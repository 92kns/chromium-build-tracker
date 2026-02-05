#!/usr/bin/env python3
"""
Chromium Build Tracker - Main CLI
"""

import os
import sys
import argparse
import webbrowser
import subprocess
from pathlib import Path
from typing import Optional
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.parse

from fetcher import fetch_all
from detector import ChangeDetector
from history import CommitHistoryFetcher


class GitilesProxyHandler(SimpleHTTPRequestHandler):
    """HTTP handler that proxies Gitiles API requests and adds CORS headers"""

    def end_headers(self):
        """Add CORS headers to all responses"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        """Handle GET requests - proxy Gitiles API or serve static files"""
        if self.path.startswith('/api/gitiles/'):
            self.proxy_gitiles_request()
        else:
            super().do_GET()

    def proxy_gitiles_request(self):
        """Proxy request to Gitiles (chromium.googlesource.com or other hosts)"""
        try:
            # Extract the path after /api/gitiles/
            # Format: /api/gitiles/{host}/{project}/+log/...
            gitiles_path = self.path[len('/api/gitiles/'):]
            gitiles_url = f'https://{gitiles_path}'

            # Fetch from Gitiles
            with urllib.request.urlopen(gitiles_url) as response:
                data = response.read()

                # Send response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data)

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(f'Error proxying request: {e}'.encode())


def get_github_token() -> Optional[str]:
    """Get GitHub token from environment variable"""
    return os.environ.get('GITHUB_TOKEN')


def fetch_command(args):
    """Fetch latest changes and detect differences"""
    print("=" * 60)
    print("Chromium Build Tracker - Fetching Changes")
    print("=" * 60)

    # Get GitHub token
    github_token = get_github_token()
    if not github_token:
        print("\n⚠️  No GITHUB_TOKEN found in environment.")
        print("   Consider setting one to avoid rate limits:")
        print("   export GITHUB_TOKEN=your_token_here\n")

    # Fetch data
    try:
        data = fetch_all(github_token)
    except Exception as e:
        print(f"\n✗ Error fetching data: {e}")
        sys.exit(1)

    # Detect changes
    detector = ChangeDetector()

    print("\n=== Detecting Changes ===")
    changes = detector.detect_changes(data)

    # Save snapshot
    detector.save_snapshot(data)

    # Save changes
    if changes:
        detector.save_changes(changes)
        print(f"\n✓ Detected {len(changes)} changes!")

        # Print summary
        print("\nChanges Summary:")
        for change in changes:
            icon = {
                'added': '➕',
                'modified': '📝',
                'removed': '➖'
            }.get(change['type'], '•')

            print(f"  {icon} [{change['repo']}] {change['file']}")
            print(f"     {change['summary']}")
    else:
        print("\n✓ No changes detected since last run.")

    # Auto-serve if requested
    if args.serve:
        print("\n" + "=" * 60)
        serve_command(args)


def serve_command(args):
    """Generate dashboard and open in browser"""
    print("=" * 60)
    print("Chromium Build Tracker - Starting Dashboard")
    print("=" * 60)

    # Ensure TypeScript is compiled
    dashboard_dir = Path(__file__).parent.parent / "dashboard"
    app_js = dashboard_dir / "app.js"

    if not app_js.exists() or getattr(args, 'rebuild', False):
        print("\nCompiling TypeScript...")
        try:
            # Check if npm dependencies are installed
            node_modules = dashboard_dir / "node_modules"
            if not node_modules.exists():
                print("Installing dependencies...")
                subprocess.run(["npm", "install"], cwd=dashboard_dir, check=True)

            # Compile TypeScript
            subprocess.run(["npm", "run", "build"], cwd=dashboard_dir, check=True)
            print("✓ TypeScript compiled successfully")
        except subprocess.CalledProcessError as e:
            print(f"\n✗ Error compiling TypeScript: {e}")
            print("   Make sure Node.js and npm are installed")
            sys.exit(1)
        except FileNotFoundError:
            print("\n✗ npm not found. Please install Node.js")
            sys.exit(1)

    # Start HTTP server with Gitiles proxy
    print("\n🚀 Starting local server with Gitiles proxy...")
    print(f"   Dashboard: http://localhost:8000")
    print("   Press Ctrl+C to stop\n")

    # Open browser
    webbrowser.open("http://localhost:8000")

    # Start HTTP server in dashboard directory
    try:
        os.chdir(dashboard_dir)
        server = HTTPServer(('localhost', 8000), GitilesProxyHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n✓ Server stopped")


def history_command(args):
    """Fetch and display commit history"""
    print("=" * 60)
    print("Chromium Build Tracker - Commit History")
    print("=" * 60)

    fetcher = CommitHistoryFetcher()

    # Fetch commits
    commits = fetcher.fetch_all_commits(
        since=args.since,
        until=args.until,
        limit=args.limit
    )

    if not commits:
        print("\n⚠ No commits found in the specified date range.")
        return

    # Display summary
    print("\n" + "=" * 60)
    print("COMMIT SUMMARY")
    print("=" * 60)
    summary = fetcher.format_commits_summary(commits)
    print(summary)

    # Optionally save to file
    if args.output:
        output_path = Path(args.output)
        with open(output_path, 'w') as f:
            f.write(summary)
        print(f"\n✓ Saved to {output_path}")


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Track changes in Chromium build instructions"
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Fetch command
    fetch_parser = subparsers.add_parser('fetch', help='Fetch latest changes')
    fetch_parser.add_argument(
        '--serve',
        action='store_true',
        help='Open dashboard after fetching'
    )

    # Serve command
    serve_parser = subparsers.add_parser('serve', help='Start dashboard server')
    serve_parser.add_argument(
        '--rebuild',
        action='store_true',
        help='Rebuild TypeScript before serving'
    )

    # History command
    history_parser = subparsers.add_parser(
        'history',
        help='View commit history for tracked files'
    )
    history_parser.add_argument(
        '--since',
        type=str,
        help='Start date (ISO format: YYYY-MM-DD)'
    )
    history_parser.add_argument(
        '--until',
        type=str,
        help='End date (ISO format: YYYY-MM-DD)'
    )
    history_parser.add_argument(
        '--limit',
        type=int,
        default=100,
        help='Maximum commits per file (default: 100)'
    )
    history_parser.add_argument(
        '--output',
        type=str,
        help='Save output to file'
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == 'fetch':
        fetch_command(args)
    elif args.command == 'serve':
        serve_command(args)
    elif args.command == 'history':
        history_command(args)


if __name__ == '__main__':
    main()

"""Fetches commit history for tracked files"""

import requests
from typing import Dict, List, Optional
from datetime import datetime
from dateutil import parser as date_parser

from config import CHROMIUM_FILES


class CommitHistoryFetcher:
    """Fetches commit history from GitHub API"""

    def __init__(self):
        self.base_url = "https://api.github.com"
        self.repo = "chromium/chromium"

    def fetch_commits(
        self,
        file_path: str,
        since: Optional[str] = None,
        until: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        Fetch commit history for a specific file

        Args:
            file_path: Path to file in repo
            since: ISO date string (e.g., "2024-10-01")
            until: ISO date string (e.g., "2024-11-01")
            limit: Maximum number of commits to fetch

        Returns:
            List of commits with metadata
        """
        url = f"{self.base_url}/repos/{self.repo}/commits"

        params = {
            'path': file_path,
            'per_page': min(limit, 100)
        }

        if since:
            params['since'] = since
        if until:
            params['until'] = until

        try:
            print(f"  Fetching commits for {file_path}...")
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            commits = response.json()

            results = []
            for commit in commits:
                commit_data = commit.get('commit', {})

                results.append({
                    'sha': commit['sha'][:7],
                    'full_sha': commit['sha'],
                    'message': commit_data.get('message', '').split('\n')[0],  # First line only
                    'full_message': commit_data.get('message', ''),
                    'author': commit_data.get('author', {}).get('name', 'Unknown'),
                    'date': commit_data.get('author', {}).get('date', ''),
                    'url': commit.get('html_url', ''),
                    'file': file_path
                })

            print(f"    ✓ Found {len(results)} commits")
            return results

        except requests.RequestException as e:
            print(f"    ✗ Error fetching commits: {e}")
            return []

    def fetch_all_commits(
        self,
        since: Optional[str] = None,
        until: Optional[str] = None,
        limit: int = 100
    ) -> Dict[str, List[Dict]]:
        """
        Fetch commit history for all tracked files

        Args:
            since: ISO date string (e.g., "2024-10-01")
            until: ISO date string (e.g., "2024-11-01")
            limit: Maximum commits per file

        Returns:
            Dict mapping file paths to their commit history
        """
        print(f"\n=== Fetching Commit History ===")
        if since or until:
            date_range = []
            if since:
                date_range.append(f"since {since}")
            if until:
                date_range.append(f"until {until}")
            print(f"Date range: {' '.join(date_range)}")
        else:
            print(f"Fetching recent commits (no date filter)")

        all_commits = {}

        for doc_path in CHROMIUM_FILES:
            commits = self.fetch_commits(doc_path, since, until, limit)
            if commits:
                all_commits[doc_path] = commits

        total_commits = sum(len(commits) for commits in all_commits.values())
        print(f"\n✓ Total commits found: {total_commits} across {len(all_commits)} files")

        return all_commits

    def get_file_at_commit(self, file_path: str, commit_sha: str) -> Optional[str]:
        """
        Fetch file content at a specific commit

        Args:
            file_path: Path to file
            commit_sha: Commit SHA

        Returns:
            File content as string, or None if error
        """
        # Use raw.githubusercontent.com to get file at specific commit
        url = f"https://raw.githubusercontent.com/{self.repo}/{commit_sha}/{file_path}"

        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            print(f"    ✗ Error fetching file at {commit_sha[:7]}: {e}")
            return None

    def format_commits_summary(self, all_commits: Dict[str, List[Dict]]) -> str:
        """
        Format commits into a human-readable summary

        Args:
            all_commits: Dict of file paths to commit lists

        Returns:
            Formatted string summary
        """
        if not all_commits:
            return "No commits found in the specified date range."

        output = []

        for file_path, commits in sorted(all_commits.items()):
            output.append(f"\n{file_path}")
            output.append("=" * len(file_path))
            output.append(f"{len(commits)} commits:\n")

            for commit in commits:
                date = commit['date']
                if date:
                    # Parse and format date
                    dt = date_parser.parse(date)
                    date_str = dt.strftime("%Y-%m-%d %H:%M")
                else:
                    date_str = "Unknown date"

                output.append(f"  {commit['sha']} - {date_str}")
                output.append(f"    {commit['author']}: {commit['message']}")
                output.append(f"    {commit['url']}\n")

        return '\n'.join(output)

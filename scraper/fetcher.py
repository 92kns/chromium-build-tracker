"""Fetches files from GitHub repositories and Chromium source"""

import os
import base64
import requests
from typing import Dict, List, Optional
from datetime import datetime
from github import Github, GithubException
import fnmatch

from config import (
    CHROMIUM_SOURCE_BASE, CHROMIUM_BROWSE_BASE, CHROMIUM_FILES,
    DEPOT_TOOLS_SOURCE_BASE, DEPOT_TOOLS_BROWSE_BASE, DEPOT_TOOLS_FILES
)


class GitHubFetcher:
    """Fetches content from GitHub repositories"""

    def __init__(self, token: Optional[str] = None):
        """
        Initialize GitHub API client

        Args:
            token: GitHub personal access token (optional, but increases rate limits)
        """
        self.github = Github(token) if token else Github()

    def fetch_chromium_docs(self) -> Dict[str, Dict]:
        """
        Fetch Chromium build files from GitHub raw mirror

        Returns:
            Dict mapping file paths to their content and metadata
        """
        print(f"Fetching Chromium files from GitHub mirror...")

        results = {}
        for doc_path in CHROMIUM_FILES:
            try:
                # Fetch from GitHub raw mirror
                url = f"{CHROMIUM_SOURCE_BASE}/{doc_path}"
                response = requests.get(url, timeout=30)
                response.raise_for_status()

                # Content is plain text
                content = response.text

                # Browser URL for viewing on source.chromium.org
                browser_url = f"{CHROMIUM_BROWSE_BASE}:{doc_path}"

                results[doc_path] = {
                    'content': content,
                    'sha': None,
                    'last_modified': datetime.now().isoformat(),
                    'url': browser_url,
                    'size': len(content)
                }
                print(f"  ✓ Fetched {doc_path}")
            except requests.RequestException as e:
                print(f"  ✗ Error fetching {doc_path}: {e}")
            except Exception as e:
                print(f"  ✗ Unexpected error fetching {doc_path}: {e}")

        return results

    def fetch_depot_tools(self) -> Dict[str, Dict]:
        """
        Fetch depot_tools files from GitHub raw mirror

        Returns:
            Dict mapping file paths to their content and metadata
        """
        print(f"Fetching depot_tools from GitHub mirror...")

        results = {}
        for file_path in DEPOT_TOOLS_FILES:
            try:
                # Fetch from GitHub raw mirror
                url = f"{DEPOT_TOOLS_SOURCE_BASE}/{file_path}"
                response = requests.get(url, timeout=30)
                response.raise_for_status()

                # Content is plain text
                content = response.text

                # Browser URL for viewing
                browser_url = f"{DEPOT_TOOLS_BROWSE_BASE}/{file_path}"

                results[file_path] = {
                    'content': content,
                    'sha': None,
                    'last_modified': datetime.now().isoformat(),
                    'url': browser_url,
                    'size': len(content)
                }
                print(f"  ✓ Fetched {file_path}")
            except requests.RequestException as e:
                print(f"  ✗ Error fetching {file_path}: {e}")
            except Exception as e:
                print(f"  ✗ Unexpected error fetching {file_path}: {e}")

        return results


def fetch_all(github_token: Optional[str] = None) -> Dict[str, Dict]:
    """
    Fetch all tracked files from both repositories

    Args:
        github_token: Optional GitHub token for higher rate limits

    Returns:
        Dict with 'chromium' and 'depot_tools' keys containing fetched data
    """
    fetcher = GitHubFetcher(github_token)

    print("\n=== Fetching Chromium Documentation ===")
    chromium_docs = fetcher.fetch_chromium_docs()

    print("\n=== Fetching depot_tools ===")
    print("  Note: depot_tools tracking not yet implemented (no GitHub mirror available)")
    depot_tools = {}
    # TODO: Implement depot_tools fetching from Gitiles API
    # depot_tools = fetcher.fetch_depot_tools()

    print(f"\n✓ Total files fetched: {len(chromium_docs) + len(depot_tools)}")

    return {
        'chromium': chromium_docs,
        'depot_tools': depot_tools,
        'timestamp': datetime.now().isoformat()
    }

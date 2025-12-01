"""Detects changes between snapshots and generates diffs"""

import os
import json
import difflib
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from pathlib import Path


class ChangeDetector:
    """Detects and tracks changes in fetched content"""

    def __init__(self, data_dir: str = "../data"):
        """
        Initialize change detector

        Args:
            data_dir: Directory to store snapshots and change data
        """
        self.data_dir = Path(data_dir)
        self.snapshots_dir = self.data_dir / "snapshots"
        self.changes_file = self.data_dir / "changes.json"

        # Create directories if they don't exist
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)

    def load_latest_snapshot(self) -> Optional[Dict]:
        """
        Load the most recent snapshot

        Returns:
            Latest snapshot data or None if no snapshots exist
        """
        snapshot_files = sorted(self.snapshots_dir.glob("snapshot_*.json"))

        if not snapshot_files:
            return None

        latest = snapshot_files[-1]
        with open(latest, 'r') as f:
            return json.load(f)

    def save_snapshot(self, data: Dict) -> str:
        """
        Save a snapshot with timestamp

        Args:
            data: Snapshot data to save

        Returns:
            Path to saved snapshot file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        snapshot_file = self.snapshots_dir / f"snapshot_{timestamp}.json"

        with open(snapshot_file, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"✓ Snapshot saved to {snapshot_file}")
        return str(snapshot_file)

    def detect_changes(self, new_data: Dict, old_data: Optional[Dict] = None) -> List[Dict]:
        """
        Detect changes between new data and previous snapshot

        Args:
            new_data: Newly fetched data
            old_data: Previous snapshot (if None, loads latest)

        Returns:
            List of changes detected
        """
        if old_data is None:
            old_data = self.load_latest_snapshot()

        if old_data is None:
            print("No previous snapshot found - this is the initial run")
            return []

        changes = []

        # Check chromium docs
        changes.extend(self._detect_repo_changes(
            'chromium',
            new_data.get('chromium', {}),
            old_data.get('chromium', {})
        ))

        # Check depot_tools
        changes.extend(self._detect_repo_changes(
            'depot_tools',
            new_data.get('depot_tools', {}),
            old_data.get('depot_tools', {})
        ))

        return changes

    def _filter_deps_content(self, content: str) -> str:
        """
        Filter DEPS file to only include platform-relevant sections

        Args:
            content: Full DEPS file content

        Returns:
            Filtered content with only relevant platforms
        """
        lines = content.splitlines(keepends=True)
        filtered_lines = []
        include_line = True
        platform_keywords = ['windows', 'win', 'linux', 'mac', 'darwin', 'android']

        for line in lines:
            lower_line = line.lower()

            # Check if line mentions any relevant platform
            has_relevant_platform = any(keyword in lower_line for keyword in platform_keywords)

            # Skip lines that mention other platforms (like iOS, fuchsia, etc)
            skip_platforms = ['ios', 'fuchsia', 'chromeos', 'lacros']
            has_skip_platform = any(keyword in lower_line for keyword in skip_platforms)

            # Include lines that either:
            # 1. Don't mention any platform (general config)
            # 2. Mention a relevant platform
            # And don't mention skip platforms
            if has_skip_platform and not has_relevant_platform:
                continue

            filtered_lines.append(line)

        return ''.join(filtered_lines)

    def _detect_repo_changes(self, repo_name: str, new_files: Dict, old_files: Dict) -> List[Dict]:
        """
        Detect changes for a specific repository

        Args:
            repo_name: Name of the repository
            new_files: New file data
            old_files: Old file data

        Returns:
            List of changes detected
        """
        changes = []

        # Find new files
        new_paths = set(new_files.keys())
        old_paths = set(old_files.keys())

        added_files = new_paths - old_paths
        removed_files = old_paths - new_paths
        common_files = new_paths & old_paths

        # Track added files
        for file_path in added_files:
            changes.append({
                'repo': repo_name,
                'file': file_path,
                'type': 'added',
                'timestamp': datetime.now().isoformat(),
                'url': new_files[file_path].get('url'),
                'summary': f"New file added: {file_path}"
            })

        # Track removed files
        for file_path in removed_files:
            changes.append({
                'repo': repo_name,
                'file': file_path,
                'type': 'removed',
                'timestamp': datetime.now().isoformat(),
                'url': old_files[file_path].get('url'),
                'summary': f"File removed: {file_path}"
            })

        # Check for modifications
        for file_path in common_files:
            old_content = old_files[file_path]['content']
            new_content = new_files[file_path]['content']

            # Apply DEPS filtering if this is the DEPS file
            if file_path == 'DEPS':
                old_content = self._filter_deps_content(old_content)
                new_content = self._filter_deps_content(new_content)

            if old_content != new_content:
                diff_html = self._generate_diff(old_content, new_content, file_path)
                change_summary = self._summarize_change(old_content, new_content)

                changes.append({
                    'repo': repo_name,
                    'file': file_path,
                    'type': 'modified',
                    'timestamp': datetime.now().isoformat(),
                    'url': new_files[file_path].get('url'),
                    'summary': change_summary,
                    'diff_html': diff_html,
                    'old_sha': old_files[file_path].get('sha'),
                    'new_sha': new_files[file_path].get('sha')
                })

        return changes

    def _generate_diff(self, old_content: str, new_content: str, filename: str) -> str:
        """
        Generate HTML diff between two versions

        Args:
            old_content: Old file content
            new_content: New file content
            filename: Name of the file

        Returns:
            HTML formatted diff
        """
        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)

        diff = difflib.HtmlDiff(wrapcolumn=80)
        html_diff = diff.make_table(
            old_lines,
            new_lines,
            fromdesc=f"{filename} (previous)",
            todesc=f"{filename} (current)",
            context=True,
            numlines=3
        )

        return html_diff

    def _summarize_change(self, old_content: str, new_content: str) -> str:
        """
        Generate a summary of what changed

        Args:
            old_content: Old file content
            new_content: New file content

        Returns:
            Human-readable summary
        """
        old_lines = old_content.splitlines()
        new_lines = new_content.splitlines()

        differ = difflib.Differ()
        diff = list(differ.compare(old_lines, new_lines))

        additions = sum(1 for line in diff if line.startswith('+ '))
        deletions = sum(1 for line in diff if line.startswith('- '))

        summary_parts = []
        if additions:
            summary_parts.append(f"+{additions} lines")
        if deletions:
            summary_parts.append(f"-{deletions} lines")

        return f"Modified: {', '.join(summary_parts)}"

    def save_changes(self, changes: List[Dict]) -> None:
        """
        Append changes to the changes log

        Args:
            changes: List of changes to save
        """
        # Load existing changes
        existing_changes = []
        if self.changes_file.exists():
            with open(self.changes_file, 'r') as f:
                existing_changes = json.load(f)

        # Append new changes
        existing_changes.extend(changes)

        # Save back
        with open(self.changes_file, 'w') as f:
            json.dump(existing_changes, f, indent=2)

        print(f"✓ {len(changes)} changes logged to {self.changes_file}")

    def get_all_changes(self) -> List[Dict]:
        """
        Get all tracked changes

        Returns:
            List of all changes
        """
        if not self.changes_file.exists():
            return []

        with open(self.changes_file, 'r') as f:
            return json.load(f)

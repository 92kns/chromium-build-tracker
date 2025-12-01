# Chromium Build Tracker - Project Context

## Project Overview

**Chromium Build Tracker** is a tool that tracks changes in Chromium build instructions and configuration files to help prevent CI build breaks.

### Purpose
At your company, you build custom Chromium in CI that sometimes breaks for obscure reasons. This tool helps you:
- Track changes to build instructions automatically
- Get alerts when something changes that might affect your builds
- View diffs to see exactly what changed
- Stay ahead of breaking changes before they hit your CI

## Repository Information

- **GitHub Repository**: https://github.com/92kns/chromium-build-tracker
- **GitHub Pages Dashboard**: https://92kns.github.io/chromium-build-tracker/
- **Local Path**: `/Users/kshampur/scrapyard/chromium_detect`
- **Git Author**: KS <ks@local> (configured for privacy)
- **Default Branch**: main
- **Additional Branch**: gh-pages (for GitHub Pages)

## Project Structure

```
chromium_detect/
├── README.md              # Main documentation
├── .gitignore            # Git ignore rules
├── scraper/              # Python scraper application
│   ├── main.py          # CLI entry point
│   ├── fetcher.py       # Fetches from GitHub
│   ├── detector.py      # Detects changes & generates diffs
│   ├── config.py        # Configuration (what to track)
│   ├── history.py       # GitHub commit history fetcher
│   └── requirements.txt # Python dependencies
├── dashboard/            # TypeScript/JavaScript dashboard
│   ├── index.html       # Dashboard UI
│   ├── app.ts          # TypeScript source
│   ├── app.js          # Compiled JavaScript
│   ├── styles.css      # Styling
│   ├── package.json    # Node.js dependencies
│   └── node_modules/   # (gitignored)
└── data/
    ├── snapshots/       # Historical snapshots (gitignored)
    └── changes.json     # Change log

```

## What It Tracks

**13 Critical Chromium Files:**

### Build Documentation (4 files)
- `docs/linux/build_instructions.md`
- `docs/mac_build_instructions.md`
- `docs/windows_build_instructions.md`
- `docs/android_build_instructions.md`

### Configuration Files (3 files)
- `DEPS` - Main dependency file (GN, clang, buildtools versions)
- `build/config/android/config.gni` - Android NDK/SDK versions
- `build/config/mac/mac_sdk.gni` - macOS SDK and deployment target

### Toolchain Setup Scripts (6 files)
- `build/config/win/visual_studio_version.gni` - Windows SDK/MSVC versions
- `build/install-build-deps.sh` - Linux dependency installer
- `build/install-build-deps.py` - Linux dependency installer (Python)
- `build/vs_toolchain.py` - Windows Visual Studio setup
- `build/mac_toolchain.py` - macOS Xcode setup
- `.vpython3` - Python dependencies specification

## Key Features

### 1. Snapshot-based Tracking
- Fetches current versions of tracked files
- Compares with previous snapshot
- Detects and logs changes (added/modified/removed)
- Generates HTML diffs for visual comparison

### 2. Interactive Dashboard (3 tabs)

**Tab 1: Tracked Changes**
- Statistics: total changes, changes by repo, last check time
- Filters: view all or filter by type (added/modified/removed)
- Change cards with summaries and links
- Diff viewer: click "View Diff" to see exact changes

**Tab 2: Commit History**
- Interactive date range picker for any time period
- Quick ranges: last 7/30/90 days
- Live GitHub API fetching (no backend needed)
- Commits grouped by file
- Works as pure static site (GitHub Pages compatible)

**Tab 3: Settings**
- Add GitHub personal access token
- Increases rate limits from 60 to 5000 requests/hour
- Token stored only in browser localStorage

### 3. CLI Commands

```bash
# Fetch and track changes
python3 scraper/main.py fetch

# View dashboard
python3 scraper/main.py serve

# Fetch and view in one command
python3 scraper/main.py fetch --serve

# View commit history
python3 scraper/main.py history --since "2024-10-01" --until "2024-11-01"
python3 scraper/main.py history --limit 50
python3 scraper/main.py history --output changes.txt
```

## Setup Instructions

### Initial Setup

```bash
# 1. Install Python dependencies
pip install -r scraper/requirements.txt

# 2. Install Node.js dependencies
cd dashboard
npm install
cd ..

# 3. Create baseline snapshot
python3 scraper/main.py fetch
```

### Regular Usage

```bash
# Periodically fetch changes (daily recommended)
python3 scraper/main.py fetch

# View dashboard when needed
python3 scraper/main.py serve

# Investigate when CI breaks
python3 scraper/main.py history --since "YYYY-MM-DD" --until "YYYY-MM-DD"
```

## Git Configuration

### Current Setup
- **Branch**: main (default)
- **Remote**: origin (https://github.com/92kns/chromium-build-tracker.git)
- **Author**: KS <ks@local>
- **gh-pages branch**: Contains dashboard files for GitHub Pages

### Important Git Commands
```bash
# Pull latest changes
git pull origin main

# Push changes
git add .
git commit -m "Your message"
git push origin main

# Update dashboard (if modified)
git checkout gh-pages
# Copy updated dashboard files
git add .
git commit -m "Update dashboard"
git push origin gh-pages
git checkout main
```

## GitHub Pages Setup

The dashboard is hosted on GitHub Pages from the `gh-pages` branch.

**Files in gh-pages branch (at root):**
- `index.html`
- `app.js`
- `styles.css`
- `changes.json`

**To update GitHub Pages:**
1. Make changes to dashboard files in `main` branch
2. Switch to `gh-pages` branch
3. Copy updated files from `main` branch
4. Commit and push

**Dashboard URL**: https://92kns.github.io/chromium-build-tracker/

## Dependencies

### Python (scraper/requirements.txt)
```
requests
beautifulsoup4
difflib (built-in)
```

### Node.js (dashboard/package.json)
```json
{
  "dependencies": {
    "typescript": "^5.0.0"
  }
}
```

## Common Workflows

### When CI Breaks
1. Check the dashboard for recent tracked changes
2. Use commit history to see what changed around the break date:
   ```bash
   python3 scraper/main.py history --since "YYYY-MM-DD" --until "YYYY-MM-DD"
   ```
3. Review the diffs to understand what changed
4. Update your build process accordingly

### Weekly Review
```bash
# Check last 7 days of changes
python3 scraper/main.py history --since "$(date -d '7 days ago' +%Y-%m-%d)"
```

### Adding New Files to Track
1. Edit `scraper/config.py`
2. Add new file paths to the tracking configuration
3. Run `python3 scraper/main.py fetch` to create baseline

## Technology Stack

- **Backend**: Python 3.11+
  - requests (HTTP client)
  - BeautifulSoup4 (HTML parsing)
  - difflib (diff generation)

- **Frontend**: TypeScript + Vanilla JS
  - No frameworks
  - GitHub API integration
  - LocalStorage for settings

- **Hosting**: GitHub Pages (static site)

## Future Improvements

- depot_tools tracking (needs Gitiles API - no GitHub mirror exists)
- Email/Slack notifications on changes
- RSS feed for changes
- More detailed section-level tracking within files
- CI environment comparison with docs
- Go rewrite for single binary distribution

## Notes

- The `data/snapshots/` directory is gitignored to avoid repo bloat
- The `changes.json` is committed to provide data for GitHub Pages
- Node modules are gitignored
- Python `__pycache__` is gitignored
- The dashboard works as a pure static site with no backend needed

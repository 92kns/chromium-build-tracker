# Chromium Build Tracker

Tracks changes in Chromium build instructions and key files that might affect your custom Chromium builds.

## What it tracks

**Chromium build documentation:**
- `docs/linux/build_instructions.md` - Linux build setup
- `docs/mac_build_instructions.md` - macOS build setup
- `docs/windows_build_instructions.md` - Windows build setup
- `docs/android_build_instructions.md` - Android build setup

**Critical build configuration files:**
- `DEPS` - Main dependency file (GN, clang, buildtools versions)
- `build/config/android/config.gni` - Android NDK/SDK versions
- `build/config/mac/mac_sdk.gni` - macOS SDK and deployment target
- `build/config/win/visual_studio_version.gni` - Windows SDK/MSVC versions

**Toolchain setup scripts:**
- `build/install-build-deps.sh` - Linux dependency installer
- `build/install-build-deps.py` - Linux dependency installer (Python)
- `build/vs_toolchain.py` - Windows Visual Studio setup
- `build/mac_toolchain.py` - macOS Xcode setup
- `.vpython3` - Python dependencies specification

**Total: 13 files tracked** (4 docs + 9 critical build files)

## Why this exists

Chromium sometimes breaks for obscure reasons. This tool helps you:
- **Track changes** to build instructions automatically
- **Get alerts** when something changes that might affect your builds
- **View diffs** to see exactly what changed
- **Stay ahead** of breaking changes before they hit your CI

## Setup

### 1. Install Python dependencies

```bash
pip install -r scraper/requirements.txt
```

### 2. Install Node.js dependencies (for dashboard)

```bash
cd dashboard
npm install
cd ..
```

### 3. First fetch (establishes baseline)

```bash
python3 scraper/main.py fetch
```

This creates the first snapshot. Subsequent runs will detect changes.

## Usage

### Fetch latest changes

```bash
python3 scraper/main.py fetch
```

This will:
- Fetch current versions of tracked files
- Compare with previous snapshot
- Detect and log any changes
- Save new snapshot

### View the dashboard

```bash
python3 scraper/main.py serve
```

This will:
- Compile TypeScript (if needed)
- Start local HTTP server on port 8000
- Open dashboard in your browser

The dashboard has **3 tabs**:

**1. Tracked Changes** - Snapshot-based tracking
- Stats: Total changes, changes by repo, last check time
- Filters: View all or filter by type (added/modified/removed)
- Change cards with summaries and links
- Diff viewer: Click "View Diff" to see exact changes

**2. Commit History** 
- **Interactive date range picker** - Query any time period
- **Quick ranges** - Last 7/30/90 days with one click
- **Live GitHub API fetching** - No backend needed!
- **Grouped by file** - See commits organized by document
- Works as pure static site (GitHub Pages compatible)

**3. Settings**
- Add GitHub personal access token
- Increase rate limits from 60 to 5000 requests/hour
- Token stored only in browser localStorage

### Fetch and view in one command

```bash
python3 scraper/main.py fetch --serve
```

### View commit history (NEW!)

This is super useful for correlating CI breaks with documentation changes:

```bash
# View all commits from the last month
python3 scraper/main.py history --since "2024-10-01" --until "2024-11-01"

# View recent commits (no date filter)
python3 scraper/main.py history --limit 50

# Save to file for later analysis
python3 scraper/main.py history --since "2024-10-01" --output changes.txt
```

**Example output:**
```
docs/windows_build_instructions.md
==================================
2 commits:

  0d018f5 - 2024-11-18 11:10
    Henrique Ferreiro: Remove recommendation to disable pgo with cc_wrapper on Windows
    https://github.com/chromium/chromium/commit/0d018f5...

  ea1232d - 2024-10-31 17:01
    Devon Loehr: Revert "Update windows SDK version to 10.0.26100.1742"
    https://github.com/chromium/chromium/commit/ea1232d...
```

**Common use cases:**
- Your CI broke on Nov 15? Check what changed: `--since "2024-11-01" --until "2024-11-20"`
- Building on Windows and getting weird errors? Check Windows docs: just grep the output
- Weekly review of all changes: `--since "$(date -d '7 days ago' +%Y-%m-%d)"`

## How it works

1. **Scraper** fetches markdown files from Chromium's GitHub mirror
2. **Detector** compares with previous snapshot (stored in `data/snapshots/`)
3. **Diff generator** creates HTML diffs for modified files
4. **Changes log** stores all detected changes in `data/changes.json`
5. **Dashboard** reads the changes and displays them with filters and diffs



## Project structure

```
chromium_detect/
├── README.md              # This file
├── scraper/
│   ├── main.py           # CLI entry point
│   ├── fetcher.py        # Fetches from GitHub
│   ├── detector.py       # Detects changes & generates diffs
│   ├── config.py         # Configuration (what to track)
│   └── requirements.txt  # Python dependencies
├── dashboard/
│   ├── index.html        # Dashboard UI
│   ├── app.ts           # TypeScript application
│   ├── app.js           # Compiled JavaScript (generated)
│   ├── styles.css       # Styling
│   └── package.json     # Node.js dependencies
└── data/
    ├── snapshots/       # Historical snapshots (timestamped)
    └── changes.json     # Change log

```

## Quick Reference

### All Commands

```bash
# Fetch and track changes (compares with last snapshot)
python3 scraper/main.py fetch
python3 scraper/main.py fetch --serve  # Also open dashboard

# View dashboard
python3 scraper/main.py serve
python3 scraper/main.py serve --rebuild  # Rebuild TypeScript first

# View commit history
python3 scraper/main.py history                    # Recent commits
python3 scraper/main.py history --since 2024-10-01  # From date
python3 scraper/main.py history --since 2024-10-01 --until 2024-11-01  # Date range
python3 scraper/main.py history --limit 50         # Limit results
python3 scraper/main.py history --output file.txt  # Save to file
```

### Typical Workflow

```bash
# 1. Initial setup (one time)
pip install -r scraper/requirements.txt
cd dashboard && npm install && cd ..

# 2. Create baseline
python3 scraper/main.py fetch

# 3. Run periodically (cron/GitHub Actions)
python3 scraper/main.py fetch

# 4. When CI breaks, investigate
python3 scraper/main.py history --since "2024-10-15" --until "2024-11-20"

# 5. View accumulated changes
python3 scraper/main.py serve
```

## Future improvements

- **depot_tools tracking** - Currently not implemented (no GitHub mirror, needs Gitiles API)
- **Go version** - Once prototype is solid, translate to Go for single binary
- **Email/Slack notifications** - Alert on changes
- **RSS feed** - Subscribe to changes
- **More detailed tracking** - Track specific sections within files
- **CI integration** - Compare your CI environment with docs
- **Diff viewing in history command** - Show actual file diffs for each commit

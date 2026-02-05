# Chromium Build Tracker

Tracks changes in Chromium, V8, and depot_tools build instructions and key files that might affect your custom builds.

## Tracked Repositories

### 1. Chromium (13 files tracked)

**Build documentation:**
- `docs/linux/build_instructions.md` - Linux build setup
- `docs/mac_build_instructions.md` - macOS build setup
- `docs/windows_build_instructions.md` - Windows build setup
- `docs/android_build_instructions.md` - Android build setup

**Critical build configuration files:**
- `DEPS` - Main dependency file (GN, clang, buildtools versions)
  - *Filtered to show only Windows, Linux, Mac/Darwin, and Android changes*
- `build/config/android/config.gni` - Android NDK/SDK versions
- `build/config/mac/mac_sdk.gni` - macOS SDK and deployment target
- `build/config/win/visual_studio_version.gni` - Windows SDK/MSVC versions

**Toolchain setup scripts:**
- `build/install-build-deps.sh` - Linux dependency installer
- `build/install-build-deps.py` - Linux dependency installer (Python)
- `build/vs_toolchain.py` - Windows Visual Studio setup
- `build/mac_toolchain.py` - macOS Xcode setup
- `.vpython3` - Python virtual environment configuration

**Data sources:**
- GitHub: https://github.com/chromium/chromium (mirror, sometimes stale)
- Gitiles: https://chromium.googlesource.com/chromium/src (official, always current)

### 2. V8 Engine (6 files tracked)

**Core build and development files:**
- `README.md` - V8 overview and build instructions
- `DEPS` - V8 dependencies
- `BUILD.gn` - Main GN build configuration
- `infra/mb/mb_config.pyl` - Multi-build configuration
- `tools/dev/gm.py` - Build tool helper
- `tools/dev/v8gen.py` - V8 build configuration generator

**Data sources:**
- GitHub: https://github.com/v8/v8 (mirror, sometimes stale)
- Gitiles: https://chromium.googlesource.com/v8/v8 (official, always current)

### 3. depot_tools (6 files tracked)

**Key tool files:**
- `README.md` - depot_tools documentation
- `gclient.py` - Main checkout/sync tool
- `gclient_utils.py` - Gclient utilities
- `git_cl.py` - Code review tool
- `autoninja.py` - Optimized ninja wrapper
- `cipd_manifest.txt` - CIPD package manifest

**Data sources:**
- Gitiles: https://chromium.googlesource.com/chromium/tools/depot_tools (official, always current)
- Note: No GitHub mirror exists for depot_tools

## Why this exists

Chromium sometimes breaks for obscure reasons. This tool helps you:
- **Track changes** to build instructions automatically
- **Get alerts** when something changes that might affect your builds
- **View diffs** to see exactly what changed
- **Stay ahead** of breaking changes before they hit your CI

## Setup

### 1. Install Python dependencies

Using `uv` (recommended - much faster):
```bash
uv pip install -r scraper/requirements.txt
```

Or using pip:
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

The dashboard has **2 tabs**:

**1. Tracked Changes** - Snapshot-based tracking
- Stats: Total changes, changes by repo, last check time
- Filters: View all or filter by type (added/modified/removed)
- Change cards with summaries and links
- Diff viewer: Click "View Diff" to see exact changes

**2. Commit History**
- **Repository selector** - Choose between Chromium, V8 Engine, or depot_tools
- **Interactive date range picker** - Query any time period
- **Quick ranges** - Last 7/30/90 days with one click
- **Hybrid API approach** - Automatically uses GitHub (fast) when fresh, falls back to Gitiles (slow but always current) when stale
- **Smart source selection** - Checks GitHub mirror freshness and switches to Gitiles if outdated
- **Live logging panel** - See which API is being used and why in real-time
- **Grouped by file** - See commits organized by document
- No authentication required

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
6. **Hybrid API** - Commit history feature automatically chooses the best data source:
   - Tries GitHub API first (much faster, ~2-3 seconds)
   - Checks if GitHub mirror is fresh (commits within last 3 days)
   - Falls back to Gitiles API if GitHub is stale or unavailable (~10-15 seconds)
   - Dashboard shows which source was used: "via GitHub (faster)" or "via Gitiles (slower but up-to-date)"



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
uv pip install -r scraper/requirements.txt
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

## Data Sources

The dashboard uses a **hybrid approach** for fetching commit history:

### GitHub API (Primary - Fast)
- **Speed**: ~2-3 seconds for all files
- **When used**: When GitHub mirror is fresh (commits within last 3 days)
- **Availability**:
  - ✓ Chromium: https://github.com/chromium/chromium
  - ✓ V8: https://github.com/v8/v8
  - ✗ depot_tools: No mirror exists
- **Limitation**: GitHub mirrors occasionally go stale for days/weeks
- **No auth required**: Works without tokens (60 requests/hour limit is plenty)

### Gitiles API (Fallback - Slow but Reliable)
- **Speed**: ~10-15 seconds for all files
- **When used**: When GitHub mirror is stale, unavailable, or doesn't exist
- **Sources**:
  - Chromium: https://chromium.googlesource.com/chromium/src
  - V8: https://chromium.googlesource.com/v8/v8
  - depot_tools: https://chromium.googlesource.com/chromium/tools/depot_tools (only option)
- **Reliability**: Always up-to-date (source of truth)

The dashboard automatically detects which source to use and shows you which one was used in the live logging panel and status message.

## Future improvements

- **depot_tools tracking** - Currently not implemented (no GitHub mirror, needs Gitiles API)
- **Go version** - Once prototype is solid, translate to Go for single binary
- **Email/Slack notifications** - Alert on changes
- **RSS feed** - Subscribe to changes
- **More detailed tracking** - Track specific sections within files
- **CI integration** - Compare your CI environment with docs
- **Diff viewing in history command** - Show actual file diffs for each commit
- **GitHub token support** - Add optional token for higher rate limits (5000/hour vs 60/hour)

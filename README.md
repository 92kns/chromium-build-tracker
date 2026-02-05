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

### Start the dashboard

```bash
python3 scraper/main.py serve
```

This will:
- Compile TypeScript (if needed)
- Start local HTTP server with Gitiles proxy on port 8000
- Open dashboard in your browser

### Using the dashboard

1. **Select a repository** - Choose Chromium, V8 Engine, or depot_tools from the dropdown
2. **Pick a date range** - Use quick ranges (7/30/90 days) or custom dates
3. **Fetch history** - Click "Fetch History" to query commits
4. **View results** - See commits grouped by file with live API logs

**Features:**
- **Repository selector** - Switch between Chromium (13 files), V8 (6 files), or depot_tools (6 files)
- **Hybrid API** - Automatically uses GitHub (fast) or Gitiles (reliable) based on mirror freshness
- **Live logging** - See which API is being used and why in real-time
- **Request cancellation** - Switch repos without mixed results
- **Direct links** - Click through to view commits on GitHub/Gitiles


## How it works

The dashboard uses a **Hybrid API** to fetch commit history:

1. **Smart source selection**:
   - Tries GitHub API first (much faster, ~2-3 seconds)
   - Checks if GitHub mirror is fresh (commits within last 3 days)
   - Falls back to Gitiles API if GitHub is stale or unavailable (~10-15 seconds)
   - For depot_tools: Uses Gitiles only (no GitHub mirror exists)

2. **Request handling**:
   - Python proxy server handles Gitiles CORS issues
   - Parallel fetching (3 files at a time) for better performance
   - Request cancellation prevents mixed results when switching repos
   - Live logging panel shows API decisions in real-time

3. **Display**:
   - Commits grouped by file
   - Filter by date range (custom or quick ranges)
   - Direct links to view commits on GitHub or Gitiles



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

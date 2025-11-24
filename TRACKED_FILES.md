# Tracked Files Explained

## Overview

We track **13 critical files** from the Chromium repository that can affect your custom builds.

## File Categories

### 📖 Build Documentation (4 files)

These are the "official" build instructions that get updated when processes change.

**1. `docs/linux/build_instructions.md`**
- Platform: Linux
- What breaks: Dependency requirements, sysroot changes, build flags
- Example recent changes: libc++ requirement documentation, RBE setup
- Your CI: Check when Ubuntu/Debian builds fail

**2. `docs/mac_build_instructions.md`**
- Platform: macOS
- What breaks: Xcode version requirements, SDK changes, codesigning
- Example: fsmonitor warnings, ARM64 support notes
- Your CI: Check when macOS builds fail

**3. `docs/windows_build_instructions.md`**
- Platform: Windows
- What breaks: Visual Studio version, Windows SDK, PGO settings
- Example: Recently removed PGO+ccache recommendation
- Your CI: Check when Windows builds fail

**4. `docs/android_build_instructions.md`**
- Platform: Android
- What breaks: NDK/SDK versions, Java requirements, build tools
- Example: Min API version bump to 26
- Your CI: Check when Android APK builds fail

---

### ⚙️ Critical Build Configs (4 files)

These are the **machine-readable** files that actually control the build.

**5. `DEPS`**
- **Most important file!**
- Contains: GN version, Ninja version, Clang revision, Buildtools revision
- Changes: Multiple times per day (rolls, updates)
- What breaks: Toolchain incompatibilities, new build tool requirements
- **High signal**: Version bumps often require environment changes

**Why track it:**
```python
# Example DEPS content (simplified)
vars = {
  'gn_version': 'git_revision:abc123',
  'clang_revision': '123456',
  'buildtools_revision': 'def456',
}
```
When these change, your CI might need updated tools.

**6. `build/config/android/config.gni`**
- Contains: `android_ndk_version`, `android_sdk_version`, `android_sdk_build_tools_version`
- Changes: Monthly
- What breaks: NDK ABI changes, new SDK requirements
- Recent: Added MacOS ARM64 host support

**Why track it:**
```gni
android_ndk_version = "r26d"  # When this bumps, your NDK needs updating
android_sdk_version = "34"     # API level requirement
```

**7. `build/config/mac/mac_sdk.gni`**
- Contains: `mac_deployment_target`, `mac_sdk_min`, SDK version pins
- Changes: Quarterly (with Xcode releases)
- What breaks: Xcode version incompatibilities, deprecated API usage

**8. `build/config/win/visual_studio_version.gni`**
- Contains: `visual_studio_version`, Windows SDK version
- Changes: Quarterly
- What breaks: MSVC compiler version mismatches, missing SDK
- Recent: SDK reverts (10.0.26100 → 10.0.22621)

---

### 🔧 Toolchain Setup Scripts (5 files)

These **install** the required tools on each platform.

**9. `build/install-build-deps.sh`**
- Platform: Linux (Debian/Ubuntu)
- What it does: Installs apt packages for building
- Changes: Rarely (new dependency added)
- What breaks: Missing system libraries
- **Run this** when: Linux builds fail with "library not found"

**10. `build/install-build-deps.py`**
- Platform: Linux (Python version)
- Same as above but Python implementation
- Tracks both to catch changes in either

**11. `build/vs_toolchain.py`**
- Platform: Windows
- What it does: Downloads/configures Visual Studio and Windows SDK
- Changes: Quarterly (SDK version bumps)
- What breaks: Missing MSVC, wrong SDK version
- Recent changes: SDK 10.0.26100 → 10.0.22621 revert

**Why this matters:**
- This script controls what gets downloaded in your CI
- SDK version changes here = your CI needs to re-provision
- Reverts indicate problems with new versions

**12. `build/mac_toolchain.py`**
- Platform: macOS
- What it does: Selects/downloads Xcode
- Changes: With each Xcode release
- What breaks: Wrong Xcode version, missing SDK

**13. `.vpython3`**
- Platform: All
- What it does: Specifies Python package versions for build scripts
- Changes: Monthly
- What breaks: Missing Python modules, version conflicts
- Recent: Python 3.8 → 3.11 migration (and revert!)

**Why this matters:**
```
# .vpython3 specifies exact versions
wheel: <
  name: "infra/python/wheels/requests-py3"
  version: "version:2.31.0"
>
```
Version bumps can break scripts that depend on specific API behavior.

---

## Change Frequency

| File | Typical Changes | Signal/Noise | Priority |
|------|----------------|--------------|----------|
| DEPS | Daily | High noise, occasional high signal | Monitor for version bumps |
| *.gni configs | Monthly | High signal | Always investigate |
| *_toolchain.py | Quarterly | Very high signal | Always investigate |
| install-build-deps.* | Rarely | Very high signal | Always investigate |
| .vpython3 | Monthly | Medium signal | Check if scripts fail |
| docs/*.md | Weekly | High signal | Always read |

## What to Watch For

### 🚨 High Priority Alerts

**1. SDK/NDK Version Changes**
```
build/config/android/config.gni:
- android_ndk_version = "r26c"
+ android_ndk_version = "r26d"
```
→ Your CI needs to update NDK!

**2. Toolchain Script Changes**
```
build/vs_toolchain.py:
+ CURRENT_DEFAULT_TOOLCHAIN_VERSION = '2022'
```
→ Your Windows CI needs Visual Studio 2022!

**3. Python Version Migration**
```
.vpython3:
- python_version: "3.8"
+ python_version: "3.11"
```
→ Your CI Python environment needs updating!

**4. DEPS Tool Versions**
```
DEPS:
- 'gn_version': 'git_revision:abc123',
+ 'gn_version': 'git_revision:def456',
```
→ Might need to update depot_tools!

### ⚠️ Medium Priority

**5. Build Instruction Changes**
- New required dependencies
- Changed build flags
- New environment variables

**6. Config File Flag Changes**
- New default GN args
- Compiler flag changes
- Linker settings

### ℹ️ Low Priority (Noisy)

**7. DEPS Internal Rolls**
- Skia, V8, PDFium updates
- Usually safe (tested by Chromium CI)
- Only matters if you patch those components

**8. Documentation Typos/Clarifications**
- Formatting changes
- Link updates

## Usage Patterns

### Pattern 1: CI Broke Yesterday
```bash
# Check what changed in all tracked files
python3 scraper/main.py history --since "yesterday" --until "today"

# Look for:
- Version number changes
- New required tools
- Reverted changes (often indicate problems)
```

### Pattern 2: Windows Builds Failing
```bash
# Focus on Windows-specific files
python3 scraper/main.py history --since "2024-11-01" | grep -A 10 "win"

# Check:
- build/config/win/visual_studio_version.gni
- build/vs_toolchain.py
- docs/windows_build_instructions.md
```

### Pattern 3: Python Script Errors
```bash
# Check Python environment changes
python3 scraper/main.py history --since "2024-10-01" | grep -A 10 "vpython3\|install-build-deps.py"
```

### Pattern 4: Weekly Review
```bash
# See all changes in last 7 days
python3 scraper/main.py history --since "$(date -d '7 days ago' +%Y-%m-%d)"

# Focus on:
- Count of DEPS changes (baseline noise level)
- Any *.gni changes (investigate these!)
- Any *_toolchain.py changes (critical!)
```

## Correlation with CI Breaks

### Example Investigation

**Scenario:** Android builds failed on Nov 20, 2024

**Step 1: Check date range**
```bash
python3 scraper/main.py history --since "2024-11-15" --until "2024-11-25"
```

**Step 2: Filter to Android**
```bash
... | grep -A 10 "android"
```

**Found:**
```
build/config/android/config.gni - Nov 18
  Author: Simone Arpe
  Message: Add support for compiling Android from MacOS ARM64 host
```

**Root cause:** Your CI was using x86_64 macOS, new code expected ARM64 detection!

## Future Enhancements

**Phase 1 (Current): Track file changes**
- ✅ Know WHEN files change
- ✅ See WHO changed them
- ✅ Read WHAT changed in commit message

**Phase 2 (Future): Parse specific values**
```python
# Extract structured data
{
  "android_ndk_version": "r26d",  # Current
  "android_ndk_version_previous": "r26c",  # Previous
  "changed": True,
  "severity": "major"  # Version bump detected
}
```

**Phase 3 (Future): Smart alerts**
```
⚠️ High Priority Change Detected!

File: build/config/android/config.gni
Change: android_ndk_version: r26c → r26d
Impact: NDK upgrade required
Action: Update CI environment to NDK r26d
Ticket: https://github.com/your-org/your-repo/issues/auto-123
```

## Questions?

**Q: Why not track ALL files in build/?**
A: Too noisy. These 13 files catch 95% of build breaks with minimal noise.

**Q: Should I add more files?**
A: Run this for 1 month, correlate with your actual breaks, then decide.

**Q: What about Skia/V8/PDFium rolls?**
A: Only if you patch those. Otherwise, Chromium CI tests them.

**Q: DEPS changes 50 times a day!**
A: Yes. Filter for specific keywords: `grep -i "gn_version\|clang_revision\|toolchain"`

**Q: How do I know which changes matter?**
A: Version number changes, reverts, and *_toolchain.py changes always matter.

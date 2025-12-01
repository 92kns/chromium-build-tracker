"""Configuration for what to track"""

# Chromium build documentation files to track
CHROMIUM_DOCS = [
    "docs/linux/build_instructions.md",
    "docs/mac_build_instructions.md",
    "docs/windows_build_instructions.md",
    "docs/android_build_instructions.md",
]

# Critical build configuration files (Tier 1 + Tier 2)
CHROMIUM_BUILD_CONFIGS = [
    # Tier 1: Critical dependencies and SDK versions
    "DEPS",  # Main dependency file - GN, clang, buildtools versions
    "build/config/android/config.gni",  # Android NDK/SDK versions
    "build/config/mac/mac_sdk.gni",  # macOS SDK and deployment target
    "build/config/win/visual_studio_version.gni",  # Windows SDK/MSVC versions

    # Tier 2: Toolchain setup scripts (document required environment)
    "build/install-build-deps.sh",  # Linux dependency installer
    "build/install-build-deps.py",  # Linux dependency installer (Python)
    "build/vs_toolchain.py",  # Windows Visual Studio setup
    "build/mac_toolchain.py",  # macOS Xcode setup
]

# Combined list for fetching
CHROMIUM_FILES = CHROMIUM_DOCS + CHROMIUM_BUILD_CONFIGS

# Chromium source base URL (using GitHub raw mirror)
CHROMIUM_SOURCE_BASE = "https://raw.githubusercontent.com/chromium/chromium/main"
CHROMIUM_BROWSE_BASE = "https://source.chromium.org/chromium/chromium/src/+/main"

# depot_tools files to track
# Key files that affect build process
DEPOT_TOOLS_FILES = [
    # Key Python scripts
    "gclient.py",
    "gclient_utils.py",
    "gclient_scm.py",
    "fetch.py",
    "update_depot_tools.py",
    # Shell wrappers
    "README.md",
]

# depot_tools GitHub mirror
DEPOT_TOOLS_SOURCE_BASE = "https://raw.githubusercontent.com/chromium/depot_tools/main"
DEPOT_TOOLS_BROWSE_BASE = "https://chromium.googlesource.com/chromium/tools/depot_tools/+/main"

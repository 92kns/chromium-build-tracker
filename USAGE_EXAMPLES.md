# Usage Examples

## Real-world scenarios for using Chromium Build Tracker

### Scenario 1: CI broke last week

Your custom Chromium build in CI was working fine, then suddenly started failing on Nov 15, 2024.

**Investigation:**
```bash
# Check what changed in build docs around that time
python3 scraper/main.py history --since "2024-11-01" --until "2024-11-20"
```

**Result:**
You find that on Nov 18, there was a commit about PGO on Windows. You check your CI - it's using a ccache-like wrapper that might be affected by this change.

### Scenario 2: Weekly review

Every Monday, you want to see what changed in Chromium build instructions last week.

**Automation:**
```bash
# Add to crontab (runs Monday at 9 AM)
0 9 * * 1 cd /path/to/chromium_detect && python3 scraper/main.py history --since "$(date -d '7 days ago' +\%Y-\%m-\%d)" --output /tmp/chromium_weekly.txt && mail -s "Chromium Build Changes" you@company.com < /tmp/chromium_weekly.txt
```

### Scenario 3: Platform-specific issue

Your Windows builds are failing but Linux builds work fine.

**Investigation:**
```bash
# Get recent Windows-specific changes
python3 scraper/main.py history --limit 50 | grep -A 10 "windows_build"
```

**Or use the dashboard:**
```bash
python3 scraper/main.py serve
# Filter by file in the UI
```

### Scenario 4: Long-term tracking

You want to track all changes over 3 months to identify patterns.

**Setup:**
```bash
# Run daily via cron
0 0 * * * cd /path/to/chromium_detect && python3 scraper/main.py fetch

# Then view accumulated changes anytime
python3 scraper/main.py serve
```

The dashboard will show all detected changes with diffs, allowing you to:
- See trends (are Android docs changing more than others?)
- Identify problematic commits
- Link CI failures to documentation updates

### Scenario 5: Bisecting a break

Your CI broke sometime between Oct 1 and Nov 1. You need to find the exact commit.

**Binary search approach:**
```bash
# Check mid-point first
python3 scraper/main.py history --since "2024-10-15" --until "2024-10-16"

# If nothing, check later half
python3 scraper/main.py history --since "2024-10-23" --until "2024-10-24"

# Keep narrowing...
```

### Scenario 6: Correlating multiple repos

You maintain custom patches and need to know when to update them.

**Check all platforms:**
```bash
# Get last 6 months of changes
python3 scraper/main.py history --since "2024-05-01" --output last_6_months.txt

# Analyze the file
grep -E "SDK|toolchain|Python|depot_tools" last_6_months.txt
```

### Scenario 7: Onboarding new team member

New developer needs to understand recent Chromium build changes.

**Create a report:**
```bash
# Get changes since they joined
python3 scraper/main.py history --since "2024-09-01" --output onboarding_changes.txt

# Show them the dashboard
python3 scraper/main.py serve
```

## Pro Tips

### 1. Combine with git log of your custom patches

```bash
# Your patches
git log --since="2024-10-01" --oneline custom_chromium/

# Chromium docs changes
python3 scraper/main.py history --since "2024-10-01"

# Compare to find conflicts
```

### 2. Set up alerts

```bash
#!/bin/bash
# check_chromium.sh - Run daily

OUTPUT=$(python3 scraper/main.py fetch 2>&1)

if echo "$OUTPUT" | grep -q "changes detected"; then
    # Send alert
    echo "$OUTPUT" | mail -s "⚠️ Chromium Build Docs Changed!" team@company.com
fi
```

### 3. Track specific keywords

```bash
# Find all commits mentioning specific tools/concepts
python3 scraper/main.py history --limit 200 --output all_changes.txt
grep -i "gn\|ninja\|depot_tools\|sdk" all_changes.txt
```

### 4. Integration with your CI

```bash
# In CI failure notification
if [ $BUILD_FAILED -eq 1 ]; then
    echo "Checking recent Chromium doc changes..."
    python3 /path/to/chromium_detect/scraper/main.py history --since "$(date -d '7 days ago' +%Y-%m-%d)"
fi
```

### 5. GitHub Actions automation

See README.md for full GitHub Actions setup that:
- Runs daily
- Commits changes to repo
- Deploys dashboard to GitHub Pages
- Can send notifications via GitHub Issues

## Common Issues and Solutions

### Issue: "No commits found"

**Cause:** Date range too narrow or files haven't changed

**Solution:**
```bash
# Widen the date range
python3 scraper/main.py history --since "2024-01-01"

# Or remove date filter
python3 scraper/main.py history --limit 100
```

### Issue: Rate limit errors

**Cause:** GitHub API rate limiting (60 requests/hour without token)

**Solution:**
```bash
# Set GitHub token
export GITHUB_TOKEN=your_personal_access_token_here

# Then run commands
python3 scraper/main.py history --since "2024-01-01"
```

### Issue: Want to see actual code changes

**Cause:** Current tool shows commit messages, not diffs

**Solution:**
```bash
# Visit the commit URL shown in output
# Or use GitHub API to fetch diff (future feature)
```

## Advanced: Analyzing patterns

### Find most active files

```bash
python3 scraper/main.py history --since "2024-01-01" --output year.txt
grep "^docs/" year.txt | sort | uniq -c | sort -rn
```

### Identify breaking change periods

```bash
# Get all commits
python3 scraper/main.py history --since "2024-01-01" --output all.txt

# Count commits per month
grep -oP '\d{4}-\d{2}' all.txt | uniq -c

# Correlate with your CI failure dates
```

### Track specific authors

```bash
python3 scraper/main.py history --since "2024-01-01" --output all.txt
grep "Devon Loehr" all.txt -A 2
# This person does a lot of Windows SDK updates
```

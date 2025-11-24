# Dashboard Features

## ✨ NEW: Interactive Commit History

The dashboard now has **3 tabs** with full GitHub API integration!

### Tab 1: Tracked Changes
- Shows changes detected by `python scraper/main.py fetch`
- Snapshot-based tracking over time
- Visual diffs for modified files
- Filters by repo and change type

### Tab 2: Commit History ⭐ NEW!
**Query any date range directly from the browser!**

**Features:**
- 📅 **Date range picker** - Select exact start/end dates
- ⚡ **Quick ranges** - Last 7/30/90 days with one click
- 🔄 **Live fetching** - Queries GitHub API directly from browser
- 📊 **Grouped by file** - Easy to see what changed where
- 🔗 **Direct links** - Click through to GitHub commits

**How it works:**
1. Open dashboard: `python3 scraper/main.py serve`
2. Click "Commit History" tab
3. Select date range (defaults to last 30 days)
4. Click "Fetch History"
5. Browse commits grouped by file

**Example queries:**
- "Show me what changed last week"
- "CI broke on Nov 15 - what changed between Nov 10-20?"
- "Review last 3 months of Android doc changes"

### Tab 3: Settings
**GitHub Token Management:**
- Add personal access token for higher rate limits
- Without token: 60 requests/hour
- With token: 5000 requests/hour
- Token stored only in browser's localStorage
- Never leaves your machine (only sent to GitHub API)

**How to get a token:**
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Create new token (no special permissions needed)
3. Paste in Settings tab
4. Enjoy 5000 req/hr instead of 60!

## Architecture

### Pure Static Site
- **No backend required** - All API calls from browser
- **Works on GitHub Pages** - Just static HTML/CSS/JS
- **Python still useful** for periodic snapshots via cron/GitHub Actions

### GitHub API Direct Access
```
Browser → GitHub API → Display
```

No Python/Go backend needed for history queries!

### Rate Limits
| Scenario | Requests/Hour | Good For |
|----------|---------------|----------|
| No token | 60 | Testing, light use |
| With token | 5000 | Heavy use, team dashboards |

## Use Cases

### 1. Quick Investigation
**Your CI broke yesterday:**
1. Open dashboard
2. History tab → Set dates to yesterday
3. See all commits
4. Find the culprit!

### 2. Weekly Review
**Every Monday morning:**
1. Open dashboard
2. Click "Last 7 days"
3. Review all changes
4. Plan your week

### 3. Bisecting a Break
**CI broke sometime last month:**
1. Start with broad range (whole month)
2. See which files changed
3. Narrow down date range
4. Find exact commit

### 4. Platform-Specific
**Windows builds failing:**
1. Query last 30 days
2. Look at `docs/windows_build_instructions.md` section
3. See what changed
4. Correlate with your failure dates

### 5. Long-term Patterns
**Combined approach:**
- Run `python fetch` daily (cron/Actions)
- View accumulated changes in Tracked tab
- Use History tab for deep dives into specific periods
- Both views complement each other!

## Technical Details

### How Dates Work
- Date picker uses your local timezone
- Converted to ISO8601 for GitHub API
- GitHub returns commits in that range
- Displayed in your local time

### API Calls
Each "Fetch History" makes:
- 4 API calls (one per file we track)
- Sequential (not parallel) to avoid rate limits
- Errors handled gracefully - continues with other files

### Error Handling
- Rate limit errors show reset time
- Suggests adding token in Settings
- Network errors displayed clearly
- Partial results shown even if some files fail

### Browser Compatibility
- Modern browsers (ES2017+)
- Chrome, Firefox, Safari, Edge
- No IE support needed

## Deployment Options

### Option 1: Local Use
```bash
python3 scraper/main.py serve
# Opens at localhost:8000
```

### Option 2: GitHub Pages
1. Push dashboard/ folder to gh-pages branch
2. Enable GitHub Pages in repo settings
3. Access at youruser.github.io/repo-name
4. Fully functional - no backend needed!

### Option 3: Internal Server
1. Host dashboard/ on any web server
2. nginx, Apache, even python -m http.server
3. No special configuration needed
4. Just serve static files

## Future Enhancements

Possible additions:
- **Diff viewing** - Show actual file diffs in History tab
- **Export** - Download commits as CSV/JSON
- **Notifications** - Browser notifications for new commits
- **Bookmarks** - Save useful date ranges
- **File filtering** - Show/hide specific files
- **Commit search** - Filter by keyword in message
- **Author filter** - See commits by specific people

## Security & Privacy

**Your data:**
- Changes tracked locally in data/ folder
- GitHub token in browser localStorage only
- No data sent to any server except GitHub API
- No analytics, no tracking

**GitHub token:**
- Read-only (no write permissions needed)
- Stored only in your browser
- Never transmitted except to api.github.com
- Can be cleared anytime in Settings tab

## Performance

**Initial load:**
- Instant (loads static HTML/CSS/JS)
- Tracked changes load from local JSON

**History fetch:**
- ~1-2 seconds for 4 files
- Depends on GitHub API response time
- Results cached in browser memory (until refresh)

**Rate limits:**
- Without token: ~15 queries per hour (4 files each)
- With token: ~1250 queries per hour
- More than enough for normal use!

## Comparison: CLI vs Dashboard

| Feature | Python CLI | Dashboard |
|---------|------------|-----------|
| Date ranges | ✅ `--since --until` | ✅ Calendar picker |
| Output format | Text in terminal | Beautiful UI |
| Filtering | Manual (grep) | Click buttons |
| Diffs | Not yet | Tracked changes only |
| Rate limits | Uses your IP | Browser-based |
| Token | Environment var | UI input |
| Automation | Cron/Actions | Manual browsing |
| Export | `--output file.txt` | Copy/paste |

**Best practice:** Use both!
- **CLI** for automation & scripts
- **Dashboard** for human exploration

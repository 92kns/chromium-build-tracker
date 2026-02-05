/**
 * Chromium Build Tracker Dashboard
 */
const CHROMIUM_FILES = [
    // Build documentation
    'docs/linux/build_instructions.md',
    'docs/mac_build_instructions.md',
    'docs/windows_build_instructions.md',
    'docs/android_build_instructions.md',
    // Critical build configs (Tier 1)
    'DEPS',
    'build/config/android/config.gni',
    'build/config/mac/mac_sdk.gni',
    'build/config/win/visual_studio_version.gni',
    // Toolchain setup scripts (Tier 2)
    'build/install-build-deps.sh',
    'build/install-build-deps.py',
    'build/vs_toolchain.py',
    'build/mac_toolchain.py',
    '.vpython3'
];
class GitHubAPI {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        this.repo = 'chromium/chromium';
    }
    async fetchJson(url) {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async fetchCommits(filePath, since, until) {
        const params = new URLSearchParams({
            path: filePath,
            per_page: '100'
        });
        if (since)
            params.append('since', since);
        if (until)
            params.append('until', until);
        const url = `${this.baseUrl}/repos/${this.repo}/commits?${params}`;
        const data = await this.fetchJson(url);
        return data.map(commit => ({
            sha: commit.sha.substring(0, 7),
            message: commit.commit.message.split('\n')[0],
            author: commit.commit.author.name,
            date: commit.commit.author.date,
            url: commit.html_url
        }));
    }
    async checkIfStale() {
        try {
            // Fetch recent commits from main branch
            const url = `${this.baseUrl}/repos/${this.repo}/commits?per_page=1`;
            const data = await this.fetchJson(url);
            if (data.length === 0)
                return true;
            const lastCommitDate = new Date(data[0].commit.author.date);
            const now = new Date();
            const daysSinceLastCommit = (now.getTime() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24);
            // Consider stale if no commits in the last 3 days
            return daysSinceLastCommit > 3;
        }
        catch (error) {
            console.error('Error checking GitHub staleness:', error);
            return true; // Assume stale on error
        }
    }
}
class GitilesAPI {
    constructor() {
        this.baseUrl = '/api/gitiles';
    }
    async fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Gitiles API error: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        // Remove XSSI protection prefix
        const jsonText = text.startsWith(')]}\'\n') ? text.substring(5) : text;
        return JSON.parse(jsonText);
    }
    async fetchCommits(filePath, since, until) {
        const url = `${this.baseUrl}/+log/main/${filePath}?format=json&n=100`;
        try {
            const data = await this.fetchJson(url);
            let commits = data.log.map(commit => ({
                sha: commit.commit.substring(0, 7),
                message: commit.message.split('\n')[0],
                author: commit.author.name,
                date: this.parseGitilesDate(commit.author.time),
                url: `https://chromium.googlesource.com/chromium/src/+/${commit.commit}`
            }));
            // Filter by date range if specified
            if (since || until) {
                const sinceDate = since ? new Date(since) : null;
                const untilDate = until ? new Date(until) : null;
                commits = commits.filter(commit => {
                    const commitDate = new Date(commit.date);
                    if (sinceDate && commitDate < sinceDate)
                        return false;
                    if (untilDate && commitDate > untilDate)
                        return false;
                    return true;
                });
            }
            return commits;
        }
        catch (error) {
            console.error(`Error fetching commits for ${filePath}:`, error);
            throw error;
        }
    }
    parseGitilesDate(dateStr) {
        // Gitiles returns dates like "Thu Dec 11 07:08:43 2025"
        // Convert to ISO format
        const date = new Date(dateStr);
        return date.toISOString();
    }
    async fetchAllCommits(since, until, onProgress) {
        const results = new Map();
        // Fetch in parallel with concurrency limit
        const concurrency = 3;
        const files = [...CHROMIUM_FILES];
        let completed = 0;
        for (let i = 0; i < files.length; i += concurrency) {
            const batch = files.slice(i, i + concurrency);
            const promises = batch.map(filePath => this.fetchCommits(filePath, since, until)
                .then(commits => {
                if (commits.length > 0) {
                    results.set(filePath, commits);
                }
                completed++;
                if (onProgress) {
                    onProgress(completed, files.length);
                }
            })
                .catch(error => {
                console.error(`Failed to fetch commits for ${filePath}:`, error);
                completed++;
                if (onProgress) {
                    onProgress(completed, files.length);
                }
            }));
            await Promise.all(promises);
        }
        return results;
    }
}
class HybridAPI {
    constructor() {
        this.preferredSource = 'github';
        this.githubAPI = new GitHubAPI();
        this.gitilesAPI = new GitilesAPI();
    }
    async fetchAllCommits(since, until, onProgress) {
        // Try GitHub first
        try {
            const isStale = await this.githubAPI.checkIfStale();
            if (!isStale) {
                console.log('Using GitHub API (mirror is up-to-date)');
                const commits = await this.fetchFromGitHub(since, until, onProgress);
                return { commits, source: 'github' };
            }
            else {
                console.log('GitHub mirror is stale, falling back to Gitiles');
            }
        }
        catch (error) {
            console.error('GitHub API failed, falling back to Gitiles:', error);
        }
        // Fallback to Gitiles
        const commits = await this.gitilesAPI.fetchAllCommits(since, until, (current, total) => {
            if (onProgress)
                onProgress(current, total, 'gitiles');
        });
        return { commits, source: 'gitiles' };
    }
    async fetchFromGitHub(since, until, onProgress) {
        const results = new Map();
        const concurrency = 3;
        const files = [...CHROMIUM_FILES];
        let completed = 0;
        for (let i = 0; i < files.length; i += concurrency) {
            const batch = files.slice(i, i + concurrency);
            const promises = batch.map(filePath => this.githubAPI.fetchCommits(filePath, since, until)
                .then(commits => {
                if (commits.length > 0) {
                    results.set(filePath, commits);
                }
                completed++;
                if (onProgress) {
                    onProgress(completed, files.length, 'github');
                }
            })
                .catch(error => {
                console.error(`Failed to fetch commits for ${filePath}:`, error);
                completed++;
                if (onProgress) {
                    onProgress(completed, files.length, 'github');
                }
            }));
            await Promise.all(promises);
        }
        return results;
    }
}
class Dashboard {
    constructor() {
        this.changes = [];
        this.currentFilter = 'all';
        this.hybridAPI = new HybridAPI();
        this.init();
    }
    async init() {
        this.setupTabs();
        this.setupHistoryControls();
        // Load tracked changes
        await this.loadChanges();
        this.updateStats();
        this.renderChanges();
        this.setupChangeListeners();
    }
    // Tab Management
    setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                var _a;
                const tabName = btn.dataset.tab;
                // Update active states
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                (_a = document.getElementById(`${tabName}-tab`)) === null || _a === void 0 ? void 0 : _a.classList.add('active');
            });
        });
    }
    // History Controls
    setupHistoryControls() {
        const sinceInput = document.getElementById('since-date');
        const untilInput = document.getElementById('until-date');
        const fetchBtn = document.getElementById('fetch-history-btn');
        const clearBtn = document.getElementById('clear-dates-btn');
        // Set default dates (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        untilInput.value = this.toLocalDateString(today);
        sinceInput.value = this.toLocalDateString(thirtyDaysAgo);
        // Quick range buttons
        document.querySelectorAll('.btn-quick').forEach(btn => {
            btn.addEventListener('click', () => {
                const days = parseInt(btn.dataset.days || '30');
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - days);
                sinceInput.value = this.toLocalDateString(start);
                untilInput.value = this.toLocalDateString(end);
            });
        });
        // Fetch button
        fetchBtn === null || fetchBtn === void 0 ? void 0 : fetchBtn.addEventListener('click', async () => {
            const since = sinceInput.value ? new Date(sinceInput.value).toISOString() : undefined;
            const until = untilInput.value ? new Date(untilInput.value).toISOString() : undefined;
            await this.fetchHistory(since, until);
        });
        // Clear button
        clearBtn === null || clearBtn === void 0 ? void 0 : clearBtn.addEventListener('click', () => {
            sinceInput.value = '';
            untilInput.value = '';
        });
    }
    async fetchHistory(since, until) {
        const statusDiv = document.getElementById('history-status');
        const historyList = document.getElementById('history-list');
        const noHistory = document.getElementById('no-history');
        if (!statusDiv || !historyList || !noHistory)
            return;
        // Show loading
        statusDiv.textContent = 'Checking GitHub mirror status...';
        statusDiv.className = 'history-status loading';
        historyList.innerHTML = '';
        noHistory.style.display = 'none';
        try {
            const { commits, source } = await this.hybridAPI.fetchAllCommits(since, until, (current, total, apiSource) => {
                const sourceName = apiSource === 'github' ? 'GitHub' : 'Gitiles (chromium.googlesource.com)';
                statusDiv.textContent = `Fetching from ${sourceName}... (${current}/${total})`;
            });
            if (commits.size === 0) {
                statusDiv.textContent = 'No commits found in the specified date range.';
                statusDiv.className = 'history-status error';
                noHistory.style.display = 'block';
                return;
            }
            // Calculate total
            let totalCommits = 0;
            commits.forEach(list => totalCommits += list.length);
            const sourceName = source === 'github' ? 'GitHub (faster)' : 'Gitiles (slower but up-to-date)';
            statusDiv.textContent = `Found ${totalCommits} commits across ${commits.size} files (via ${sourceName})`;
            statusDiv.className = 'history-status success';
            // Render commits grouped by file
            this.renderHistory(commits);
        }
        catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'history-status error';
            noHistory.style.display = 'block';
        }
    }
    renderHistory(commitsByFile) {
        const historyList = document.getElementById('history-list');
        if (!historyList)
            return;
        historyList.innerHTML = '';
        // Sort files alphabetically
        const sortedFiles = Array.from(commitsByFile.keys()).sort();
        for (const filePath of sortedFiles) {
            const commits = commitsByFile.get(filePath) || [];
            const fileGroup = document.createElement('div');
            fileGroup.className = 'history-file-group';
            const fileTitle = document.createElement('h3');
            fileTitle.textContent = filePath;
            fileGroup.appendChild(fileTitle);
            for (const commit of commits) {
                const commitDiv = document.createElement('div');
                commitDiv.className = 'history-commit';
                const header = document.createElement('div');
                header.className = 'commit-header';
                const sha = document.createElement('span');
                sha.className = 'commit-sha';
                sha.textContent = commit.sha;
                const date = document.createElement('span');
                date.className = 'commit-date';
                date.textContent = this.formatDate(new Date(commit.date));
                header.appendChild(sha);
                header.appendChild(date);
                const message = document.createElement('div');
                message.className = 'commit-message';
                message.textContent = commit.message;
                const author = document.createElement('div');
                author.className = 'commit-author';
                author.textContent = `by ${commit.author}`;
                const link = document.createElement('a');
                link.className = 'commit-link';
                link.href = commit.url;
                link.target = '_blank';
                link.textContent = 'View on Gitiles →';
                commitDiv.appendChild(header);
                commitDiv.appendChild(message);
                commitDiv.appendChild(author);
                commitDiv.appendChild(link);
                fileGroup.appendChild(commitDiv);
            }
            historyList.appendChild(fileGroup);
        }
    }
    // Tracked Changes (existing functionality)
    async loadChanges() {
        try {
            const response = await fetch('../data/changes.json');
            if (response.ok) {
                this.changes = await response.json();
                this.changes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            }
        }
        catch (error) {
            console.warn('No changes file found or error loading:', error);
            this.changes = [];
        }
    }
    updateStats() {
        const totalChanges = this.changes.length;
        const chromiumChanges = this.changes.filter(c => c.repo === 'chromium').length;
        const depotToolsChanges = this.changes.filter(c => c.repo === 'depot_tools').length;
        let lastCheck = 'Never';
        if (this.changes.length > 0) {
            const latest = new Date(this.changes[0].timestamp);
            lastCheck = this.formatDate(latest);
        }
        document.getElementById('total-changes').textContent = totalChanges.toString();
        document.getElementById('chromium-changes').textContent = chromiumChanges.toString();
        document.getElementById('depot-tools-changes').textContent = depotToolsChanges.toString();
        document.getElementById('last-check').textContent = lastCheck;
    }
    renderChanges() {
        const changesList = document.getElementById('changes-list');
        const noChanges = document.getElementById('no-changes');
        const filteredChanges = this.filterChanges();
        if (filteredChanges.length === 0) {
            changesList.style.display = 'none';
            noChanges.style.display = 'block';
            return;
        }
        changesList.style.display = 'flex';
        noChanges.style.display = 'none';
        changesList.innerHTML = filteredChanges.map(change => this.renderChangeCard(change)).join('');
    }
    filterChanges() {
        if (this.currentFilter === 'all') {
            return this.changes;
        }
        return this.changes.filter(change => {
            if (this.currentFilter === 'chromium' || this.currentFilter === 'depot_tools') {
                return change.repo === this.currentFilter;
            }
            return change.type === this.currentFilter;
        });
    }
    renderChangeCard(change) {
        const timestamp = this.formatTimestamp(change.timestamp);
        const diffButton = change.diff_html
            ? `<button class="btn btn-primary view-diff" data-file="${change.file}" data-timestamp="${change.timestamp}">View Diff</button>`
            : '';
        return `
            <div class="change-card" data-repo="${change.repo}" data-type="${change.type}">
                <div class="change-header">
                    <div class="change-title">
                        <span class="change-type ${change.type}">${change.type}</span>
                        <span class="repo-badge">${change.repo}</span>
                    </div>
                    <div class="change-meta">
                        <span class="change-timestamp">${timestamp}</span>
                    </div>
                </div>
                <div class="change-file">${change.file}</div>
                <div class="change-summary">${change.summary}</div>
                <div class="change-actions">
                    ${diffButton}
                    ${change.url ? `<a href="${change.url}" target="_blank" class="btn">View Source</a>` : ''}
                </div>
            </div>
        `;
    }
    setupChangeListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target;
                const filter = target.dataset.filter || 'all';
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                this.currentFilter = filter;
                this.renderChanges();
            });
        });
        // Diff modal
        const modal = document.getElementById('diff-modal');
        const closeBtn = document.querySelector('.close');
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        // View diff buttons
        document.getElementById('changes-list').addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('view-diff')) {
                const file = target.dataset.file;
                const timestamp = target.dataset.timestamp;
                this.showDiff(file, timestamp);
            }
        });
    }
    showDiff(file, timestamp) {
        const change = this.changes.find(c => c.file === file && c.timestamp === timestamp);
        if (!change || !change.diff_html) {
            return;
        }
        const modal = document.getElementById('diff-modal');
        const diffViewer = document.getElementById('diff-viewer');
        diffViewer.innerHTML = `
            <h2>${file}</h2>
            <p style="color: #8b949e; margin-bottom: 20px;">${change.summary} - ${this.formatTimestamp(change.timestamp)}</p>
            ${change.diff_html}
        `;
        modal.style.display = 'block';
    }
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    formatDate(date) {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 60) {
            return `${diffMins} min ago`;
        }
        else if (diffHours < 24) {
            return `${diffHours} hr ago`;
        }
        else if (diffDays < 7) {
            return `${diffDays} days ago`;
        }
        else {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }
    toLocalDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}
// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Dashboard());
}
else {
    new Dashboard();
}

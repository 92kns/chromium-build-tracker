/**
 * Chromium Build Tracker Dashboard
 */
class Logger {
    constructor() {
        this.logPanel = document.getElementById('log-panel');
    }
    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        // Console logging
        const consoleMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
        consoleMethod(logMessage);
        // UI logging
        if (this.logPanel) {
            const entry = document.createElement('div');
            entry.className = `log-entry ${level}`;
            entry.innerHTML = `<span class="log-timestamp">${timestamp}</span>${message}`;
            this.logPanel.appendChild(entry);
            // Auto-scroll to bottom
            this.logPanel.scrollTop = this.logPanel.scrollHeight;
            // Keep only last 50 entries
            while (this.logPanel.children.length > 50) {
                this.logPanel.removeChild(this.logPanel.firstChild);
            }
        }
    }
    clear() {
        if (this.logPanel) {
            this.logPanel.innerHTML = '';
        }
    }
}
const REPO_CONFIGS = [
    {
        id: 'chromium',
        name: 'Chromium',
        github: {
            owner: 'chromium',
            repo: 'chromium'
        },
        gitiles: {
            host: 'chromium.googlesource.com',
            project: 'chromium/src'
        },
        files: [
            'docs/linux/build_instructions.md',
            'docs/mac_build_instructions.md',
            'docs/windows_build_instructions.md',
            'docs/android_build_instructions.md',
            'DEPS',
            'build/config/android/config.gni',
            'build/config/mac/mac_sdk.gni',
            'build/config/win/visual_studio_version.gni',
            'build/install-build-deps.sh',
            'build/install-build-deps.py',
            'build/vs_toolchain.py',
            'build/mac_toolchain.py',
            '.vpython3'
        ]
    },
    {
        id: 'v8',
        name: 'V8 Engine',
        github: {
            owner: 'v8',
            repo: 'v8'
        },
        gitiles: {
            host: 'chromium.googlesource.com',
            project: 'v8/v8'
        },
        files: [
            'README.md',
            'DEPS',
            'BUILD.gn',
            'infra/mb/mb_config.pyl',
            'tools/dev/gm.py',
            'tools/dev/v8gen.py'
        ]
    },
    {
        id: 'depot_tools',
        name: 'depot_tools',
        // No GitHub mirror exists, Gitiles only
        gitiles: {
            host: 'chromium.googlesource.com',
            project: 'chromium/tools/depot_tools'
        },
        files: [
            'README.md',
            'gclient.py',
            'gclient_utils.py',
            'git_cl.py',
            'autoninja.py',
            'cipd_manifest.txt'
        ]
    }
];
// Legacy constant for backwards compatibility
const CHROMIUM_FILES = REPO_CONFIGS[0].files;
class GitHubAPI {
    constructor(config) {
        this.baseUrl = 'https://api.github.com';
        this.config = config;
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
        const url = `${this.baseUrl}/repos/${this.config.github.owner}/${this.config.github.repo}/commits?${params}`;
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
            const url = `${this.baseUrl}/repos/${this.config.github.owner}/${this.config.github.repo}/commits?per_page=1`;
            console.log(`[GitHub] Checking staleness for ${this.config.name}...`);
            const data = await this.fetchJson(url);
            if (data.length === 0) {
                console.log(`[GitHub] No commits found for ${this.config.name}, considering stale`);
                return true;
            }
            const lastCommitDate = new Date(data[0].commit.author.date);
            const now = new Date();
            const daysSinceLastCommit = (now.getTime() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24);
            const isStale = daysSinceLastCommit > 3;
            console.log(`[GitHub] ${this.config.name} last commit: ${daysSinceLastCommit.toFixed(1)} days ago - ${isStale ? 'STALE' : 'FRESH'}`);
            return isStale;
        }
        catch (error) {
            console.error(`[GitHub] Error checking staleness for ${this.config.name}:`, error);
            return true;
        }
    }
}
class GitilesAPI {
    constructor(config) {
        this.baseUrl = '/api/gitiles';
        this.config = config;
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
        const url = `${this.baseUrl}/${this.config.gitiles.host}/${this.config.gitiles.project}/+log/main/${filePath}?format=json&n=100`;
        try {
            const data = await this.fetchJson(url);
            let commits = data.log.map(commit => ({
                sha: commit.commit.substring(0, 7),
                message: commit.message.split('\n')[0],
                author: commit.author.name,
                date: this.parseGitilesDate(commit.author.time),
                url: `https://${this.config.gitiles.host}/${this.config.gitiles.project}/+/${commit.commit}`
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
        const concurrency = 10; // High concurrency for faster fetching
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
    constructor(config, logger) {
        this.cacheExpiryMs = 10 * 60 * 1000; // 10 minutes
        this.config = config;
        this.logger = logger;
        this.githubAPI = new GitHubAPI(config);
        this.gitilesAPI = new GitilesAPI(config);
    }
    getCacheKey(since, until) {
        return `cache_${this.config.id}_${since || 'none'}_${until || 'none'}`;
    }
    getCached(since, until) {
        try {
            const key = this.getCacheKey(since, until);
            const cached = localStorage.getItem(key);
            if (!cached)
                return null;
            const entry = JSON.parse(cached);
            const age = Date.now() - entry.timestamp;
            if (age > this.cacheExpiryMs) {
                localStorage.removeItem(key);
                return null;
            }
            // Convert plain object back to Map
            const commitsMap = new Map();
            const commitsObj = entry.commits;
            for (const key in commitsObj) {
                if (commitsObj.hasOwnProperty(key)) {
                    commitsMap.set(key, commitsObj[key]);
                }
            }
            entry.commits = commitsMap;
            return entry;
        }
        catch (e) {
            return null;
        }
    }
    setCache(commits, source, since, until) {
        try {
            const key = this.getCacheKey(since, until);
            const entry = {
                commits,
                source,
                timestamp: Date.now()
            };
            // Convert Map to plain object for JSON
            const commitsObj = {};
            commits.forEach((value, key) => {
                commitsObj[key] = value;
            });
            const cacheData = {
                commits: commitsObj,
                source: entry.source,
                timestamp: entry.timestamp
            };
            localStorage.setItem(key, JSON.stringify(cacheData));
        }
        catch (e) {
            // Ignore cache write errors (quota exceeded, etc.)
            console.warn('Failed to cache results:', e);
        }
    }
    async fetchAllCommits(since, until, signal, onProgress) {
        // Check cache first
        const cached = this.getCached(since, until);
        if (cached) {
            this.logger.log(`Using cached results for ${this.config.name} (less than 10 min old)`, 'success');
            return { commits: cached.commits, source: cached.source };
        }
        this.logger.log(`Fetching commits for ${this.config.name}`, 'info');
        // Check if cancelled
        if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
            throw new DOMException('Fetch aborted', 'AbortError');
        }
        // Try GitHub first (if available)
        if (this.config.github) {
            try {
                this.logger.log('Checking GitHub mirror status...', 'info');
                // Check if cancelled
                if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                    throw new DOMException('Fetch aborted', 'AbortError');
                }
                const isStale = await this.githubAPI.checkIfStale();
                if (!isStale) {
                    this.logger.log('GitHub mirror is fresh - using GitHub API (fast)', 'success');
                    const commits = await this.fetchFromGitHub(since, until, signal, onProgress);
                    this.logger.log(`Fetched ${commits.size} files with commits from GitHub`, 'success');
                    // Cache the results
                    this.setCache(commits, 'github', since, until);
                    return { commits, source: 'github' };
                }
                else {
                    this.logger.log('GitHub mirror is stale (>3 days old) - falling back to Gitiles', 'warning');
                }
            }
            catch (error) {
                // Re-throw abort errors
                if (error instanceof DOMException && error.name === 'AbortError') {
                    throw error;
                }
                this.logger.log(`GitHub API failed: ${error}`, 'error');
                this.logger.log('Falling back to Gitiles API', 'warning');
            }
        }
        else {
            this.logger.log('No GitHub mirror available - using Gitiles only', 'info');
        }
        // Check if cancelled before Gitiles
        if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
            throw new DOMException('Fetch aborted', 'AbortError');
        }
        // Fallback to Gitiles (or primary if no GitHub)
        this.logger.log('Using Gitiles API (slower but always current)', 'info');
        const commits = await this.gitilesAPI.fetchAllCommits(since, until, (current, total) => {
            // Check if cancelled during fetch
            if (signal === null || signal === void 0 ? void 0 : signal.aborted)
                return;
            if (onProgress)
                onProgress(current, total, 'gitiles');
        });
        this.logger.log(`Fetched ${commits.size} files with commits from Gitiles`, 'success');
        // Cache the results
        this.setCache(commits, 'gitiles', since, until);
        return { commits, source: 'gitiles' };
    }
    async fetchFromGitHub(since, until, signal, onProgress) {
        const results = new Map();
        const concurrency = 10; // High concurrency for faster fetching
        const files = [...this.config.files];
        let completed = 0;
        console.log(`[${this.config.name}] Fetching ${files.length} files from GitHub...`);
        for (let i = 0; i < files.length; i += concurrency) {
            // Check if cancelled before each batch
            if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                throw new DOMException('Fetch aborted', 'AbortError');
            }
            const batch = files.slice(i, i + concurrency);
            const promises = batch.map(filePath => this.githubAPI.fetchCommits(filePath, since, until)
                .then(commits => {
                // Check if cancelled
                if (signal === null || signal === void 0 ? void 0 : signal.aborted)
                    return;
                if (commits.length > 0) {
                    results.set(filePath, commits);
                }
                completed++;
                if (onProgress) {
                    onProgress(completed, files.length, 'github');
                }
            })
                .catch(error => {
                // Don't log errors if aborted
                if (signal === null || signal === void 0 ? void 0 : signal.aborted)
                    return;
                console.error(`[${this.config.name}] Failed to fetch ${filePath}:`, error);
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
        this.currentFetchAbort = null;
        this.logger = new Logger();
        this.currentRepo = REPO_CONFIGS[0]; // Default to Chromium
        this.hybridAPI = new HybridAPI(this.currentRepo, this.logger);
        this.init();
    }
    async init() {
        this.setupRepoSelector();
        this.setupHistoryControls();
        this.loadDeployTime();
    }
    loadDeployTime() {
        // Check if deploy time was injected by build process
        const metaTag = document.querySelector('meta[name="deploy-time"]');
        const timestampEl = document.getElementById('deploy-timestamp');
        if (metaTag && timestampEl) {
            const deployTime = metaTag.content;
            if (deployTime && deployTime !== 'DEPLOY_TIME_PLACEHOLDER') {
                timestampEl.textContent = deployTime + ' UTC';
            }
            else {
                timestampEl.textContent = 'Development';
            }
        }
    }
    setupRepoSelector() {
        const selector = document.getElementById('repo-selector');
        if (!selector)
            return;
        // Populate options
        REPO_CONFIGS.forEach(config => {
            const option = document.createElement('option');
            option.value = config.id;
            option.textContent = config.name;
            selector.appendChild(option);
        });
        // Handle selection change
        selector.addEventListener('change', () => {
            const selectedConfig = REPO_CONFIGS.find(c => c.id === selector.value);
            if (selectedConfig) {
                this.logger.log(`Switched to ${selectedConfig.name}`, 'info');
                this.currentRepo = selectedConfig;
                this.hybridAPI = new HybridAPI(selectedConfig, this.logger);
            }
        });
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
        var _a;
        const statusDiv = document.getElementById('history-status');
        const historyList = document.getElementById('history-list');
        const noHistory = document.getElementById('no-history');
        if (!statusDiv || !historyList || !noHistory)
            return;
        // Cancel any in-flight request
        if (this.currentFetchAbort) {
            this.currentFetchAbort.abort();
            this.logger.log('⚠ Previous fetch cancelled', 'warning');
        }
        // Create new abort controller for this fetch
        this.currentFetchAbort = new AbortController();
        const signal = this.currentFetchAbort.signal;
        // Clear logs and show loading
        this.logger.clear();
        this.logger.log(`Starting fetch for ${this.currentRepo.name}`, 'info');
        statusDiv.textContent = 'Checking GitHub mirror status...';
        statusDiv.className = 'history-status loading';
        historyList.innerHTML = '';
        noHistory.style.display = 'none';
        try {
            // Check if cancelled before starting
            if (signal.aborted) {
                this.logger.log('Fetch cancelled before starting', 'warning');
                return;
            }
            const { commits, source } = await this.hybridAPI.fetchAllCommits(since, until, signal, (current, total, apiSource) => {
                // Check if cancelled during progress
                if (signal.aborted)
                    return;
                const sourceName = apiSource === 'github' ? 'GitHub' : 'Gitiles';
                statusDiv.textContent = `Fetching from ${sourceName}... (${current}/${total})`;
            });
            // Check if cancelled after fetch
            if (signal.aborted) {
                this.logger.log('Fetch cancelled after completion', 'warning');
                return;
            }
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
            // Don't show error if it was just an abort
            if (error instanceof DOMException && error.name === 'AbortError') {
                this.logger.log('Fetch was cancelled', 'warning');
                statusDiv.textContent = 'Fetch cancelled';
                statusDiv.className = 'history-status warning';
                return;
            }
            // Check if signal was aborted (might not throw AbortError in all cases)
            if (signal.aborted) {
                this.logger.log('Fetch was cancelled', 'warning');
                statusDiv.textContent = 'Fetch cancelled';
                statusDiv.className = 'history-status warning';
                return;
            }
            this.logger.log(`Error: ${error.message}`, 'error');
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'history-status error';
            noHistory.style.display = 'block';
        }
        finally {
            // Clear abort controller if this was the current one
            if (((_a = this.currentFetchAbort) === null || _a === void 0 ? void 0 : _a.signal) === signal) {
                this.currentFetchAbort = null;
            }
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

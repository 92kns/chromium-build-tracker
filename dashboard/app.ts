/**
 * Chromium Build Tracker Dashboard
 */

interface Change {
    repo: string;
    file: string;
    type: 'added' | 'modified' | 'removed';
    timestamp: string;
    url?: string;
    summary: string;
    diff_html?: string;
    old_sha?: string;
    new_sha?: string;
}

interface Commit {
    sha: string;
    message: string;
    author: string;
    date: string;
    url: string;
}

interface GitHubCommit {
    sha: string;
    commit: {
        message: string;
        author: {
            name: string;
            date: string;
        };
    };
    html_url: string;
}

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
    private baseUrl = 'https://api.github.com';
    private repo = 'chromium/chromium';
    private token: string | null = null;

    constructor() {
        // Load token from localStorage if available
        this.token = localStorage.getItem('github_token');
    }

    setToken(token: string) {
        this.token = token;
        localStorage.setItem('github_token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('github_token');
    }

    hasToken(): boolean {
        return this.token !== null && this.token.length > 0;
    }

    private async fetch(url: string): Promise<Response> {
        const headers: HeadersInit = {
            'Accept': 'application/vnd.github.v3+json'
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, { headers });

        if (response.status === 403) {
            const resetTime = response.headers.get('X-RateLimit-Reset');
            if (resetTime) {
                const resetDate = new Date(parseInt(resetTime) * 1000);
                throw new Error(`Rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}. Consider adding a GitHub token in Settings.`);
            }
            throw new Error('Rate limit exceeded. Consider adding a GitHub token in Settings.');
        }

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        return response;
    }

    async fetchCommits(filePath: string, since?: string, until?: string): Promise<Commit[]> {
        const params = new URLSearchParams({
            path: filePath,
            per_page: '100'
        });

        if (since) params.append('since', since);
        if (until) params.append('until', until);

        const url = `${this.baseUrl}/repos/${this.repo}/commits?${params}`;

        try {
            const response = await this.fetch(url);
            const data: GitHubCommit[] = await response.json();

            return data.map(commit => ({
                sha: commit.sha.substring(0, 7),
                message: commit.commit.message.split('\n')[0],
                author: commit.commit.author.name,
                date: commit.commit.author.date,
                url: commit.html_url
            }));
        } catch (error) {
            console.error(`Error fetching commits for ${filePath}:`, error);
            throw error;
        }
    }

    async fetchAllCommits(since?: string, until?: string): Promise<Map<string, Commit[]>> {
        const results = new Map<string, Commit[]>();

        for (const filePath of CHROMIUM_FILES) {
            try {
                const commits = await this.fetchCommits(filePath, since, until);
                if (commits.length > 0) {
                    results.set(filePath, commits);
                }
            } catch (error) {
                console.error(`Failed to fetch commits for ${filePath}:`, error);
                // Continue with other files
            }
        }

        return results;
    }
}

class Dashboard {
    private changes: Change[] = [];
    private currentFilter: string = 'all';
    private githubAPI: GitHubAPI;

    constructor() {
        this.githubAPI = new GitHubAPI();
        this.init();
    }

    async init() {
        this.setupTabs();
        this.setupSettings();
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
                const tabName = (btn as HTMLElement).dataset.tab;

                // Update active states
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                document.getElementById(`${tabName}-tab`)?.classList.add('active');
            });
        });
    }

    // Settings Management
    setupSettings() {
        const tokenInput = document.getElementById('github-token') as HTMLInputElement;
        const saveBtn = document.getElementById('save-token-btn');
        const clearBtn = document.getElementById('clear-token-btn');
        const statusDiv = document.getElementById('token-status');

        // Load existing token (masked)
        if (this.githubAPI.hasToken()) {
            tokenInput.placeholder = '••••••••••••••••••••';
        }

        saveBtn?.addEventListener('click', () => {
            const token = tokenInput.value.trim();

            if (!token) {
                this.showTokenStatus('Please enter a token', 'error');
                return;
            }

            this.githubAPI.setToken(token);
            tokenInput.value = '';
            tokenInput.placeholder = '••••••••••••••••••••';
            this.showTokenStatus('Token saved successfully! You now have higher rate limits.', 'success');
        });

        clearBtn?.addEventListener('click', () => {
            this.githubAPI.clearToken();
            tokenInput.value = '';
            tokenInput.placeholder = 'ghp_xxxxxxxxxxxx';
            this.showTokenStatus('Token cleared', 'success');
        });
    }

    showTokenStatus(message: string, type: 'success' | 'error') {
        const statusDiv = document.getElementById('token-status');
        if (!statusDiv) return;

        statusDiv.textContent = message;
        statusDiv.className = `token-status ${type}`;

        setTimeout(() => {
            statusDiv.className = 'token-status';
        }, 5000);
    }

    // History Controls
    setupHistoryControls() {
        const sinceInput = document.getElementById('since-date') as HTMLInputElement;
        const untilInput = document.getElementById('until-date') as HTMLInputElement;
        const fetchBtn = document.getElementById('fetch-history-btn');
        const clearBtn = document.getElementById('clear-dates-btn');

        // Set default dates (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        untilInput.value = today.toISOString().split('T')[0];
        sinceInput.value = thirtyDaysAgo.toISOString().split('T')[0];

        // Quick range buttons
        document.querySelectorAll('.btn-quick').forEach(btn => {
            btn.addEventListener('click', () => {
                const days = parseInt((btn as HTMLElement).dataset.days || '30');
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - days);

                sinceInput.value = start.toISOString().split('T')[0];
                untilInput.value = end.toISOString().split('T')[0];
            });
        });

        // Fetch button
        fetchBtn?.addEventListener('click', async () => {
            const since = sinceInput.value ? new Date(sinceInput.value).toISOString() : undefined;
            const until = untilInput.value ? new Date(untilInput.value).toISOString() : undefined;

            await this.fetchHistory(since, until);
        });

        // Clear button
        clearBtn?.addEventListener('click', () => {
            sinceInput.value = '';
            untilInput.value = '';
        });
    }

    async fetchHistory(since?: string, until?: string) {
        const statusDiv = document.getElementById('history-status');
        const historyList = document.getElementById('history-list');
        const noHistory = document.getElementById('no-history');

        if (!statusDiv || !historyList || !noHistory) return;

        // Show loading
        statusDiv.textContent = 'Fetching commit history from GitHub...';
        statusDiv.className = 'history-status loading';
        historyList.innerHTML = '';
        noHistory.style.display = 'none';

        try {
            const commits = await this.githubAPI.fetchAllCommits(since, until);

            if (commits.size === 0) {
                statusDiv.textContent = 'No commits found in the specified date range.';
                statusDiv.className = 'history-status error';
                noHistory.style.display = 'block';
                return;
            }

            // Calculate total
            let totalCommits = 0;
            commits.forEach(list => totalCommits += list.length);

            statusDiv.textContent = `Found ${totalCommits} commits across ${commits.size} files`;
            statusDiv.className = 'history-status success';

            // Render commits grouped by file
            this.renderHistory(commits);

        } catch (error) {
            statusDiv.textContent = `Error: ${(error as Error).message}`;
            statusDiv.className = 'history-status error';
            noHistory.style.display = 'block';
        }
    }

    renderHistory(commitsByFile: Map<string, Commit[]>) {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;

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
                link.textContent = 'View on GitHub →';

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
                this.changes.sort((a, b) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
            }
        } catch (error) {
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

        document.getElementById('total-changes')!.textContent = totalChanges.toString();
        document.getElementById('chromium-changes')!.textContent = chromiumChanges.toString();
        document.getElementById('depot-tools-changes')!.textContent = depotToolsChanges.toString();
        document.getElementById('last-check')!.textContent = lastCheck;
    }

    renderChanges() {
        const changesList = document.getElementById('changes-list')!;
        const noChanges = document.getElementById('no-changes')!;

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

    filterChanges(): Change[] {
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

    renderChangeCard(change: Change): string {
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
                    ${change.url ? `<a href="${change.url}" target="_blank" class="btn">View on GitHub</a>` : ''}
                </div>
            </div>
        `;
    }

    setupChangeListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const filter = target.dataset.filter || 'all';

                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                target.classList.add('active');

                this.currentFilter = filter;
                this.renderChanges();
            });
        });

        // Diff modal
        const modal = document.getElementById('diff-modal')!;
        const closeBtn = document.querySelector('.close')!;

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // View diff buttons
        document.getElementById('changes-list')!.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('view-diff')) {
                const file = target.dataset.file!;
                const timestamp = target.dataset.timestamp!;
                this.showDiff(file, timestamp);
            }
        });
    }

    showDiff(file: string, timestamp: string) {
        const change = this.changes.find(c => c.file === file && c.timestamp === timestamp);

        if (!change || !change.diff_html) {
            return;
        }

        const modal = document.getElementById('diff-modal')!;
        const diffViewer = document.getElementById('diff-viewer')!;

        diffViewer.innerHTML = `
            <h2>${file}</h2>
            <p style="color: #8b949e; margin-bottom: 20px;">${change.summary} - ${this.formatTimestamp(change.timestamp)}</p>
            ${change.diff_html}
        `;

        modal.style.display = 'block';
    }

    formatTimestamp(timestamp: string): string {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDate(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) {
            return `${diffMins} min ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hr ago`;
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }
}

// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Dashboard());
} else {
    new Dashboard();
}

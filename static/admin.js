// Admin Panel JavaScript for Fast Finger Response System

class AdminPanel {
    constructor() {
        this.gameState = {
            active: false,
            current_team: null,
            round_number: 1
        };
        this.teams = {};
        this.pollState = {
            active: false,
            votes: { A: 0, B: 0, C: 0, D: 0 }
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialData();
        this.setupSocketListeners();
    }

    bindEvents() {
        // Game control buttons
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        document.getElementById('stop-game').addEventListener('click', () => this.stopGame());
        document.getElementById('reset-game').addEventListener('click', () => this.resetGame());

        // Team management
        document.getElementById('save-teams').addEventListener('click', () => this.saveTeams());

        // Poll control buttons
        document.getElementById('start-poll').addEventListener('click', () => this.startPoll());
        document.getElementById('stop-poll').addEventListener('click', () => this.stopPoll());
        document.getElementById('reset-poll').addEventListener('click', () => this.resetPoll());

        // Logs
        document.getElementById('refresh-logs').addEventListener('click', () => this.loadLogs());
    }

    async loadInitialData() {
        try {
            // Wait for utils to be available
            if (typeof utils === 'undefined') {
                console.warn('Utils not available yet, waiting...');
                setTimeout(() => this.loadInitialData(), 100);
                return;
            }
            
            const [gameState, teams, pollState] = await Promise.all([
                utils.apiRequest('/api/game-state'),
                utils.apiRequest('/api/teams'),
                utils.apiRequest('/api/poll')
            ]);

            this.updateGameState(gameState.game_state);
            this.updateTeams(gameState.teams);
            this.updatePollState(gameState.poll);
            this.loadLogs();
        } catch (error) {
            if (typeof utils !== 'undefined') {
                utils.showNotification('Failed to load initial data: ' + error.message, 'error');
            } else {
                console.error('Failed to load initial data:', error);
            }
        }
    }

    setupSocketListeners() {
        // Wait for socket to be available
        if (typeof socket === 'undefined') {
            console.warn('Socket not available yet, waiting...');
            setTimeout(() => this.setupSocketListeners(), 100);
            return;
        }
        
        socket.on('state_update', (data) => {
            this.updateGameState(data.game_state);
            this.updateTeams(data.teams);
            this.updatePollState(data.poll);
        });

        socket.on('game_started', (gameState) => {
            this.updateGameState(gameState);
            if (typeof utils !== 'undefined') {
                utils.showNotification('Game started!', 'success');
            }
        });

        socket.on('game_stopped', (gameState) => {
            this.updateGameState(gameState);
            if (typeof utils !== 'undefined') {
                utils.showNotification('Game stopped!', 'info');
            }
        });

        socket.on('game_reset', (gameState) => {
            this.updateGameState(gameState);
            if (typeof utils !== 'undefined') {
                utils.showNotification('Game reset for new round!', 'info');
            }
        });

        socket.on('team_buzzed', (data) => {
            this.gameState.current_team = data.team;
            this.updateWinnerDisplay(data);
            if (typeof utils !== 'undefined') {
                utils.showNotification(`${data.team_name} buzzed in!`, 'success');
            }
        });

        socket.on('teams_updated', (teams) => {
            this.updateTeams(teams);
            if (typeof utils !== 'undefined') {
                utils.showNotification('Team names updated!', 'success');
            }
        });

        socket.on('poll_started', (pollState) => {
            this.updatePollState(pollState);
            if (typeof utils !== 'undefined') {
                utils.showNotification('Poll started!', 'success');
            }
        });

        socket.on('poll_stopped', () => {
            this.pollState.active = false;
            this.updatePollControls();
            if (typeof utils !== 'undefined') {
                utils.showNotification('Poll stopped!', 'info');
            }
        });

        socket.on('poll_reset', () => {
            this.pollState = { active: false, votes: { A: 0, B: 0, C: 0, D: 0 } };
            this.updatePollState(this.pollState);
            if (typeof utils !== 'undefined') {
                utils.showNotification('Poll reset!', 'info');
            }
        });

        socket.on('poll_vote_update', (data) => {
            this.pollState.votes = data.votes;
            this.updatePollResults(data.votes, data.total_votes);
        });

        socket.on('log_update', () => {
            this.loadLogs();
        });
    }

    updateGameState(gameState) {
        this.gameState = gameState;
        
        // Update status display
        const statusText = gameState.active ? 'Game Active' : 'Game Inactive';
        utils.updateText('game-status', statusText);
        utils.updateText('round-number', `Round: ${gameState.round_number}`);

        // Update button states
        document.getElementById('start-game').disabled = gameState.active;
        document.getElementById('stop-game').disabled = !gameState.active;
        document.getElementById('reset-game').disabled = gameState.active;

        // Update winner display
        if (gameState.current_team && gameState.active) {
            this.showWinner(gameState.current_team, gameState.timestamp);
        } else {
            this.hideWinner();
        }
    }

    updateTeams(teams) {
        this.teams = teams;
        
        // Update team input fields
        Object.keys(teams).forEach(teamId => {
            const input = document.getElementById(teamId);
            if (input) {
                input.value = teams[teamId];
            }
        });
    }

    updatePollState(pollState) {
        this.pollState = pollState;
        this.updatePollControls();
        this.updatePollResults(pollState.votes || { A: 0, B: 0, C: 0, D: 0 });
    }

    updatePollControls() {
        const statusText = this.pollState.active ? 'Poll Active' : 'No Active Poll';
        utils.updateText('poll-status', statusText);

        document.getElementById('start-poll').disabled = this.pollState.active;
        document.getElementById('stop-poll').disabled = !this.pollState.active;
        document.getElementById('reset-poll').disabled = this.pollState.active;

        // Show/hide poll results
        const resultsElement = document.getElementById('poll-results');
        if (resultsElement) {
            resultsElement.style.display = this.pollState.active ? 'block' : 'none';
        }
    }

    updatePollResults(votes, totalVotes = null) {
        if (!votes) return;

        const total = totalVotes || Object.values(votes).reduce((a, b) => a + b, 0);
        
        ['A', 'B', 'C', 'D'].forEach(option => {
            const count = votes[option] || 0;
            const percentage = total > 0 ? (count / total * 100) : 0;
            
            utils.updateText(`vote-${option.toLowerCase()}-count`, count);
            utils.updateProgressBar(`vote-${option.toLowerCase()}-bar`, percentage);
        });

        utils.updateText('total-votes', total);
    }

    showWinner(teamId, timestamp) {
        const teamName = this.teams[teamId] || teamId;
        const timeStr = utils.formatTime(timestamp);
        
        utils.updateText('winner-team', teamName);
        utils.updateText('winner-time', `Time: ${timeStr}`);
        utils.toggleDisplay('current-winner', true);
    }

    hideWinner() {
        utils.toggleDisplay('current-winner', false);
    }

    updateWinnerDisplay(data) {
        // Update winner display functionality if needed
        if (data && data.team && data.team_name) {
            this.showWinner(data.team, data.timestamp);
        }
    }

    async startGame() {
        try {
            await utils.apiRequest('/api/start', 'POST');
        } catch (error) {
            utils.showNotification('Failed to start game: ' + error.message, 'error');
        }
    }

    async stopGame() {
        try {
            await utils.apiRequest('/api/stop', 'POST');
        } catch (error) {
            utils.showNotification('Failed to stop game: ' + error.message, 'error');
        }
    }

    async resetGame() {
        try {
            await utils.apiRequest('/api/reset', 'POST');
        } catch (error) {
            utils.showNotification('Failed to reset game: ' + error.message, 'error');
        }
    }

    async saveTeams() {
        try {
            const teams = {};
            ['team1', 'team2', 'team3', 'team4', 'team5', 'team6'].forEach(teamId => {
                const input = document.getElementById(teamId);
                if (input) {
                    teams[teamId] = input.value.trim() || teamId;
                }
            });

            await utils.apiRequest('/api/teams', 'POST', teams);
        } catch (error) {
            utils.showNotification('Failed to save teams: ' + error.message, 'error');
        }
    }

    async startPoll() {
        const questionInput = document.getElementById('poll-question');
        const question = questionInput ? questionInput.value.trim() : '';
        
        if (!question) {
            utils.showNotification('Please enter a poll question', 'error');
            return;
        }

        try {
            await utils.apiRequest('/api/poll', 'POST', { question });
            if (questionInput) questionInput.value = '';
        } catch (error) {
            utils.showNotification('Failed to start poll: ' + error.message, 'error');
        }
    }

    async stopPoll() {
        try {
            await utils.apiRequest('/api/poll/stop', 'POST');
        } catch (error) {
            utils.showNotification('Failed to stop poll: ' + error.message, 'error');
        }
    }

    async resetPoll() {
        try {
            await utils.apiRequest('/api/poll/reset', 'POST');
        } catch (error) {
            utils.showNotification('Failed to reset poll: ' + error.message, 'error');
        }
    }

    async loadLogs() {
        try {
            const logs = await utils.apiRequest('/api/logs');
            this.displayLogs(logs);
        } catch (error) {
            utils.showNotification('Failed to load logs: ' + error.message, 'error');
        }
    }

    displayLogs(logs) {
        const container = document.getElementById('logs-container');
        if (!container) return;

        if (logs.length === 0) {
            container.innerHTML = '<p>No logs available</p>';
            return;
        }

        const logsHTML = logs.reverse().map(log => `
            <div class="log-entry">
                <div class="log-timestamp">${utils.formatDate(log.timestamp)}</div>
                <div class="log-details">
                    <strong>Round ${log.round}:</strong> ${log.details}
                    ${log.team ? ` (Team: ${this.teams[log.team] || log.team})` : ''}
                </div>
            </div>
        `).join('');

        container.innerHTML = logsHTML;
    }
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for main.js to load utils and socket
    setTimeout(() => {
        const adminPanel = new AdminPanel();
        window.adminPanel = adminPanel; // Make available globally for debugging
    }, 200);
});
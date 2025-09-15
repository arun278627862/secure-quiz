// Display Screen JavaScript for Fast Finger Response System

class DisplayScreen {
    constructor() {
        this.gameState = {
            active: false,
            current_team: null,
            round_number: 1
        };
        this.teams = {};
        this.pollState = {
            active: false,
            question: '',
            votes: { A: 0, B: 0, C: 0, D: 0 }
        };
        this.init();
    }

    init() {
        this.loadInitialData();
        this.setupSocketListeners();
        this.startClock();
    }

    async loadInitialData() {
        try {
            const gameState = await utils.apiRequest('/api/game-state');
            this.updateGameState(gameState.game_state);
            this.updateTeams(gameState.teams);
            this.updatePollState(gameState.poll);
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    setupSocketListeners() {
        socket.on('state_update', (data) => {
            this.updateGameState(data.game_state);
            this.updateTeams(data.teams);
            this.updatePollState(data.poll);
        });

        socket.on('game_started', (gameState) => {
            this.updateGameState(gameState);
            this.showGameDisplay();
            this.animateGameStart();
        });

        socket.on('game_stopped', (gameState) => {
            this.updateGameState(gameState);
        });

        socket.on('game_reset', (gameState) => {
            this.updateGameState(gameState);
            this.hideWinnerDisplay();
            this.resetTeamCards();
        });

        socket.on('team_buzzed', (data) => {
            this.gameState.current_team = data.team;
            this.showWinner(data.team, data.team_name, data.timestamp);
            this.updateTeamCards();
            this.playWinnerAnimation();
        });

        socket.on('teams_updated', (teams) => {
            this.updateTeams(teams);
        });

        socket.on('poll_started', (pollState) => {
            this.updatePollState(pollState);
            this.showPollDisplay();
        });

        socket.on('poll_stopped', () => {
            this.pollState.active = false;
            this.showGameDisplay();
        });

        socket.on('poll_reset', () => {
            this.pollState = {
                active: false,
                question: '',
                votes: { A: 0, B: 0, C: 0, D: 0 }
            };
            this.showGameDisplay();
        });

        socket.on('poll_vote_update', (data) => {
            this.pollState.votes = data.votes;
            this.updatePollResults(data.votes, data.total_votes);
        });
    }

    updateGameState(gameState) {
        this.gameState = gameState;
        
        // Update status display
        const statusText = gameState.active ? 
            (gameState.current_team ? 'Round Complete' : 'Round Active') : 
            'Waiting for Game';
        const statusIcon = gameState.active ? 
            (gameState.current_team ? '🏆' : '🔴') : 
            '⏸️';
            
        utils.updateText('status-text', statusText);
        utils.updateText('status-icon', statusIcon);
        utils.updateText('display-status', statusText);
        utils.updateText('display-round', `Round: ${gameState.round_number}`);

        // Update team cards
        this.updateTeamCards();

        // Show winner if someone has buzzed
        if (gameState.current_team && gameState.active) {
            const teamName = this.teams[gameState.current_team] || gameState.current_team;
            this.showWinner(gameState.current_team, teamName, gameState.timestamp);
        } else {
            this.hideWinnerDisplay();
        }
    }

    updateTeams(teams) {
        this.teams = teams;
        
        // Update team display names
        Object.keys(teams).forEach(teamId => {
            const element = document.getElementById(`display-${teamId}`);
            if (element) {
                element.textContent = teams[teamId];
            }
        });
    }

    updateTeamCards() {
        document.querySelectorAll('.team-card').forEach(card => {
            const teamId = card.getAttribute('data-team');
            const statusElement = card.querySelector('.team-status');
            
            // Remove all status classes
            card.classList.remove('active', 'winner');
            
            if (!this.gameState.active) {
                if (statusElement) statusElement.textContent = 'Waiting';
            } else if (this.gameState.current_team) {
                if (teamId === this.gameState.current_team) {
                    card.classList.add('winner');
                    if (statusElement) statusElement.textContent = 'WINNER!';
                } else {
                    if (statusElement) statusElement.textContent = 'Ready';
                }
            } else {
                card.classList.add('active');
                if (statusElement) statusElement.textContent = 'Ready';
            }
        });
    }

    resetTeamCards() {
        document.querySelectorAll('.team-card').forEach(card => {
            card.classList.remove('active', 'winner');
            const statusElement = card.querySelector('.team-status');
            if (statusElement) {
                statusElement.textContent = 'Ready';
            }
        });
    }

    showWinner(teamId, teamName, timestamp) {
        utils.updateText('display-winner-team', teamName);
        utils.updateText('display-winner-time', `Time: ${utils.formatTime(timestamp)}`);
        utils.toggleDisplay('winner-display', true);
    }

    hideWinnerDisplay() {
        utils.toggleDisplay('winner-display', false);
    }

    updatePollState(pollState) {
        this.pollState = pollState;
        
        if (pollState.active) {
            utils.updateText('display-poll-question', pollState.question);
            this.updatePollResults(pollState.votes || { A: 0, B: 0, C: 0, D: 0 });
        }
    }

    updatePollResults(votes, totalVotes = null) {
        if (!votes) return;

        const total = totalVotes || Object.values(votes).reduce((a, b) => a + b, 0);
        
        ['A', 'B', 'C', 'D'].forEach(option => {
            const count = votes[option] || 0;
            const percentage = total > 0 ? (count / total * 100) : 0;
            
            utils.updateText(`display-count-${option.toLowerCase()}`, count);
            utils.updateProgressBar(`display-option-${option.toLowerCase()}`, percentage);
        });

        utils.updateText('display-total-votes', total);
    }

    showGameDisplay() {
        utils.toggleDisplay('game-display', true);
        utils.toggleDisplay('poll-display', false);
    }

    showPollDisplay() {
        utils.toggleDisplay('game-display', false);
        utils.toggleDisplay('poll-display', true);
    }

    animateGameStart() {
        const stateIndicator = document.getElementById('state-indicator');
        if (stateIndicator) {
            stateIndicator.style.animation = 'pulse 2s ease-in-out 3';
        }
    }

    playWinnerAnimation() {
        const winnerDisplay = document.getElementById('winner-display');
        if (winnerDisplay) {
            winnerDisplay.style.animation = 'celebration 2s ease-in-out';
        }
    }

    startClock() {
        setInterval(() => {
            this.updateCurrentTime();
        }, 1000);
        this.updateCurrentTime();
    }

    updateCurrentTime() {
        const timeElement = document.getElementById('current-time');
        if (timeElement) {
            const now = new Date();
            timeElement.textContent = now.toLocaleTimeString();
        }
    }
}

// Initialize display screen when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const displayScreen = new DisplayScreen();
    window.displayScreen = displayScreen; // Make available globally
});
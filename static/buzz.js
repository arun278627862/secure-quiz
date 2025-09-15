// Buzz-in Page JavaScript for Fast Finger Response System

class BuzzPage {
    constructor() {
        this.gameState = {
            active: false,
            current_team: null,
            round_number: 1
        };
        this.teams = {};
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialData();
        this.setupSocketListeners();
    }

    bindEvents() {
        // Add click handlers to all team buttons
        document.querySelectorAll('.team-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const teamId = button.getAttribute('data-team');
                this.buzzIn(teamId);
            });
        });
    }

    async loadInitialData() {
        try {
            const gameState = await utils.apiRequest('/api/game-state');
            this.updateGameState(gameState.game_state);
            this.updateTeams(gameState.teams);
        } catch (error) {
            utils.showNotification('Failed to load game data: ' + error.message, 'error');
        }
    }

    setupSocketListeners() {
        socket.on('state_update', (data) => {
            this.updateGameState(data.game_state);
            this.updateTeams(data.teams);
        });

        socket.on('game_started', (gameState) => {
            this.updateGameState(gameState);
            this.hideWinnerAnnouncement();
            utils.showNotification('Game started! Click your team button to buzz in!', 'success');
        });

        socket.on('game_stopped', (gameState) => {
            this.updateGameState(gameState);
            utils.showNotification('Game stopped!', 'info');
        });

        socket.on('game_reset', (gameState) => {
            this.updateGameState(gameState);
            this.hideWinnerAnnouncement();
            this.resetTeamButtons();
            utils.showNotification('Game reset! Ready for new round!', 'info');
        });

        socket.on('team_buzzed', (data) => {
            this.gameState.current_team = data.team;
            this.showWinner(data.team, data.team_name, data.timestamp);
            this.updateTeamButtons();
            
            // Play buzz sound effect if available
            this.playBuzzSound();
        });

        socket.on('teams_updated', (teams) => {
            this.updateTeams(teams);
        });
    }

    updateGameState(gameState) {
        this.gameState = gameState;
        
        // Update status banner
        const statusText = gameState.active ? 'Game Active - Click your team button!' : 'Waiting for game to start...';
        utils.updateText('game-status-text', statusText);
        utils.updateText('round-info', `Round: ${gameState.round_number}`);

        // Update team buttons based on game state
        this.updateTeamButtons();

        // Show winner if someone has already buzzed
        if (gameState.current_team && gameState.active) {
            const teamName = this.teams[gameState.current_team] || gameState.current_team;
            this.showWinner(gameState.current_team, teamName, gameState.timestamp);
        }
    }

    updateTeams(teams) {
        this.teams = teams;
        
        // Update team button names
        Object.keys(teams).forEach(teamId => {
            const button = document.getElementById(`${teamId}-btn`);
            if (button) {
                const nameElement = button.querySelector('.team-name');
                if (nameElement) {
                    nameElement.textContent = teams[teamId];
                }
            }
        });
    }

    updateTeamButtons() {
        document.querySelectorAll('.team-button').forEach(button => {
            const teamId = button.getAttribute('data-team');
            const statusElement = button.querySelector('.buzz-status');
            
            // Remove all status classes
            button.classList.remove('active', 'winner', 'disabled');
            
            if (!this.gameState.active) {
                // Game not active
                button.disabled = true;
                button.classList.add('disabled');
                if (statusElement) statusElement.textContent = 'Waiting...';
            } else if (this.gameState.current_team) {
                // Someone has already buzzed
                button.disabled = true;
                if (teamId === this.gameState.current_team) {
                    button.classList.add('winner');
                    if (statusElement) statusElement.textContent = 'WINNER!';
                } else {
                    button.classList.add('disabled');
                    if (statusElement) statusElement.textContent = 'Too late';
                }
            } else {
                // Game active, ready to buzz
                button.disabled = false;
                if (statusElement) statusElement.textContent = 'Ready';
            }
        });
    }

    resetTeamButtons() {
        document.querySelectorAll('.team-button').forEach(button => {
            button.classList.remove('active', 'winner', 'disabled');
            const statusElement = button.querySelector('.buzz-status');
            if (statusElement) {
                statusElement.textContent = 'Ready';
            }
        });
    }

    showWinner(teamId, teamName, timestamp) {
        const announcementElement = document.getElementById('winner-announcement');
        const teamNameElement = document.getElementById('winner-team-name');
        const timestampElement = document.getElementById('winner-timestamp');
        
        if (announcementElement && teamNameElement && timestampElement) {
            teamNameElement.textContent = teamName;
            timestampElement.textContent = `Time: ${utils.formatTime(timestamp)}`;
            announcementElement.style.display = 'block';
            
            // Add celebration animation
            announcementElement.style.animation = 'celebration 1s ease-in-out';
        }
    }

    hideWinnerAnnouncement() {
        const announcementElement = document.getElementById('winner-announcement');
        if (announcementElement) {
            announcementElement.style.display = 'none';
        }
    }

    async buzzIn(teamId) {
        if (!this.gameState.active || this.gameState.current_team) {
            return; // Game not active or someone already buzzed
        }

        try {
            // Immediately disable the button to prevent double-clicks
            const button = document.getElementById(`${teamId}-btn`);
            if (button) {
                button.disabled = true;
                button.classList.add('active');
                
                const statusElement = button.querySelector('.buzz-status');
                if (statusElement) {
                    statusElement.textContent = 'Buzzing...';
                }
            }

            const result = await utils.apiRequest('/api/buzz', 'POST', { team: teamId });
            utils.showNotification(`${result.team} buzzed in!`, 'success');
            
        } catch (error) {
            // Re-enable button if request failed
            const button = document.getElementById(`${teamId}-btn`);
            if (button) {
                button.disabled = false;
                button.classList.remove('active');
                
                const statusElement = button.querySelector('.buzz-status');
                if (statusElement) {
                    statusElement.textContent = 'Ready';
                }
            }
            
            if (error.message.includes('already buzzed')) {
                utils.showNotification('Someone else already buzzed in!', 'info');
            } else if (error.message.includes('not active')) {
                utils.showNotification('Game is not active!', 'error');
            } else {
                utils.showNotification('Failed to buzz in: ' + error.message, 'error');
            }
        }
    }

    playBuzzSound() {
        // Create a simple beep sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            // Audio not supported or permission denied
            console.log('Audio playback not available');
        }
    }

    // Keyboard shortcuts for accessibility
    handleKeyPress(event) {
        const keyMap = {
            '1': 'team1',
            '2': 'team2',
            '3': 'team3',
            '4': 'team4',
            '5': 'team5',
            '6': 'team6'
        };

        const teamId = keyMap[event.key];
        if (teamId && this.gameState.active && !this.gameState.current_team) {
            this.buzzIn(teamId);
        }
    }
}

// Initialize buzz page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const buzzPage = new BuzzPage();
    window.buzzPage = buzzPage; // Make available globally

    // Add keyboard event listener
    document.addEventListener('keypress', (event) => {
        buzzPage.handleKeyPress(event);
    });

    // Add visual feedback for keyboard shortcuts
    const instructions = document.querySelector('.instructions ul');
    if (instructions) {
        const keyboardInstruction = document.createElement('li');
        keyboardInstruction.textContent = 'Use keyboard keys 1-6 for quick team buzz-in';
        instructions.appendChild(keyboardInstruction);
    }
});
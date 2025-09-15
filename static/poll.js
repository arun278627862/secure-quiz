// Poll Page JavaScript for Secure Poll

class PollPage {
    constructor() {
        this.pollState = {
            active: false,
            question: '',
            type: 'multiple_choice',
            options: {},
            votes: {},
            winner: null,
            winner_percentage: 0,
            total_votes: 0
        };
        this.hasVoted = false;
        this.selectedOption = null;
        this.winnerShown = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialData();
        this.startRealTimeUpdates();
    }

    bindEvents() {
        // Add click handlers to poll option buttons
        document.querySelectorAll('.poll-option-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const option = button.getAttribute('data-option');
                this.selectOption(option);
            });
        });
    }

    async loadInitialData() {
        try {
            const pollState = await utils.apiRequest('/api/poll');
            this.updatePollState(pollState);
        } catch (error) {
            console.error('Failed to load poll data:', error);
        }
    }

    startRealTimeUpdates() {
        // Poll for updates every 500ms for real-time feel
        setInterval(async () => {
            try {
                const pollState = await utils.apiRequest('/api/poll');
                this.updatePollState(pollState);
            } catch (error) {
                console.error('Failed to fetch poll updates:', error);
            }
        }, 500);
    }

    updatePollState(pollState) {
        this.pollState = pollState;
        this.updatePollInterface();
        
        if (pollState.active) {
            this.updatePollResults(pollState.votes || {});
            this.showPollOptions(pollState.options || {});
        }
    }

    updatePollInterface() {
        const statusText = this.pollState.active ? '🟢 Poll Active - Cast Your Vote!' : '🔴 Waiting for poll to start...';
        utils.updateText('poll-status-text', statusText);

        if (this.pollState.active) {
            utils.toggleDisplay('poll-container', true);
            
            if (this.hasVoted) {
                this.showVoteConfirmation();
            } else {
                this.showPollOptions(this.pollState.options || {});
            }
        } else {
            utils.toggleDisplay('poll-container', false);
            utils.toggleDisplay('vote-confirmation', false);
            utils.toggleDisplay('poll-results', false);
        }
    }

    showPollOptions(options = {}) {
        utils.toggleDisplay('vote-confirmation', false);
        
        // Show/hide options based on poll type and available options
        const optionKeys = Object.keys(options);
        ['A', 'B', 'C', 'D', 'E'].forEach(key => {
            const button = document.getElementById(`option-${key.toLowerCase()}`);
            const textElement = document.getElementById(`option-${key.toLowerCase()}-text`);
            
            if (optionKeys.includes(key) && button) {
                button.style.display = 'flex';
                button.disabled = false;
                button.classList.remove('selected', 'disabled');
                
                if (textElement) {
                    textElement.textContent = options[key] || `Option ${key}`;
                }
            } else if (button) {
                button.style.display = 'none';
            }
        });
    }

    showVoteConfirmation() {
        utils.toggleDisplay('vote-confirmation', true);
        utils.toggleDisplay('poll-results', true);
        
        // Update confirmation message
        if (this.selectedOption) {
            const optionText = this.pollState.options[this.selectedOption] || `Option ${this.selectedOption}`;
            utils.updateText('selected-option', `${this.selectedOption} - ${optionText}`);
        }
        
        // Disable all option buttons
        document.querySelectorAll('.poll-option-btn').forEach(button => {
            button.disabled = true;
            button.classList.add('disabled');
            
            if (button.getAttribute('data-option') === this.selectedOption) {
                button.classList.add('selected');
            }
        });
    }

    resetPollInterface() {
        utils.toggleDisplay('vote-confirmation', false);
        utils.toggleDisplay('poll-results', false);
        this.hideWinnerAnnouncement();
        
        // Reset all option buttons
        document.querySelectorAll('.poll-option-btn').forEach(button => {
            button.disabled = false;
            button.classList.remove('selected', 'disabled');
        });
    }

    showWinnerAnnouncement(winner, percentage, options = {}) {
        if (!winner) return;
        
        this.winnerShown = true;
        const winnerElement = document.getElementById('winner-announcement');
        
        if (winnerElement) {
            utils.updateText('winner-option-display', winner);
            utils.updateText('winner-percentage-display', `${percentage}%`);
            
            const winnerText = options[winner] || `Option ${winner}`;
            utils.updateText('winner-description', `🎉 "${winnerText}" wins with ${percentage}% of votes!`);
            
            utils.toggleDisplay('winner-announcement', true);
            
            // Add celebration animation
            winnerElement.classList.add('fade-in');
        }
    }

    updateWinnerDisplay(winner, percentage, options = {}) {
        if (!winner || this.winnerShown) return;
        
        // Only show winner if poll is still active and has significant lead
        if (this.pollState.active && percentage >= 50 && this.pollState.total_votes >= 5) {
            this.showWinnerAnnouncement(winner, percentage, options);
        }
    }

    hideWinnerAnnouncement() {
        utils.toggleDisplay('winner-announcement', false);
        this.winnerShown = false;
    }

    async selectOption(option) {
        if (!this.pollState.active || this.hasVoted) {
            return;
        }

        try {
            // Immediately mark as voted to prevent double voting
            this.hasVoted = true;
            this.selectedOption = option;
            
            // Visual feedback with animation
            const button = document.querySelector(`[data-option="${option}"]`);
            if (button) {
                button.classList.add('selected');
                button.disabled = true;
                
                // Add pulse animation
                button.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    button.style.transform = '';
                }, 200);
            }

            const result = await utils.apiRequest('/api/poll/vote', 'POST', { option });
            
            this.showVoteConfirmation();
            utils.showNotification(`✅ Vote cast for option ${option}!`, 'success');
            
        } catch (error) {
            // Reset vote state on error
            this.hasVoted = false;
            this.selectedOption = null;
            
            // Reset button state
            const button = document.querySelector(`[data-option="${option}"]`);
            if (button) {
                button.classList.remove('selected');
                button.disabled = false;
                button.style.transform = '';
            }
            
            if (error.message.includes('already voted')) {
                this.hasVoted = true;
                this.showVoteConfirmation();
                utils.showNotification('⚠️ You have already voted in this poll!', 'info');
            } else if (error.message.includes('No active poll')) {
                utils.showNotification('❌ No active poll available!', 'error');
            } else {
                utils.showNotification('❌ Failed to cast vote: ' + error.message, 'error');
            }
        }
    }

    updatePollResults(votes, totalVotes = null) {
        if (!votes) return;

        const total = totalVotes || Object.values(votes).reduce((a, b) => a + b, 0);
        
        // Get available options from current poll state
        const availableOptions = Object.keys(this.pollState.options || votes);
        
        availableOptions.forEach(option => {
            const count = votes[option] || 0;
            const percentage = total > 0 ? (count / total * 100) : 0;
            
            const optionLower = option.toLowerCase();
            utils.updateText(`count-${optionLower}`, count);
            utils.updateProgressBar(`result-${optionLower}`, percentage);
            
            // Show/hide result items based on available options
            const resultItem = document.getElementById(`result-item-${optionLower}`);
            if (resultItem) {
                resultItem.style.display = availableOptions.includes(option) ? 'flex' : 'none';
            }
        });
        
        // Hide unused result items
        ['A', 'B', 'C', 'D', 'E'].forEach(option => {
            if (!availableOptions.includes(option)) {
                const resultItem = document.getElementById(`result-item-${option.toLowerCase()}`);
                if (resultItem) {
                    resultItem.style.display = 'none';
                }
            }
        });

        utils.updateText('total-votes-display', total);
        
        // Show results if user has voted
        if (this.hasVoted && this.pollState.active) {
            utils.toggleDisplay('poll-results', true);
        }
        
        // Add visual feedback for leading option
        if (total > 0) {
            const maxVotes = Math.max(...Object.values(votes));
            availableOptions.forEach(option => {
                const resultFill = document.getElementById(`result-${option.toLowerCase()}`);
                if (resultFill && votes[option] === maxVotes && maxVotes > 0) {
                    resultFill.style.background = 'var(--warning-gradient)';
                } else if (resultFill) {
                    resultFill.style.background = 'var(--success-gradient)';
                }
            });
        }
    }

    // Keyboard shortcuts for voting
    handleKeyPress(event) {
        if (!this.pollState.active || this.hasVoted) {
            return;
        }

        const keyMap = {
            'a': 'A',
            'b': 'B',
            'c': 'C',
            'd': 'D'
        };

        const option = keyMap[event.key.toLowerCase()];
        if (option) {
            this.selectOption(option);
        }
    }
}

// Initialize poll page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const pollPage = new PollPage();
    window.pollPage = pollPage; // Make available globally

    // Add keyboard event listener
    document.addEventListener('keypress', (event) => {
        pollPage.handleKeyPress(event);
    });

    // Add visual feedback for keyboard shortcuts
    const instructions = document.querySelector('.poll-instructions ul');
    if (instructions) {
        const keyboardInstruction = document.createElement('li');
        keyboardInstruction.textContent = 'Use keyboard keys A, B, C, D for quick voting';
        instructions.appendChild(keyboardInstruction);
    }
});
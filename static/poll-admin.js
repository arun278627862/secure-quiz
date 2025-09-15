// Poll Admin JavaScript for Fast Finger Response System

class PollAdmin {
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
        this.pollStartTime = null;
        this.voteRateInterval = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialData();
        this.setupSocketListeners();
        this.startVoteRateTracking();
    }

    bindEvents() {
        // Poll control buttons
        document.getElementById('admin-start-poll').addEventListener('click', () => this.startPoll());
        document.getElementById('admin-stop-poll').addEventListener('click', () => this.stopPoll());
        document.getElementById('admin-reset-poll').addEventListener('click', () => this.resetPoll());
    }

    async loadInitialData() {
        try {
            const pollState = await utils.apiRequest('/api/poll');
            this.updatePollState(pollState);
        } catch (error) {
            utils.showNotification('Failed to load poll data: ' + error.message, 'error');
        }
    }

    setupSocketListeners() {
        socket.on('state_update', (data) => {
            this.updatePollState(data.poll);
        });

        socket.on('poll_started', (pollState) => {
            this.updatePollState(pollState);
            this.pollStartTime = new Date();
            utils.showNotification('Poll started successfully!', 'success');
        });

        socket.on('poll_stopped', () => {
            this.pollState.active = false;
            this.updatePollControls();
            utils.showNotification('Poll stopped!', 'info');
        });

        socket.on('poll_reset', () => {
            this.pollState = {
                active: false,
                question: '',
                votes: { A: 0, B: 0, C: 0, D: 0 }
            };
            this.pollStartTime = null;
            this.updatePollState(this.pollState);
            utils.showNotification('Poll reset!', 'info');
        });

        socket.on('poll_vote_update', (data) => {
            this.pollState.votes = data.votes;
            this.pollState.winner = data.winner;
            this.pollState.winner_percentage = data.winner_percentage;
            this.pollState.total_votes = data.total_votes;
            
            this.updatePollResults(data.votes, data.total_votes);
            this.updateStatistics(data.votes, data.total_votes);
        });
    }

    updatePollState(pollState) {
        this.pollState = pollState;
        this.updatePollControls();
        this.updatePollResults(pollState.votes || { A: 0, B: 0, C: 0, D: 0 });
        this.updateStatistics(pollState.votes || { A: 0, B: 0, C: 0, D: 0 });
    }

    updatePollControls() {
        const statusText = this.pollState.active ? 'Poll Active' : 'No Active Poll';
        utils.updateText('admin-poll-status', statusText);

        document.getElementById('admin-start-poll').disabled = this.pollState.active;
        document.getElementById('admin-stop-poll').disabled = !this.pollState.active;
        document.getElementById('admin-reset-poll').disabled = this.pollState.active;
    }

    updatePollResults(votes, totalVotes = null) {
        if (!votes) return;

        const total = totalVotes || Object.values(votes).reduce((a, b) => a + b, 0);
        const availableOptions = Object.keys(votes);
        
        availableOptions.forEach(option => {
            const count = votes[option] || 0;
            const percentage = total > 0 ? (count / total * 100) : 0;
            
            const optionLower = option.toLowerCase();
            utils.updateText(`admin-vote-${optionLower}-count`, count);
            utils.updateText(`admin-vote-${optionLower}-percent`, `${percentage.toFixed(1)}%`);
            utils.updateProgressBar(`admin-vote-${optionLower}-bar`, percentage);
        });

        utils.updateText('admin-total-votes', total);
    }

    updateStatistics(votes, totalVotes = null) {
        if (!votes) return;

        const total = totalVotes || Object.values(votes).reduce((a, b) => a + b, 0);
        
        // Update total votes
        utils.updateText('stat-total-votes', total);
        
        // Find leading option
        let leadingOption = 'None';
        let maxVotes = 0;
        Object.entries(votes).forEach(([option, count]) => {
            if (count > maxVotes) {
                maxVotes = count;
                leadingOption = option;
            }
        });
        
        if (total === 0) {
            leadingOption = '-';
        }
        
        utils.updateText('stat-leading-option', leadingOption);
        
        // Calculate vote rate (votes per minute)
        let voteRate = 0;
        if (this.pollStartTime && this.pollState.active) {
            const elapsedMinutes = (new Date() - this.pollStartTime) / (1000 * 60);
            voteRate = elapsedMinutes > 0 ? Math.round(total / elapsedMinutes) : 0;
        }
        
        utils.updateText('stat-vote-rate', voteRate);
        
        // Update unique devices (approximated by total votes for now)
        utils.updateText('stat-devices', total);
    }

    async startPoll() {
        const questionInput = document.getElementById('admin-poll-question');
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

    startVoteRateTracking() {
        // Update vote rate every 10 seconds
        this.voteRateInterval = setInterval(() => {
            if (this.pollState.active && this.pollStartTime) {
                const total = Object.values(this.pollState.votes).reduce((a, b) => a + b, 0);
                this.updateStatistics(this.pollState.votes, total);
            }
        }, 10000);
    }

    destroy() {
        if (this.voteRateInterval) {
            clearInterval(this.voteRateInterval);
        }
    }
}

// Initialize poll admin when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const pollAdmin = new PollAdmin();
    window.pollAdmin = pollAdmin; // Make available globally
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.pollAdmin) {
            window.pollAdmin.destroy();
        }
    });
});
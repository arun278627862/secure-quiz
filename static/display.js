// Display Screen JavaScript for Secure Poll

class DisplayScreen {
    constructor() {
        this.pollState = {
            active: false,
            question: '',
            votes: { A: 0, B: 0, C: 0, D: 0 },
            options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' }
        };
        this.init();
    }

    init() {
        this.loadInitialData();
        this.startRealTimeUpdates();
        this.startClock();
    }

    async loadInitialData() {
        try {
            const pollState = await utils.apiRequest('/api/poll');
            this.updatePollState(pollState);
        } catch (error) {
            console.error('Failed to load initial data:', error);
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
        this.updatePollDisplay();
    }

    updatePollDisplay() {
        if (this.pollState.active) {
            utils.updateText('display-status', 'Poll Active');
            this.updatePollResults(this.pollState.votes);
            this.showPollDisplay();
        } else {
            utils.updateText('display-status', 'Waiting for Poll');
            this.updatePollResults({ A: 0, B: 0, C: 0, D: 0 });
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

    showPollDisplay() {
        utils.toggleDisplay('poll-display', true);
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
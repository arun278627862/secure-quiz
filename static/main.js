// Common JavaScript functions for Secure Poll

// Initialize Socket.IO connection
let socket;

function initializeSocket() {
    if (typeof io !== 'undefined') {
        socket = io({
            transports: ['polling', 'websocket'],
            upgrade: true,
            rememberUpgrade: false,
            timeout: 20000,
            forceNew: true
        });
        
        socket.on('connect', () => {
            console.log('Socket.IO connected successfully');
        });
        
        socket.on('disconnect', () => {
            console.log('Socket.IO disconnected');
        });
        
        socket.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
            // Retry connection after 2 seconds
            setTimeout(() => {
                console.log('Retrying Socket.IO connection...');
                socket.connect();
            }, 2000);
        });
        
        window.socket = socket; // Make globally available
    } else {
        console.warn('Socket.IO not loaded yet, retrying in 100ms...');
        setTimeout(initializeSocket, 100);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeSocket);

// Common utility functions
const utils = {
    // Format timestamp for display
    formatTime: function(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    },

    // Format date for display
    formatDate: function(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    },

    // Show notification
    showNotification: function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#4299e1'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    },

    // Make API request
    apiRequest: async function(url, method = 'GET', data = null) {
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };
            
            if (data) {
                options.body = JSON.stringify(data);
            }
            
            const response = await fetch(url, options);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Request failed');
            }
            
            return result;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },

    // Update element text safely
    updateText: function(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    },

    // Update element HTML safely
    updateHTML: function(elementId, html) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = html;
        }
    },

    // Add class to element
    addClass: function(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add(className);
        }
    },

    // Remove class from element
    removeClass: function(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove(className);
        }
    },

    // Toggle class on element
    toggleClass: function(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.toggle(className);
        }
    },

    // Show/hide element
    toggleDisplay: function(elementId, show) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = show ? 'block' : 'none';
        }
    },

    // Update progress bar
    updateProgressBar: function(elementId, percentage) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.width = percentage + '%';
        }
    },

    // Debounce function calls
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Tab management for admin panel
const tabManager = {
    init: function() {
        const tabs = document.querySelectorAll('.nav-tab');
        const contents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.getAttribute('data-tab');
                
                // Remove active class from all tabs and contents
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                const targetContent = document.getElementById(targetTab + '-tab');
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }
};

// Socket event handlers
function setupSocketListeners() {
    if (!socket) {
        console.warn('Socket not available, retrying in 100ms...');
        setTimeout(setupSocketListeners, 100);
        return;
    }
    
    socket.on('connect', function() {
        console.log('Connected to server');
    });

    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        utils.showNotification('Connection lost. Attempting to reconnect...', 'error');
    });

    socket.on('connect_error', function() {
        console.log('Connection error');
        utils.showNotification('Connection error. Please check your network.', 'error');
    });
}

// Update current time display
function updateCurrentTime() {
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString();
    }
}

// Initialize common functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize socket connection if not already done
    if (!socket && typeof io !== 'undefined') {
        socket = io();
        window.socket = socket; // Make globally available
    }
    
    // Setup socket listeners
    setupSocketListeners();
    
    // Initialize tab manager
    tabManager.init();
    
    // Update time every second
    setInterval(updateCurrentTime, 1000);
    updateCurrentTime();
    
    // Add smooth scrolling to all links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});

// Export utils for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { utils, socket, tabManager };
} else {
    window.utils = utils;
    window.socket = socket;
    window.tabManager = tabManager;
}
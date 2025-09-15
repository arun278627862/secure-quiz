# Secure Poll

A real-time web-based polling system designed for audience engagement and secure voting. This application provides a comprehensive polling system with real-time results and professional administration tools.

## Features

### 📊 Secure Polling System
- **Real-time voting** with A, B, C, D options
- **Device-based voting** (one vote per device)
- **Live results display** with vote counts and percentages
- **Professional poll management** with start/stop/reset controls
- **Real-time statistics** including vote rates and leading options
- **Secure voting** with device tracking to prevent duplicate votes

### 🎮 Professional Interface
- **Poll Admin Panel** for comprehensive poll management
- **Live Voting Page** for audience participation
- **Real-time Display Screen** for live results
- **Modern responsive design** with beautiful UI
- **Real-time updates** with instant polling

## Technology Stack

- **Backend**: Python Flask
- **Real-time Communication**: Flask-SocketIO
- **Frontend**: HTML5, CSS3, JavaScript
- **Data Storage**: JSON file-based storage
- **WebSocket**: Socket.IO for real-time updates

## Installation

### Prerequisites
- Python 3.7 or higher
- pip (Python package installer)

### Setup Instructions

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the application**
   ```bash
   python app.py
   ```

3. **Access the application**
   - Poll Admin Panel: `http://localhost:5000/poll-admin`
   - Display Screen: `http://localhost:5000/display`
   - Audience Poll: `http://localhost:5000/poll`
   - Main Admin: `http://localhost:5000/admin`

## Usage Guide

### For Administrators

1. **Access Admin Panel** (`/admin`)
   - Configure team names (up to 6 teams)
   - Start/stop/reset Fast Finger games
   - Manage audience polls
   - View game logs and statistics

2. **Team Management**
   - Enter custom team names in the Team Management section
   - Click "Save Teams" to update team names
   - Teams will be reflected across all interfaces

3. **Game Control**
   - **Start Game**: Activates the buzzer system
   - **Stop Game**: Deactivates the buzzer system
   - **Reset Round**: Clears current round and prepares for next

4. **Poll Management**
   - **Start Poll**: Creates a new audience poll with A, B, C, D options
   - **Stop Poll**: Ends the current poll
   - **Reset Poll**: Clears poll data and prepares for new poll

### For Teams

1. **Access Buzz-In Page** (`/buzz`)
   - Select your team from the available options
   - Click your team button when ready to buzz in
   - First team to buzz wins the round

### For Audience

1. **View Display Screen** (`/display`)
   - Watch live game updates
   - See current game state and team standings
   - View poll results in real-time

2. **Participate in Polls** (`/poll`)
   - Select from A, B, C, D options
   - Vote on current poll question
   - View live results

## File Structure

```
fast-finger-response/
├── app.py                 # Main Flask application
├── data.json             # Game data storage
├── requirements.txt      # Python dependencies
├── README.md            # This file
├── static/              # Static assets
│   ├── admin.js         # Admin panel JavaScript
│   ├── buzz.js          # Buzz-in page JavaScript
│   ├── display.js       # Display screen JavaScript
│   ├── poll.js          # Poll page JavaScript
│   ├── poll-admin.js    # Poll admin JavaScript
│   ├── main.js          # Common JavaScript functions
│   ├── style.css        # Main stylesheet
│   ├── style-arun.css   # Additional styles
│   ├── sw.js            # Service worker
│   └── favicon.ico      # Website icon
└── templates/           # HTML templates
    ├── admin.html       # Admin panel
    ├── buzz.html        # Team buzz-in page
    ├── display.html     # Display screen
    ├── index.html       # Home page (redirects to admin)
    ├── poll.html        # Audience poll page
    └── poll-admin.html  # Poll administration
```

## API Endpoints

### Game Management
- `GET /api/teams` - Get all teams
- `POST /api/teams` - Update team names
- `POST /api/start` - Start Fast Finger game
- `POST /api/stop` - Stop Fast Finger game
- `POST /api/reset` - Reset game state
- `GET /api/logs` - Get game logs
- `GET /api/game-state` - Get current game state

### Poll Management
- `GET /api/poll` - Get current poll state
- `POST /api/poll` - Create new poll
- `POST /api/poll/vote` - Submit vote
- `POST /api/poll/stop` - Stop poll
- `POST /api/poll/reset` - Reset poll

### Team Actions
- `POST /api/buzz` - Team buzz-in

## Configuration

### Default Settings
- **Port**: 5000
- **Host**: 0.0.0.0 (accessible from any IP)
- **Debug Mode**: Enabled
- **Max Teams**: 6
- **Poll Options**: A, B, C, D

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (responsive design)

## License

This project is developed for Secure Meters Ltd. All rights reserved.

---

**Developed by**: Secure Meters Ltd  
**Version**: 1.0  
**Last Updated**: 2025
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import os
from datetime import datetime
import threading
import time
from typing import Optional

app = Flask(__name__)
app.config['SECRET_KEY'] = 'fast_finger_secret_key_2025'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Data file path
DATA_FILE = 'data.json'

# Initialize data structure
DEFAULT_DATA = {
    'game_state': {
        'active': False,
        'current_team': None,
        'round_number': 1,
        'timestamp': None
    },
    'teams': {
        'team1': 'Team 1',
        'team2': 'Team 2',
        'team3': 'Team 3',
        'team4': 'Team 4',
        'team5': 'Team 5',
        'team6': 'Team 6'
    },
    'logs': [],
    'poll': {
        'active': False,
        'question': '',
        'type': 'multiple_choice',  # 'multiple_choice', 'yes_no', 'rating'
        'options': {
            'A': 'Option A',
            'B': 'Option B', 
            'C': 'Option C',
            'D': 'Option D'
        },
        'votes': {'A': 0, 'B': 0, 'C': 0, 'D': 0},
        'voted_devices': [],
        'winner': None,
        'winner_percentage': 0,
        'total_votes': 0,
        'started_at': None,
        'ended_at': None
    }
}

def load_data():
    """Load data from JSON file or create default"""
    if not os.path.exists(DATA_FILE):
        save_data(DEFAULT_DATA)
        return DEFAULT_DATA
    
    try:
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except:
        save_data(DEFAULT_DATA)
        return DEFAULT_DATA

def save_data(data):
    """Save data to JSON file"""
    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving data: {e}")

def log_event(event_type, details, team=None):
    """Log game events"""
    data = load_data()
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'type': event_type,
        'team': team,
        'details': details,
        'round': data['game_state']['round_number']
    }
    data['logs'].append(log_entry)
    save_data(data)
    
    # Emit log update to all clients
    socketio.emit('log_update', log_entry, namespace='/')

def get_client_ip():
    """Get client IP address for device tracking"""
    if request.environ.get('HTTP_X_FORWARDED_FOR') is None:
        return request.environ['REMOTE_ADDR']
    else:
        return request.environ['HTTP_X_FORWARDED_FOR']

# Routes
@app.route('/')
def index():
    """Redirect to admin panel"""
    return redirect(url_for('admin'))

@app.route('/admin')
def admin():
    """Admin panel for game control"""
    return render_template('admin.html')

@app.route('/buzz')
def buzz():
    """Team buzz-in page"""
    return render_template('buzz.html')

@app.route('/display')
def display():
    """Display screen for audience"""
    return render_template('display.html')

@app.route('/poll')
def poll():
    """Audience poll page"""
    return render_template('poll.html')

@app.route('/poll-admin')
def poll_admin():
    """Poll administration page"""
    return render_template('poll-admin.html')

# API Routes
@app.route('/api/teams', methods=['GET'])
def get_teams():
    """Get all teams"""
    data = load_data()
    return jsonify(data['teams'])

@app.route('/api/teams', methods=['POST'])
def update_teams():
    """Update team names"""
    try:
        new_teams = request.json
        if not new_teams or len(new_teams) != 6:
            return jsonify({'error': 'Must provide exactly 6 teams'}), 400
        
        data = load_data()
        data['teams'] = new_teams
        save_data(data)
        
        # Emit team update to all clients
        socketio.emit('teams_updated', new_teams, namespace='/')
        
        log_event('teams_updated', 'Team names updated')
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/start', methods=['POST'])
def start_game():
    """Start Fast Finger game"""
    try:
        data = load_data()
        
        # Stop any active poll
        if data['poll']['active']:
            data['poll']['active'] = False
            socketio.emit('poll_stopped', namespace='/')
        
        data['game_state']['active'] = True
        data['game_state']['current_team'] = None
        data['game_state']['timestamp'] = datetime.now().isoformat()
        save_data(data)
        
        # Emit game state to all clients
        socketio.emit('game_started', data['game_state'], namespace='/')
        
        log_event('game_started', f'Round {data["game_state"]["round_number"]} started')
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stop', methods=['POST'])
def stop_game():
    """Stop Fast Finger game"""
    try:
        data = load_data()
        data['game_state']['active'] = False
        save_data(data)
        
        # Emit game state to all clients
        socketio.emit('game_stopped', data['game_state'], namespace='/')
        
        log_event('game_stopped', 'Game stopped by admin')
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reset', methods=['POST'])
def reset_game():
    """Reset game state"""
    try:
        data = load_data()
        data['game_state']['active'] = False
        data['game_state']['current_team'] = None
        data['game_state']['round_number'] += 1
        save_data(data)
        
        # Emit reset to all clients
        socketio.emit('game_reset', data['game_state'], namespace='/')
        
        log_event('game_reset', f'Game reset, new round: {data["game_state"]["round_number"]}')
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/buzz', methods=['POST'])
def buzz_in():
    """Handle team buzz-in"""
    try:
        team_id = request.json.get('team')
        if not team_id:
            return jsonify({'error': 'Team ID required'}), 400
        
        data = load_data()
        
        # Check if game is active
        if not data['game_state']['active']:
            return jsonify({'error': 'Game is not active'}), 400
        
        # Check if someone already buzzed
        if data['game_state']['current_team']:
            return jsonify({'error': 'Someone already buzzed'}), 400
        
        # Record the buzz
        data['game_state']['current_team'] = team_id
        data['game_state']['timestamp'] = datetime.now().isoformat()
        save_data(data)
        
        team_name = data['teams'].get(team_id, team_id)
        
        # Emit buzz event to all clients
        socketio.emit('team_buzzed', {
            'team': team_id,
            'team_name': team_name,
            'timestamp': data['game_state']['timestamp']
        }, namespace='/')
        
        log_event('team_buzzed', f'{team_name} buzzed in', team_id)
        
        return jsonify({'success': True, 'team': team_name})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get game logs"""
    data = load_data()
    # Return last 50 logs
    return jsonify(data['logs'][-50:])

@app.route('/api/game-state', methods=['GET'])
def get_game_state():
    """Get current game state"""
    data = load_data()
    return jsonify({
        'game_state': data['game_state'],
        'teams': data['teams'],
        'poll': data['poll']
    })

# Poll API Routes
@app.route('/api/poll', methods=['GET'])
def get_poll():
    """Get current poll state"""
    data = load_data()
    return jsonify(data['poll'])

@app.route('/api/poll', methods=['POST'])
def create_poll():
    """Create new poll"""
    try:
        poll_data = request.json or {}
        question = poll_data.get('question', '')
        poll_type = poll_data.get('type', 'multiple_choice')
        custom_options = poll_data.get('options', {})
        
        if not question:
            return jsonify({'error': 'Question is required'}), 400
        
        data = load_data()
        
        # Stop any active game
        if data['game_state']['active']:
            data['game_state']['active'] = False
            socketio.emit('game_stopped', data['game_state'], namespace='/')
        
        # Prepare poll options based on type
        if poll_type == 'yes_no':
            options = {'A': 'Yes', 'B': 'No'}
            votes = {'A': 0, 'B': 0}
        elif poll_type == 'rating':
            options = {'A': '⭐', 'B': '⭐⭐', 'C': '⭐⭐⭐', 'D': '⭐⭐⭐⭐', 'E': '⭐⭐⭐⭐⭐'}
            votes = {'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0}
        else:  # multiple_choice
            if custom_options:
                options = custom_options
                votes = {key: 0 for key in custom_options.keys()}
            else:
                options = {'A': 'Option A', 'B': 'Option B', 'C': 'Option C', 'D': 'Option D'}
                votes = {'A': 0, 'B': 0, 'C': 0, 'D': 0}
        
        data['poll'] = {
            'active': True,
            'question': question,
            'type': poll_type,
            'options': options,
            'votes': votes,
            'voted_devices': [],
            'winner': None,
            'winner_percentage': 0,
            'total_votes': 0,
            'started_at': datetime.now().isoformat(),
            'ended_at': None
        }
        save_data(data)
        
        # Emit poll start to all clients
        socketio.emit('poll_started', data['poll'], namespace='/')
        
        log_event('poll_started', f'Poll started: {question} (Type: {poll_type})')
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/poll/vote', methods=['POST'])
def vote_poll():
    """Submit poll vote"""
    try:
        vote_data = request.json or {}
        option = vote_data.get('option')
        device_id = get_client_ip()  # Use IP as device identifier
        
        data = load_data()
        
        if not data['poll']['active']:
            return jsonify({'error': 'No active poll'}), 400
            
        # Validate option exists in current poll
        if option not in data['poll']['votes']:
            return jsonify({'error': 'Invalid option'}), 400
        
        # Check if device already voted
        if device_id in data['poll']['voted_devices']:
            return jsonify({'error': 'Device already voted'}), 400
        
        # Record vote
        data['poll']['votes'][option] += 1
        data['poll']['voted_devices'].append(device_id)
        
        # Calculate winner and statistics
        votes = data['poll']['votes']
        total_votes = sum(votes.values())
        data['poll']['total_votes'] = total_votes
        
        if total_votes > 0:
            winner = max(votes.items(), key=lambda x: x[1])
            data['poll']['winner'] = winner[0]
            data['poll']['winner_percentage'] = round((winner[1] / total_votes) * 100, 1)
        
        save_data(data)
        
        # Emit vote update to all clients
        socketio.emit('poll_vote_update', {
            'votes': data['poll']['votes'],
            'total_votes': total_votes,
            'winner': data['poll']['winner'],
            'winner_percentage': data['poll']['winner_percentage'],
            'options': data['poll']['options']
        }, namespace='/')
        
        log_event('poll_vote', f'Vote cast for option {option}')
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/poll/stop', methods=['POST'])
def stop_poll():
    """Stop current poll"""
    try:
        data = load_data()
        if data['poll']['active']:
            data['poll']['active'] = False
            data['poll']['ended_at'] = datetime.now().isoformat()
            
            # Final winner calculation
            votes = data['poll']['votes']
            total_votes = sum(votes.values())
            if total_votes > 0:
                winner = max(votes.items(), key=lambda x: x[1])
                data['poll']['winner'] = winner[0]
                data['poll']['winner_percentage'] = round((winner[1] / total_votes) * 100, 1)
                
                # Log final results
                winner_name = data['poll']['options'].get(winner[0], winner[0])
                log_event('poll_ended', f'Poll ended. Winner: {winner_name} with {winner[1]} votes ({data["poll"]["winner_percentage"]}%)')
            else:
                log_event('poll_ended', 'Poll ended with no votes')
                
            save_data(data)
        
        # Emit poll stop to all clients
        socketio.emit('poll_stopped', {
            'winner': data['poll']['winner'],
            'winner_percentage': data['poll']['winner_percentage'],
            'total_votes': data['poll']['total_votes'],
            'votes': data['poll']['votes'],
            'options': data['poll']['options']
        }, namespace='/')
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/poll/reset', methods=['POST'])
def reset_poll():
    """Reset poll data"""
    try:
        data = load_data()
        data['poll'] = {
            'active': False,
            'question': '',
            'type': 'multiple_choice',
            'options': {
                'A': 'Option A',
                'B': 'Option B', 
                'C': 'Option C',
                'D': 'Option D'
            },
            'votes': {'A': 0, 'B': 0, 'C': 0, 'D': 0},
            'voted_devices': [],
            'winner': None,
            'winner_percentage': 0,
            'total_votes': 0,
            'started_at': None,
            'ended_at': None
        }
        save_data(data)
        
        # Emit poll reset to all clients
        socketio.emit('poll_reset', namespace='/')
        
        log_event('poll_reset', 'Poll data reset')
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Socket.IO Events
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f'Client connected: {request.sid}')
    
    # Send current state to newly connected client
    data = load_data()
    emit('state_update', {
        'game_state': data['game_state'],
        'teams': data['teams'],
        'poll': data['poll']
    })

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f'Client disconnected: {request.sid}')

@socketio.on('join_room')
def handle_join_room(data):
    """Handle room joining for targeted updates"""
    room = data.get('room')
    if room:
        join_room(room)
        print(f'Client {request.sid} joined room {room}')

@socketio.on('leave_room')
def handle_leave_room(data):
    """Handle room leaving"""
    room = data.get('room')
    if room:
        leave_room(room)
        print(f'Client {request.sid} left room {room}')

if __name__ == '__main__':
    # Initialize data file if it doesn't exist
    if not os.path.exists(DATA_FILE):
        save_data(DEFAULT_DATA)
    
    print("Starting Fast Finger Response System...")
    print("Access the application at:")
    print("  Admin Panel: http://localhost:5000/admin")
    print("  Display Screen: http://localhost:5000/display")
    print("  Team Buzz-In: http://localhost:5000/buzz")
    print("  Audience Poll: http://localhost:5000/poll")
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
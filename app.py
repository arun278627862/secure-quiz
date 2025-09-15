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

def log_event(event_type, details):
    """Log poll events"""
    data = load_data()
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'type': event_type,
        'details': details
    }
    if 'logs' not in data:
        data['logs'] = []
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
    """Redirect to poll admin"""
    return redirect(url_for('poll_admin'))

@app.route('/admin')
def admin():
    """Admin panel for poll control"""
    return render_template('admin.html')

@app.route('/display')
def display():
    """Display screen for poll results"""
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
@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get poll logs"""
    data = load_data()
    logs = data.get('logs', [])
    # Return last 50 logs
    return jsonify(logs[-50:])

@app.route('/api/poll-state', methods=['GET'])
def get_poll_state():
    """Get current poll state"""
    data = load_data()
    return jsonify(data['poll'])

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
        
        data = load_data()
        
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
    
    # Get port from environment variable (for Render) or default to 5000
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    
    print("Starting Secure Poll...")
    print("Access the application at:")
    print(f"  Admin Panel: http://localhost:{port}/admin")
    print(f"  Display Screen: http://localhost:{port}/display")
    print(f"  Audience Poll: http://localhost:{port}/poll")
    print(f"  Poll Admin: http://localhost:{port}/poll-admin")
    
    socketio.run(app, host='0.0.0.0', port=port, debug=debug_mode)
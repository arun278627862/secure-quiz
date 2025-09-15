#!/usr/bin/env python3
"""
WSGI entry point for Render deployment
"""
import os
from app import app, socketio

if __name__ == "__main__":
    # For development
    socketio.run(app, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False)
else:
    # For production WSGI
    application = socketio

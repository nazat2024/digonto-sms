from sms_server import socketio, app
socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True, log_output=False)

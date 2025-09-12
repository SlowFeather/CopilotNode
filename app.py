from flask import Flask, send_from_directory
from flask_cors import CORS
from core.config import WEB_DIR
from api.nodes import nodes_bp
from api.projects import projects_bp
from api.execution import execution_bp
from api.upload import upload_bp
from api.drawings import drawings_bp

app = Flask(__name__, static_folder=WEB_DIR, static_url_path='')
CORS(app)

app.register_blueprint(nodes_bp)
app.register_blueprint(projects_bp)
app.register_blueprint(execution_bp)
app.register_blueprint(upload_bp)
app.register_blueprint(drawings_bp)

@app.route('/')
def index():
    return send_from_directory(WEB_DIR, 'index.html')

if __name__ == '__main__':
    import sys
    import threading
    import time
    import webbrowser
    
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    url = f"http://localhost:{port}"
    
    print(f"CopilotNode Web Server starting...")
    print(f"Server URL: {url}")
    
    # Function to open browser after server starts
    def open_browser():
        time.sleep(1.5)  # Wait for server to start
        try:
            print(f"Opening browser: {url}")
            webbrowser.open(url)
        except Exception as e:
            print(f"Could not open browser automatically: {e}")
            print(f"Please manually open {url} in your browser")
    
    # Start browser opening in background thread
    threading.Timer(1.5, open_browser).start()
    
    app.run(debug=True, host='0.0.0.0', port=port)
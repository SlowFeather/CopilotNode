from flask import Flask, send_from_directory
from flask_cors import CORS
from core.config import WEB_DIR
from api.nodes import nodes_bp
from api.projects import projects_bp
from api.execution import execution_bp
from api.upload import upload_bp

app = Flask(__name__, static_folder=WEB_DIR, static_url_path='')
CORS(app)

app.register_blueprint(nodes_bp)
app.register_blueprint(projects_bp)
app.register_blueprint(execution_bp)
app.register_blueprint(upload_bp)

@app.route('/')
def index():
    return send_from_directory(WEB_DIR, 'index.html')

if __name__ == '__main__':
    print("CopilotNode Web Server starting...")
    print("Open http://localhost:5000 in your browser")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
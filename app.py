try:
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
    
except Exception as e:
    print(f"\n[IMPORT ERROR] Failed to import modules: {e}")
    print(f"[IMPORT ERROR] Error type: {type(e).__name__}")
    import traceback
    print(f"[IMPORT ERROR] Full traceback:")
    traceback.print_exc()
    
    import sys
    is_packaged = getattr(sys, 'frozen', False)
    if is_packaged:
        print("\n[INFO] Press Enter to exit...")
        try:
            input()
        except:
            pass
    sys.exit(1)

@app.route('/')
def index():
    return send_from_directory(WEB_DIR, 'index.html')

if __name__ == '__main__':
    try:
        import sys
        import threading
        import time
        import webbrowser
        import os
        
        port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
        url = f"http://localhost:{port}"
        
        print(f"CopilotNode Web Server starting...")
        print(f"Server URL: {url}")
        
        # Function to open browser after server starts
        def open_browser():
            time.sleep(2.0)  # Wait for server to start
            try:
                print(f"Opening browser: {url}")
                webbrowser.open(url)
            except Exception as e:
                print(f"Could not open browser automatically: {e}")
                print(f"Please manually open {url} in your browser")
        
        # Only open browser in main process (not in reloader process)
        if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
            # Start browser opening in background thread
            threading.Timer(2.0, open_browser).start()
        
        # Detect if running as executable (packaged)
        is_packaged = getattr(sys, 'frozen', False)
        
        if is_packaged:
            # In packaged mode, disable debug and use production settings
            print("[INFO] Running in packaged mode")
            app.run(debug=False, host='127.0.0.1', port=port, use_reloader=False)
        else:
            # In development mode
            print("[INFO] Running in development mode")
            app.run(debug=True, host='0.0.0.0', port=port)
            
    except Exception as e:
        print(f"\n[ERROR] Application failed to start: {e}")
        print(f"[ERROR] Error type: {type(e).__name__}")
        import traceback
        print(f"[ERROR] Full traceback:")
        traceback.print_exc()
        
        # 检测是否为打包应用，如果是则等待用户输入
        is_packaged = getattr(sys, 'frozen', False)
        if is_packaged:
            print("\n[INFO] Press Enter to exit...")
            try:
                input()
            except:
                pass
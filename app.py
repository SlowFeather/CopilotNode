from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import os
import uuid
import threading
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
import random
import pyautogui
from image_recognition import ImageRecognition

# Configure PyAutoGUI settings
pyautogui.FAILSAFE = True  # Keep failsafe enabled for safety
pyautogui.PAUSE = 0.1  # Small pause between actions for stability

# Create necessary directories
PROJECTS_DIR = 'projects'
os.makedirs(PROJECTS_DIR, exist_ok=True)
os.makedirs('uploads', exist_ok=True)

app = Flask(__name__, static_folder='web', static_url_path='')
CORS(app)

# Global state
current_project: Dict[str, Any] = {"nodes": []}
execution_state = {
    "is_running": False,
    "current_node": None,
    "status": "idle",
    "progress": 0,
    "thread": None,
    "should_stop": False
}

# Initialize image recognition
image_recognition = ImageRecognition()

@app.route('/')
def index():
    """Serve the main web interface"""
    return send_from_directory('web', 'index.html')

@app.route('/api/nodes', methods=['GET'])
def get_nodes():
    """Get all nodes in current project"""
    return jsonify(current_project)

@app.route('/api/nodes', methods=['POST'])
def handle_nodes():
    """Handle node operations - create single node or update all nodes"""
    data = request.get_json()
    
    # Check if this is a bulk update (contains 'nodes' key)
    if 'nodes' in data:
        print(f"DEBUG: Received bulk nodes update with {len(data['nodes'])} nodes")
        current_project["nodes"] = data['nodes']
        return jsonify({"message": f"Updated {len(data['nodes'])} nodes"}), 201
    
    # Single node creation (original behavior)
    node = {
        "id": data.get('id', f"node_{uuid.uuid4().hex[:8]}"),
        "action_type": data.get('action_type', 'click'),
        "params": data.get('params', {}),
        "x": data.get('x', 0),
        "y": data.get('y', 0),
        "connections": data.get('connections', [])
    }
    
    current_project["nodes"].append(node)
    return jsonify(node), 201

@app.route('/api/nodes/<node_id>', methods=['PUT'])
def update_node(node_id):
    """Update an existing node"""
    data = request.get_json()
    
    for i, node in enumerate(current_project["nodes"]):
        if node["id"] == node_id:
            current_project["nodes"][i].update(data)
            return jsonify(current_project["nodes"][i])
    
    return jsonify({"error": "Node not found"}), 404

@app.route('/api/nodes/<node_id>', methods=['DELETE'])
def delete_node(node_id):
    """Delete a node"""
    current_project["nodes"] = [
        node for node in current_project["nodes"] 
        if node["id"] != node_id
    ]
    
    # Remove connections to deleted node
    for node in current_project["nodes"]:
        if node_id in node["connections"]:
            node["connections"].remove(node_id)
    
    return jsonify({"message": "Node deleted"})

@app.route('/api/projects', methods=['GET'])
def list_projects():
    """List available project files"""
    projects = []
    # 确保projects目录存在
    if os.path.exists(PROJECTS_DIR):
        for file in os.listdir(PROJECTS_DIR):
            if file.endswith('.json') or file.endswith('.acp'):
                projects.append(file)
    return jsonify(projects)

@app.route('/api/projects', methods=['POST'])
def save_project():
    """Save current project to file"""
    global current_project
    data = request.get_json()
    filename = data.get('filename', f'project_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
    
    if not filename.endswith('.json') and not filename.endswith('.acp'):
        filename += '.json'
    
    # 将文件保存到projects目录中
    filepath = os.path.join(PROJECTS_DIR, filename)
    
    try:
        # Save the current project data (which should be already updated via /api/nodes)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(current_project, f, ensure_ascii=False, indent=2)
        
        print(f"DEBUG: Saved project '{filepath}' with {len(current_project.get('nodes', []))} nodes")
        return jsonify({"message": f"Project saved as {filename}", "filename": filename, "filepath": filepath})
    except Exception as e:
        print(f"ERROR: Failed to save project '{filepath}': {e}")
        return jsonify({"error": f"Failed to save project: {str(e)}"}), 500

@app.route('/api/projects/<filename>', methods=['GET'])
def load_project(filename):
    """Load project from file"""
    global current_project
    
    # 从 projects 目录中加载文件
    filepath = os.path.join(PROJECTS_DIR, filename)
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            current_project = json.load(f)
        print(f"DEBUG: Loaded project '{filepath}' with {len(current_project.get('nodes', []))} nodes")
        return jsonify(current_project)
    except FileNotFoundError:
        print(f"ERROR: Project file not found: {filepath}")
        return jsonify({"error": "Project file not found"}), 404
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid project file format in '{filepath}': {e}")
        return jsonify({"error": "Invalid project file format"}), 400
    except Exception as e:
        print(f"ERROR: Failed to load project '{filepath}': {e}")
        return jsonify({"error": f"Failed to load project: {str(e)}"}), 500

@app.route('/api/execute', methods=['POST'])
def execute_workflow():
    """Start workflow execution"""
    global execution_state
    
    if execution_state["is_running"]:
        return jsonify({"error": "Workflow already running"}), 400
    
    data = request.get_json()
    loop = data.get('loop', False)
    speed = data.get('speed', 1.0)
    
    execution_state.update({
        "is_running": True,
        "should_stop": False,
        "status": "running",
        "progress": 0
    })
    
    def run_workflow():
        try:
            execute_nodes(current_project["nodes"], loop, speed)
        except Exception as e:
            execution_state.update({
                "status": "error",
                "error": str(e)
            })
        finally:
            execution_state.update({
                "is_running": False,
                "status": "completed",
                "current_node": None
            })
    
    execution_state["thread"] = threading.Thread(target=run_workflow, daemon=True)
    execution_state["thread"].start()
    
    return jsonify({"message": "Workflow execution started"})

@app.route('/api/execute', methods=['DELETE'])
def stop_execution():
    """Stop workflow execution"""
    global execution_state
    
    execution_state["should_stop"] = True
    execution_state["status"] = "stopping"
    
    return jsonify({"message": "Stopping workflow execution"})

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current execution status"""
    status = {
        "is_running": execution_state["is_running"],
        "status": execution_state["status"],
        "progress": execution_state["progress"],
        "current_node": execution_state["current_node"]
    }
    
    if "error" in execution_state:
        status["error"] = execution_state["error"]
    
    return jsonify(status)

@app.route('/api/upload', methods=['POST'])
def upload_image():
    """Handle image uploads for image recognition nodes"""
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Create uploads directory if it doesn't exist
    os.makedirs('uploads', exist_ok=True)
    
    # Generate unique filename
    filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    filepath = os.path.join('uploads', filename)
    
    file.save(filepath)
    return jsonify({"filename": filename, "path": filepath})

def execute_nodes(nodes: List[Dict], loop: bool = False, speed: float = 1.0):
    """Execute workflow nodes"""
    global execution_state
    
    if not nodes:
        return
    
    # Debug: Print all nodes before execution
    print("DEBUG: All nodes in workflow:")
    for node in nodes:
        print(f"  Node {node['id']}: {node['action_type']} - {node.get('params', {})} - connections: {node.get('connections', [])}")
    
    # Find start nodes (nodes with no incoming connections)
    all_connections = set()
    for node in nodes:
        all_connections.update(node.get("connections", []))
    
    start_nodes = [node for node in nodes if node["id"] not in all_connections]
    
    if not start_nodes:
        # If no start nodes found, start with first node
        start_nodes = [nodes[0]]
    
    print(f"DEBUG: Start nodes: {[node['id'] for node in start_nodes]}")
    print(f"DEBUG: All connections: {all_connections}")
    
    total_nodes = len(nodes)
    executed_count = 0
    
    def execute_node_recursive(node_id: str, visited: set):
        nonlocal executed_count
        
        if execution_state["should_stop"] or node_id in visited:
            return
        
        visited.add(node_id)
        
        # Find the node
        node = next((n for n in nodes if n["id"] == node_id), None)
        if not node:
            return
        
        execution_state["current_node"] = node_id
        execution_state["progress"] = int((executed_count / total_nodes) * 100)
        
        # Execute the action
        execute_action(node)
        executed_count += 1
        
        # Add delay based on speed
        if speed < 1.0:
            time.sleep((1.0 - speed) * 2)  # Slower execution
        
        # Execute connected nodes
        if node["action_type"] == "if":
            # For IF nodes, execute connections based on condition result
            condition_result = node.get('_condition_result', False)
            print(f"DEBUG: IF node {node['id']} branching - condition result: {condition_result}")
            
            # First try to find connection nodes (advanced mode)
            connection_nodes = [n for n in nodes if n.get('action_type') == 'connection' and 
                              n.get('params', {}).get('source_id') == node['id']]
            
            if connection_nodes:
                # Advanced mode: use connection nodes with specific output types
                for conn_node in connection_nodes:
                    conn_params = conn_node.get('params', {})
                    output_type = conn_params.get('output_type', 'output')
                    
                    # Check if this connection should be followed based on condition result
                    should_follow = False
                    if output_type == 'true' and condition_result:
                        should_follow = True
                    elif output_type == 'false' and not condition_result:
                        should_follow = True
                    elif output_type == 'output':  # Default output for non-conditional connections
                        should_follow = True
                    
                    if should_follow:
                        target_id = conn_params.get('target_id')
                        if target_id and not execution_state["should_stop"]:
                            print(f"DEBUG: Following {output_type} branch to {target_id}")
                            execute_node_recursive(target_id, visited.copy())
            else:
                # Simple mode: direct connections from IF node
                connections = node.get("connections", [])
                if connections:
                    if condition_result:
                        # TRUE condition: execute first connection
                        target_id = connections[0]
                        print(f"DEBUG: IF node {node['id']} - condition TRUE, executing first connection: {target_id}")
                        if not execution_state["should_stop"]:
                            execute_node_recursive(target_id, visited.copy())
                    else:
                        # FALSE condition: execute second connection if it exists
                        if len(connections) > 1:
                            target_id = connections[1]
                            print(f"DEBUG: IF node {node['id']} - condition FALSE, executing second connection: {target_id}")
                            if not execution_state["should_stop"]:
                                execute_node_recursive(target_id, visited.copy())
                        else:
                            print(f"DEBUG: IF node {node['id']} - condition FALSE, but no second connection available")
                else:
                    print(f"DEBUG: IF node {node['id']} - no connections found")
        else:
            # For regular nodes, execute all connections
            for next_node_id in node.get("connections", []):
                if not execution_state["should_stop"]:
                    execute_node_recursive(next_node_id, visited.copy())
    
    # Main execution loop
    while True:
        if execution_state["should_stop"]:
            break
            
        for start_node in start_nodes:
            if execution_state["should_stop"]:
                break
            execute_node_recursive(start_node["id"], set())
        
        executed_count = 0  # Reset for next loop iteration
        
        if not loop or execution_state["should_stop"]:
            break
        
        time.sleep(0.5)  # Brief pause between loops

def execute_action(node: Dict[str, Any]):
    """Execute a single action node"""
    action_type = node["action_type"]
    params = node["params"]
    
    print(f"DEBUG: Executing node {node['id']} - action_type: {action_type}, params: {params}")
    
    try:
        if action_type == "click":
            x, y = params.get("x", 0), params.get("y", 0)
            x_random = params.get("x_random", 0.0)
            y_random = params.get("y_random", 0.0)
            
            # Check if coordinates are (0,0) which might be unintended
            if x == 0 and y == 0:
                print(f"WARNING: Click node {node['id']} has coordinates (0,0). This might be unintended. Skipping...")
                return
            
            # Apply random offset to coordinates
            final_x = x
            final_y = y
            
            if x_random > 0:
                random_x_offset = random.uniform(-x_random, x_random)
                final_x = int(x + random_x_offset)
                
            if y_random > 0:
                random_y_offset = random.uniform(-y_random, y_random)
                final_y = int(y + random_y_offset)
            
            print(f"DEBUG: Click node - base_coords: ({x}, {y}), x_random: ±{x_random}, y_random: ±{y_random}, final_coords: ({final_x}, {final_y})")
            
            # Validate coordinates are within screen bounds
            screen_width, screen_height = pyautogui.size()
            if 0 <= final_x <= screen_width and 0 <= final_y <= screen_height:
                # Move to position first to avoid corner trigger
                pyautogui.moveTo(final_x, final_y, duration=0.1)
                time.sleep(0.1)
                pyautogui.click()
                print(f"DEBUG: Successfully clicked at ({final_x}, {final_y})")
            else:
                print(f"Click coordinates ({final_x}, {final_y}) are outside screen bounds")
            
        elif action_type == "move":
            x, y = params.get("x", 0), params.get("y", 0)
            duration = params.get("duration", 0.2)
            duration_random = params.get("duration_random", 0.0)
            speed_factor = params.get("speed_factor", 1.0)
            speed_random = params.get("speed_random", 0.0)
            
            print(f"DEBUG: Move node - params: {params}, x: {x}, y: {y}")
            
            # Check if coordinates are (0,0) which might be unintended
            if x == 0 and y == 0:
                print(f"WARNING: Move node {node['id']} has coordinates (0,0). This might be unintended. Skipping...")
                return
            
            # Calculate randomized values
            
            # Randomize duration
            if duration_random > 0:
                random_duration_offset = random.uniform(-duration_random, duration_random)
                final_duration = max(0.1, duration + random_duration_offset)
            else:
                final_duration = duration
            
            # Randomize speed (affects final duration inversely)
            if speed_random > 0:
                random_speed_offset = random.uniform(-speed_random, speed_random)
                final_speed_factor = max(0.1, speed_factor + random_speed_offset)
            else:
                final_speed_factor = speed_factor
            
            # Apply speed factor to duration (faster speed = shorter duration)
            final_duration = final_duration / final_speed_factor
            final_duration = max(0.05, final_duration)  # Ensure minimum duration
            
            print(f"DEBUG: Move timing - base_duration: {duration}, duration_random: ±{duration_random}, final_duration: {final_duration:.2f}")
            print(f"DEBUG: Move speed - base_speed: {speed_factor}, speed_random: ±{speed_random}, final_speed: {final_speed_factor:.2f}")
            
            screen_width, screen_height = pyautogui.size()
            if 0 <= x <= screen_width and 0 <= y <= screen_height:
                pyautogui.moveTo(x, y, duration=final_duration)
                print(f"DEBUG: Successfully moved to ({x}, {y}) in {final_duration:.2f}s")
            else:
                print(f"Move coordinates ({x}, {y}) are outside screen bounds")
            
        elif action_type == "keyboard":
            if "key" in params and params["key"]:
                pyautogui.press(params["key"])
            elif "text" in params and params["text"]:
                pyautogui.write(params["text"])
                
        elif action_type == "wait":
            duration = params.get("duration", 1.0)
            time.sleep(max(0.1, duration))  # Minimum 0.1 second wait
            
        elif action_type in ["findimg", "followimg", "clickimg"]:
            image_path = params.get("image_path", "")
            if os.path.exists(image_path):
                result = image_recognition.find_image_on_screen(image_path)
                if result and result.get('found'):
                    x, y = result['position'][0], result['position'][1]
                    
                    # Apply random offset for clickimg action
                    if action_type == "clickimg":
                        x_random = params.get("x_random", 0.0)
                        y_random = params.get("y_random", 0.0)
                        
                        final_x = x
                        final_y = y
                        
                        if x_random > 0:
                            random_x_offset = random.uniform(-x_random, x_random)
                            final_x = int(x + random_x_offset)
                            
                        if y_random > 0:
                            random_y_offset = random.uniform(-y_random, y_random)
                            final_y = int(y + random_y_offset)
                        
                        print(f"DEBUG: ClickImg node - base_coords: ({x}, {y}), x_random: ±{x_random}, y_random: ±{y_random}, final_coords: ({final_x}, {final_y})")
                        x, y = final_x, final_y
                    
                    screen_width, screen_height = pyautogui.size()
                    if 0 <= x <= screen_width and 0 <= y <= screen_height:
                        if action_type == "followimg":
                            pyautogui.moveTo(x, y, duration=0.2)
                        elif action_type == "clickimg":
                            pyautogui.moveTo(x, y, duration=0.1)
                            time.sleep(0.1)
                            pyautogui.click()
                            print(f"DEBUG: Successfully clicked image at ({x}, {y})")
                    else:
                        print(f"Found image at ({x}, {y}) is outside screen bounds")
                else:
                    print(f"Image not found: {image_path}")
            else:
                print(f"Image file does not exist: {image_path}")
                
        elif action_type == "if":
            # IF nodes don't execute actions directly - they affect execution flow
            # The execution flow is handled by connection nodes with conditional logic
            condition_type = params.get("condition_type", "image_exists")
            
            if condition_type == "image_exists":
                image_path = params.get("image_path", "")
                if os.path.exists(image_path):
                    result = image_recognition.find_image_on_screen(image_path)
                    condition_result = result is not None and result.get('found', False)
                    print(f"DEBUG: IF node {node['id']} - image condition: {'TRUE' if condition_result else 'FALSE'}")
                else:
                    condition_result = False
                    print(f"DEBUG: IF node {node['id']} - image file not found: {image_path}")
                    
            elif condition_type == "node_result":
                # For now, implement basic node result checking
                # This would need to be enhanced based on specific requirements
                target_node_id = params.get("target_node_id", "")
                expected_result = params.get("expected_result", "true") == "true"
                condition_result = expected_result  # Placeholder logic
                print(f"DEBUG: IF node {node['id']} - node result condition: {'TRUE' if condition_result else 'FALSE'}")
            
            else:
                condition_result = False
                print(f"DEBUG: IF node {node['id']} - unknown condition type: {condition_type}")
            
            # Store the condition result for connection nodes to use
            node['_condition_result'] = condition_result
            
        elif action_type == "connection":
            # Connection nodes don't execute any actions - they just pass through
            print(f"DEBUG: Connection node {node['id']} - passing through")
            # The actual connection logic is handled in execute_node_recursive
                
    except pyautogui.FailSafeException:
        print(f"PyAutoGUI failsafe triggered for action {action_type}. Move mouse away from screen corners.")
        execution_state.update({
            "should_stop": True,
            "status": "error",
            "error": "安全机制触发：鼠标移动到了屏幕角落。请将鼠标移开后重试。"
        })
    except Exception as e:
        print(f"Error executing action {action_type}: {e}")
        execution_state.update({
            "status": "error", 
            "error": f"执行 {action_type} 动作时出错: {str(e)}"
        })

if __name__ == '__main__':
    # Create necessary directories
    os.makedirs('uploads', exist_ok=True)
    os.makedirs('web', exist_ok=True)
    
    print("CopilotNode Web Server starting...")
    print("Open http://localhost:5000 in your browser")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
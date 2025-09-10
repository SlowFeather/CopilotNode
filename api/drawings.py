from flask import Blueprint, jsonify, request
from services.drawing_service import DrawingService
from typing import Dict, Any

drawings_bp = Blueprint('drawings', __name__, url_prefix='/api')
drawing_service = DrawingService()

@drawings_bp.route('/drawings', methods=['GET'])
def list_drawings():
    """Get list of all drawings"""
    try:
        drawings = drawing_service.list_drawings()
        return jsonify({
            "drawings": [
                {
                    "id": drawing_id,
                    "name": drawing["name"],
                    "created_at": drawing.get("created_at"),
                    "last_executed": drawing.get("last_executed"),
                    "boundary": drawing.get("boundary"),
                    "node_count": len(drawing.get("nodes", [])),
                    "execution_state": {
                        "is_running": drawing["execution_state"]["is_running"],
                        "status": drawing["execution_state"]["status"],
                        "progress": drawing["execution_state"]["progress"]
                        # Exclude 'thread' and other non-serializable fields
                    }
                }
                for drawing_id, drawing in drawings.items()
            ]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings', methods=['POST'])
def create_drawing():
    """Create a new drawing in the current project"""
    data = request.get_json()
    name = data.get('name')
    nodes = data.get('nodes', [])
    boundary = data.get('boundary')
    
    if not name:
        return jsonify({"error": "Drawing name is required"}), 400
    
    try:
        drawing_id = drawing_service.create_new_drawing(name, nodes, boundary)
        return jsonify({"drawing_id": drawing_id, "message": "Drawing created successfully"})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings/<drawing_id>', methods=['GET'])
def get_drawing(drawing_id: str):
    """Get a specific drawing"""
    try:
        drawing = drawing_service.get_drawing_info(drawing_id)
        if not drawing:
            return jsonify({"error": "Drawing not found"}), 404
        
        # Create a JSON-safe copy of the drawing data
        json_safe_drawing = {
            "id": drawing["id"],
            "name": drawing["name"],
            "nodes": drawing.get("nodes", []),
            "boundary": drawing.get("boundary"),
            "created_at": drawing.get("created_at"),
            "last_executed": drawing.get("last_executed"),
            "execution_state": {
                "is_running": drawing["execution_state"]["is_running"],
                "current_node": drawing["execution_state"]["current_node"],
                "status": drawing["execution_state"]["status"],
                "progress": drawing["execution_state"]["progress"],
                "should_stop": drawing["execution_state"]["should_stop"]
                # Exclude 'thread' as it's not JSON serializable
            }
        }
        
        return jsonify(json_safe_drawing)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings/<drawing_id>', methods=['PUT'])
def update_drawing(drawing_id: str):
    """Update a drawing"""
    data = request.get_json()
    
    try:
        success = drawing_service.update_drawing_info(drawing_id, data)
        if not success:
            return jsonify({"error": "Drawing not found"}), 404
        return jsonify({"message": "Drawing updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings/<drawing_id>', methods=['DELETE'])
def delete_drawing(drawing_id: str):
    """Delete a drawing"""
    try:
        success = drawing_service.delete_drawing_by_id(drawing_id)
        if not success:
            return jsonify({"error": "Drawing not found"}), 404
        return jsonify({"message": "Drawing deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings/<drawing_id>/execute', methods=['POST'])
def execute_drawing(drawing_id: str):
    """Start executing a drawing"""
    data = request.get_json() or {}
    loop = data.get('loop', False)
    speed = data.get('speed', 1.0)
    
    try:
        result = drawing_service.start_drawing_execution(drawing_id, loop, speed)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings/<drawing_id>/execute', methods=['DELETE'])
def stop_drawing_execution(drawing_id: str):
    """Stop executing a drawing"""
    try:
        result = drawing_service.stop_drawing_execution(drawing_id)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings/<drawing_id>/status', methods=['GET'])
def get_drawing_status(drawing_id: str):
    """Get drawing execution status"""
    try:
        status = drawing_service.get_drawing_status(drawing_id)
        return jsonify(status)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings/status', methods=['GET'])
def get_all_drawing_statuses():
    """Get execution status of all drawings"""
    try:
        statuses = drawing_service.get_all_drawing_statuses()
        return jsonify({"statuses": statuses})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings/<drawing_id>/boundary', methods=['GET'])
def get_drawing_boundary(drawing_id: str):
    """Get drawing operation boundary"""
    try:
        boundary = drawing_service.get_boundary(drawing_id)
        if boundary is None:
            return jsonify({"error": "Drawing not found"}), 404
        return jsonify({"boundary": boundary})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings/<drawing_id>/boundary', methods=['POST'])
def set_drawing_boundary(drawing_id: str):
    """Set drawing operation boundary"""
    data = request.get_json()
    boundary = data.get('boundary')
    
    if not boundary:
        return jsonify({"error": "Boundary is required"}), 400
    
    required_fields = ['x', 'y', 'width', 'height']
    if not all(field in boundary for field in required_fields):
        return jsonify({"error": f"Boundary must contain: {required_fields}"}), 400
    
    try:
        success = drawing_service.set_boundary(drawing_id, boundary)
        if not success:
            return jsonify({"error": "Drawing not found"}), 404
        return jsonify({"message": "Boundary set successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings/execute-all', methods=['POST'])
def execute_all_drawings():
    """Execute all drawings in the current project sequentially"""
    data = request.get_json() or {}
    loop = data.get('loop', False)
    speed = data.get('speed', 1.0)
    
    try:
        result = drawing_service.start_all_drawings_execution(loop, speed)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings/execute-all', methods=['DELETE'])
def stop_all_drawings_execution():
    """Stop executing all drawings"""
    try:
        result = drawing_service.stop_all_drawings_execution()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@drawings_bp.route('/drawings/execute-all/status', methods=['GET'])
def get_all_drawings_execution_status():
    """Get status of all drawings execution"""
    try:
        status = drawing_service.get_all_drawings_execution_status()
        return jsonify(status)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
from flask import Blueprint, jsonify, request
from services.project_service import ProjectService

projects_bp = Blueprint('projects', __name__, url_prefix='/api')
project_service = ProjectService()

# New hierarchical project endpoints
@projects_bp.route('/projects', methods=['GET'])
def list_all_projects():
    """List all projects with metadata"""
    try:
        projects = project_service.list_all_projects()
        return jsonify({"projects": projects})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@projects_bp.route('/projects', methods=['POST'])
def create_project():
    """Create a new project"""
    data = request.get_json()
    name = data.get('name')
    description = data.get('description', '')
    
    if not name:
        return jsonify({"error": "Project name is required"}), 400
    
    try:
        result = project_service.create_new_project(name, description)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@projects_bp.route('/projects/<project_id>', methods=['GET'])
def get_project_info(project_id: str):
    """Get project information including drawings"""
    try:
        project = project_service.get_project_info(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        return jsonify(project)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@projects_bp.route('/projects/<project_id>', methods=['PUT'])
def update_project(project_id: str):
    """Update project information"""
    data = request.get_json()
    
    try:
        success = project_service.update_project_info(project_id, data)
        if not success:
            return jsonify({"error": "Project not found"}), 404
        return jsonify({"message": "Project updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@projects_bp.route('/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id: str):
    """Delete a project and all its drawings"""
    try:
        success = project_service.delete_project_by_id(project_id)
        if not success:
            return jsonify({"error": "Project not found"}), 404
        return jsonify({"message": "Project deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@projects_bp.route('/projects/<project_id>/activate', methods=['POST'])
def set_active_project(project_id: str):
    """Set the active project"""
    try:
        success = project_service.set_active_project(project_id)
        if not success:
            return jsonify({"error": "Project not found"}), 404
        return jsonify({"message": f"Project '{project_id}' activated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@projects_bp.route('/projects/active', methods=['GET'])
def get_active_project():
    """Get the currently active project"""
    try:
        project = project_service.get_active_project()
        if not project:
            return jsonify({"message": "No active project"}), 404
        return jsonify(project)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@projects_bp.route('/projects/<project_id>/drawings', methods=['GET'])
def list_project_drawings(project_id: str):
    """List all drawings in a project"""
    try:
        from services.drawing_service import DrawingService
        drawing_service = DrawingService()
        drawings = drawing_service.list_project_drawings(project_id)
        return jsonify({"drawings": drawings})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Legacy endpoints for backward compatibility
@projects_bp.route('/projects/legacy', methods=['GET'])
def list_legacy_projects():
    """List legacy project files"""
    try:
        projects = project_service.list_projects()
        return jsonify(projects)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@projects_bp.route('/projects/legacy', methods=['POST'])
def save_legacy_project():
    """Save current graph data as legacy project"""
    data = request.get_json()
    filename = data.get('filename') if data else None
    
    try:
        result = project_service.save_project(filename)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@projects_bp.route('/projects/legacy/<filename>', methods=['GET'])
def load_legacy_project(filename):
    """Load legacy project file"""
    try:
        project = project_service.load_project(filename)
        return jsonify(project)
    except FileNotFoundError:
        return jsonify({"error": "Project file not found"}), 404
    except ValueError:
        return jsonify({"error": "Invalid project file format"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@projects_bp.route('/projects/migrate/<filename>', methods=['POST'])
def migrate_legacy_project(filename):
    """Migrate a legacy project to new hierarchical structure"""
    data = request.get_json()
    new_name = data.get('name') if data else None
    
    try:
        project_id = project_service.migrate_legacy_project(filename, new_name)
        if not project_id:
            return jsonify({"error": "Failed to migrate project"}), 500
        
        return jsonify({
            "project_id": project_id,
            "message": f"Project '{filename}' migrated successfully"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
from flask import Blueprint, jsonify, request
from services.project_service import ProjectService

projects_bp = Blueprint('projects', __name__, url_prefix='/api/projects')
project_service = ProjectService()

@projects_bp.route('', methods=['GET'])
def list_projects():
    projects = project_service.list_projects()
    return jsonify(projects)

@projects_bp.route('', methods=['POST'])
def save_project():
    data = request.get_json()
    filename = data.get('filename') if data else None
    
    try:
        result = project_service.save_project(filename)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@projects_bp.route('/<filename>', methods=['GET'])
def load_project(filename):
    try:
        project = project_service.load_project(filename)
        return jsonify(project)
    except FileNotFoundError:
        return jsonify({"error": "Project file not found"}), 404
    except ValueError:
        return jsonify({"error": "Invalid project file format"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
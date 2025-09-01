from flask import Blueprint, jsonify, request
from services.execution_service import ExecutionService
from core.state import current_project

execution_bp = Blueprint('execution', __name__, url_prefix='/api')
execution_service = ExecutionService()

@execution_bp.route('/execute', methods=['POST'])
def execute_workflow():
    data = request.get_json()
    loop = data.get('loop', False)
    speed = data.get('speed', 1.0)
    
    try:
        result = execution_service.start_workflow(current_project["nodes"], loop, speed)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

@execution_bp.route('/execute', methods=['DELETE'])
def stop_execution():
    result = execution_service.stop_workflow()
    return jsonify(result)

@execution_bp.route('/status', methods=['GET'])
def get_status():
    status = execution_service.get_status()
    return jsonify(status)
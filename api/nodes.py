from flask import Blueprint, jsonify, request
from services.node_service import NodeService

nodes_bp = Blueprint('nodes', __name__, url_prefix='/api/nodes')
node_service = NodeService()

@nodes_bp.route('', methods=['GET'])
def get_nodes():
    return jsonify(node_service.get_all_nodes())

@nodes_bp.route('', methods=['POST'])
def handle_nodes():
    data = request.get_json()
    
    if 'nodes' in data:
        result = node_service.bulk_update_nodes(data['nodes'])
        return jsonify(result), 201
    
    node = node_service.create_node(data)
    return jsonify(node), 201

@nodes_bp.route('/<node_id>', methods=['PUT'])
def update_node(node_id):
    data = request.get_json()
    
    try:
        updated_node = node_service.update_node(node_id, data)
        return jsonify(updated_node)
    except ValueError:
        return jsonify({"error": "Node not found"}), 404

@nodes_bp.route('/<node_id>', methods=['DELETE'])
def delete_node(node_id):
    result = node_service.delete_node(node_id)
    return jsonify(result)
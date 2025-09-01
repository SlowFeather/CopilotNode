import uuid
from typing import Dict, Any, List
from core.state import current_project

class NodeService:
    @staticmethod
    def get_all_nodes() -> Dict[str, Any]:
        return current_project

    @staticmethod
    def create_node(data: Dict[str, Any]) -> Dict[str, Any]:
        node = {
            "id": data.get('id', f"node_{uuid.uuid4().hex[:8]}"),
            "action_type": data.get('action_type', 'click'),
            "params": data.get('params', {}),
            "x": data.get('x', 0),
            "y": data.get('y', 0),
            "connections": data.get('connections', [])
        }
        current_project["nodes"].append(node)
        return node

    @staticmethod
    def bulk_update_nodes(nodes: List[Dict[str, Any]]) -> Dict[str, str]:
        print(f"DEBUG: Received bulk nodes update with {len(nodes)} nodes")
        current_project["nodes"] = nodes
        return {"message": f"Updated {len(nodes)} nodes"}

    @staticmethod
    def update_node(node_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        for i, node in enumerate(current_project["nodes"]):
            if node["id"] == node_id:
                current_project["nodes"][i].update(data)
                return current_project["nodes"][i]
        raise ValueError("Node not found")

    @staticmethod
    def delete_node(node_id: str) -> Dict[str, str]:
        current_project["nodes"] = [
            node for node in current_project["nodes"] 
            if node["id"] != node_id
        ]
        
        # Remove connections to deleted node
        for node in current_project["nodes"]:
            if node_id in node["connections"]:
                node["connections"].remove(node_id)
        
        return {"message": "Node deleted"}
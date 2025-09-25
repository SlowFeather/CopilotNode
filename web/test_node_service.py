import pytest
from services.node_service import NodeService
from core.state import current_project

class TestNodeService:
    def setup_method(self):
        """Reset current_project before each test."""
        current_project["nodes"] = []
    
    def test_create_node(self):
        """Test node creation."""
        node_data = {
            "id": "node_1",
            "action_type": "click",
            "params": {"x": 100, "y": 200},
            "x": 100,
            "y": 200
        }
        result = NodeService.create_node(node_data)
        assert result["id"] == "node_1"
        assert len(current_project["nodes"]) == 1
    
    def test_bulk_update_nodes(self):
        """Test bulk update of nodes."""
        nodes = [
            {"id": "node_1", "action_type": "click", "params": {}, "x": 0, "y": 0},
            {"id": "node_2", "action_type": "wait", "params": {"duration": 5}, "x": 0, "y": 0}
        ]
        result = NodeService.bulk_update_nodes(nodes)
        assert result["message"] == "Updated 2 nodes"
        assert len(current_project["nodes"]) == 2
    
    def test_update_node(self):
        """Test node update."""
        NodeService.create_node({"id": "node_1", "action_type": "click", "params": {}, "x": 0, "y": 0})
        updated_data = {"action_type": "wait", "params": {"duration": 5}}
        result = NodeService.update_node("node_1", updated_data)
        assert result["action_type"] == "wait"
    
    def test_delete_node(self):
        """Test node deletion."""
        NodeService.create_node({"id": "node_1", "action_type": "click", "params": {}, "x": 0, "y": 0})
        result = NodeService.delete_node("node_1")
        assert result["message"] == "Node deleted"
        assert len(current_project["nodes"]) == 0
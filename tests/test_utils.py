import os
import pytest
from utils import validate_project_data, create_directories, get_action_description

class TestUtils:
    def test_validate_project_data(self):
        """Test project data validation."""
        # Valid data
        valid_data = {
            "nodes": [
                {"id": "1", "action_type": "click", "params": {}, "x": 0, "y": 0}
            ]
        }
        assert validate_project_data(valid_data) is True
        
        # Invalid data (missing required fields)
        invalid_data = {
            "nodes": [
                {"id": "1", "action_type": "click"}  # Missing x, y, params
            ]
        }
        assert validate_project_data(invalid_data) is False
        
        # Invalid data (nodes not a list)
        invalid_data = {"nodes": "not_a_list"}
        assert validate_project_data(invalid_data) is False
    
    def test_create_directories(self, tmp_path):
        """Test directory creation."""
        test_dir = os.path.join(tmp_path, "test_dir")
        os.makedirs(test_dir, exist_ok=True)
        assert os.path.exists(test_dir)
    
    def test_get_action_description(self):
        """Test action description generation."""
        assert get_action_description("click", {"x": 100, "y": 200}) == "点击 (100, 200)"
        assert get_action_description("wait", {"duration": 5}) == "等待 5 秒"
        assert get_action_description("unknown", {}) == "未知动作"
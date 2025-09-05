import threading
import time
import random
import pyautogui
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from core.state import (
    create_drawing, get_drawing, get_all_drawings, update_drawing,
    delete_drawing, update_drawing_execution_state, get_drawing_execution_state,
    set_drawing_boundary, get_drawing_boundary, save_drawing_to_file,
    list_project_drawings, get_current_project, set_current_drawing, get_current_drawing
)
from image_recognition import ImageRecognition

class DrawingService:
    def __init__(self):
        self.image_recognition = ImageRecognition()

    def create_new_drawing(self, name: str, nodes: List[Dict] = None, boundary: Dict[str, int] = None) -> str:
        """Create a new drawing in the current project"""
        current_project_id = get_current_project()
        if not current_project_id:
            raise ValueError("No active project. Please select or create a project first.")
        
        drawing_id = create_drawing(current_project_id, name, nodes, boundary)
        set_current_drawing(drawing_id)
        
        # Auto-save to file
        save_drawing_to_file(drawing_id)
        
        print(f"DEBUG: Created new drawing '{name}' with ID: {drawing_id} in project: {current_project_id}")
        return drawing_id

    def get_drawing_info(self, drawing_id: str) -> Optional[Dict[str, Any]]:
        """Get drawing information"""
        return get_drawing(drawing_id)

    def list_drawings(self) -> Dict[str, Dict[str, Any]]:
        """List all drawings (backward compatibility)"""
        return get_all_drawings()
    
    def list_project_drawings(self, project_id: str) -> List[Dict[str, Any]]:
        """List all drawings in a specific project"""
        try:
            drawings = list_project_drawings(project_id)
            print(f"DEBUG: Listed {len(drawings)} drawings for project: {project_id}")
            return drawings
        except Exception as e:
            print(f"ERROR: Failed to list drawings for project '{project_id}': {e}")
            return []

    def update_drawing_info(self, drawing_id: str, updates: Dict[str, Any]) -> bool:
        """Update drawing information and save to file"""
        try:
            drawing = get_drawing(drawing_id)
            if not drawing:
                print(f"WARNING: Drawing '{drawing_id}' not found for update")
                return False
            
            update_drawing(drawing_id, updates)
            save_drawing_to_file(drawing_id)
            
            print(f"DEBUG: Updated and saved drawing '{drawing_id}' with: {updates}")
            return True
        except Exception as e:
            print(f"ERROR: Failed to update drawing '{drawing_id}': {e}")
            return False

    def delete_drawing_by_id(self, drawing_id: str) -> bool:
        """Delete a drawing"""
        return delete_drawing(drawing_id)

    def set_boundary(self, drawing_id: str, boundary: Dict[str, int]) -> bool:
        """Set operation boundary for a drawing"""
        drawing = get_drawing(drawing_id)
        if not drawing:
            return False
        set_drawing_boundary(drawing_id, boundary)
        return True

    def get_boundary(self, drawing_id: str) -> Optional[Dict[str, int]]:
        """Get operation boundary for a drawing"""
        return get_drawing_boundary(drawing_id)

    def start_drawing_execution(self, drawing_id: str, loop: bool = False, speed: float = 1.0) -> Dict[str, str]:
        """Start executing a drawing"""
        drawing = get_drawing(drawing_id)
        if not drawing:
            raise ValueError(f"Drawing {drawing_id} not found")
        
        execution_state = get_drawing_execution_state(drawing_id)
        if execution_state and execution_state["is_running"]:
            raise ValueError(f"Drawing {drawing_id} is already running")
        
        update_drawing_execution_state(drawing_id, {
            "is_running": True,
            "should_stop": False,
            "status": "running",
            "progress": 0,
            "error": None
        })
        
        def run_workflow():
            try:
                self.execute_drawing_nodes(drawing_id, drawing["nodes"], loop, speed)
            except Exception as e:
                update_drawing_execution_state(drawing_id, {
                    "status": "error",
                    "error": str(e)
                })
            finally:
                update_drawing_execution_state(drawing_id, {
                    "is_running": False,
                    "status": "completed",
                    "current_node": None
                })
                update_drawing(drawing_id, {"last_executed": datetime.now().isoformat()})
        
        thread = threading.Thread(target=run_workflow, daemon=True)
        update_drawing_execution_state(drawing_id, {"thread": thread})
        thread.start()
        
        return {"message": f"Drawing {drawing_id} execution started"}

    def stop_drawing_execution(self, drawing_id: str) -> Dict[str, str]:
        """Stop executing a drawing"""
        drawing = get_drawing(drawing_id)
        if not drawing:
            raise ValueError(f"Drawing {drawing_id} not found")
        
        update_drawing_execution_state(drawing_id, {
            "should_stop": True,
            "status": "stopping"
        })
        return {"message": f"Stopping drawing {drawing_id} execution"}

    def get_drawing_status(self, drawing_id: str) -> Dict[str, Any]:
        """Get drawing execution status"""
        drawing = get_drawing(drawing_id)
        if not drawing:
            raise ValueError(f"Drawing {drawing_id} not found")
        
        execution_state = get_drawing_execution_state(drawing_id)
        if not execution_state:
            return {"error": "Execution state not found"}
        
        status = {
            "drawing_id": drawing_id,
            "name": drawing["name"],
            "is_running": execution_state["is_running"],
            "status": execution_state["status"],
            "progress": execution_state["progress"],
            "current_node": execution_state["current_node"]
        }
        
        if "error" in execution_state:
            status["error"] = execution_state["error"]
        
        return status

    def get_all_drawing_statuses(self) -> List[Dict[str, Any]]:
        """Get status of all drawings"""
        drawings = get_all_drawings()
        statuses = []
        
        for drawing_id, drawing in drawings.items():
            try:
                status = self.get_drawing_status(drawing_id)
                statuses.append(status)
            except Exception as e:
                statuses.append({
                    "drawing_id": drawing_id,
                    "name": drawing.get("name", "Unknown"),
                    "error": str(e)
                })
        
        return statuses

    def is_coordinate_in_boundary(self, drawing_id: str, x: int, y: int) -> bool:
        """Check if coordinates are within the drawing's boundary"""
        boundary = get_drawing_boundary(drawing_id)
        if not boundary:
            return True  # No boundary set, allow all coordinates
        
        return (boundary["x"] <= x <= boundary["x"] + boundary["width"] and
                boundary["y"] <= y <= boundary["y"] + boundary["height"])

    def execute_drawing_nodes(self, drawing_id: str, nodes: List[Dict], loop: bool = False, speed: float = 1.0):
        """Execute nodes for a specific drawing"""
        if not nodes:
            return
        
        print(f"DEBUG: Executing drawing {drawing_id} with {len(nodes)} nodes")
        
        # Find start nodes (nodes without incoming connections)
        all_connections = set()
        for node in nodes:
            all_connections.update(node.get("connections", []))
        
        start_nodes = [node for node in nodes if node["id"] not in all_connections]
        
        if not start_nodes:
            start_nodes = [nodes[0]]
        
        total_nodes = len(nodes)
        executed_count = 0
        
        def execute_node_recursive(node_id: str, visited: set):
            nonlocal executed_count
            
            execution_state = get_drawing_execution_state(drawing_id)
            if not execution_state or execution_state["should_stop"] or node_id in visited:
                return
            
            visited.add(node_id)
            
            node = next((n for n in nodes if n["id"] == node_id), None)
            if not node:
                return
            
            update_drawing_execution_state(drawing_id, {
                "current_node": node_id,
                "progress": int((executed_count / total_nodes) * 100)
            })
            
            self.execute_drawing_action(drawing_id, node)
            executed_count += 1
            
            if speed < 1.0:
                time.sleep((1.0 - speed) * 2)
            
            # Handle conditional nodes
            if node["action_type"] == "if":
                condition_result = node.get('_condition_result', False)
                connections = node.get("connections", [])
                if connections:
                    if condition_result:
                        target_id = connections[0]
                        execution_state = get_drawing_execution_state(drawing_id)
                        if execution_state and not execution_state["should_stop"]:
                            execute_node_recursive(target_id, visited.copy())
                    else:
                        if len(connections) > 1:
                            target_id = connections[1]
                            execution_state = get_drawing_execution_state(drawing_id)
                            if execution_state and not execution_state["should_stop"]:
                                execute_node_recursive(target_id, visited.copy())
            else:
                for next_node_id in node.get("connections", []):
                    execution_state = get_drawing_execution_state(drawing_id)
                    if execution_state and not execution_state["should_stop"]:
                        execute_node_recursive(next_node_id, visited.copy())
        
        # Main execution loop
        while True:
            execution_state = get_drawing_execution_state(drawing_id)
            if not execution_state or execution_state["should_stop"]:
                break
                
            for start_node in start_nodes:
                execution_state = get_drawing_execution_state(drawing_id)
                if not execution_state or execution_state["should_stop"]:
                    break
                execute_node_recursive(start_node["id"], set())
            
            executed_count = 0
            
            if not loop:
                break
            
            execution_state = get_drawing_execution_state(drawing_id)
            if not execution_state or execution_state["should_stop"]:
                break
            
            time.sleep(0.5)

    def execute_drawing_action(self, drawing_id: str, node: Dict[str, Any]):
        """Execute a single action for a drawing"""
        action_type = node["action_type"]
        params = node["params"]
        
        print(f"DEBUG: Drawing {drawing_id} - Executing node {node['id']} - action_type: {action_type}")
        
        try:
            if action_type == "click":
                self._execute_bounded_click(drawing_id, node, params)
            elif action_type == "move":
                self._execute_bounded_move(drawing_id, node, params)
            elif action_type == "keyboard":
                self._execute_keyboard(params)
            elif action_type == "wait":
                self._execute_wait(params)
            elif action_type in ["findimg", "followimg", "clickimg"]:
                self._execute_bounded_image_action(drawing_id, action_type, params)
            elif action_type == "if":
                self._execute_if_condition(drawing_id, node, params)
                
        except pyautogui.FailSafeException:
            print(f"PyAutoGUI failsafe triggered for drawing {drawing_id}")
            update_drawing_execution_state(drawing_id, {
                "should_stop": True,
                "status": "error",
                "error": "安全机制触发：鼠标移动到了屏幕角落。请将鼠标移开后重试。"
            })
        except Exception as e:
            print(f"Error executing action {action_type} for drawing {drawing_id}: {e}")
            update_drawing_execution_state(drawing_id, {
                "status": "error", 
                "error": f"执行 {action_type} 动作时出错: {str(e)}"
            })

    def _execute_bounded_click(self, drawing_id: str, node: Dict[str, Any], params: Dict[str, Any]):
        """Execute click action with boundary check"""
        x, y = params.get("x", 0), params.get("y", 0)
        x_random = params.get("x_random", 0.0)
        y_random = params.get("y_random", 0.0)
        
        if x == 0 and y == 0:
            print(f"WARNING: Drawing {drawing_id} - Click node {node['id']} has coordinates (0,0). Skipping...")
            return
        
        final_x, final_y = x, y
        
        if x_random > 0:
            random_x_offset = random.uniform(-x_random, x_random)
            final_x = int(x + random_x_offset)
            
        if y_random > 0:
            random_y_offset = random.uniform(-y_random, y_random)
            final_y = int(y + random_y_offset)
        
        # Check boundary
        if not self.is_coordinate_in_boundary(drawing_id, final_x, final_y):
            print(f"Drawing {drawing_id} - Click coordinates ({final_x}, {final_y}) outside boundary. Skipping...")
            return
        
        screen_width, screen_height = pyautogui.size()
        if 0 <= final_x <= screen_width and 0 <= final_y <= screen_height:
            pyautogui.moveTo(final_x, final_y, duration=0.1)
            time.sleep(0.1)
            pyautogui.click()
            print(f"DEBUG: Drawing {drawing_id} - Successfully clicked at ({final_x}, {final_y})")
        else:
            print(f"Drawing {drawing_id} - Click coordinates ({final_x}, {final_y}) outside screen bounds")

    def _execute_bounded_move(self, drawing_id: str, node: Dict[str, Any], params: Dict[str, Any]):
        """Execute move action with boundary check"""
        x, y = params.get("x", 0), params.get("y", 0)
        
        if x == 0 and y == 0:
            print(f"WARNING: Drawing {drawing_id} - Move node {node['id']} has coordinates (0,0). Skipping...")
            return
        
        # Check boundary
        if not self.is_coordinate_in_boundary(drawing_id, x, y):
            print(f"Drawing {drawing_id} - Move coordinates ({x}, {y}) outside boundary. Skipping...")
            return
        
        duration = params.get("duration", 0.2)
        screen_width, screen_height = pyautogui.size()
        
        if 0 <= x <= screen_width and 0 <= y <= screen_height:
            pyautogui.moveTo(x, y, duration=duration)
            print(f"DEBUG: Drawing {drawing_id} - Successfully moved to ({x}, {y})")
        else:
            print(f"Drawing {drawing_id} - Move coordinates ({x}, {y}) outside screen bounds")

    def _execute_bounded_image_action(self, drawing_id: str, action_type: str, params: Dict[str, Any]):
        """Execute image action with boundary check - now searches only within boundary region"""
        image_path = params.get("image_path", "")
        if os.path.exists(image_path):
            # Get drawing boundary for region search
            boundary = get_drawing_boundary(drawing_id)
            region_bbox = None
            if boundary:
                region_bbox = (boundary["x"], boundary["y"], boundary["width"], boundary["height"])
                print(f"DEBUG: Drawing {drawing_id} - Searching for image within boundary: {region_bbox}")
            else:
                print(f"DEBUG: Drawing {drawing_id} - No boundary set, searching full screen")
            
            # Use region-based search
            result = self.image_recognition.find_image_in_region(image_path, region_bbox)
            if result and result.get('found'):
                x, y = result['position'][0], result['position'][1]
                print(f"DEBUG: Drawing {drawing_id} - Found image at ({x}, {y}) with confidence {result['confidence']:.2f}")
                
                # Double-check boundary (should already be within boundary due to region search)
                if boundary and not self.is_coordinate_in_boundary(drawing_id, x, y):
                    print(f"WARNING: Drawing {drawing_id} - Found image at ({x}, {y}) outside boundary after region search. This shouldn't happen!")
                    return
                
                if action_type == "clickimg":
                    x_random = params.get("x_random", 0.0)
                    y_random = params.get("y_random", 0.0)
                    
                    final_x, final_y = x, y
                    
                    if x_random > 0:
                        random_x_offset = random.uniform(-x_random, x_random)
                        final_x = int(x + random_x_offset)
                        
                    if y_random > 0:
                        random_y_offset = random.uniform(-y_random, y_random)
                        final_y = int(y + random_y_offset)
                    
                    x, y = final_x, final_y
                
                screen_width, screen_height = pyautogui.size()
                if 0 <= x <= screen_width and 0 <= y <= screen_height:
                    if action_type == "followimg":
                        pyautogui.moveTo(x, y, duration=0.2)
                    elif action_type == "clickimg":
                        pyautogui.moveTo(x, y, duration=0.1)
                        time.sleep(0.1)
                        pyautogui.click()
                        print(f"DEBUG: Drawing {drawing_id} - Successfully clicked image at ({x}, {y})")
                else:
                    print(f"Drawing {drawing_id} - Found image at ({x}, {y}) outside screen bounds")
            else:
                print(f"Drawing {drawing_id} - Image not found: {image_path}")
        else:
            print(f"Drawing {drawing_id} - Image file does not exist: {image_path}")

    def _execute_keyboard(self, params: Dict[str, Any]):
        """Execute keyboard action"""
        if "key" in params and params["key"]:
            pyautogui.press(params["key"])
        elif "text" in params and params["text"]:
            pyautogui.write(params["text"])

    def _execute_wait(self, params: Dict[str, Any]):
        """Execute wait action"""
        duration = params.get("duration", 1.0)
        time.sleep(max(0.1, duration))

    def _execute_if_condition(self, drawing_id: str, node: Dict[str, Any], params: Dict[str, Any]):
        """Execute if condition - now uses boundary region for image detection"""
        condition_type = params.get("condition_type", "image_exists")
        
        if condition_type == "image_exists":
            image_path = params.get("image_path", "")
            if os.path.exists(image_path):
                # Get drawing boundary for region search
                boundary = get_drawing_boundary(drawing_id)
                region_bbox = None
                if boundary:
                    region_bbox = (boundary["x"], boundary["y"], boundary["width"], boundary["height"])
                    print(f"DEBUG: Drawing {drawing_id} - Checking image condition within boundary: {region_bbox}")
                else:
                    print(f"DEBUG: Drawing {drawing_id} - Checking image condition on full screen")
                
                # Use region-based search for condition
                result = self.image_recognition.find_image_in_region(image_path, region_bbox)
                condition_result = result is not None and result.get('found', False)
                
                if condition_result:
                    print(f"DEBUG: Drawing {drawing_id} - Image condition TRUE: found image with confidence {result['confidence']:.2f}")
                else:
                    print(f"DEBUG: Drawing {drawing_id} - Image condition FALSE: image not found")
            else:
                condition_result = False
                
        elif condition_type == "node_result":
            target_node_id = params.get("target_node_id", "")
            expected_result = params.get("expected_result", "true") == "true"
            condition_result = expected_result
        else:
            condition_result = False
        
        node['_condition_result'] = condition_result
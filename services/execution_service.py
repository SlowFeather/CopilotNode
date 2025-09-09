import threading
import time
import random
import pyautogui
import os
from typing import Dict, List, Any
from core.state import execution_state, update_execution_state
from image_recognition import ImageRecognition

class ExecutionService:
    def __init__(self):
        self.image_recognition = ImageRecognition()

    def start_workflow(self, nodes: List[Dict], loop: bool = False, speed: float = 1.0) -> Dict[str, str]:
        if execution_state["is_running"]:
            raise ValueError("Workflow already running")
        
        update_execution_state({
            "is_running": True,
            "should_stop": False,
            "status": "running",
            "progress": 0
        })
        
        def run_workflow():
            try:
                self.execute_nodes(nodes, loop, speed)
            except Exception as e:
                update_execution_state({
                    "status": "error",
                    "error": str(e)
                })
            finally:
                update_execution_state({
                    "is_running": False,
                    "status": "completed",
                    "current_node": None
                })
        
        execution_state["thread"] = threading.Thread(target=run_workflow, daemon=True)
        execution_state["thread"].start()
        
        return {"message": "Workflow execution started"}

    def stop_workflow(self) -> Dict[str, str]:
        update_execution_state({
            "should_stop": True,
            "status": "stopping"
        })
        return {"message": "Stopping workflow execution"}

    def get_status(self) -> Dict[str, Any]:
        status = {
            "is_running": execution_state["is_running"],
            "status": execution_state["status"],
            "progress": execution_state["progress"],
            "current_node": execution_state["current_node"]
        }
        
        if "error" in execution_state:
            status["error"] = execution_state["error"]
        
        return status

    def execute_nodes(self, nodes: List[Dict], loop: bool = False, speed: float = 1.0):
        if not nodes:
            return
        
        print("DEBUG: All nodes in workflow:")
        for node in nodes:
            print(f"  Node {node['id']}: {node['action_type']} - {node.get('params', {})} - connections: {node.get('connections', [])}")
        
        all_connections = set()
        for node in nodes:
            all_connections.update(node.get("connections", []))
        
        start_nodes = [node for node in nodes if node["id"] not in all_connections]
        
        if not start_nodes:
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
            
            node = next((n for n in nodes if n["id"] == node_id), None)
            if not node:
                return
            
            update_execution_state({
                "current_node": node_id,
                "progress": int((executed_count / total_nodes) * 100)
            })
            
            self.execute_action(node)
            executed_count += 1
            
            if speed < 1.0:
                time.sleep((1.0 - speed) * 2)
            
            if node["action_type"] == "if":
                condition_result = node.get('_condition_result', False)
                print(f"DEBUG: IF node {node['id']} branching - condition result: {condition_result}")
                
                connections = node.get("connections", [])
                if connections:
                    if condition_result:
                        target_id = connections[0]
                        print(f"DEBUG: IF node {node['id']} - condition TRUE, executing first connection: {target_id}")
                        if not execution_state["should_stop"]:
                            execute_node_recursive(target_id, visited.copy())
                    else:
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
                for next_node_id in node.get("connections", []):
                    if not execution_state["should_stop"]:
                        execute_node_recursive(next_node_id, visited.copy())
        
        while True:
            if execution_state["should_stop"]:
                break
                
            for start_node in start_nodes:
                if execution_state["should_stop"]:
                    break
                execute_node_recursive(start_node["id"], set())
            
            executed_count = 0
            
            if not loop or execution_state["should_stop"]:
                break
            
            time.sleep(0.5)

    def execute_action(self, node: Dict[str, Any]):
        action_type = node["action_type"]
        params = node["params"]
        
        # Track mouse position before and after each action
        before_x, before_y = pyautogui.position()
        print(f"DEBUG: Before executing {action_type} node {node['id']}: mouse at ({before_x}, {before_y})")
        print(f"DEBUG: Executing node {node['id']} - action_type: {action_type}, params: {params}")
        
        try:
            if action_type == "click":
                self._execute_click(node, params)
            elif action_type == "move":
                self._execute_move(node, params)
            elif action_type == "keyboard":
                self._execute_keyboard(params)
            elif action_type == "wait":
                self._execute_wait(params)
            elif action_type == "mousedown":
                self._execute_mouse_down(node, params)
            elif action_type == "mouseup":
                self._execute_mouse_up(node, params)
            elif action_type == "mousescroll":
                self._execute_mouse_scroll(node, params)
            elif action_type in ["findimg", "followimg", "clickimg"]:
                self._execute_image_action(action_type, params)
            elif action_type == "if":
                self._execute_if_condition(node, params)
            else:
                print(f"WARNING: Unknown action type: {action_type}. Skipping node {node['id']}")
            
            # Track mouse position after execution
            after_x, after_y = pyautogui.position()
            print(f"DEBUG: After executing {action_type} node {node['id']}: mouse at ({after_x}, {after_y})")
                
        except pyautogui.FailSafeException:
            print(f"PyAutoGUI failsafe triggered for action {action_type}. Move mouse away from screen corners.")
            update_execution_state({
                "should_stop": True,
                "status": "error",
                "error": "安全机制触发：鼠标移动到了屏幕角落。请将鼠标移开后重试。"
            })
        except Exception as e:
            print(f"Error executing action {action_type}: {e}")
            update_execution_state({
                "status": "error", 
                "error": f"执行 {action_type} 动作时出错: {str(e)}"
            })

    def _execute_click(self, node: Dict[str, Any], params: Dict[str, Any]):
        position_mode = params.get("position_mode", "absolute")
        
        if position_mode == "current":
            # 使用当前鼠标位置
            current_x, current_y = pyautogui.position()
            final_x, final_y = current_x, current_y
        else:
            # 使用绝对坐标
            x, y = params.get("x", 0), params.get("y", 0)
            
            if x == 0 and y == 0:
                print(f"WARNING: Click node {node['id']} has coordinates (0,0). This might be unintended. Skipping...")
                return
            
            final_x, final_y = x, y
        
        # 添加随机偏移（对两种模式都生效）
        x_random = params.get("x_random", 0.0)
        y_random = params.get("y_random", 0.0)
        
        if x_random > 0:
            random_x_offset = random.uniform(-x_random, x_random)
            final_x = int(final_x + random_x_offset)
            
        if y_random > 0:
            random_y_offset = random.uniform(-y_random, y_random)
            final_y = int(final_y + random_y_offset)
        
        print(f"DEBUG: Click node - position_mode: {position_mode}, x_random: ±{x_random}, y_random: ±{y_random}, final_coords: ({final_x}, {final_y})")
        
        screen_width, screen_height = pyautogui.size()
        if 0 <= final_x <= screen_width and 0 <= final_y <= screen_height:
            pyautogui.moveTo(final_x, final_y, duration=0.1)
            time.sleep(0.1)
            pyautogui.click()
            print(f"DEBUG: Successfully clicked at ({final_x}, {final_y})")
        else:
            print(f"Click coordinates ({final_x}, {final_y}) are outside screen bounds")

    def _execute_move(self, node: Dict[str, Any], params: Dict[str, Any]):
        x, y = params.get("x", 0), params.get("y", 0)
        duration = params.get("duration", 0.2)
        duration_random = params.get("duration_random", 0.0)
        speed_factor = params.get("speed_factor", 1.0)
        speed_random = params.get("speed_random", 0.0)
        
        print(f"DEBUG: Move node {node['id']} - raw params: {params}")
        print(f"DEBUG: Move node {node['id']} - parsed x: {x} (type: {type(x)}), y: {y} (type: {type(y)}), duration: {duration}")
        
        # Try to convert to int to ensure proper types
        try:
            x = int(float(x)) if x is not None else 0
            y = int(float(y)) if y is not None else 0
            print(f"DEBUG: Move node {node['id']} - converted x: {x}, y: {y}")
        except (ValueError, TypeError) as e:
            print(f"ERROR: Move node {node['id']} - failed to convert coordinates: {e}")
            return
        
        if x == 0 and y == 0:
            print(f"WARNING: Move node {node['id']} has coordinates (0,0). This might be unintended. Skipping...")
            return
        
        if duration_random > 0:
            random_duration_offset = random.uniform(-duration_random, duration_random)
            final_duration = max(0.1, duration + random_duration_offset)
        else:
            final_duration = duration
        
        if speed_random > 0:
            random_speed_offset = random.uniform(-speed_random, speed_random)
            final_speed_factor = max(0.1, speed_factor + random_speed_offset)
        else:
            final_speed_factor = speed_factor
        
        final_duration = final_duration / final_speed_factor
        final_duration = max(0.05, final_duration)
        
        print(f"DEBUG: Move timing - base_duration: {duration}, duration_random: ±{duration_random}, final_duration: {final_duration:.2f}")
        print(f"DEBUG: Move speed - base_speed: {speed_factor}, speed_random: ±{speed_random}, final_speed: {final_speed_factor:.2f}")
        
        screen_width, screen_height = pyautogui.size()
        current_x, current_y = pyautogui.position()
        print(f"DEBUG: Move node - screen size: {screen_width}x{screen_height}")
        print(f"DEBUG: Move node - current position before move: ({current_x}, {current_y})")
        print(f"DEBUG: Move node - target position: ({x}, {y}), duration: {final_duration:.2f}s")
        print(f"DEBUG: Move node - target in bounds: {0 <= x <= screen_width and 0 <= y <= screen_height}")
        
        if 0 <= x <= screen_width and 0 <= y <= screen_height:
            pyautogui.moveTo(x, y, duration=final_duration)
            final_x, final_y = pyautogui.position()
            print(f"DEBUG: Move node - final position after move: ({final_x}, {final_y})")
            print(f"DEBUG: Successfully moved to ({x}, {y}) in {final_duration:.2f}s")
        else:
            print(f"Move coordinates ({x}, {y}) are outside screen bounds")

    def _execute_keyboard(self, params: Dict[str, Any]):
        if "key" in params and params["key"]:
            pyautogui.press(params["key"])
        elif "text" in params and params["text"]:
            pyautogui.write(params["text"])

    def _execute_wait(self, params: Dict[str, Any]):
        duration = params.get("duration", 1.0)
        time.sleep(max(0.1, duration))

    def _execute_image_action(self, action_type: str, params: Dict[str, Any]):
        image_path = params.get("image_path", "")
        if os.path.exists(image_path):
            result = self.image_recognition.find_image_on_screen(image_path)
            if result and result.get('found'):
                x, y = result['position'][0], result['position'][1]
                
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

    def _execute_if_condition(self, node: Dict[str, Any], params: Dict[str, Any]):
        condition_type = params.get("condition_type", "image_exists")
        
        if condition_type == "image_exists":
            image_path = params.get("image_path", "")
            if os.path.exists(image_path):
                result = self.image_recognition.find_image_on_screen(image_path)
                condition_result = result is not None and result.get('found', False)
                print(f"DEBUG: IF node {node['id']} - image condition: {'TRUE' if condition_result else 'FALSE'}")
            else:
                condition_result = False
                print(f"DEBUG: IF node {node['id']} - image file not found: {image_path}")
                
        elif condition_type == "node_result":
            target_node_id = params.get("target_node_id", "")
            expected_result = params.get("expected_result", "true") == "true"
            condition_result = expected_result
            print(f"DEBUG: IF node {node['id']} - node result condition: {'TRUE' if condition_result else 'FALSE'}")
        
        else:
            condition_result = False
            print(f"DEBUG: IF node {node['id']} - unknown condition type: {condition_type}")
        
        node['_condition_result'] = condition_result

    def _execute_mouse_down(self, node: Dict[str, Any], params: Dict[str, Any]):
        """执行鼠标按下操作"""
        position_mode = params.get("position_mode", "absolute")
        button = params.get("button", "left")
        
        if position_mode == "current":
            # 使用当前鼠标位置
            current_x, current_y = pyautogui.position()
            final_x, final_y = current_x, current_y
        else:
            # 使用绝对坐标
            x, y = params.get("x", 0), params.get("y", 0)
            
            # 检查是否为默认的(0,0)坐标，如果是则跳过移动
            if x == 0 and y == 0:
                print(f"WARNING: MouseDown node {node['id']} has coordinates (0,0). Using current position instead...")
                current_x, current_y = pyautogui.position()
                final_x, final_y = current_x, current_y
            else:
                final_x, final_y = x, y
                
                # 添加随机偏移（只在非(0,0)坐标时）
                x_random = params.get("x_random", 0.0)
                y_random = params.get("y_random", 0.0)
                
                if x_random > 0:
                    random_x_offset = random.uniform(-x_random, x_random)
                    final_x = int(x + random_x_offset)
                    
                if y_random > 0:
                    random_y_offset = random.uniform(-y_random, y_random)
                    final_y = int(y + random_y_offset)
        
        # 对current模式也添加随机偏移
        if position_mode == "current":
            x_random = params.get("x_random", 0.0)
            y_random = params.get("y_random", 0.0)
            
            if x_random > 0:
                random_x_offset = random.uniform(-x_random, x_random)
                final_x = int(final_x + random_x_offset)
                
            if y_random > 0:
                random_y_offset = random.uniform(-y_random, y_random)
                final_y = int(final_y + random_y_offset)
        
        print(f"DEBUG: MouseDown node - position_mode: {position_mode}, button: {button}, final_coords: ({final_x}, {final_y})")
        
        screen_width, screen_height = pyautogui.size()
        if 0 <= final_x <= screen_width and 0 <= final_y <= screen_height:
            # 移动到目标位置
            pyautogui.moveTo(final_x, final_y, duration=0.1)
            time.sleep(0.1)
            # 按下鼠标按钮
            pyautogui.mouseDown(button=button)
            print(f"DEBUG: Successfully pressed {button} mouse button at ({final_x}, {final_y})")
        else:
            print(f"MouseDown coordinates ({final_x}, {final_y}) are outside screen bounds")

    def _execute_mouse_up(self, node: Dict[str, Any], params: Dict[str, Any]):
        """执行鼠标松开操作"""
        position_mode = params.get("position_mode", "absolute")
        button = params.get("button", "left")
        
        if position_mode == "current":
            # 使用当前鼠标位置
            current_x, current_y = pyautogui.position()
            final_x, final_y = current_x, current_y
        else:
            # 使用绝对坐标
            x, y = params.get("x", 0), params.get("y", 0)
            
            if x == 0 and y == 0:
                print(f"WARNING: MouseUp node {node['id']} has coordinates (0,0). This might be unintended. Skipping...")
                return
            
            final_x, final_y = x, y
        
        # 添加随机偏移（对两种模式都生效）
        x_random = params.get("x_random", 0.0)
        y_random = params.get("y_random", 0.0)
        
        if x_random > 0:
            random_x_offset = random.uniform(-x_random, x_random)
            final_x = int(final_x + random_x_offset)
            
        if y_random > 0:
            random_y_offset = random.uniform(-y_random, y_random)
            final_y = int(final_y + random_y_offset)
        
        print(f"DEBUG: MouseUp node - position_mode: {position_mode}, button: {button}, x_random: ±{x_random}, y_random: ±{y_random}, final_coords: ({final_x}, {final_y})")
        
        screen_width, screen_height = pyautogui.size()
        if 0 <= final_x <= screen_width and 0 <= final_y <= screen_height:
            # 移动到目标位置
            pyautogui.moveTo(final_x, final_y, duration=0.1)
            time.sleep(0.1)
            # 松开鼠标按钮
            pyautogui.mouseUp(button=button)
            print(f"DEBUG: Successfully released {button} mouse button at ({final_x}, {final_y})")
        else:
            print(f"MouseUp coordinates ({final_x}, {final_y}) are outside screen bounds")

    def _execute_mouse_scroll(self, node: Dict[str, Any], params: Dict[str, Any]):
        """执行鼠标滚轮操作"""
        position_mode = params.get("position_mode", "absolute")
        direction = params.get("direction", "up")
        clicks = params.get("clicks", 3)
        
        if position_mode == "current":
            # 使用当前鼠标位置
            current_x, current_y = pyautogui.position()
            final_x, final_y = current_x, current_y
        else:
            # 使用绝对坐标
            x, y = params.get("x", 0), params.get("y", 0)
            
            # 检查是否为默认的(0,0)坐标，如果是则使用当前位置
            if x == 0 and y == 0:
                print(f"WARNING: MouseScroll node {node['id']} has coordinates (0,0). Using current position instead...")
                current_x, current_y = pyautogui.position()
                final_x, final_y = current_x, current_y
            else:
                final_x, final_y = x, y
        
        # 添加随机偏移（对两种模式都生效）
        x_random = params.get("x_random", 0.0)
        y_random = params.get("y_random", 0.0)
        
        if x_random > 0:
            random_x_offset = random.uniform(-x_random, x_random)
            final_x = int(final_x + random_x_offset)
            
        if y_random > 0:
            random_y_offset = random.uniform(-y_random, y_random)
            final_y = int(final_y + random_y_offset)
        
        # 确定滚轮方向
        scroll_amount = clicks if direction == "up" else -clicks
        
        print(f"DEBUG: MouseScroll node - position_mode: {position_mode}, direction: {direction}, clicks: {clicks}, final_coords: ({final_x}, {final_y})")
        
        screen_width, screen_height = pyautogui.size()
        if 0 <= final_x <= screen_width and 0 <= final_y <= screen_height:
            # 移动到目标位置
            pyautogui.moveTo(final_x, final_y, duration=0.1)
            time.sleep(0.1)
            # 滚动鼠标滚轮
            pyautogui.scroll(scroll_amount)
            print(f"DEBUG: Successfully scrolled {direction} {clicks} clicks at ({final_x}, {final_y})")
        else:
            print(f"MouseScroll coordinates ({final_x}, {final_y}) are outside screen bounds")
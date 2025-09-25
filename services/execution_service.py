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
        
        all_connections = set()
        for node in nodes:
            all_connections.update(node.get("connections", []))

        start_nodes = [node for node in nodes if node["id"] not in all_connections]

        if not start_nodes:
            start_nodes = [nodes[0]]

        print(f"🚀 开始执行工作流，共{len(nodes)}个节点，起始节点：{[node['id'] for node in start_nodes]}")
        
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
                connections = node.get("connections", [])
                if connections:
                    if condition_result:
                        target_id = connections[0]
                        print(f"   🔀 条件为真，执行分支: {target_id}")
                        if not execution_state["should_stop"]:
                            execute_node_recursive(target_id, visited.copy())
                    else:
                        if len(connections) > 1:
                            target_id = connections[1]
                            print(f"   🔀 条件为假，执行分支: {target_id}")
                            if not execution_state["should_stop"]:
                                execute_node_recursive(target_id, visited.copy())
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
        
        print(f"📍 执行节点 {node['id']} ({action_type})")
        
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
            
            pass
                
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

        # 添加随机偏移
        x_random = params.get("x_random", 0.0)
        y_random = params.get("y_random", 0.0)

        if position_mode == "current":
            # 使用当前鼠标位置
            current_x, current_y = pyautogui.position()
            final_x, final_y = current_x, current_y

            # 对当前位置也应用随机偏移
            if x_random > 0:
                random_x_offset = random.uniform(-x_random, x_random)
                final_x = int(final_x + random_x_offset)

            if y_random > 0:
                random_y_offset = random.uniform(-y_random, y_random)
                final_y = int(final_y + random_y_offset)
        else:
            # 使用绝对坐标
            x, y = params.get("x", 0), params.get("y", 0)
            final_x, final_y = x, y

            # 对绝对坐标应用随机偏移
            if x_random > 0:
                random_x_offset = random.uniform(-x_random, x_random)
                final_x = int(final_x + random_x_offset)

            if y_random > 0:
                random_y_offset = random.uniform(-y_random, y_random)
                final_y = int(final_y + random_y_offset)
        
        print(f"🖱️  点击操作详情：")
        print(f"   位置模式: {position_mode}")
        if position_mode == "current":
            print(f"   使用当前鼠标位置 (无视节点xy设置)")
        else:
            print(f"   绝对坐标: ({params.get('x', 0)}, {params.get('y', 0)})")
        print(f"   随机偏移: X±{x_random}, Y±{y_random}")
        print(f"   最终点击位置: ({final_x}, {final_y})")

        screen_width, screen_height = pyautogui.size()
        if 0 <= final_x <= screen_width and 0 <= final_y <= screen_height:
            # 显示安全模式状态
            print(f"   🛡️ PyAutoGUI安全模式: {pyautogui.FAILSAFE}")

            try:
                if position_mode == "current":
                    # current模式：直接在当前位置点击，如果有随机偏移则移动到偏移位置
                    if x_random > 0 or y_random > 0:
                        print(f"   🎯 应用随机偏移，移动到 ({final_x}, {final_y})")
                        pyautogui.moveTo(final_x, final_y, duration=0.1)
                        time.sleep(0.1)
                    else:
                        print(f"   📍 直接在当前位置点击")
                else:
                    # absolute模式：移动到目标位置
                    print(f"   🎯 移动鼠标到 ({final_x}, {final_y})")
                    pyautogui.moveTo(final_x, final_y, duration=0.1)
                    time.sleep(0.1)

                # 验证最终鼠标位置
                actual_x, actual_y = pyautogui.position()
                print(f"   📍 实际鼠标位置: ({actual_x}, {actual_y})")

                print(f"   👆 执行点击操作")
                pyautogui.click()
                print(f"   ✅ 点击成功完成")

            except pyautogui.FailSafeException:
                print(f"   ⚠️ 安全机制触发：鼠标位于屏幕角落，点击被阻止")
                raise
            except Exception as e:
                print(f"   ❌ 点击执行失败: {e}")
                raise
        else:
            print(f"   ❌ 点击坐标 ({final_x}, {final_y}) 超出屏幕范围 ({screen_width}x{screen_height})")

    def _execute_move(self, node: Dict[str, Any], params: Dict[str, Any]):
        x, y = params.get("x", 0), params.get("y", 0)
        duration = params.get("duration", 0.2)
        duration_random = params.get("duration_random", 0.0)
        speed_factor = params.get("speed_factor", 1.0)
        speed_random = params.get("speed_random", 0.0)
        
        print(f"🎯 移动操作：目标({x}, {y}), 时长{duration}s")
        
        try:
            x = int(float(x)) if x is not None else 0
            y = int(float(y)) if y is not None else 0
        except (ValueError, TypeError) as e:
            print(f"   ❌ 坐标转换失败: {e}")
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
        
        screen_width, screen_height = pyautogui.size()
        if 0 <= x <= screen_width and 0 <= y <= screen_height:
            pyautogui.moveTo(x, y, duration=final_duration)
            print(f"   ✅ 移动完成到 ({x}, {y})")
        else:
            print(f"   ❌ 移动坐标 ({x}, {y}) 超出屏幕范围")

    def _execute_keyboard(self, params: Dict[str, Any]):
        input_type = params.get("input_type", "text")
        hold_duration = params.get("hold_duration", 0.1)

        try:
            if input_type == "text":
                # 文本输入
                text = params.get("text", "")
                if text:
                    pyautogui.write(text)

            elif input_type == "key":
                # 单个按键
                key = params.get("key", "")
                if key:
                    if hold_duration > 0.1:
                        # 按住指定时间
                        pyautogui.keyDown(key)
                        time.sleep(hold_duration)
                        pyautogui.keyUp(key)
                    else:
                        pyautogui.press(key)

            elif input_type == "special":
                # 特殊按键
                special_key = params.get("special_key", "")
                if special_key:
                    # 映射特殊按键名称到pyautogui认识的名称
                    key_mapping = {
                        "enter": "enter",
                        "space": "space",
                        "tab": "tab",
                        "escape": "escape",
                        "backspace": "backspace",
                        "delete": "delete",
                        "up": "up",
                        "down": "down",
                        "left": "left",
                        "right": "right",
                        "home": "home",
                        "end": "end",
                        "page_up": "pageup",
                        "page_down": "pagedown",
                        "f1": "f1", "f2": "f2", "f3": "f3", "f4": "f4",
                        "f5": "f5", "f6": "f6", "f7": "f7", "f8": "f8",
                        "f9": "f9", "f10": "f10", "f11": "f11", "f12": "f12",
                        "insert": "insert",
                        "print_screen": "printscreen",
                        "scroll_lock": "scrolllock",
                        "pause": "pause",
                        "caps_lock": "capslock",
                        "num_lock": "numlock",
                        "shift": "shift",
                        "ctrl": "ctrl",
                        "alt": "alt",
                        "cmd": "cmd",
                        "win": "winleft"
                    }

                    mapped_key = key_mapping.get(special_key, special_key)
                    if hold_duration > 0.1:
                        pyautogui.keyDown(mapped_key)
                        time.sleep(hold_duration)
                        pyautogui.keyUp(mapped_key)
                    else:
                        pyautogui.press(mapped_key)

            elif input_type == "combo":
                # 组合按键
                key = params.get("key", "")
                modifier_keys = params.get("modifier_keys", "")

                if key:
                    if modifier_keys:
                        # 解析修饰键
                        modifiers = [k.strip().lower() for k in modifier_keys.split("+") if k.strip()]
                        # 映射修饰键
                        modifier_mapping = {
                            "ctrl": "ctrl",
                            "alt": "alt",
                            "shift": "shift",
                            "cmd": "cmd",
                            "win": "winleft"
                        }
                        mapped_modifiers = [modifier_mapping.get(m, m) for m in modifiers]

                        # 执行组合键
                        all_keys = mapped_modifiers + [key]
                        if hold_duration > 0.1:
                            # 按住所有键
                            for k in all_keys:
                                pyautogui.keyDown(k)
                            time.sleep(hold_duration)
                            # 释放所有键（逆序）
                            for k in reversed(all_keys):
                                pyautogui.keyUp(k)
                        else:
                            pyautogui.hotkey(*all_keys)
                    else:
                        # 没有修饰键，就是单个按键
                        if hold_duration > 0.1:
                            pyautogui.keyDown(key)
                            time.sleep(hold_duration)
                            pyautogui.keyUp(key)
                        else:
                            pyautogui.press(key)

        except Exception as e:
            print(f"键盘操作执行失败: {e}")
            # 确保所有按键都被释放
            try:
                pyautogui.keyUp('ctrl')
                pyautogui.keyUp('alt')
                pyautogui.keyUp('shift')
                pyautogui.keyUp('cmd')
                pyautogui.keyUp('winleft')
            except:
                pass

    def _execute_wait(self, params: Dict[str, Any]):
        duration = params.get("duration", 1.0)
        print(f"⏱️ 等待 {duration}s")
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

        # 添加随机偏移
        x_random = params.get("x_random", 0.0)
        y_random = params.get("y_random", 0.0)

        if position_mode == "current":
            # 使用当前鼠标位置，无视节点属性中的xy坐标
            current_x, current_y = pyautogui.position()
            final_x, final_y = current_x, current_y

            # 对current模式添加随机偏移
            if x_random > 0:
                random_x_offset = random.uniform(-x_random, x_random)
                final_x = int(final_x + random_x_offset)

            if y_random > 0:
                random_y_offset = random.uniform(-y_random, y_random)
                final_y = int(final_y + random_y_offset)
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
                if x_random > 0:
                    random_x_offset = random.uniform(-x_random, x_random)
                    final_x = int(x + random_x_offset)

                if y_random > 0:
                    random_y_offset = random.uniform(-y_random, y_random)
                    final_y = int(y + random_y_offset)
        
        print(f"🖱️  鼠标按下操作详情：")
        print(f"   位置模式: {position_mode}")
        if position_mode == "current":
            print(f"   使用当前鼠标位置 (无视节点xy设置)")
        else:
            print(f"   绝对坐标: ({params.get('x', 0)}, {params.get('y', 0)})")
        print(f"   随机偏移: X±{x_random}, Y±{y_random}")
        print(f"   最终按下位置: ({final_x}, {final_y})")
        print(f"   鼠标按键: {button}")
        
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

        # 添加随机偏移
        x_random = params.get("x_random", 0.0)
        y_random = params.get("y_random", 0.0)

        if position_mode == "current":
            # 使用当前鼠标位置，无视节点属性中的xy坐标
            current_x, current_y = pyautogui.position()
            final_x, final_y = current_x, current_y

            # 对current模式添加随机偏移
            if x_random > 0:
                random_x_offset = random.uniform(-x_random, x_random)
                final_x = int(final_x + random_x_offset)

            if y_random > 0:
                random_y_offset = random.uniform(-y_random, y_random)
                final_y = int(final_y + random_y_offset)
        else:
            # 使用绝对坐标
            x, y = params.get("x", 0), params.get("y", 0)
            final_x, final_y = x, y

            # 添加随机偏移
            if x_random > 0:
                random_x_offset = random.uniform(-x_random, x_random)
                final_x = int(final_x + random_x_offset)

            if y_random > 0:
                random_y_offset = random.uniform(-y_random, y_random)
                final_y = int(final_y + random_y_offset)

        print(f"🖱️  鼠标松开操作详情：")
        print(f"   位置模式: {position_mode}")
        if position_mode == "current":
            print(f"   使用当前鼠标位置 (无视节点xy设置)")
        else:
            print(f"   绝对坐标: ({params.get('x', 0)}, {params.get('y', 0)})")
        print(f"   随机偏移: X±{x_random}, Y±{y_random}")
        print(f"   最终松开位置: ({final_x}, {final_y})")
        print(f"   鼠标按键: {button}")
        
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

        # 添加随机偏移
        x_random = params.get("x_random", 0.0)
        y_random = params.get("y_random", 0.0)

        if position_mode == "current":
            # 使用当前鼠标位置，无视节点属性中的xy坐标
            current_x, current_y = pyautogui.position()
            final_x, final_y = current_x, current_y

            # 对current模式添加随机偏移
            if x_random > 0:
                random_x_offset = random.uniform(-x_random, x_random)
                final_x = int(final_x + random_x_offset)

            if y_random > 0:
                random_y_offset = random.uniform(-y_random, y_random)
                final_y = int(final_y + random_y_offset)
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

                # 添加随机偏移
                if x_random > 0:
                    random_x_offset = random.uniform(-x_random, x_random)
                    final_x = int(final_x + random_x_offset)

                if y_random > 0:
                    random_y_offset = random.uniform(-y_random, y_random)
                    final_y = int(final_y + random_y_offset)

        # 确定滚轮方向
        scroll_amount = clicks if direction == "up" else -clicks

        print(f"🖱️  鼠标滚轮操作详情：")
        print(f"   位置模式: {position_mode}")
        if position_mode == "current":
            print(f"   使用当前鼠标位置 (无视节点xy设置)")
        else:
            print(f"   绝对坐标: ({params.get('x', 0)}, {params.get('y', 0)})")
        print(f"   随机偏移: X±{x_random}, Y±{y_random}")
        print(f"   最终滚轮位置: ({final_x}, {final_y})")
        print(f"   滚轮方向: {direction}, 次数: {clicks}")
        
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
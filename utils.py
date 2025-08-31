import os
import json
import tkinter as tk
from tkinter import messagebox
from typing import Dict, List, Any, Optional
import logging

def setup_logging():
    """设置日志系统"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('autoclick.log', encoding='utf-8'),
            logging.StreamHandler()
        ]
    )

def validate_project_data(data: Dict[str, Any]) -> bool:
    """验证项目数据格式"""
    if not isinstance(data, dict):
        return False
    
    if 'nodes' not in data:
        return False
    
    nodes = data['nodes']
    if not isinstance(nodes, list):
        return False
    
    required_node_fields = ['id', 'action_type', 'params', 'x', 'y']
    for node in nodes:
        if not isinstance(node, dict):
            return False
        for field in required_node_fields:
            if field not in node:
                return False
    
    return True

def create_directories():
    """创建必要的目录结构"""
    directories = ['examples', 'projects', 'images', 'logs']
    for directory in directories:
        os.makedirs(directory, exist_ok=True)

def get_action_description(action_type: str, params: Dict[str, Any]) -> str:
    """获取动作的描述文本"""
    if action_type == 'click':
        return f"点击 ({params.get('x', 0)}, {params.get('y', 0)})"
    elif action_type == 'move':
        return f"移动到 ({params.get('x', 0)}, {params.get('y', 0)})"
    elif action_type == 'keyboard':
        if 'key' in params:
            return f"按键: {params['key']}"
        elif 'text' in params:
            return f"输入: {params['text'][:20]}..."
    elif action_type == 'wait':
        return f"等待 {params.get('duration', 0)} 秒"
    elif action_type in ['findimg', 'followimg', 'clickimg']:
        image_path = params.get('image_path', '')
        filename = os.path.basename(image_path) if image_path else '未知'
        action_names = {
            'findimg': '查找图像',
            'followimg': '移动到图像', 
            'clickimg': '点击图像'
        }
        return f"{action_names[action_type]}: {filename}"
    
    return f"{action_type}: {str(params)}"

def show_error(title: str, message: str):
    """显示错误对话框"""
    messagebox.showerror(title, message)

def show_info(title: str, message: str):
    """显示信息对话框"""
    messagebox.showinfo(title, message)

def show_warning(title: str, message: str):
    """显示警告对话框"""
    messagebox.showwarning(title, message)

def ask_yes_no(title: str, message: str) -> bool:
    """显示确认对话框"""
    return messagebox.askyesno(title, message)

class ConfigManager:
    """配置管理器"""
    
    def __init__(self, config_file: str = 'config.json'):
        self.config_file = config_file
        self.default_config = {
            'screen_scale': 1.0,
            'image_threshold': 0.8,
            'default_wait_time': 1.0,
            'auto_save': True,
            'recent_projects': []
        }
        self.config = self.load_config()
    
    def load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                return {**self.default_config, **config}
            except Exception as e:
                logging.warning(f"加载配置文件失败: {e}")
        return self.default_config.copy()
    
    def save_config(self):
        """保存配置文件"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logging.error(f"保存配置文件失败: {e}")
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取配置值"""
        return self.config.get(key, default)
    
    def set(self, key: str, value: Any):
        """设置配置值"""
        self.config[key] = value
        self.save_config()
    
    def add_recent_project(self, project_path: str):
        """添加最近打开的项目"""
        recent = self.config.get('recent_projects', [])
        if project_path in recent:
            recent.remove(project_path)
        recent.insert(0, project_path)
        recent = recent[:10]  # 最多保留10个
        self.set('recent_projects', recent)

def center_window(window: tk.Tk, width: int, height: int):
    """将窗口居中显示"""
    screen_width = window.winfo_screenwidth()
    screen_height = window.winfo_screenheight()
    
    x = (screen_width - width) // 2
    y = (screen_height - height) // 2
    
    window.geometry(f'{width}x{height}+{x}+{y}')

def validate_coordinates(x: str, y: str) -> tuple[bool, Optional[tuple[int, int]]]:
    """验证坐标输入"""
    try:
        x_val = int(x)
        y_val = int(y)
        if x_val < 0 or y_val < 0:
            return False, None
        return True, (x_val, y_val)
    except ValueError:
        return False, None

def validate_duration(duration: str) -> tuple[bool, Optional[float]]:
    """验证时间输入"""
    try:
        dur_val = float(duration)
        if dur_val < 0:
            return False, None
        return True, dur_val
    except ValueError:
        return False, None
#!/usr/bin/env python3
"""
测试应用导入的独立脚本
"""

def test_imports():
    """测试各个模块的导入"""
    try:
        print("Testing Flask import...")
        from flask import Flask
        print("✓ Flask import successful")
        
        print("Testing OpenCV import...")
        import cv2
        print("✓ OpenCV import successful")
        
        print("Testing PIL import...")
        from PIL import Image
        print("✓ PIL import successful")
        
        print("Testing PyAutoGUI import...")
        import pyautogui
        print("✓ PyAutoGUI import successful")
        
        print("Testing core modules...")
        from core.config import WEB_DIR
        print("✓ Core config import successful")
        
        print("Testing API modules...")
        from api.nodes import nodes_bp
        from api.projects import projects_bp
        from api.execution import execution_bp
        from api.upload import upload_bp
        from api.drawings import drawings_bp
        print("✓ API modules import successful")
        
        print("Testing main app import...")
        from app import app
        print("✓ Main app import successful")
        
        print("\n🎉 All imports successful! Application should work correctly.")
        return True
        
    except ImportError as e:
        print(f"❌ Import Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return False

if __name__ == "__main__":
    success = test_imports()
    exit(0 if success else 1)
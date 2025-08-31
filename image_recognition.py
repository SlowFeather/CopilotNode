import cv2
import numpy as np
import pyautogui
import pyscreeze
from PIL import Image, ImageGrab
import os
import time
from typing import Tuple, Dict, Any, Optional

class ImageRecognition:
    def __init__(self, screen_scale=1):
        self.screen_scale = screen_scale
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.1
        self.screenshot_cache = None
        self.cache_time = 0
        
    def capture_screen(self, save_path="screenshot.png"):
        screenshot = pyscreeze.screenshot(save_path)
        return save_path
        
    def load_target_image(self, image_path):
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Target image not found: {image_path}")
        return cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        
    def find_image_on_screen(self, target_image_path, threshold=0.8):
        screenshot_path = self.capture_screen()
        target = self.load_target_image(target_image_path)
        temp = cv2.imread(screenshot_path, cv2.IMREAD_GRAYSCALE)
        
        theight, twidth = target.shape[:2]
        tempheight, tempwidth = temp.shape[:2]
        
        if self.screen_scale != 1:
            scaleTemp = cv2.resize(temp, (int(tempwidth / self.screen_scale), int(tempheight / self.screen_scale)))
        else:
            scaleTemp = temp
            
        res = cv2.matchTemplate(scaleTemp, target, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)
        
        if max_val >= threshold:
            top_left = max_loc
            center_x = top_left[0] + twidth // 2
            center_y = top_left[1] + theight // 2
            
            os.remove(screenshot_path)
            return {
                'found': True,
                'confidence': max_val,
                'position': (center_x, center_y),
                'top_left': top_left,
                'bottom_right': (top_left[0] + twidth, top_left[1] + theight)
            }
        else:
            os.remove(screenshot_path)
            return {'found': False, 'confidence': max_val}
            
    def click_image(self, target_image_path, threshold=0.8, button='left'):
        result = self.find_image_on_screen(target_image_path, threshold)
        if result['found']:
            pyautogui.click(result['position'][0], result['position'][1], button=button)
            return True
        return False
        
    def get_screen_size(self):
        return pyautogui.size()
    
    def move_to_image(self, target_image_path: str, threshold: float = 0.8) -> bool:
        """移动鼠标到图像位置"""
        result = self.find_image_on_screen(target_image_path, threshold)
        if result['found']:
            pyautogui.moveTo(result['position'][0], result['position'][1])
            return True
        return False
    
    def wait_for_image(self, target_image_path: str, timeout: int = 10, threshold: float = 0.8) -> Dict[str, Any]:
        """等待图像出现在屏幕上"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            result = self.find_image_on_screen(target_image_path, threshold)
            if result['found']:
                return result
            time.sleep(0.5)
        return {'found': False, 'confidence': 0.0}
    
    def double_click_image(self, target_image_path: str, threshold: float = 0.8, button: str = 'left') -> bool:
        """双击图像"""
        result = self.find_image_on_screen(target_image_path, threshold)
        if result['found']:
            pyautogui.doubleClick(result['position'][0], result['position'][1], button=button)
            return True
        return False
    
    def right_click_image(self, target_image_path: str, threshold: float = 0.8) -> bool:
        """右键点击图像"""
        return self.click_image(target_image_path, threshold, 'right')
    
    def get_image_region(self, target_image_path: str, threshold: float = 0.8) -> Optional[Tuple[int, int, int, int]]:
        """获取图像在屏幕上的区域坐标"""
        result = self.find_image_on_screen(target_image_path, threshold)
        if result['found']:
            return (
                result['top_left'][0],
                result['top_left'][1], 
                result['bottom_right'][0],
                result['bottom_right'][1]
            )
        return None
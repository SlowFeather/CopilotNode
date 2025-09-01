import os
import pyautogui

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.1

PROJECTS_DIR = 'projects'
UPLOADS_DIR = 'uploads'
WEB_DIR = 'web'

os.makedirs(PROJECTS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(WEB_DIR, exist_ok=True)
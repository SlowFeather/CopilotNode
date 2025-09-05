import os
import pyautogui

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.1

PROJECTS_DIR = 'projects'
UPLOADS_DIR = 'uploads'
WEB_DIR = 'web'

# New hierarchical storage structure
DRAWINGS_SUBDIR = 'drawings'  # Subdirectory within each project
METADATA_FILE = 'project.json'  # Project metadata file

os.makedirs(PROJECTS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(WEB_DIR, exist_ok=True)
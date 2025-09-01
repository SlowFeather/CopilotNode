import json
import os
from datetime import datetime
from typing import Dict, Any, List
from core.config import PROJECTS_DIR
from core.state import current_project

class ProjectService:
    @staticmethod
    def list_projects() -> List[str]:
        projects = []
        if os.path.exists(PROJECTS_DIR):
            for file in os.listdir(PROJECTS_DIR):
                if file.endswith('.json') or file.endswith('.acp'):
                    projects.append(file)
        return projects

    @staticmethod
    def save_project(filename: str = None) -> Dict[str, Any]:
        if not filename:
            filename = f'project_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        
        if not filename.endswith('.json') and not filename.endswith('.acp'):
            filename += '.json'
        
        filepath = os.path.join(PROJECTS_DIR, filename)
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(current_project, f, ensure_ascii=False, indent=2)
            
            print(f"DEBUG: Saved project '{filepath}' with {len(current_project.get('nodes', []))} nodes")
            return {
                "message": f"Project saved as {filename}", 
                "filename": filename, 
                "filepath": filepath
            }
        except Exception as e:
            print(f"ERROR: Failed to save project '{filepath}': {e}")
            raise Exception(f"Failed to save project: {str(e)}")

    @staticmethod
    def load_project(filename: str) -> Dict[str, Any]:
        global current_project
        filepath = os.path.join(PROJECTS_DIR, filename)
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                loaded_project = json.load(f)
            
            # Update global state
            from core.state import current_project
            current_project.clear()
            current_project.update(loaded_project)
            
            print(f"DEBUG: Loaded project '{filepath}' with {len(current_project.get('nodes', []))} nodes")
            return current_project
        except FileNotFoundError:
            print(f"ERROR: Project file not found: {filepath}")
            raise FileNotFoundError("Project file not found")
        except json.JSONDecodeError as e:
            print(f"ERROR: Invalid project file format in '{filepath}': {e}")
            raise ValueError("Invalid project file format")
        except Exception as e:
            print(f"ERROR: Failed to load project '{filepath}': {e}")
            raise Exception(f"Failed to load project: {str(e)}")
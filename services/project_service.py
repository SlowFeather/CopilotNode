import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from core.config import PROJECTS_DIR, DRAWINGS_SUBDIR, METADATA_FILE
from core.state import (
    create_project, get_project_metadata, list_projects, 
    update_project_metadata, delete_project,
    list_project_drawings, set_current_project, get_current_project
)

class ProjectService:
    
    def __init__(self):
        # Ensure projects directory exists
        os.makedirs(PROJECTS_DIR, exist_ok=True)
    
    def create_new_project(self, name: str, description: str = "") -> Dict[str, Any]:
        """Create a new project with hierarchical structure"""
        try:
            project_id = create_project(name, description)
            set_current_project(project_id)
            
            print(f"DEBUG: Created new project '{name}' with ID: {project_id}")
            
            return {
                "id": project_id,
                "name": name,
                "description": description,
                "message": f"Project '{name}' created successfully"
            }
        except Exception as e:
            print(f"ERROR: Failed to create project '{name}': {e}")
            raise Exception(f"Failed to create project: {str(e)}")
    
    def list_all_projects(self) -> List[Dict[str, Any]]:
        """List all projects with their metadata"""
        try:
            projects = list_projects()
            
            # Add drawing count to each project
            for project in projects:
                try:
                    drawings = list_project_drawings(project["id"])
                    project["drawing_count"] = len(drawings)
                except Exception:
                    project["drawing_count"] = 0
            
            print(f"DEBUG: Listed {len(projects)} projects")
            return projects
        except Exception as e:
            print(f"ERROR: Failed to list projects: {e}")
            return []
    
    def get_project_info(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed project information including drawings"""
        try:
            metadata = get_project_metadata(project_id)
            if not metadata:
                return None
            
            # Add drawings list
            drawings = list_project_drawings(project_id)
            metadata["drawings"] = drawings
            metadata["drawing_count"] = len(drawings)
            
            print(f"DEBUG: Retrieved project info for '{project_id}' with {len(drawings)} drawings")
            return metadata
        except Exception as e:
            print(f"ERROR: Failed to get project info for '{project_id}': {e}")
            return None
    
    def update_project_info(self, project_id: str, updates: Dict[str, Any]) -> bool:
        """Update project information"""
        try:
            success = update_project_metadata(project_id, updates)
            if success:
                print(f"DEBUG: Updated project '{project_id}' with: {updates}")
            return success
        except Exception as e:
            print(f"ERROR: Failed to update project '{project_id}': {e}")
            return False
    
    def delete_project_by_id(self, project_id: str) -> bool:
        """Delete a project and all its drawings"""
        try:
            # Clear current project if it's being deleted
            if get_current_project() == project_id:
                set_current_project(None)
            
            success = delete_project(project_id)
            if success:
                print(f"DEBUG: Deleted project '{project_id}' and all its drawings")
            return success
        except Exception as e:
            print(f"ERROR: Failed to delete project '{project_id}': {e}")
            return False
    
    def set_active_project(self, project_id: str) -> bool:
        """Set the active project"""
        try:
            metadata = get_project_metadata(project_id)
            if not metadata:
                return False
            
            set_current_project(project_id)
            print(f"DEBUG: Set active project to '{project_id}' ({metadata['name']})")
            return True
        except Exception as e:
            print(f"ERROR: Failed to set active project '{project_id}': {e}")
            return False
    
    def get_active_project(self) -> Optional[Dict[str, Any]]:
        """Get the currently active project"""
        try:
            current_id = get_current_project()
            if not current_id:
                return None
            
            return self.get_project_info(current_id)
        except Exception as e:
            print(f"ERROR: Failed to get active project: {e}")
            return None
    
    # Legacy compatibility methods
    def list_projects(self) -> List[str]:
        """Legacy method: List project filenames for backward compatibility"""
        try:
            # Check for old-style projects (JSON files directly in projects dir)
            old_projects = []
            if os.path.exists(PROJECTS_DIR):
                for file in os.listdir(PROJECTS_DIR):
                    if file.endswith('.json') or file.endswith('.acp'):
                        # Check if it's not a new-style project directory
                        full_path = os.path.join(PROJECTS_DIR, file)
                        if os.path.isfile(full_path):
                            old_projects.append(file)
            
            print(f"DEBUG: Found {len(old_projects)} legacy project files")
            return old_projects
        except Exception as e:
            print(f"ERROR: Failed to list legacy projects: {e}")
            return []
    
    def save_project(self, filename: str = None) -> Dict[str, Any]:
        """Legacy method: Save current graph data as old-style project"""
        try:
            from core.state import current_project
            
            if not filename:
                filename = f'legacy_project_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            
            if not filename.endswith('.json') and not filename.endswith('.acp'):
                filename += '.json'
            
            filepath = os.path.join(PROJECTS_DIR, filename)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(current_project, f, ensure_ascii=False, indent=2)
            
            print(f"DEBUG: Saved legacy project '{filepath}' with {len(current_project.get('nodes', []))} nodes")
            return {
                "message": f"Legacy project saved as {filename}", 
                "filename": filename, 
                "filepath": filepath
            }
        except Exception as e:
            print(f"ERROR: Failed to save legacy project: {e}")
            raise Exception(f"Failed to save project: {str(e)}")
    
    def load_project(self, filename: str) -> Dict[str, Any]:
        """Legacy method: Load old-style project"""
        try:
            from core.state import current_project
            
            filepath = os.path.join(PROJECTS_DIR, filename)
            
            with open(filepath, 'r', encoding='utf-8') as f:
                loaded_project = json.load(f)
            
            # Update global state for backward compatibility
            current_project.clear()
            current_project.update(loaded_project)
            
            print(f"DEBUG: Loaded legacy project '{filepath}' with {len(current_project.get('nodes', []))} nodes")
            return current_project
        except FileNotFoundError:
            print(f"ERROR: Legacy project file not found: {filepath}")
            raise FileNotFoundError("Project file not found")
        except json.JSONDecodeError as e:
            print(f"ERROR: Invalid legacy project file format: {e}")
            raise ValueError("Invalid project file format")
        except Exception as e:
            print(f"ERROR: Failed to load legacy project: {e}")
            raise Exception(f"Failed to load project: {str(e)}")
    
    def migrate_legacy_project(self, filename: str, new_project_name: str = None) -> Optional[str]:
        """Migrate an old-style project to the new hierarchical structure"""
        try:
            # Load legacy project
            legacy_data = self.load_project(filename)
            
            # Create new project
            if not new_project_name:
                new_project_name = filename.replace('.json', '').replace('.acp', '')
            
            project_result = self.create_new_project(
                name=new_project_name, 
                description=f"Migrated from legacy project: {filename}"
            )
            
            project_id = project_result["id"]
            
            # Create a default drawing with the legacy data
            from core.state import create_drawing
            drawing_id = create_drawing(
                project_id=project_id,
                name="Main Drawing",
                nodes=legacy_data.get("nodes", [])
            )
            
            print(f"DEBUG: Migrated legacy project '{filename}' to new project '{project_id}' with drawing '{drawing_id}'")
            return project_id
        except Exception as e:
            print(f"ERROR: Failed to migrate legacy project '{filename}': {e}")
            return None
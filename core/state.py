from typing import Dict, Any, Optional, List
import uuid
import threading
import os
import json
from datetime import datetime

# Current active project and drawing
current_project_id: Optional[str] = None
current_drawing_id: Optional[str] = None

# In-memory cache for active sessions
active_drawings: Dict[str, Dict[str, Any]] = {}
drawings_lock = threading.Lock()

# Legacy support for backward compatibility
current_project: Dict[str, Any] = {"nodes": []}
execution_state = {
    "is_running": False,
    "current_node": None,
    "status": "idle",
    "progress": 0,
    "thread": None,
    "should_stop": False
}

def set_current_project(project_id: str):
    """Set the current active project"""
    global current_project_id
    current_project_id = project_id

def get_current_project() -> Optional[str]:
    """Get the current active project ID"""
    return current_project_id

def set_current_drawing(drawing_id: str):
    """Set the current active drawing"""
    global current_drawing_id
    current_drawing_id = drawing_id

def get_current_drawing() -> Optional[str]:
    """Get the current active drawing ID"""
    return current_drawing_id

# Project management functions
def create_project(name: str, description: str = "") -> str:
    """Create a new project directory structure"""
    from core.config import PROJECTS_DIR, DRAWINGS_SUBDIR, METADATA_FILE
    
    project_id = str(uuid.uuid4())
    project_dir = os.path.join(PROJECTS_DIR, project_id)
    drawings_dir = os.path.join(project_dir, DRAWINGS_SUBDIR)
    
    # Create directories
    os.makedirs(drawings_dir, exist_ok=True)
    
    # Create project metadata
    project_metadata = {
        "id": project_id,
        "name": name,
        "description": description,
        "created_at": datetime.now().isoformat(),
        "last_modified": datetime.now().isoformat(),
        "version": "1.0"
    }
    
    metadata_path = os.path.join(project_dir, METADATA_FILE)
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(project_metadata, f, ensure_ascii=False, indent=2)
    
    return project_id

def get_project_metadata(project_id: str) -> Optional[Dict[str, Any]]:
    """Get project metadata"""
    from core.config import PROJECTS_DIR, METADATA_FILE
    
    metadata_path = os.path.join(PROJECTS_DIR, project_id, METADATA_FILE)
    if not os.path.exists(metadata_path):
        return None
    
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None

def list_projects() -> List[Dict[str, Any]]:
    """List all projects"""
    from core.config import PROJECTS_DIR
    
    projects = []
    if not os.path.exists(PROJECTS_DIR):
        return projects
    
    for item in os.listdir(PROJECTS_DIR):
        item_path = os.path.join(PROJECTS_DIR, item)
        if os.path.isdir(item_path):
            # Check if it's a new-style project (has metadata)
            metadata = get_project_metadata(item)
            if metadata:
                projects.append(metadata)
    
    return sorted(projects, key=lambda x: x.get('last_modified', ''), reverse=True)

def update_project_metadata(project_id: str, updates: Dict[str, Any]) -> bool:
    """Update project metadata"""
    from core.config import PROJECTS_DIR, METADATA_FILE
    
    metadata_path = os.path.join(PROJECTS_DIR, project_id, METADATA_FILE)
    if not os.path.exists(metadata_path):
        return False
    
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        metadata.update(updates)
        metadata['last_modified'] = datetime.now().isoformat()
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        return True
    except Exception:
        return False

def delete_project(project_id: str) -> bool:
    """Delete a project and all its drawings"""
    from core.config import PROJECTS_DIR
    import shutil
    
    project_dir = os.path.join(PROJECTS_DIR, project_id)
    if not os.path.exists(project_dir):
        return False
    
    try:
        shutil.rmtree(project_dir)
        return True
    except Exception:
        return False

# Drawing management functions
def create_drawing(project_id: str, name: str, nodes: list = None, boundary: Dict[str, int] = None) -> str:
    """Create a new drawing in a project"""
    from core.config import PROJECTS_DIR, DRAWINGS_SUBDIR
    
    drawing_id = str(uuid.uuid4())
    drawings_dir = os.path.join(PROJECTS_DIR, project_id, DRAWINGS_SUBDIR)
    
    if not os.path.exists(drawings_dir):
        os.makedirs(drawings_dir, exist_ok=True)
    
    default_boundary = {
        "x": 0,
        "y": 0, 
        "width": 1920,
        "height": 1080
    }
    
    drawing_data = {
        "id": drawing_id,
        "project_id": project_id,
        "name": name,
        "nodes": nodes or [],
        "boundary": boundary or default_boundary,
        "created_at": datetime.now().isoformat(),
        "last_modified": datetime.now().isoformat(),
        "execution_history": []
    }
    
    # Save drawing to file
    drawing_path = os.path.join(drawings_dir, f"{drawing_id}.json")
    with open(drawing_path, 'w', encoding='utf-8') as f:
        json.dump(drawing_data, f, ensure_ascii=False, indent=2)
    
    # Cache in memory with execution state
    with drawings_lock:
        active_drawings[drawing_id] = {
            **drawing_data,
            "execution_state": {
                "is_running": False,
                "current_node": None,
                "status": "idle",
                "progress": 0,
                "thread": None,
                "should_stop": False
            }
        }
    
    # Update project metadata
    update_project_metadata(project_id, {"last_modified": datetime.now().isoformat()})
    
    return drawing_id

def get_drawing(drawing_id: str) -> Optional[Dict[str, Any]]:
    """Get a drawing by ID"""
    with drawings_lock:
        # Check memory cache first
        if drawing_id in active_drawings:
            return active_drawings[drawing_id].copy()
    
    # Load from file
    drawing = load_drawing_from_file(drawing_id)
    if drawing:
        # Cache in memory with execution state
        with drawings_lock:
            active_drawings[drawing_id] = {
                **drawing,
                "execution_state": {
                    "is_running": False,
                    "current_node": None,
                    "status": "idle",
                    "progress": 0,
                    "thread": None,
                    "should_stop": False
                }
            }
        return active_drawings[drawing_id].copy()
    
    return None

def load_drawing_from_file(drawing_id: str) -> Optional[Dict[str, Any]]:
    """Load drawing data from file"""
    from core.config import PROJECTS_DIR, DRAWINGS_SUBDIR
    
    # Search all projects for this drawing
    for project_id in os.listdir(PROJECTS_DIR):
        project_path = os.path.join(PROJECTS_DIR, project_id)
        if not os.path.isdir(project_path):
            continue
            
        drawing_path = os.path.join(project_path, DRAWINGS_SUBDIR, f"{drawing_id}.json")
        if os.path.exists(drawing_path):
            try:
                with open(drawing_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                continue
    
    return None

def save_drawing_to_file(drawing_id: str) -> bool:
    """Save drawing data to file"""
    with drawings_lock:
        if drawing_id not in active_drawings:
            return False
        
        drawing_data = active_drawings[drawing_id].copy()
        
    # Remove execution state before saving
    if "execution_state" in drawing_data:
        del drawing_data["execution_state"]
    
    drawing_data["last_modified"] = datetime.now().isoformat()
    
    from core.config import PROJECTS_DIR, DRAWINGS_SUBDIR
    project_id = drawing_data.get("project_id")
    if not project_id:
        return False
    
    drawing_path = os.path.join(PROJECTS_DIR, project_id, DRAWINGS_SUBDIR, f"{drawing_id}.json")
    
    try:
        with open(drawing_path, 'w', encoding='utf-8') as f:
            json.dump(drawing_data, f, ensure_ascii=False, indent=2)
        
        # Update project metadata
        update_project_metadata(project_id, {"last_modified": datetime.now().isoformat()})
        
        return True
    except Exception:
        return False

def list_project_drawings(project_id: str) -> List[Dict[str, Any]]:
    """List all drawings in a project"""
    from core.config import PROJECTS_DIR, DRAWINGS_SUBDIR
    
    drawings = []
    drawings_dir = os.path.join(PROJECTS_DIR, project_id, DRAWINGS_SUBDIR)
    
    if not os.path.exists(drawings_dir):
        return drawings
    
    for filename in os.listdir(drawings_dir):
        if filename.endswith('.json'):
            drawing_id = filename[:-5]  # Remove .json extension
            drawing = get_drawing(drawing_id)
            if drawing:
                drawings.append({
                    "id": drawing["id"],
                    "name": drawing["name"],
                    "created_at": drawing.get("created_at"),
                    "last_modified": drawing.get("last_modified"),
                    "node_count": len(drawing.get("nodes", [])),
                    "execution_state": drawing.get("execution_state", {})
                })
    
    return sorted(drawings, key=lambda x: x.get('last_modified', ''), reverse=True)

def get_all_drawings() -> Dict[str, Dict[str, Any]]:
    """Get all active drawings (for backward compatibility)"""
    with drawings_lock:
        return active_drawings.copy()

def update_drawing(drawing_id: str, updates: Dict[str, Any]):
    """Update a drawing"""
    with drawings_lock:
        if drawing_id in active_drawings:
            active_drawings[drawing_id].update(updates)
            
    # Auto-save to file
    save_drawing_to_file(drawing_id)

def delete_drawing(drawing_id: str) -> bool:
    """Delete a drawing"""
    # Remove from memory cache
    with drawings_lock:
        if drawing_id in active_drawings:
            drawing = active_drawings[drawing_id]
            # Stop execution if running
            if drawing.get("execution_state", {}).get("is_running"):
                drawing["execution_state"]["should_stop"] = True
            del active_drawings[drawing_id]
    
    # Delete file
    from core.config import PROJECTS_DIR, DRAWINGS_SUBDIR
    
    # Search all projects for this drawing
    for project_id in os.listdir(PROJECTS_DIR):
        project_path = os.path.join(PROJECTS_DIR, project_id)
        if not os.path.isdir(project_path):
            continue
            
        drawing_path = os.path.join(project_path, DRAWINGS_SUBDIR, f"{drawing_id}.json")
        if os.path.exists(drawing_path):
            try:
                os.remove(drawing_path)
                # Update project metadata
                update_project_metadata(project_id, {"last_modified": datetime.now().isoformat()})
                return True
            except Exception:
                pass
    
    return False

def update_drawing_execution_state(drawing_id: str, updates: Dict[str, Any]):
    """Update execution state for a specific drawing"""
    with drawings_lock:
        if drawing_id in active_drawings:
            if "execution_state" not in active_drawings[drawing_id]:
                active_drawings[drawing_id]["execution_state"] = {}
            active_drawings[drawing_id]["execution_state"].update(updates)

def get_drawing_execution_state(drawing_id: str) -> Optional[Dict[str, Any]]:
    """Get execution state for a specific drawing"""
    with drawings_lock:
        if drawing_id in active_drawings:
            return active_drawings[drawing_id].get("execution_state", {}).copy()
        return None

def set_drawing_boundary(drawing_id: str, boundary: Dict[str, int]):
    """Set operation boundary for a drawing"""
    update_drawing(drawing_id, {"boundary": boundary})

def get_drawing_boundary(drawing_id: str) -> Optional[Dict[str, int]]:
    """Get operation boundary for a drawing"""
    drawing = get_drawing(drawing_id)
    if drawing:
        return drawing.get("boundary", {}).copy()
    return None

# Legacy compatibility functions
def reset_execution_state():
    execution_state.update({
        "is_running": False,
        "current_node": None,
        "status": "idle",
        "progress": 0,
        "thread": None,
        "should_stop": False
    })

def update_execution_state(updates: Dict[str, Any]):
    execution_state.update(updates)
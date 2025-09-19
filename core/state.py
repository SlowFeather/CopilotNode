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

    # Calculate next order number
    existing_drawings = list_project_drawings(project_id)
    next_order = max([d.get('order', 0) for d in existing_drawings], default=0) + 1

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
        "order": next_order,
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
                    "order": drawing.get("order", 0),  # Include order field
                    "node_count": len(drawing.get("nodes", [])),
                    "execution_state": drawing.get("execution_state", {})
                })

    # Sort by order field (ascending), with fallback to last_modified for drawings without order
    return sorted(drawings, key=lambda x: (x.get('order', 999999), x.get('last_modified', '')))

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

def reorder_drawing(project_id: str, drawing_id: str, new_order: int) -> bool:
    """Reorder a drawing in a project"""
    try:
        drawings_list = list_project_drawings(project_id)

        # Create a map to track order changes
        order_changes = {}

        # Initialize order field for drawings that don't have it
        for i, drawing_info in enumerate(drawings_list):
            if 'order' not in drawing_info:
                order_changes[drawing_info['id']] = i + 1

        target_drawing_info = None

        # Find the target drawing
        for drawing_info in drawings_list:
            if drawing_info['id'] == drawing_id:
                target_drawing_info = drawing_info
                break

        if not target_drawing_info:
            return False

        old_order = target_drawing_info.get('order', 0)

        # Adjust orders of other drawings
        for drawing_info in drawings_list:
            if drawing_info['id'] == drawing_id:
                continue

            current_order = drawing_info.get('order', 0)

            if old_order < new_order:
                # Moving down: shift up drawings between old and new position
                if old_order < current_order <= new_order:
                    order_changes[drawing_info['id']] = current_order - 1
            else:
                # Moving up: shift down drawings between new and old position
                if new_order <= current_order < old_order:
                    order_changes[drawing_info['id']] = current_order + 1

        # Set new order for target drawing
        order_changes[drawing_id] = new_order

        # Apply order changes to full drawing objects and save
        for drawing_info in drawings_list:
            drawing_id_to_update = drawing_info['id']
            if drawing_id_to_update in order_changes:
                # Get the full drawing object
                full_drawing = get_drawing(drawing_id_to_update)
                if full_drawing:
                    # Update order and last_modified
                    full_drawing['order'] = order_changes[drawing_id_to_update]
                    full_drawing['last_modified'] = datetime.now().isoformat()

                    # Save the full drawing object
                    from core.config import PROJECTS_DIR, DRAWINGS_SUBDIR
                    drawings_dir = os.path.join(PROJECTS_DIR, project_id, DRAWINGS_SUBDIR)
                    drawing_path = os.path.join(drawings_dir, f"{drawing_id_to_update}.json")

                    # Remove execution_state before saving to file
                    drawing_to_save = full_drawing.copy()
                    if "execution_state" in drawing_to_save:
                        del drawing_to_save["execution_state"]

                    with open(drawing_path, 'w', encoding='utf-8') as f:
                        json.dump(drawing_to_save, f, ensure_ascii=False, indent=2)

                    # Update memory cache with full object
                    with drawings_lock:
                        if drawing_id_to_update in active_drawings:
                            active_drawings[drawing_id_to_update].update(full_drawing)

        return True

    except Exception as e:
        print(f"Error reordering drawing: {e}")
        return False

def copy_drawing(project_id: str, source_drawing_id: str, new_name: str = None) -> Optional[str]:
    """Copy a drawing within the same project"""
    try:
        source_drawing = get_drawing(source_drawing_id)
        if not source_drawing or source_drawing.get('project_id') != project_id:
            return None

        # Generate new name if not provided
        if not new_name:
            new_name = f"{source_drawing['name']} - 副本"

        # Create new drawing with copied data
        new_drawing_id = create_drawing(
            project_id=project_id,
            name=new_name,
            nodes=source_drawing.get('nodes', []).copy(),
            boundary=source_drawing.get('boundary', {}).copy()
        )

        return new_drawing_id

    except Exception as e:
        print(f"Error copying drawing: {e}")
        return None

def move_drawing_up(project_id: str, drawing_id: str) -> bool:
    """Move a drawing up one position"""
    try:
        drawings = list_project_drawings(project_id)

        # Initialize order field for drawings that don't have it
        for i, drawing in enumerate(drawings):
            if 'order' not in drawing:
                # Get full drawing object and update it
                full_drawing = get_drawing(drawing['id'])
                if full_drawing:
                    full_drawing['order'] = i + 1
                    full_drawing['last_modified'] = datetime.now().isoformat()

                    # Save the full drawing with order field
                    from core.config import PROJECTS_DIR, DRAWINGS_SUBDIR
                    drawings_dir = os.path.join(PROJECTS_DIR, project_id, DRAWINGS_SUBDIR)
                    drawing_path = os.path.join(drawings_dir, f"{drawing['id']}.json")

                    # Remove execution_state before saving
                    drawing_to_save = full_drawing.copy()
                    if "execution_state" in drawing_to_save:
                        del drawing_to_save["execution_state"]

                    with open(drawing_path, 'w', encoding='utf-8') as f:
                        json.dump(drawing_to_save, f, ensure_ascii=False, indent=2)

                    # Update memory cache
                    with drawings_lock:
                        if drawing['id'] in active_drawings:
                            active_drawings[drawing['id']].update(full_drawing)

        drawings.sort(key=lambda x: x.get('order', 0))

        # Find current position
        current_index = None
        for i, drawing in enumerate(drawings):
            if drawing['id'] == drawing_id:
                current_index = i
                break

        if current_index is None or current_index == 0:
            return False  # Already at top or not found

        # Swap orders with previous drawing
        current_order = drawings[current_index].get('order', 0)
        prev_order = drawings[current_index - 1].get('order', 0)

        return reorder_drawing(project_id, drawing_id, prev_order)

    except Exception as e:
        print(f"Error moving drawing up: {e}")
        return False

def move_drawing_down(project_id: str, drawing_id: str) -> bool:
    """Move a drawing down one position"""
    try:
        drawings = list_project_drawings(project_id)

        # Initialize order field for drawings that don't have it
        for i, drawing in enumerate(drawings):
            if 'order' not in drawing:
                # Get full drawing object and update it
                full_drawing = get_drawing(drawing['id'])
                if full_drawing:
                    full_drawing['order'] = i + 1
                    full_drawing['last_modified'] = datetime.now().isoformat()

                    # Save the full drawing with order field
                    from core.config import PROJECTS_DIR, DRAWINGS_SUBDIR
                    drawings_dir = os.path.join(PROJECTS_DIR, project_id, DRAWINGS_SUBDIR)
                    drawing_path = os.path.join(drawings_dir, f"{drawing['id']}.json")

                    # Remove execution_state before saving
                    drawing_to_save = full_drawing.copy()
                    if "execution_state" in drawing_to_save:
                        del drawing_to_save["execution_state"]

                    with open(drawing_path, 'w', encoding='utf-8') as f:
                        json.dump(drawing_to_save, f, ensure_ascii=False, indent=2)

                    # Update memory cache
                    with drawings_lock:
                        if drawing['id'] in active_drawings:
                            active_drawings[drawing['id']].update(full_drawing)

        drawings.sort(key=lambda x: x.get('order', 0))

        # Find current position
        current_index = None
        for i, drawing in enumerate(drawings):
            if drawing['id'] == drawing_id:
                current_index = i
                break

        if current_index is None or current_index == len(drawings) - 1:
            return False  # Already at bottom or not found

        # Swap orders with next drawing
        current_order = drawings[current_index].get('order', 0)
        next_order = drawings[current_index + 1].get('order', 0)

        return reorder_drawing(project_id, drawing_id, next_order)

    except Exception as e:
        print(f"Error moving drawing down: {e}")
        return False

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
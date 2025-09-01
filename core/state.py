from typing import Dict, Any

current_project: Dict[str, Any] = {"nodes": []}

execution_state = {
    "is_running": False,
    "current_node": None,
    "status": "idle",
    "progress": 0,
    "thread": None,
    "should_stop": False
}

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
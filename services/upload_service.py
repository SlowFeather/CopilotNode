import os
import uuid
from typing import Dict, Any
from werkzeug.datastructures import FileStorage
from core.config import UPLOADS_DIR

class UploadService:
    @staticmethod
    def upload_image(file: FileStorage) -> Dict[str, Any]:
        if not file or file.filename == '':
            raise ValueError("No file selected")
        
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        
        filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
        filepath = os.path.join(UPLOADS_DIR, filename)
        
        file.save(filepath)
        return {"filename": filename, "path": filepath}
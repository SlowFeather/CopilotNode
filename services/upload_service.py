import os
import uuid
import hashlib
from typing import Dict, Any, List
from werkzeug.datastructures import FileStorage
from core.config import UPLOADS_DIR

class UploadService:
    @staticmethod
    def get_uploaded_images() -> List[Dict[str, Any]]:
        """Get list of all uploaded images"""
        if not os.path.exists(UPLOADS_DIR):
            return []
        
        images = []
        for filename in os.listdir(UPLOADS_DIR):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
                filepath = os.path.join(UPLOADS_DIR, filename)
                # Normalize path separators to forward slashes for cross-platform compatibility
                normalized_path = filepath.replace(os.sep, '/')
                try:
                    file_stat = os.stat(filepath)
                    images.append({
                        "filename": filename,
                        "path": normalized_path,
                        "size": file_stat.st_size,
                        "created_time": file_stat.st_ctime
                    })
                except OSError:
                    continue
        
        # Sort by creation time (newest first)
        images.sort(key=lambda x: x['created_time'], reverse=True)
        return images

    @staticmethod
    def _calculate_file_hash(file: FileStorage) -> str:
        """Calculate MD5 hash of uploaded file"""
        file.seek(0)
        file_hash = hashlib.md5()
        while chunk := file.read(8192):
            file_hash.update(chunk)
        file.seek(0)  # Reset file pointer
        return file_hash.hexdigest()

    @staticmethod
    def _find_existing_file(file_hash: str, original_filename: str) -> str:
        """Find existing file with same hash"""
        if not os.path.exists(UPLOADS_DIR):
            return None
            
        for filename in os.listdir(UPLOADS_DIR):
            filepath = os.path.join(UPLOADS_DIR, filename)
            if os.path.isfile(filepath):
                try:
                    with open(filepath, 'rb') as existing_file:
                        existing_hash = hashlib.md5()
                        while chunk := existing_file.read(8192):
                            existing_hash.update(chunk)
                        if existing_hash.hexdigest() == file_hash:
                            return filename
                except OSError:
                    continue
        return None

    @staticmethod
    def upload_image(file: FileStorage) -> Dict[str, Any]:
        """Upload image with duplicate detection"""
        if not file or file.filename == '':
            raise ValueError("No file selected")
        
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        
        # Calculate file hash to check for duplicates
        file_hash = UploadService._calculate_file_hash(file)
        existing_filename = UploadService._find_existing_file(file_hash, file.filename)
        
        if existing_filename:
            # File already exists, return existing file info
            existing_filepath = os.path.join(UPLOADS_DIR, existing_filename)
            # Normalize path separators to forward slashes for cross-platform compatibility
            normalized_path = existing_filepath.replace(os.sep, '/')
            return {
                "filename": existing_filename,
                "path": normalized_path,
                "duplicate": True,
                "message": "File already exists, using existing file"
            }
        
        # Generate new filename and save
        filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
        filepath = os.path.join(UPLOADS_DIR, filename)
        
        file.save(filepath)
        # Normalize path separators to forward slashes for cross-platform compatibility
        normalized_path = filepath.replace(os.sep, '/')
        return {
            "filename": filename,
            "path": normalized_path,
            "duplicate": False,
            "message": "File uploaded successfully"
        }
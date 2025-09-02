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
        """Upload image with duplicate detection, preserving original filename when possible"""
        if not file or file.filename == '':
            raise ValueError("No file selected")
        
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        
        original_filename = file.filename
        original_filepath = os.path.join(UPLOADS_DIR, original_filename)
        
        # Check if file with original name already exists
        if os.path.exists(original_filepath):
            # File with same name exists, check if it's the same content
            file_hash = UploadService._calculate_file_hash(file)
            
            # Calculate hash of existing file
            try:
                with open(original_filepath, 'rb') as existing_file:
                    existing_hash = hashlib.md5()
                    while chunk := existing_file.read(8192):
                        existing_hash.update(chunk)
                    
                    if existing_hash.hexdigest() == file_hash:
                        # Same file content, return existing file
                        normalized_path = original_filepath.replace(os.sep, '/')
                        return {
                            "filename": original_filename,
                            "path": normalized_path,
                            "duplicate": True,
                            "message": "File already exists, using existing file"
                        }
            except OSError:
                pass  # If we can't read existing file, proceed with rename
            
            # Different content, need to rename with UUID prefix
            filename = f"{uuid.uuid4().hex[:8]}_{original_filename}"
            filepath = os.path.join(UPLOADS_DIR, filename)
        else:
            # Original filename is available, use it directly
            filename = original_filename
            filepath = original_filepath
        
        # Save the file
        file.save(filepath)
        
        # Normalize path separators to forward slashes for cross-platform compatibility
        normalized_path = filepath.replace(os.sep, '/')
        return {
            "filename": filename,
            "path": normalized_path,
            "duplicate": False,
            "message": "File uploaded successfully"
        }

    @staticmethod
    def delete_image(filename: str) -> Dict[str, Any]:
        """Delete uploaded image file"""
        if not filename:
            raise ValueError("No filename provided")
        
        # Security check - ensure filename doesn't contain path separators
        if '/' in filename or '\\' in filename or '..' in filename:
            raise ValueError("Invalid filename")
        
        filepath = os.path.join(UPLOADS_DIR, filename)
        
        if not os.path.exists(filepath):
            raise FileNotFoundError("Image file not found")
        
        if not os.path.isfile(filepath):
            raise ValueError("Not a valid file")
        
        try:
            os.remove(filepath)
            return {
                "filename": filename,
                "message": "Image deleted successfully"
            }
        except OSError as e:
            raise Exception(f"Failed to delete file: {str(e)}")
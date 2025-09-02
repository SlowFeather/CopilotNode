from flask import Blueprint, jsonify, request, send_from_directory
from services.upload_service import UploadService
from core.config import UPLOADS_DIR
import os

upload_bp = Blueprint('upload', __name__, url_prefix='/api')
upload_service = UploadService()

@upload_bp.route('/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400
    
    file = request.files['image']
    
    try:
        result = upload_service.upload_image(file)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

@upload_bp.route('/images', methods=['GET'])
def get_uploaded_images():
    """Get list of all uploaded images"""
    try:
        images = upload_service.get_uploaded_images()
        return jsonify(images)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@upload_bp.route('/images/<filename>', methods=['GET'])
def serve_image(filename):
    """Serve uploaded image files"""
    try:
        return send_from_directory(UPLOADS_DIR, filename)
    except FileNotFoundError:
        return jsonify({"error": "Image not found"}), 404
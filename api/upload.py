from flask import Blueprint, jsonify, request
from services.upload_service import UploadService

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
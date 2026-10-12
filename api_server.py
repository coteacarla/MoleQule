#!/usr/bin/env python3
"""
Flask API server for molecule visualization
Handles file uploads and generates 2D images + launches 3D viewer
"""
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import sys
import tempfile
from pathlib import Path

# Import visualization functions
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '2d'))
from visualize_molecule import process_molecule_file

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Create directory for generated images
IMAGES_DIR = Path(__file__).parent / 'interface' / 'generated_images'
IMAGES_DIR.mkdir(exist_ok=True)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "message": "Molecule visualization API is running"})

@app.route('/api/visualize', methods=['POST'])
def visualize_molecule():
    """
    Process uploaded molecule file and return 2D image
    3D visualization now happens in the browser via 3Dmol.js
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(mode='wb', suffix='.xyz', delete=False) as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name
    
    try:
        # Generate unique output filename based on input
        base_name = Path(file.filename).stem
        output_image = IMAGES_DIR / f"{base_name}_2d.png"
        
        # Process molecule file (2D image only, no 3D window)
        success, message = process_molecule_file(tmp_path, str(output_image), launch_3d=False)
        
        if success:
            # Return relative path for frontend
            image_url = f"/api/images/{output_image.name}"
            return jsonify({
                "success": True,
                "message": message,
                "image_url": image_url,
                "filename": file.filename
            })
        else:
            return jsonify({"success": False, "error": message}), 500
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except:
            pass

@app.route('/api/images/<filename>', methods=['GET'])
def serve_image(filename):
    """Serve generated 2D molecule images"""
    image_path = IMAGES_DIR / filename
    if not image_path.exists():
        return jsonify({"error": "Image not found"}), 404
    return send_file(image_path, mimetype='image/png')

if __name__ == '__main__':
    print("🚀 Starting Molecule Visualization API Server...")
    print(f"📁 Generated images will be saved to: {IMAGES_DIR}")
    print("🌐 Server running on http://localhost:5000")
    print("💡 Use Ctrl+C to stop the server")
    app.run(debug=True, host='0.0.0.0', port=5000)

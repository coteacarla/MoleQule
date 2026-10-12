"""
Molecule visualization endpoints
"""
from flask import Blueprint, request, jsonify, send_file
from app.services.storage_service import storage_service
from app.services.logger_service import logger_service
import io
import base64
import numpy as np


bp = Blueprint('visualization', __name__, url_prefix='/api/v1/visualization')


@bp.route('/molecule/2d', methods=['POST'])
def visualize_molecule_2d():
    """
    Generate 2D molecule visualization
    
    Request body:
    {
        "xyz_data": "H 0.0 0.0 0.0\\nH 0.0 0.0 0.74",
        "format": "png"  // or "svg"
    }
    """
    try:
        data = request.json
        
        xyz_data = data.get('xyz_data')
        if not xyz_data:
            return jsonify({"error": "xyz_data required"}), 400
        
        try:
            from rdkit import Chem
            from rdkit.Chem import AllChem, Draw
            
            # Parse XYZ data
            lines = xyz_data.strip().split('\n')
            atoms = []
            coords = []
            
            for line in lines:
                parts = line.strip().split()
                if len(parts) >= 4:
                    atoms.append(parts[0])
                    coords.append([float(parts[1]), float(parts[2]), float(parts[3])])
            
            if not atoms:
                return jsonify({"error": "No valid atoms found in XYZ data"}), 400
            
            # Create RDKit molecule with proper bonds using the same approach as 3d.py
            mol = Chem.RWMol()
            conf = Chem.Conformer(len(atoms))
            
            for i, (atom, (x, y, z)) in enumerate(zip(atoms, coords)):
                idx = mol.AddAtom(Chem.Atom(atom))
                conf.SetAtomPosition(idx, (x, y, z))
            
            mol.AddConformer(conf)
            
            # Guess bonds based on distance (same algorithm as 3d.py)
            max_distance = 1.8
            bonds_added = 0
            for i in range(len(atoms)):
                for j in range(i + 1, len(atoms)):
                    d = np.linalg.norm(np.array(coords[i]) - np.array(coords[j]))
                    if 0.4 < d < max_distance:
                        mol.AddBond(i, j, Chem.BondType.SINGLE)
                        bonds_added += 1
            
            logger_service.get_logger("api").info(f"Added {bonds_added} bonds to molecule with {len(atoms)} atoms")
            
            # Try to sanitize, but continue even if it fails
            try:
                Chem.SanitizeMol(mol)
                logger_service.get_logger("api").info("Molecule sanitized successfully")
            except Exception as e:
                logger_service.get_logger("api").warning(f"Failed to sanitize molecule: {e}")
                # Continue anyway - the molecule can still be visualized
            
            # Convert to read-only molecule
            mol = mol.GetMol()
            
            if mol is None or mol.GetNumAtoms() == 0:
                return jsonify({"error": "Failed to create valid molecule"}), 400
            
            logger_service.get_logger("api").info(f"Molecule has {mol.GetNumAtoms()} atoms and {mol.GetNumBonds()} bonds")
            
            # Remove the 3D conformer before generating 2D coordinates
            # This is important - RDKit needs a clean slate for 2D layout
            mol.RemoveAllConformers()
            
            # Generate 2D coordinates - this creates a proper 2D layout
            result = AllChem.Compute2DCoords(mol)
            logger_service.get_logger("api").info(f"Compute2DCoords result: {result}")
            
            # Verify we have 2D coordinates
            if mol.GetNumConformers() == 0:
                logger_service.get_logger("api").error("Failed to generate 2D coordinates")
                return jsonify({"error": "Failed to generate 2D layout"}), 400
            
            # Create the image with proper rendering - use larger size for better quality
            img = Draw.MolToImage(mol, size=(600, 600), kekulize=True)
            
            # Save image to storage/plots directory
            import os
            from pathlib import Path
            import hashlib
            import time
            
            plots_dir = Path(__file__).parent.parent.parent / 'storage' / 'plots'
            plots_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate unique filename based on xyz_data hash and timestamp
            hash_obj = hashlib.md5(xyz_data.encode())
            filename = f"molecule_2d_{hash_obj.hexdigest()[:8]}_{int(time.time())}.png"
            filepath = plots_dir / filename
            
            # Save to file
            img.save(str(filepath))
            logger_service.get_logger("api").info(f"Saved 2D image to: {filepath}")
            
            # Convert to base64
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='PNG')
            img_bytes.seek(0)
            
            img_base64 = base64.b64encode(img_bytes.getvalue()).decode()
            
            logger_service.get_logger("api").info("2D molecule visualization generated successfully")
            
            return jsonify({
                "status": "success",
                "image_base64": img_base64,
                "format": "png",
                "filename": filename,
                "filepath": str(filepath)
            }), 200
            
        except ImportError as ie:
            logger_service.get_logger("api").error(f"RDKit import error: {ie}")
            return jsonify({
                "status": "error",
                "error": "RDKit not installed. Install with: pip install rdkit"
            }), 500
        except Exception as e:
            logger_service.get_logger("api").error(f"2D visualization error: {e}")
            return jsonify({
                "status": "error",
                "error": f"Failed to generate 2D visualization: {str(e)}"
            }), 500
        
    except Exception as e:
        logger_service.log_error("visualize_molecule_2d", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/molecule/3d', methods=['POST'])
def visualize_molecule_3d():
    """
    Generate 3D molecule visualization data
    
    Request body:
    {
        "xyz_data": "H 0.0 0.0 0.0\\nH 0.0 0.0 0.74"
    }
    """
    try:
        data = request.json
        
        xyz_data = data.get('xyz_data')
        if not xyz_data:
            return jsonify({"error": "xyz_data required"}), 400
        
        atoms = []
        bonds = []
        
        lines = xyz_data.strip().split('\n')
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 4:
                atoms.append({
                    "element": parts[0],
                    "x": float(parts[1]),
                    "y": float(parts[2]),
                    "z": float(parts[3])
                })
        
        for i in range(len(atoms)):
            for j in range(i + 1, len(atoms)):
                a1 = atoms[i]
                a2 = atoms[j]
                
                dist = ((a1['x'] - a2['x'])**2 + 
                       (a1['y'] - a2['y'])**2 + 
                       (a1['z'] - a2['z'])**2)**0.5
                
                if dist < 2.0:
                    bonds.append({"atom1": i, "atom2": j})
        
        logger_service.get_logger("api").info(f"3D molecule data generated: {len(atoms)} atoms, {len(bonds)} bonds")
        
        return jsonify({
            "status": "success",
            "atoms": atoms,
            "bonds": bonds
        }), 200
        
    except Exception as e:
        logger_service.log_error("visualize_molecule_3d", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/backend/layout', methods=['GET'])
def backend_layout():
    """
    Get backend coupling map layout
    
    Query params:
    - backend_name: Name of backend
    """
    try:
        from app.services.credential_manager import credential_manager
        from qiskit_ibm_runtime import QiskitRuntimeService
        
        backend_name = request.args.get('backend_name')
        user_id = request.args.get('user_id', 'default')
        
        if not backend_name:
            return jsonify({"error": "backend_name required"}), 400
        
        creds = credential_manager.load_credentials(user_id)
        if not creds:
            return jsonify({"error": "No credentials configured"}), 400
        
        service = QiskitRuntimeService(
            channel="ibm_cloud",
            token=creds['token'],
            instance=creds['crn']
        )
        
        backend = service.backend(backend_name)
        config = backend.configuration()
        
        coupling_map = []
        if hasattr(config, 'coupling_map') and config.coupling_map:
            coupling_map = [[int(q[0]), int(q[1])] for q in config.coupling_map]
        
        num_qubits = config.n_qubits if hasattr(config, 'n_qubits') else 0
        
        basis_gates = config.basis_gates if hasattr(config, 'basis_gates') else []
        
        logger_service.get_logger("api").info(f"Backend layout retrieved: {backend_name}")
        
        return jsonify({
            "status": "success",
            "backend_name": backend_name,
            "num_qubits": num_qubits,
            "coupling_map": coupling_map,
            "basis_gates": basis_gates
        }), 200
        
    except Exception as e:
        logger_service.log_error("backend_layout", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/circuit/qubit-mapping', methods=['POST'])
def circuit_qubit_mapping():
    """
    Get circuit qubit mapping on backend
    
    Request body:
    {
        "session_id": "unique_session_id",
        "backend_name": "ibm_fez",
        "initial_layout": [0, 1, 2, ...]
    }
    """
    try:
        data = request.json
        
        session_id = data.get('session_id')
        backend_name = data.get('backend_name')
        initial_layout = data.get('initial_layout')
        
        if not session_id or not backend_name:
            return jsonify({"error": "session_id and backend_name required"}), 400
        
        from app.utils.session_manager import session_manager
        
        builder = session_manager.get_circuit_builder(session_id)
        if not builder:
            return jsonify({"error": "No circuit built for session"}), 404
        
        circuit_info = {
            "num_qubits": builder.circuit.num_qubits if builder.circuit else 0,
            "initial_layout": initial_layout,
            "backend_name": backend_name
        }
        
        logger_service.get_logger("api").info(f"Circuit mapping info: {session_id}")
        
        return jsonify({
            "status": "success",
            "mapping": circuit_info
        }), 200
        
    except Exception as e:
        logger_service.log_error("circuit_qubit_mapping", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/molecule/image/<filename>', methods=['GET'])
def get_molecule_image(filename):
    """
    Retrieve a saved molecule 2D image
    
    Path params:
    - filename: Name of the saved image file
    """
    try:
        from pathlib import Path
        
        plots_dir = Path(__file__).parent.parent.parent / 'storage' / 'plots'
        filepath = plots_dir / filename
        
        if not filepath.exists():
            return jsonify({"error": "Image not found"}), 404
        
        logger_service.get_logger("api").info(f"Serving image: {filename}")
        
        return send_file(filepath, mimetype='image/png')
        
    except Exception as e:
        logger_service.log_error("get_molecule_image", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

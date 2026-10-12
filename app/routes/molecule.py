"""
Molecule building endpoint
"""
from flask import Blueprint, request, jsonify
from app.utils.session_manager import session_manager
from app.utils.validators import validate_xyz_data
from app.services.storage_service import storage_service
from app.services.logger_service import logger_service


bp = Blueprint('molecule', __name__, url_prefix='/api/v1/molecule')


@bp.route('/build', methods=['POST'])
def build_molecule():
    """
    Build a molecule from XYZ coordinates
    
    Request body:
    {
        "xyz_data": "H 0.0 0.0 0.0\\nH 0.0 0.0 0.74",
        "basis": "6-31g",
        "charge": 0,
        "spin": 0,
        "session_id": "unique_session_id"
    }
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        xyz_data = data.get('xyz_data')
        basis = data.get('basis', '6-31g')
        charge = data.get('charge', 0)
        spin = data.get('spin', 0)
        session_id = data.get('session_id', 'default')
        
        # Validate XYZ data
        is_valid, error_msg = validate_xyz_data(xyz_data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        # Create calculator and build molecule
        calculator = session_manager.create_session(session_id, xyz_data, basis, charge, spin)
        result = calculator.build_molecule()
        
        if result['status'] == 'success':
            result['session_id'] = session_id
            
            molecule_name = data.get('molecule_name', session_id)
            atoms_data = {
                'xyz_data': xyz_data,
                'basis': basis,
                'charge': charge,
                'spin': spin,
                'natom': result['natom'],
                'nelectron': result['nelectron'],
                'nbasis': result['nbasis']
            }
            
            storage_service.save_molecule_data(molecule_name, basis, 'CELL2', atoms_data)
            logger_service.get_logger("api").info(f"Molecule built: {molecule_name} with basis {basis}")
            
            return jsonify(result), 200
        else:
            session_manager.delete_session(session_id)
            logger_service.log_error("build_molecule", Exception(result.get('message', 'Unknown error')))
            return jsonify(result), 400
            
    except Exception as e:
        logger_service.log_error("build_molecule", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

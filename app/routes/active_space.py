"""
Active space setup endpoint
"""
from flask import Blueprint, request, jsonify
from app.utils.session_manager import session_manager
from app.utils.validators import validate_session_request, validate_active_space_config
from app.services.molecular_calculator import ActiveSpaceConfig
from app.services.storage_service import storage_service
from app.services.logger_service import logger_service


bp = Blueprint('active_space', __name__, url_prefix='/api/v1/active-space')


@bp.route('/setup', methods=['POST'])
def setup_active_space():
    """
    Setup active space for calculation
    
    Request body:
    {
        "session_id": "unique_session_id",
        "mode": "homo_lumo",  // or "range" or "explicit"
        "n_below_homo": 18,
        "n_above_lumo": 18,
        "nelec_mode": "auto"  // or "manual"
    }
    """
    try:
        data = request.json
        
        # Validate request
        is_valid, error_msg = validate_session_request(data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        is_valid, error_msg = validate_active_space_config(data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        session_id = data.get('session_id')
        
        # Get calculator from session
        calculator = session_manager.get_calculator(session_id)
        if calculator is None:
            return jsonify({"error": "Session not found. Build molecule first."}), 404
        
        # Create config
        config = ActiveSpaceConfig(
            mode=data.get('mode'),
            act_start=data.get('act_start'),
            act_stop=data.get('act_stop'),
            explicit_orbs=data.get('explicit_orbs'),
            n_below_homo=data.get('n_below_homo'),
            n_above_lumo=data.get('n_above_lumo'),
            nelec_mode=data.get('nelec_mode', 'auto'),
            manual_nelec=tuple(data['manual_nelec']) if 'manual_nelec' in data else None
        )
        
        # Setup active space
        result = calculator.setup_active_space(config)
        
        if result['status'] == 'success':
            molecule_name = data.get('molecule_name', session_id)
            basis = calculator.basis
            
            active_space_data = {
                'mode': data.get('mode'),
                'num_orbitals': result.get('num_orbitals'),
                'n_electrons': result.get('total_electrons'),
                'n_alpha': result.get('n_alpha'),
                'n_beta': result.get('n_beta'),
                'active_orbs': result.get('active_orbital_indices'),  # Fixed: was 'active_orbs'
                'config': config.__dict__
            }
            
            storage_service.save_molecule_data(molecule_name, basis, 'CELL2_active_space', active_space_data)
            logger_service.get_logger("api").info(f"Active space setup for {molecule_name}")
            
            return jsonify(result), 200
        else:
            logger_service.log_error("setup_active_space", Exception(result.get('message', 'Failed')))
            return jsonify(result), 400
            
    except ValueError as e:
        # Validation errors from calculator
        error_msg = str(e)
        logger_service.get_logger("api").error(f"Active space validation error: {error_msg}")
        return jsonify({
            "error": error_msg,
            "status": "error"
        }), 400
    except Exception as e:
        logger_service.log_error("setup_active_space", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

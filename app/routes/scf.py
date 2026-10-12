"""
SCF calculation endpoint
"""
from flask import Blueprint, request, jsonify
from app.utils.session_manager import session_manager
from app.utils.validators import validate_session_request
from app.services.storage_service import storage_service
from app.services.logger_service import logger_service


bp = Blueprint('scf', __name__, url_prefix='/api/v1/scf')


@bp.route('/run', methods=['POST'])
def run_scf():
    """
    Run Hartree-Fock (SCF) calculation
    
    Request body:
    {
        "session_id": "unique_session_id"
    }
    """
    try:
        data = request.json
        
        # Validate request
        is_valid, error_msg = validate_session_request(data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        session_id = data.get('session_id')
        
        # Get calculator from session
        calculator = session_manager.get_calculator(session_id)
        if calculator is None:
            return jsonify({"error": "Session not found. Build molecule first."}), 404
        
        # Run SCF
        result = calculator.run_scf()
        
        if result['status'] == 'success':
            molecule_name = data.get('molecule_name', session_id)
            basis = calculator.basis
            
            # Save all SCF data including PySCF objects
            scf_data = {
                'converged': result.get('converged'),
                'scf_energy': result.get('scf_energy'),
                'mf': calculator.mf,  # Save the mean-field object (will be pickled)
                'mol': calculator.mol  # Save the molecule object (will be pickled)
            }
            
            # Save MO energies and occupations if available
            if hasattr(calculator, 'mo_energy') and calculator.mo_energy is not None:
                scf_data['mo_energy'] = calculator.mo_energy.tolist() if hasattr(calculator.mo_energy, 'tolist') else calculator.mo_energy
            
            if hasattr(calculator, 'mo_occ') and calculator.mo_occ is not None:
                scf_data['mo_occ'] = calculator.mo_occ.tolist() if hasattr(calculator.mo_occ, 'tolist') else calculator.mo_occ
            
            storage_service.save_molecule_data(molecule_name, basis, 'CELL2_scf', scf_data)
            logger_service.get_logger("api").info(f"SCF completed and saved (including mf and mol objects) for {molecule_name}")
            
            return jsonify(result), 200
        else:
            logger_service.log_error("run_scf", Exception(result.get('message', 'SCF failed')))
            return jsonify(result), 400
            
    except Exception as e:
        logger_service.log_error("run_scf", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

"""
Quantum circuit endpoints
"""
from flask import Blueprint, request, jsonify
from app.utils.session_manager import session_manager
from app.utils.validators import validate_session_request
from app.services.quantum_circuit import QuantumCircuitBuilder
from app.services.storage_service import storage_service
from app.services.logger_service import logger_service


bp = Blueprint('circuit', __name__, url_prefix='/api/v1/circuit')


@bp.route('/restore', methods=['POST'])
def restore_circuit():
    """
    Restore circuit metadata from storage (CELL4) if available
    
    Request body:
    {
        "session_id": "unique_session_id",
        "molecule_name": "molecule_name",
        "basis": "6-31g"
    }
    """
    try:
        data = request.json
        
        is_valid, error_msg = validate_session_request(data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        session_id = data.get('session_id')
        molecule_name = data.get('molecule_name')
        basis = data.get('basis', '6-31g')
        
        if not molecule_name:
            return jsonify({"error": "molecule_name is required"}), 400
        
        # Try to load circuit data from storage
        circuit_data = storage_service.load_molecule_data(molecule_name, basis, 'CELL4_circuit')
        
        if circuit_data is None:
            return jsonify({
                "status": "not_found",
                "message": "No saved circuit found for this molecule"
            }), 404
        
        print(f"[CIRCUIT RESTORE] Loaded for {molecule_name}/{basis}")
        print(f"[CIRCUIT RESTORE] Qubits: {circuit_data.get('num_qubits')}, Depth: {circuit_data.get('depth')}")
        
        return jsonify({
            "status": "success",
            "num_qubits": circuit_data.get('num_qubits'),
            "depth": circuit_data.get('depth'),
            "gate_counts": circuit_data.get('gate_counts'),
            "n_reps": circuit_data.get('n_reps', 1),
            "restored_from_storage": True
        }), 200
            
    except Exception as e:
        logger_service.log_error("restore_circuit", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/build', methods=['POST'])
def build_circuit():
    """
    Build UCJ quantum circuit
    
    Request body:
    {
        "session_id": "unique_session_id",
        "n_reps": 1
    }
    """
    try:
        data = request.json
        
        # Validate request
        is_valid, error_msg = validate_session_request(data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        session_id = data.get('session_id')
        n_reps = data.get('n_reps', 1)
        
        # Get calculator from session
        calculator = session_manager.get_calculator(session_id)
        if calculator is None:
            return jsonify({"error": "Session not found."}), 404
        
        # Check prerequisites
        print(f"[CIRCUIT BUILD] Calculator state: t1={calculator.t1 is not None}, t2={calculator.t2 is not None}")
        print(f"[CIRCUIT BUILD] Active space: num_orbitals={calculator.num_orbitals}, n_alpha={calculator.n_alpha}, n_beta={calculator.n_beta}")
        
        if calculator.t1 is None or calculator.t2 is None:
            return jsonify({
                "error": "CCSD amplitudes not computed. Run 'Compute Integrals' first to generate t1 and t2 amplitudes."
            }), 400
        
        # Create circuit builder
        builder = QuantumCircuitBuilder(
            calculator.num_orbitals,
            (calculator.n_alpha, calculator.n_beta),
            calculator.t1,
            calculator.t2
        )
        
        # Build circuit
        result = builder.build_ucj_circuit(n_reps)
        
        if result['status'] == 'success':
            session_manager.set_circuit_builder(session_id, builder)
            
            molecule_name = data.get('molecule_name', session_id)
            calculator = session_manager.get_calculator(session_id)
            basis = calculator.basis if calculator else '6-31g'
            
            circuit_data = {
                'n_reps': n_reps,
                'num_qubits': result.get('num_qubits'),
                'depth': result.get('depth'),
                'gate_counts': result.get('gate_counts')
            }
            
            storage_service.save_molecule_data(molecule_name, basis, 'CELL4_circuit', circuit_data)
            logger_service.get_logger("api").info(f"Circuit built for {molecule_name}")
            
            return jsonify(result), 200
        else:
            logger_service.log_error("build_circuit", Exception(result.get('message', 'Failed')))
            return jsonify(result), 400
            
    except Exception as e:
        logger_service.log_error("build_circuit", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/transpile', methods=['POST'])
def transpile_circuit():
    """
    Transpile circuit for IBM backend
    
    Request body:
    {
        "session_id": "unique_session_id",
        "backend_name": "ibm_fez",
        "optimization_level": 3,
        "use_pre_init": true,
        "use_zigzag_layout": true
    }
    
    Note: Requires IBM credentials to be configured
    """
    try:
        data = request.json
        
        # Validate request
        is_valid, error_msg = validate_session_request(data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        session_id = data.get('session_id')
        backend_name = data.get('backend_name')
        optimization_level = data.get('optimization_level', 3)
        use_pre_init = data.get('use_pre_init', True)
        use_zigzag_layout = data.get('use_zigzag_layout', True)
        
        if not backend_name:
            return jsonify({"error": "backend_name is required"}), 400
        
        # Get user credentials
        user_id = data.get('user_id', 'default')
        from app.services.credential_manager import credential_manager
        creds = credential_manager.load_credentials(user_id)
        
        if not creds:
            return jsonify({"error": "No credentials configured"}), 400
        
        # Get circuit builder from session
        builder = session_manager.get_circuit_builder(session_id)
        if builder is None:
            logger_service.get_logger("api").warning(f"No circuit found for session {session_id} - user needs to build circuit first")
            return jsonify({
                "error": "Circuit not built. Call /api/v1/circuit/build first."
            }), 404
        
        # Get backend (using user credentials)
        from qiskit_ibm_runtime import QiskitRuntimeService
        
        service = QiskitRuntimeService(
            channel="ibm_cloud",
            token=creds['token'],
            instance=creds['crn']
        )
        backend = service.backend(backend_name)
        
        # Transpile
        result = builder.transpile_for_backend(
            backend,
            optimization_level,
            use_pre_init,
            use_zigzag_layout
        )
        
        if result['status'] == 'success':
            logger_service.get_logger("api").info(f"Circuit transpiled for {backend_name}")
            return jsonify(result), 200
        else:
            logger_service.log_error("transpile_circuit", Exception(result.get('message', 'Failed')))
            return jsonify(result), 400
            
    except Exception as e:
        logger_service.log_error("transpile_circuit", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/qasm', methods=['GET'])
def get_circuit_qasm():
    """
    Get QASM representation of circuit
    
    Query params:
    - session_id: Session identifier
    """
    try:
        session_id = request.args.get('session_id')
        
        if not session_id:
            return jsonify({"error": "session_id is required"}), 400
        
        builder = session_manager.get_circuit_builder(session_id)
        if builder is None:
            return jsonify({"error": "Circuit not built."}), 404
        
        qasm = builder.get_circuit_qasm()
        if qasm is None:
            return jsonify({"error": "No circuit available"}), 404
        
        return jsonify({
            "status": "success",
            "qasm": qasm
        }), 200
            
    except Exception as e:
        logger_service.log_error("get_circuit_qasm", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

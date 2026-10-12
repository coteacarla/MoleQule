"""
IBM Quantum backend endpoints
"""
from flask import Blueprint, request, jsonify


bp = Blueprint('ibm', __name__, url_prefix='/api/v1/ibm')


@bp.route('/backends', methods=['GET'])
def get_ibm_backends():
    """
    Get available IBM Quantum backends
    
    Query params:
    - token: IBM Cloud token (optional if configured in environment)
    - crn: IBM Cloud CRN (optional if configured in environment)
    """
    try:
        from qiskit_ibm_runtime import QiskitRuntimeService
        from config.settings import Config
        
        token = request.args.get('token', Config.IBM_CLOUD_TOKEN)
        crn = request.args.get('crn', Config.IBM_CLOUD_CRN)
        
        if not token or not crn:
            return jsonify({
                "error": "IBM Cloud credentials not provided. Set IBM_CLOUD_TOKEN and IBM_CLOUD_CRN environment variables or pass as query parameters."
            }), 400
        
        service = QiskitRuntimeService(
            channel="ibm_cloud",
            token=token,
            instance=crn
        )
        
        backends = []
        for backend in service.backends():
            backend_info = {
                "name": backend.name
            }
            
            # Add optional properties if available
            if hasattr(backend, 'num_qubits'):
                backend_info['num_qubits'] = backend.num_qubits
            if hasattr(backend, 'status'):
                backend_info['status'] = backend.status().status_msg
            
            backends.append(backend_info)
        
        return jsonify({
            "status": "success",
            "backends": backends,
            "count": len(backends)
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

"""
Backend monitoring and selection endpoints
"""
from flask import Blueprint, request, jsonify
from app.services.backend_monitor import backend_monitor
from app.services.credential_manager import credential_manager
from app.services.logger_service import logger_service


bp = Blueprint('backends', __name__, url_prefix='/api/v1/backends')


@bp.route('/list', methods=['GET'])
def list_backends():
    """
    Get list of available backends with queue and error info
    
    Query params:
    - force_update: Force refresh of backend data (default=false)
    - user_id: User ID for credentials (default="default")
    """
    try:
        force_update = request.args.get('force_update', 'false').lower() == 'true'
        user_id = request.args.get('user_id', 'default')
        
        if not backend_monitor.service:
            creds = credential_manager.load_credentials(user_id)
            if creds:
                backend_monitor.initialize(creds['token'], creds['crn'])
                backend_monitor.start_monitoring()
            else:
                return jsonify({
                    "error": "No credentials configured. Use /api/v1/credentials/save first."
                }), 400
        
        backends = backend_monitor.get_backends_data(force_update=force_update)
        
        return jsonify({
            "status": "success",
            "backends": backends,
            "count": len(backends),
            "last_update": backend_monitor.last_update.isoformat() if backend_monitor.last_update else None
        }), 200
        
    except Exception as e:
        logger_service.log_error("list_backends", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/optimal', methods=['GET'])
def get_optimal_backend():
    """
    Get optimal backend based on criteria
    
    Query params:
    - min_qubits: Minimum number of qubits required (default=0)
    - operational_only: Only operational backends (default=true)
    - user_id: User ID for credentials (default="default")
    """
    try:
        min_qubits = int(request.args.get('min_qubits', 0))
        operational_only = request.args.get('operational_only', 'true').lower() == 'true'
        user_id = request.args.get('user_id', 'default')
        
        if not backend_monitor.service:
            creds = credential_manager.load_credentials(user_id)
            if creds:
                backend_monitor.initialize(creds['token'], creds['crn'])
                backend_monitor.start_monitoring()
            else:
                return jsonify({
                    "error": "No credentials configured"
                }), 400
        
        optimal = backend_monitor.get_optimal_backend(min_qubits, operational_only)
        
        if not optimal:
            return jsonify({
                "status": "success",
                "optimal_backend": None,
                "message": "No backends match criteria"
            }), 200
        
        return jsonify({
            "status": "success",
            "optimal_backend": optimal
        }), 200
        
    except Exception as e:
        logger_service.log_error("get_optimal_backend", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/details/<backend_name>', methods=['GET'])
def get_backend_details(backend_name: str):
    """
    Get detailed information for specific backend including gate errors
    
    Path params:
    - backend_name: Name of the backend
    """
    try:
        user_id = request.args.get('user_id', 'default')
        
        if not backend_monitor.service:
            creds = credential_manager.load_credentials(user_id)
            if creds:
                backend_monitor.initialize(creds['token'], creds['crn'])
                backend_monitor.start_monitoring()
            else:
                return jsonify({
                    "error": "No credentials configured"
                }), 400
        
        backend_info = backend_monitor.get_backend_details(backend_name)
        
        if not backend_info:
            backend_monitor.update_backends_data()
            backend_info = backend_monitor.get_backend_details(backend_name)
        
        if not backend_info:
            return jsonify({
                "error": f"Backend '{backend_name}' not found"
            }), 404
        
        return jsonify({
            "status": "success",
            "backend": backend_info
        }), 200
        
    except Exception as e:
        logger_service.log_error("get_backend_details", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

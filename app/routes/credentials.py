"""
Credentials management endpoints
"""
from flask import Blueprint, request, jsonify
from app.services.credential_manager import credential_manager
from app.services.backend_monitor import backend_monitor
from app.services.logger_service import logger_service


bp = Blueprint('credentials', __name__, url_prefix='/api/v1/credentials')


@bp.route('/save', methods=['POST'])
def save_credentials():
    """
    Save IBM credentials securely (encrypted)
    
    Request body:
    {
        "token": "your_ibm_token",
        "crn": "your_ibm_crn",
        "user_id": "optional_user_id"
    }
    """
    try:
        data = request.json
        
        if not data:
            logger_service.get_logger("api").error("Save credentials called with empty request body")
            return jsonify({"error": "Request body is required"}), 400
        
        token = data.get('token')
        crn = data.get('crn')
        user_id = data.get('user_id', 'default')
        
        logger_service.get_logger("api").info(f"Attempting to save credentials for user_id='{user_id}'")
        
        if not token:
            logger_service.get_logger("api").error("Token is missing from request")
            return jsonify({"error": "token is required"}), 400
        
        if not crn:
            logger_service.get_logger("api").error("CRN is missing from request")
            return jsonify({"error": "crn is required"}), 400
        
        # Save credentials (credential_manager will sanitize and validate)
        credential_manager.save_credentials(token, crn, user_id)
        
        logger_service.get_logger("api").info(f"Credentials saved successfully for user_id='{user_id}', attempting to initialize backend monitor")
        
        # Try to initialize backend monitor with the new credentials
        init_success = backend_monitor.initialize(token, crn)
        
        if init_success:
            backend_monitor.start_monitoring()
            logger_service.get_logger("api").info(f"Backend monitor initialized and started for user_id='{user_id}'")
        else:
            logger_service.get_logger("api").warning(f"Backend monitor initialization failed for user_id='{user_id}' - credentials may be invalid")
        
        return jsonify({
            "status": "success",
            "message": "Credentials saved securely",
            "user_id": user_id,
            "backend_monitor_initialized": init_success
        }), 200
        
    except ValueError as e:
        logger_service.log_error("save_credentials.validation", e)
        return jsonify({
            "error": f"Validation error: {str(e)}",
            "status": "error"
        }), 400
    except Exception as e:
        logger_service.log_error("save_credentials", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/load', methods=['GET'])
def load_credentials():
    """
    Load saved credentials (returns only existence, not values)
    
    Query params:
    - user_id: User identifier (optional, default="default")
    """
    try:
        user_id = request.args.get('user_id', 'default')
        
        creds = credential_manager.load_credentials(user_id)
        
        if creds:
            return jsonify({
                "status": "success",
                "exists": True,
                "user_id": user_id,
                "message": "Credentials are configured"
            }), 200
        else:
            return jsonify({
                "status": "success",
                "exists": False,
                "message": "No credentials found"
            }), 200
        
    except Exception as e:
        logger_service.log_error("load_credentials", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/get', methods=['GET'])
def get_credentials():
    """
    Get user credentials (returns user_id and CRN, but NOT the token)
    
    Query params:
    - user_id: User identifier (optional, default="default")
    """
    try:
        user_id = request.args.get('user_id', 'default')
        
        creds = credential_manager.load_credentials(user_id)
        
        if creds:
            return jsonify({
                "status": "success",
                "user_id": user_id,
                "crn": creds.get('crn', ''),
                "has_token": bool(creds.get('token'))
            }), 200
        else:
            return jsonify({
                "error": "No credentials found",
                "status": "error"
            }), 404
        
    except Exception as e:
        logger_service.log_error("get_credentials", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/delete', methods=['DELETE', 'POST'])
def delete_credentials():
    """
    Delete saved credentials
    
    Request body:
    {
        "user_id": "optional_user_id"
    }
    """
    try:
        data = request.json or {}
        user_id = data.get('user_id', 'default')
        
        logger_service.get_logger("api").info(f"Attempting to delete credentials for user_id='{user_id}'")
        
        success = credential_manager.delete_credentials(user_id)
        
        if success:
            logger_service.get_logger("api").info(f"Credentials deleted successfully for user_id='{user_id}'")
            return jsonify({
                "status": "success",
                "message": f"Credentials deleted for user {user_id}"
            }), 200
        else:
            logger_service.get_logger("api").warning(f"No credentials found to delete for user_id='{user_id}'")
            return jsonify({
                "status": "success",
                "message": f"No credentials found for user {user_id}"
            }), 200
        
    except Exception as e:
        logger_service.log_error("delete_credentials", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/update', methods=['POST', 'PUT'])
def update_credentials():
    """
    Update existing credentials (user_id and CRN only, token is read-only)
    
    Request body:
    {
        "old_user_id": "current_user_id",
        "new_user_id": "new_user_id",  # Optional
        "crn": "new_crn"  # Optional
    }
    """
    try:
        data = request.json or {}
        old_user_id = data.get('old_user_id')
        new_user_id = data.get('new_user_id')
        new_crn = data.get('crn')
        
        if not old_user_id:
            return jsonify({"error": "old_user_id is required"}), 400
        
        logger_service.get_logger("api").info(f"Attempting to update credentials for user_id='{old_user_id}'")
        
        # Load existing credentials
        existing_creds = credential_manager.load_credentials(old_user_id)
        if not existing_creds:
            return jsonify({"error": f"No credentials found for user {old_user_id}"}), 404
        
        # Keep existing token, update CRN if provided
        token = existing_creds.get('token')
        crn = new_crn if new_crn else existing_creds.get('crn')
        user_id = new_user_id if new_user_id else old_user_id
        
        # If user_id changed, delete old entry
        if new_user_id and new_user_id != old_user_id:
            credential_manager.delete_credentials(old_user_id)
            logger_service.get_logger("api").info(f"Renamed user from '{old_user_id}' to '{new_user_id}'")
        
        # Save updated credentials
        credential_manager.save_credentials(token, crn, user_id)
        
        logger_service.get_logger("api").info(f"Credentials updated successfully for user_id='{user_id}'")
        
        return jsonify({
            "status": "success",
            "message": "Credentials updated successfully",
            "user_id": user_id
        }), 200
        
    except ValueError as e:
        logger_service.log_error("update_credentials.validation", e)
        return jsonify({
            "error": f"Validation error: {str(e)}",
            "status": "error"
        }), 400
    except Exception as e:
        logger_service.log_error("update_credentials", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


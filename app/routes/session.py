"""
Session management endpoints
"""
from flask import Blueprint, request, jsonify
from app.utils.session_manager import session_manager


bp = Blueprint('session', __name__, url_prefix='/api/v1/session')


@bp.route('/info', methods=['GET'])
def get_session_info():
    """
    Get information about a calculation session
    
    Query params:
    - session_id: Session identifier
    """
    try:
        session_id = request.args.get('session_id')
        
        if not session_id:
            return jsonify({"error": "session_id query parameter is required"}), 400
        
        info = session_manager.get_session_info(session_id)
        
        if info is None:
            return jsonify({"error": "Session not found"}), 404
        
        return jsonify(info), 200
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/list', methods=['GET'])
def list_sessions():
    """List all active calculation sessions"""
    try:
        sessions = session_manager.list_sessions()
        return jsonify({
            "sessions": sessions,
            "count": len(sessions)
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/delete', methods=['DELETE'])
def delete_session():
    """
    Delete a calculation session
    
    Request body:
    {
        "session_id": "unique_session_id"
    }
    """
    try:
        data = request.json
        
        if not data or 'session_id' not in data:
            return jsonify({"error": "session_id is required in request body"}), 400
        
        session_id = data.get('session_id')
        
        success = session_manager.delete_session(session_id)
        
        if success:
            return jsonify({
                "status": "success",
                "message": f"Session {session_id} deleted"
            }), 200
        else:
            return jsonify({"error": "Session not found"}), 404
            
    except Exception as e:
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

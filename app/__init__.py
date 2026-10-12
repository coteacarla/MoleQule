"""
Quantum Chemistry API Application Package
"""
from flask import Flask
from flask_cors import CORS
from config.settings import Config


def create_app(config_class=Config):
    """Application factory pattern"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    CORS(app)
    
    # Initialize services on startup
    from app.services.credential_manager import credential_manager
    from app.services.backend_monitor import backend_monitor
    from app.services.logger_service import logger_service
    
    logger = logger_service.get_logger("main")
    
    # Detailed logs go to file, minimal to console
    logger.info("=" * 80)
    logger.info("Starting Quantum Chemistry API")
    logger.info("=" * 80)
    
    # Try to load credentials and start monitoring
    try:
        logger.info("Checking for saved IBM credentials...")
        
        # Try to load credentials from all saved users
        all_users = credential_manager._load_all_credentials()
        
        if all_users:
            # Use the first available user's credentials
            user_id = list(all_users.keys())[0]
            creds = all_users[user_id]
            
            logger.info(f"✓ Found saved credentials for user '{user_id}' (token_len={len(creds.get('token', ''))}, crn_len={len(creds.get('crn', ''))})")
            logger.info("  Initializing IBM Quantum backend monitor...")
            
            if backend_monitor.initialize(creds['token'], creds['crn']):
                backend_monitor.start_monitoring()
                logger.info("  ✓ Backend monitoring initialized and started successfully")
                print(f"✓ IBM Quantum backend monitor started (user: {user_id})")
            else:
                logger.error("  ✗ Failed to initialize backend monitor - credentials may be invalid")
                logger.error("  → Please update credentials using: POST /api/v1/credentials/save")
                print("✗ Failed to initialize IBM Quantum backend - check logs/errors.log")
        else:
            logger.warning("✗ No saved credentials found")
            logger.info("  → Backend monitoring will NOT start")
            logger.info("  → To enable IBM Quantum features, save credentials:")
            logger.info("     curl -X POST http://localhost:5000/api/v1/credentials/save \\")
            logger.info("       -H 'Content-Type: application/json' \\")
            logger.info("       -d '{\"token\": \"YOUR_IBM_TOKEN\", \"crn\": \"YOUR_IBM_CRN\", \"user_id\": \"default\"}'")
            print("→ No IBM credentials found - backend monitoring disabled")
    except Exception as e:
        logger.error(f"Error during credential initialization: {e}")
        logger_service.log_error("app_startup", e)
        print(f"✗ Startup error - check logs/errors.log")
    
    # Register blueprints
    from app.routes import molecule, scf, active_space, integrals, circuit, ibm, session
    from app.routes import credentials, backends, jobs, sqd, visualization
    
    app.register_blueprint(molecule.bp)
    app.register_blueprint(scf.bp)
    app.register_blueprint(active_space.bp)
    app.register_blueprint(integrals.bp)
    app.register_blueprint(circuit.bp)
    app.register_blueprint(ibm.bp)
    app.register_blueprint(session.bp)
    app.register_blueprint(credentials.bp)
    app.register_blueprint(backends.bp)
    app.register_blueprint(jobs.bp)
    app.register_blueprint(sqd.bp)
    app.register_blueprint(visualization.bp)
    
    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        from app.services.credential_manager import credential_manager
        from app.services.backend_monitor import backend_monitor
        
        # Get all saved users
        all_users = credential_manager._load_all_credentials()
        saved_users = list(all_users.keys()) if all_users else []
        
        health_data = {
            "status": "healthy",
            "service": "Quantum Chemistry API",
            "credentials": {
                "configured": len(saved_users) > 0,
                "saved_users": saved_users,
                "active_user": saved_users[0] if saved_users else None
            },
            "backend_monitor": {
                "service_initialized": backend_monitor.service is not None,
                "monitoring_active": backend_monitor.running,
                "backends_count": len(backend_monitor.backends_data),
                "last_update": backend_monitor.last_update.isoformat() if backend_monitor.last_update else None
            }
        }
        
        return health_data, 200
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return {"error": "Endpoint not found"}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return {"error": "Internal server error"}, 500
    
    return app

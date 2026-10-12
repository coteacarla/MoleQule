"""
Application configuration settings
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Base configuration class"""
    
    # Flask settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    
    # Server settings
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 5000))
    
    # IBM Quantum credentials
    IBM_CLOUD_TOKEN = os.getenv('IBM_CLOUD_TOKEN', '')
    IBM_CLOUD_CRN = os.getenv('IBM_CLOUD_CRN', '')
    
    # CORS settings
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
    
    # Session settings
    MAX_SESSIONS = int(os.getenv('MAX_SESSIONS', 100))
    
    @staticmethod
    def validate():
        """Validate configuration"""
        warnings = []
        
        if not Config.IBM_CLOUD_TOKEN or not Config.IBM_CLOUD_CRN:
            warnings.append("IBM Cloud credentials not configured. Set IBM_CLOUD_TOKEN and IBM_CLOUD_CRN.")
        
        if Config.SECRET_KEY == 'dev-secret-key-change-in-production':
            warnings.append("Using default SECRET_KEY. Set a secure SECRET_KEY in production.")
        
        return warnings


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False


# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

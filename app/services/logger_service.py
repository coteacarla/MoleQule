"""
Logging service for application
"""
import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler


class LoggerService:
    """Centralized logging service"""
    
    def __init__(self, log_dir: str = "logs"):
        self.log_dir = log_dir
        os.makedirs(log_dir, exist_ok=True)
        
        self.loggers = {}
        self._setup_main_logger()
    
    def _setup_main_logger(self):
        """Setup main application logger"""
        logger = logging.getLogger("quantum_app")
        logger.setLevel(logging.DEBUG)
        
        formatter = logging.Formatter(
            '%(asctime)s.%(msecs)03d - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        console_formatter = logging.Formatter(
            '%(levelname)s: %(message)s'
        )
        
        log_file = os.path.join(self.log_dir, "app.log")
        file_handler = RotatingFileHandler(
            log_file, maxBytes=10*1024*1024, backupCount=5
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.WARNING)
        console_handler.setFormatter(console_formatter)
        
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
        self.loggers["main"] = logger
    
    def get_logger(self, name: str = "main") -> logging.Logger:
        """Get logger by name"""
        if name not in self.loggers:
            if name == "main":
                self._setup_main_logger()
            else:
                logger = logging.getLogger(f"quantum_app.{name}")
                logger.setLevel(logging.DEBUG)
                
                formatter = logging.Formatter(
                    '%(asctime)s.%(msecs)03d - %(name)s - %(levelname)s - %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S'
                )
                
                log_file = os.path.join(self.log_dir, f"{name}.log")
                file_handler = RotatingFileHandler(
                    log_file, maxBytes=10*1024*1024, backupCount=5
                )
                file_handler.setLevel(logging.DEBUG)
                file_handler.setFormatter(formatter)
                
                logger.addHandler(file_handler)
                self.loggers[name] = logger
        
        return self.loggers[name]
    
    def log_api_call(self, endpoint: str, method: str, data: dict, response: dict):
        """Log API call details"""
        logger = self.get_logger("api")
        logger.info(f"{method} {endpoint} - Request: {data} - Response: {response.get('status', 'unknown')}")
    
    def log_quantum_job(self, session_id: str, job_id: str, backend: str, shots: int):
        """Log quantum job submission"""
        logger = self.get_logger("quantum")
        logger.info(f"Job submitted - Session: {session_id}, Job ID: {job_id}, Backend: {backend}, Shots: {shots}")
    
    def log_error(self, context: str, error: Exception):
        """Log error with context"""
        logger = self.get_logger("errors")
        logger.error(f"{context} - {type(error).__name__}: {str(error)}", exc_info=True)


logger_service = LoggerService()

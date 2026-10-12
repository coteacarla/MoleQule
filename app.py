"""
Quantum Chemistry API - Main Application Entry Point
"""
import os
from app import create_app
from config.settings import Config

app = create_app()

if __name__ == '__main__':
    warnings = Config.validate()
    if warnings:
        print("\n⚠ Configuration Warnings:")
        for warning in warnings:
            print(f"  {warning}")
    
    print(f"\n🚀 Server running on http://{Config.HOST}:{Config.PORT}")
    print(f"📊 Health check: http://{Config.HOST}:{Config.PORT}/health")
    print(f"📝 Logs: logs/app.log, logs/api.log, logs/quantum.log")
    print(f"\nReady to accept requests! Press CTRL+C to quit.\n")
    
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG
    )

"""
Backend monitoring service for IBM Quantum computers
"""
import asyncio
from typing import List, Dict, Any, Optional
from qiskit_ibm_runtime import QiskitRuntimeService
from datetime import datetime
import threading


class BackendMonitor:
    """Monitors IBM Quantum backends and provides optimal backend selection"""
    
    def __init__(self):
        self.backends_data = []
        self.last_update = None
        self.update_interval = 300
        self.monitor_thread = None
        self.running = False
        self.service = None
        self._log_info("BackendMonitor initialized")
    
    def _log_info(self, message: str):
        """Log info message"""
        try:
            from app.services.logger_service import logger_service
            logger_service.get_logger("quantum").info(f"[BackendMonitor] {message}")
        except Exception:
            print(f"[BackendMonitor] {message}")
    
    def _log_error(self, message: str, error: Exception):
        """Log error message"""
        try:
            from app.services.logger_service import logger_service
            logger_service.log_error(f"backend_monitor.{message}", error)
        except Exception:
            print(f"[BackendMonitor ERROR] {message}: {error}")
    
    def initialize(self, token: str, crn: str):
        """Initialize service with credentials"""
        self._log_info(f"Attempting to initialize IBM Quantum service (token_len={len(token)}, crn_len={len(crn)})")
        
        try:
            self.service = QiskitRuntimeService(
                channel="ibm_cloud",
                token=token,
                instance=crn
            )
            self._log_info("IBM Quantum service initialized successfully")
            return True
        except Exception as e:
            self._log_error("initialize", e)
            self.service = None
            return False
    
    def start_monitoring(self):
        """Start background monitoring thread"""
        if self.running:
            self._log_info("Monitoring already running")
            return
        
        self._log_info("Starting background monitoring thread")
        self.running = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        self._log_info("Background monitoring thread started")
    
    def stop_monitoring(self):
        """Stop background monitoring"""
        self._log_info("Stopping background monitoring")
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        self._log_info("Background monitoring stopped")
    
    def _monitor_loop(self):
        """Background monitoring loop"""
        while self.running:
            try:
                self._log_info("Starting backend data update cycle")
                self.update_backends_data()
                self._log_info(f"Backend data update cycle completed. Found {len(self.backends_data)} backends")
            except Exception as e:
                self._log_error("_monitor_loop", e)
            
            for _ in range(self.update_interval):
                if not self.running:
                    break
                threading.Event().wait(1)
    
    def update_backends_data(self) -> List[Dict[str, Any]]:
        """Fetch latest backend data"""
        if not self.service:
            self._log_error("update_backends_data", Exception("Service not initialized"))
            return []
        
        self._log_info("Fetching backend data from IBM Quantum")
        backends_list = []
        
        try:
            all_backends = list(self.service.backends())
            self._log_info(f"Retrieved {len(all_backends)} backends from IBM Quantum")
            
            for backend in all_backends:
                try:
                    status = backend.status()
                    config = backend.configuration()
                    props = None
                    
                    try:
                        props = backend.properties()
                    except Exception:
                        pass
                    
                    backend_info = {
                        "name": backend.name,
                        "num_qubits": config.n_qubits if hasattr(config, 'n_qubits') else 0,
                        "operational": status.operational if hasattr(status, 'operational') else True,
                        "pending_jobs": status.pending_jobs if hasattr(status, 'pending_jobs') else 0,
                        "status_msg": status.status_msg if hasattr(status, 'status_msg') else "unknown",
                        "coupling_map": config.coupling_map if hasattr(config, 'coupling_map') else None
                    }
                    
                    if props:
                        qubit_errors = []
                        gate_errors = []
                        
                        for qubit in range(backend_info["num_qubits"]):
                            try:
                                readout_err = props.readout_error(qubit)
                                qubit_errors.append({
                                    "qubit": qubit,
                                    "readout_error": readout_err
                                })
                            except Exception:
                                pass
                        
                        try:
                            for gate_name in config.basis_gates:
                                for qubit_pair in config.coupling_map:
                                    try:
                                        gate_err = props.gate_error(gate_name, qubit_pair)
                                        gate_errors.append({
                                            "gate": gate_name,
                                            "qubits": qubit_pair,
                                            "error": gate_err
                                        })
                                    except Exception:
                                        pass
                        except Exception:
                            pass
                        
                        backend_info["qubit_errors"] = qubit_errors
                        backend_info["gate_errors"] = gate_errors
                        
                        if qubit_errors:
                            backend_info["avg_readout_error"] = sum(q["readout_error"] for q in qubit_errors) / len(qubit_errors)
                        
                        if gate_errors:
                            # Group by gate type and calculate average error per gate type
                            gate_type_errors = {}
                            for g in gate_errors:
                                gate_name = g["gate"]
                                if gate_name not in gate_type_errors:
                                    gate_type_errors[gate_name] = []
                                gate_type_errors[gate_name].append(g["error"])
                            
                            # Calculate average error for each gate type, then average those
                            gate_type_avgs = [sum(errors) / len(errors) for errors in gate_type_errors.values()]
                            backend_info["avg_gate_error"] = sum(gate_type_avgs) / len(gate_type_avgs) if gate_type_avgs else 0
                            backend_info["gate_type_errors"] = {
                                gate: sum(errors) / len(errors) 
                                for gate, errors in gate_type_errors.items()
                            }
                    
                    backends_list.append(backend_info)
                
                except Exception:
                    continue
            
            backends_list.sort(key=lambda x: (
                not x.get("operational", False),
                x.get("pending_jobs", 999999),
                x.get("avg_gate_error", 1.0)
            ))
            
            self.backends_data = backends_list
            self.last_update = datetime.now()
        
        except Exception:
            pass
        
        return self.backends_data
    
    def get_backends_data(self, force_update: bool = False) -> List[Dict[str, Any]]:
        """Get cached backends data or force update"""
        if force_update or not self.backends_data:
            return self.update_backends_data()
        
        return self.backends_data
    
    def get_optimal_backend(self, min_qubits: int = 0, operational_only: bool = True) -> Optional[Dict[str, Any]]:
        """Get optimal backend based on criteria"""
        if not self.backends_data:
            self.update_backends_data()
        
        candidates = self.backends_data
        
        if operational_only:
            candidates = [b for b in candidates if b.get("operational", False)]
        
        if min_qubits > 0:
            candidates = [b for b in candidates if b.get("num_qubits", 0) >= min_qubits]
        
        if not candidates:
            return None
        
        return candidates[0]
    
    def get_backend_details(self, backend_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed info for specific backend"""
        for backend in self.backends_data:
            if backend["name"] == backend_name:
                return backend
        
        return None


backend_monitor = BackendMonitor()

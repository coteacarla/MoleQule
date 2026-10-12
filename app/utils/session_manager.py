"""
Session Manager
Handles calculation session storage and management
"""
from typing import Dict, Any, Optional
from app.services.molecular_calculator import MolecularCalculator
from app.services.quantum_circuit import QuantumCircuitBuilder
import threading


class SessionManager:
    """Thread-safe session manager for calculation workflows"""
    
    def __init__(self):
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
    
    def create_session(
        self,
        session_id: str,
        xyz_data: str,
        basis: str = '6-31g',
        charge: int = 0,
        spin: int = 0
    ) -> MolecularCalculator:
        """
        Create a new calculation session
        
        Args:
            session_id: Unique session identifier
            xyz_data: Molecular geometry in XYZ format
            basis: Basis set
            charge: Molecular charge
            spin: Spin multiplicity
            
        Returns:
            MolecularCalculator instance
        """
        with self._lock:
            calculator = MolecularCalculator(xyz_data, basis, charge, spin)
            self._sessions[session_id] = {
                'calculator': calculator,
                'circuit_builder': None
            }
            return calculator
    
    def get_calculator(self, session_id: str) -> Optional[MolecularCalculator]:
        """Get calculator for session"""
        with self._lock:
            session = self._sessions.get(session_id)
            return session['calculator'] if session else None
    
    def get_circuit_builder(self, session_id: str) -> Optional[QuantumCircuitBuilder]:
        """Get circuit builder for session"""
        with self._lock:
            session = self._sessions.get(session_id)
            return session['circuit_builder'] if session else None
    
    def set_circuit_builder(self, session_id: str, builder: QuantumCircuitBuilder) -> None:
        """Set circuit builder for session"""
        with self._lock:
            if session_id in self._sessions:
                self._sessions[session_id]['circuit_builder'] = builder
    
    def session_exists(self, session_id: str) -> bool:
        """Check if session exists"""
        with self._lock:
            return session_id in self._sessions
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                return True
            return False
    
    def list_sessions(self) -> list:
        """List all active session IDs"""
        with self._lock:
            return list(self._sessions.keys())
    
    def get_session_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed session information"""
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None
            
            calculator = session['calculator']
            circuit_builder = session['circuit_builder']
            
            info = calculator.get_state_summary()
            info['session_id'] = session_id
            info['circuit_built'] = circuit_builder is not None
            
            if circuit_builder:
                info['circuit_num_qubits'] = circuit_builder.num_orbitals * 2
                info['has_transpiled_circuit'] = circuit_builder.isa_circuit is not None
            
            return info


# Global session manager instance
session_manager = SessionManager()

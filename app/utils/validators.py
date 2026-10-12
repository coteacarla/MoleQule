"""
Validation utilities for API requests
"""
from typing import Dict, Any, Optional, Tuple


def validate_xyz_data(xyz_data: str) -> Tuple[bool, Optional[str]]:
    """
    Validate XYZ molecular geometry data
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not xyz_data or not isinstance(xyz_data, str):
        return False, "xyz_data must be a non-empty string"
    
    # Basic validation: should have at least one line
    lines = xyz_data.strip().split('\n')
    if len(lines) == 0:
        return False, "xyz_data appears to be empty"
    
    return True, None


def validate_session_request(data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate session-related request
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not data:
        return False, "Request body is required"
    
    if 'session_id' not in data:
        return False, "session_id is required"
    
    return True, None


def validate_active_space_config(data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate active space configuration
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    mode = data.get('mode')
    
    if mode not in ['range', 'explicit', 'homo_lumo']:
        return False, "mode must be 'range', 'explicit', or 'homo_lumo'"
    
    if mode == 'range':
        if 'act_start' not in data or 'act_stop' not in data:
            return False, "act_start and act_stop required for range mode"
    
    elif mode == 'explicit':
        if 'explicit_orbs' not in data:
            return False, "explicit_orbs required for explicit mode"
        if not isinstance(data['explicit_orbs'], list):
            return False, "explicit_orbs must be a list"
    
    elif mode == 'homo_lumo':
        if 'n_below_homo' not in data or 'n_above_lumo' not in data:
            return False, "n_below_homo and n_above_lumo required for homo_lumo mode"
    
    nelec_mode = data.get('nelec_mode', 'auto')
    if nelec_mode not in ['auto', 'manual']:
        return False, "nelec_mode must be 'auto' or 'manual'"
    
    if nelec_mode == 'manual' and 'manual_nelec' not in data:
        return False, "manual_nelec required when nelec_mode='manual'"
    
    return True, None

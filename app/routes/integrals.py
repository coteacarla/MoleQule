"""
Molecular integrals and CCSD endpoint
"""
from flask import Blueprint, request, jsonify
from app.utils.session_manager import session_manager
from app.utils.validators import validate_session_request
from app.services.storage_service import storage_service
from app.services.logger_service import logger_service
import os
import numpy as np


bp = Blueprint('integrals', __name__, url_prefix='/api/v1/integrals')


@bp.route('/restore', methods=['POST'])
def restore_integrals():
    """
    Restore integrals from storage (CELL3) if available
    
    Request body:
    {
        "session_id": "unique_session_id",
        "molecule_name": "molecule_name",
        "basis": "6-31g"
    }
    """
    try:
        data = request.json
        
        is_valid, error_msg = validate_session_request(data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        session_id = data.get('session_id')
        molecule_name = data.get('molecule_name')
        basis = data.get('basis', '6-31g')
        
        if not molecule_name:
            return jsonify({"error": "molecule_name is required"}), 400
        
        calculator = session_manager.get_calculator(session_id)
        if calculator is None:
            return jsonify({"error": "Session not found."}), 404
        
        # Try to load integrals from storage
        cell_data = storage_service.load_molecule_data(molecule_name, basis, 'CELL3')
        
        print(f"[INTEGRALS RESTORE] Attempting to load: {molecule_name}/{basis}/CELL3")
        print(f"[INTEGRALS RESTORE] Result: {cell_data is not None}")
        
        if cell_data is None:
            print(f"[INTEGRALS RESTORE] NOT FOUND - No saved integrals")
            return jsonify({
                "status": "not_found",
                "message": "No saved integrals found for this molecule"
            }), 404
        
        # Restore integrals to calculator
        calculator.hcore = cell_data.get('hcore')
        calculator.eri = cell_data.get('eri')
        calculator.nuclear_repulsion_energy = cell_data.get('nuclear_repulsion_energy')
        calculator.t1 = cell_data.get('t1')
        calculator.t2 = cell_data.get('t2')
        calculator.ccsd_energy = cell_data.get('ccsd_energy')
        
        # CRITICAL: Also restore active space parameters!
        # Without these, circuit building will use wrong parameters
        if 'num_orbitals' in cell_data:
            calculator.num_orbitals = cell_data.get('num_orbitals')
        if 'n_alpha' in cell_data:
            calculator.n_alpha = cell_data.get('n_alpha')
        if 'n_beta' in cell_data:
            calculator.n_beta = cell_data.get('n_beta')
        if 'active_orbs' in cell_data:
            calculator.active_orbs = cell_data.get('active_orbs')
        
        print(f"[INTEGRALS RESTORE] Loaded for {molecule_name}/{basis}")
        print(f"[INTEGRALS RESTORE] Active space: num_orbitals={calculator.num_orbitals}, n_alpha={calculator.n_alpha}, n_beta={calculator.n_beta}")
        print(f"[INTEGRALS RESTORE] t1 shape: {calculator.t1.shape if calculator.t1 is not None else None}")
        print(f"[INTEGRALS RESTORE] t2 shape: {calculator.t2.shape if calculator.t2 is not None else None}")
        
        return jsonify({
            "status": "success",
            "ccsd_energy": calculator.ccsd_energy,
            "nuclear_repulsion": float(calculator.nuclear_repulsion_energy) if calculator.nuclear_repulsion_energy is not None else None,
            "t1_shape": list(calculator.t1.shape) if calculator.t1 is not None else None,
            "t2_shape": list(calculator.t2.shape) if calculator.t2 is not None else None,
            "num_orbitals": calculator.num_orbitals,
            "n_alpha": calculator.n_alpha,
            "n_beta": calculator.n_beta,
            "restored_from_storage": True
        }), 200
            
    except Exception as e:
        logger_service.log_error("restore_integrals", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/compute', methods=['POST'])
def compute_integrals():
    """
    Compute molecular integrals and CCSD amplitudes
    
    Request body:
    {
        "session_id": "unique_session_id",
        "molecule_name": "optional_molecule_name",
        "max_iter": 200  // Optional: Maximum CCSD iterations (default: 200)
    }
    """
    try:
        data = request.json
        
        is_valid, error_msg = validate_session_request(data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        session_id = data.get('session_id')
        max_iter = data.get('max_iter', 200)
        
        calculator = session_manager.get_calculator(session_id)
        
        # If session not in memory, try to reconstruct from storage
        if calculator is None:
            logger_service.get_logger("api").info(f"Session {session_id} not in memory, attempting to reconstruct from storage")
            
            # Try to find the molecule directory
            molecule_name = data.get('molecule_name', session_id)
            molecules_path = storage_service.molecules_path
            
            # Look for directory matching session_id
            import os
            found_dir = None
            for dir_name in os.listdir(molecules_path):
                if session_id in dir_name:
                    found_dir = dir_name
                    break
            
            if not found_dir:
                return jsonify({"error": f"Session {session_id} not found in memory or storage."}), 404
            
            # Extract basis
            parts = found_dir.rsplit('_', 1)
            if len(parts) == 2:
                basis = parts[1]
            else:
                basis = '6-31g'
            
            # Load required data
            cell2_path = os.path.join(molecules_path, found_dir, 'CELL2')
            
            # Load XYZ data
            xyz_file = os.path.join(cell2_path, 'xyz_data.json')
            if not os.path.exists(xyz_file):
                return jsonify({"error": "XYZ data not found in storage"}), 404
            
            import json
            with open(xyz_file, 'r') as f:
                xyz_data = json.load(f)
            
            # Load charge and spin
            charge = 0
            spin = 0
            charge_file = os.path.join(cell2_path, 'charge.json')
            spin_file = os.path.join(cell2_path, 'spin.json')
            
            if os.path.exists(charge_file):
                with open(charge_file, 'r') as f:
                    charge = json.load(f)
            
            if os.path.exists(spin_file):
                with open(spin_file, 'r') as f:
                    spin = json.load(f)
            
            # Create temporary session
            temp_session_id = f"temp_integrals_{session_id}"
            calculator = session_manager.create_session(temp_session_id, xyz_data, basis, charge, spin)
            
            # Load and restore SCF data
            scf_data = storage_service.load_molecule_data(molecule_name, basis, 'CELL2_scf')
            if not scf_data:
                session_manager.delete_session(temp_session_id)
                return jsonify({"error": "SCF data not found in storage"}), 404
            
            calculator.mf = scf_data.get('mf')
            calculator.mol = scf_data.get('mol')
            
            # Load and restore active space data
            active_space_data = storage_service.load_molecule_data(molecule_name, basis, 'CELL2_active_space')
            if not active_space_data:
                session_manager.delete_session(temp_session_id)
                return jsonify({"error": "Active space data not found in storage"}), 404
            
            # Get active orbitals - handle both new and old storage formats
            active_orbs = active_space_data.get('active_orbs')
            if active_orbs is None:
                # Try to reconstruct from config if active_orbs was saved as null
                config_data = active_space_data.get('config', {})
                mode = config_data.get('mode', 'range')
                if mode == 'range':
                    act_start = config_data.get('act_start', 0)
                    act_stop = config_data.get('act_stop')
                    if act_stop is not None:
                        active_orbs = list(range(act_start, act_stop))
                        logger_service.get_logger("api").info(f"Reconstructed active_orbs from config: {active_orbs}")
            
            if not active_orbs:
                session_manager.delete_session(temp_session_id)
                return jsonify({"error": "Could not determine active orbitals from storage"}), 404
            
            calculator.active_orbs = active_orbs
            calculator.num_orbitals = active_space_data.get('num_orbitals')
            calculator.n_alpha = active_space_data.get('n_alpha')
            calculator.n_beta = active_space_data.get('n_beta')
            
            logger_service.get_logger("api").info(f"Reconstructed calculator for {session_id} from storage")
            
            # Compute integrals
            result = calculator.compute_integrals_and_ccsd(max_iter=max_iter)
            
            # Clean up temp session
            session_manager.delete_session(temp_session_id)
            
        else:
            # Normal path - session exists in memory
            result = calculator.compute_integrals_and_ccsd(max_iter=max_iter)
            molecule_name = data.get('molecule_name', session_id)
        
        if result['status'] == 'success':
            if not molecule_name:
                molecule_name = session_id
            basis = calculator.basis
            
            # Save all integrals data including active space info for easy SQD access
            cell_data = {
                'hcore': calculator.hcore,
                'eri': calculator.eri,
                'nuclear_repulsion_energy': calculator.nuclear_repulsion_energy,
                't1': calculator.t1,
                't2': calculator.t2,
                'ccsd_energy': result.get('ccsd_energy'),
                'max_iter': max_iter,
                # Add active space parameters for SQD
                'num_orbitals': calculator.num_orbitals,
                'n_alpha': calculator.n_alpha,
                'n_beta': calculator.n_beta,
                'active_orbs': calculator.active_orbs
            }
            
            storage_service.save_molecule_data(molecule_name, basis, 'CELL3', cell_data)
            logger_service.get_logger("api").info(f"Integrals computed and saved (with active space info) for {molecule_name}")
            
            return jsonify(result), 200
        else:
            # Log the error details for debugging
            error_msg = result.get('message', 'Unknown error')
            print(f"[INTEGRALS ERROR] {error_msg}")
            if 'traceback' in result:
                print(f"[INTEGRALS TRACEBACK] {result['traceback']}")
            logger_service.log_error("compute_integrals", Exception(error_msg))
            return jsonify(result), 400
            
    except Exception as e:
        logger_service.log_error("compute_integrals", e)
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/backfill', methods=['POST'])
def backfill_integrals():
    """
    Backfill integrals computation for all sessions in history that have 
    SCF and active space data but are missing CELL3 integrals.
    
    This will iterate through all molecule directories in storage and compute
    integrals for those that don't already have them.
    
    Request body:
    {
        "max_iter": 200,  // Optional: Maximum CCSD iterations (default: 200)
        "dry_run": false  // Optional: If true, just list what would be computed without actually computing
    }
    
    Returns:
    {
        "status": "success",
        "processed": [...],  // List of molecules that were processed
        "skipped": [...],    // List of molecules that were skipped (already have CELL3 or missing prerequisites)
        "errors": [...]      // List of molecules that failed to process
    }
    """
    try:
        data = request.json or {}
        max_iter = data.get('max_iter', 200)
        dry_run = data.get('dry_run', False)
        
        molecules_path = storage_service.molecules_path
        
        processed = []
        skipped = []
        errors = []
        
        # Iterate through all molecule directories
        for dir_name in os.listdir(molecules_path):
            dir_path = os.path.join(molecules_path, dir_name)
            if not os.path.isdir(dir_path):
                continue
            
            cell2_path = os.path.join(dir_path, 'CELL2')
            if not os.path.isdir(cell2_path):
                skipped.append({"molecule": dir_name, "reason": "No CELL2 directory"})
                continue
            
            # Check if CELL3 already exists
            cell3_path = os.path.join(cell2_path, 'CELL3')
            if os.path.isdir(cell3_path):
                skipped.append({"molecule": dir_name, "reason": "CELL3 already exists"})
                continue
            
            # Check if prerequisites exist (SCF and active space)
            scf_path = os.path.join(cell2_path, 'CELL2_scf')
            active_space_path = os.path.join(cell2_path, 'CELL2_active_space')
            
            if not os.path.isdir(scf_path):
                skipped.append({"molecule": dir_name, "reason": "Missing CELL2_scf"})
                continue
            
            if not os.path.isdir(active_space_path):
                skipped.append({"molecule": dir_name, "reason": "Missing CELL2_active_space"})
                continue
            
            # Parse molecule name and basis from directory name
            parts = dir_name.rsplit('_', 1)
            if len(parts) == 2:
                molecule_name = parts[0]
                basis = parts[1]
            else:
                molecule_name = dir_name
                basis = '6-31g'
            
            if dry_run:
                processed.append({
                    "molecule": dir_name,
                    "molecule_name": molecule_name,
                    "basis": basis,
                    "action": "would_compute"
                })
                continue
            
            # Try to compute integrals for this molecule
            try:
                # Load SCF data
                scf_data = storage_service.load_molecule_data(molecule_name, basis, 'CELL2_scf')
                if not scf_data:
                    skipped.append({"molecule": dir_name, "reason": "Could not load SCF data"})
                    continue
                
                # Load active space data
                active_space_data = storage_service.load_molecule_data(molecule_name, basis, 'CELL2_active_space')
                if not active_space_data:
                    skipped.append({"molecule": dir_name, "reason": "Could not load active space data"})
                    continue
                
                # We need the original XYZ data to reconstruct the molecule
                # Try to load from xyz_data.json in CELL2
                xyz_file = os.path.join(cell2_path, 'xyz_data.json')
                if not os.path.exists(xyz_file):
                    # Try alternative location
                    xyz_file = os.path.join(dir_path, 'structure.xyz')
                    if not os.path.exists(xyz_file):
                        skipped.append({"molecule": dir_name, "reason": "Missing xyz_data.json or structure.xyz file"})
                        continue
                
                import json
                # Load XYZ data
                if xyz_file.endswith('.json'):
                    with open(xyz_file, 'r') as f:
                        xyz_data = json.load(f)
                else:
                    with open(xyz_file, 'r') as f:
                        xyz_data = f.read()
                
                # Load charge and spin
                charge_file = os.path.join(cell2_path, 'charge.json')
                spin_file = os.path.join(cell2_path, 'spin.json')
                
                charge = 0
                spin = 0
                
                if os.path.exists(charge_file):
                    with open(charge_file, 'r') as f:
                        charge = json.load(f)
                
                if os.path.exists(spin_file):
                    with open(spin_file, 'r') as f:
                        spin = json.load(f)
                
                # Create temporary calculator
                temp_session_id = f"backfill_{molecule_name}"
                calculator = session_manager.create_session(
                    temp_session_id,
                    xyz_data,
                    basis,
                    charge,
                    spin
                )
                
                # Restore SCF state
                calculator.mf = scf_data.get('mf')
                calculator.mol = scf_data.get('mol')
                
                # Restore active space state
                calculator.active_orbs = active_space_data.get('active_orbs')
                calculator.num_orbitals = active_space_data.get('num_orbitals')
                calculator.n_alpha = active_space_data.get('n_alpha')
                calculator.n_beta = active_space_data.get('n_beta')
                
                # Compute integrals
                result = calculator.compute_integrals_and_ccsd(max_iter=max_iter)
                
                if result['status'] == 'success':
                    # Save to CELL3
                    cell_data = {
                        'hcore': calculator.hcore,
                        'eri': calculator.eri,
                        'nuclear_repulsion_energy': calculator.nuclear_repulsion_energy,
                        't1': calculator.t1,
                        't2': calculator.t2,
                        'ccsd_energy': result.get('ccsd_energy'),
                        'max_iter': max_iter
                    }
                    
                    storage_service.save_molecule_data(molecule_name, basis, 'CELL3', cell_data)
                    
                    processed.append({
                        "molecule": dir_name,
                        "molecule_name": molecule_name,
                        "basis": basis,
                        "ccsd_energy": result.get('ccsd_energy'),
                        "status": "success"
                    })
                    
                    logger_service.get_logger("api").info(f"Backfilled integrals for {molecule_name}")
                else:
                    errors.append({
                        "molecule": dir_name,
                        "error": result.get('message', 'Unknown error')
                    })
                
                # Clean up temporary session
                session_manager.delete_session(temp_session_id)
                
            except Exception as e:
                errors.append({
                    "molecule": dir_name,
                    "error": str(e)
                })
                logger_service.get_logger("api").error(f"Error backfilling {dir_name}: {str(e)}")
        
        return jsonify({
            "status": "success",
            "summary": {
                "total_checked": len(processed) + len(skipped) + len(errors),
                "processed": len(processed),
                "skipped": len(skipped),
                "errors": len(errors)
            },
            "processed": processed,
            "skipped": skipped,
            "errors": errors,
            "dry_run": dry_run
        }), 200
        
    except Exception as e:
        logger_service.log_error("backfill_integrals", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

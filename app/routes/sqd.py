"""
SQD (Selected Quantum Diagonalization) endpoints
"""
from flask import Blueprint, request, jsonify
from app.services.storage_service import storage_service
from app.services.logger_service import logger_service
import numpy as np
import io
import base64
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt


bp = Blueprint('sqd', __name__, url_prefix='/api/v1/sqd')


@bp.route('/configure', methods=['POST'])
def configure_sqd():
    """
    Configure SQD parameters
    
    Request body:
    {
        "session_id": "unique_session_id",
        "energy_tol": 1e-3,
        "occupancies_tol": 1e-3,
        "max_iterations": 5,
        "num_batches": 3,
        "samples_per_batch": 300,
        "symmetrize_spin": true,
        "carryover_threshold": 1e-4,
        "max_cycle": 200,
        "exact_energy": -1.137
    }
    """
    try:
        data = request.json
        
        session_id = data.get('session_id')
        if not session_id:
            return jsonify({"error": "session_id required"}), 400
        
        sqd_config = {
            'energy_tol': data.get('energy_tol', 1e-3),
            'occupancies_tol': data.get('occupancies_tol', 1e-3),
            'max_iterations': data.get('max_iterations', 5),
            'num_batches': data.get('num_batches', 3),
            'samples_per_batch': data.get('samples_per_batch', 300),
            'symmetrize_spin': data.get('symmetrize_spin', True),
            'carryover_threshold': data.get('carryover_threshold', 1e-4),
            'max_cycle': data.get('max_cycle', 200),
            'exact_energy': data.get('exact_energy', 0.0)
        }
        
        molecule_name = data.get('molecule_name', session_id)
        
        from app.utils.session_manager import session_manager
        calculator = session_manager.get_calculator(session_id)
        basis = data.get('basis')
        if not basis and calculator:
            basis = calculator.basis
        if not basis:
            basis = 'sto-3g'
        
        storage_service.save_molecule_data(molecule_name, basis, 'CELL10_sqd_config', sqd_config)
        logger_service.get_logger("api").info(f"SQD config saved for {session_id}")
        
        return jsonify({
            "status": "success",
            "sqd_config": sqd_config
        }), 200
        
    except Exception as e:
        logger_service.log_error("configure_sqd", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/load-config', methods=['GET'])
def load_sqd_config():
    """
    Load SQD configuration
    
    Query params:
    - session_id or molecule_name: Identifier
    - basis: Basis set
    """
    try:
        session_id = request.args.get('session_id')
        molecule_name = request.args.get('molecule_name', session_id)
        
        from app.utils.session_manager import session_manager
        calculator = session_manager.get_calculator(session_id) if session_id else None
        basis = request.args.get('basis')
        if not basis and calculator:
            basis = calculator.basis
        if not basis:
            basis = 'sto-3g'
        
        if not molecule_name:
            return jsonify({"error": "session_id or molecule_name required"}), 400
        
        config = storage_service.load_molecule_data(molecule_name, basis, 'CELL10_sqd_config')
        
        if not config:
            return jsonify({
                "status": "success",
                "exists": False,
                "message": "No SQD config found"
            }), 200
        
        return jsonify({
            "status": "success",
            "exists": True,
            "sqd_config": config
        }), 200
        
    except Exception as e:
        logger_service.log_error("load_sqd_config", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/save-results', methods=['POST'])
def save_sqd_results():
    """
    Save SQD calculation results
    
    Request body:
    {
        "session_id": "unique_session_id",
        "results": {...},
        "plots": {...}
    }
    """
    try:
        data = request.json
        
        session_id = data.get('session_id')
        if not session_id:
            return jsonify({"error": "session_id required"}), 400
        
        molecule_name = data.get('molecule_name', session_id)
        basis = data.get('basis', '6-31g')
        
        results_data = data.get('results', {})
        
        storage_service.save_molecule_data(molecule_name, basis, 'CELL10_results', results_data)
        
        plots = data.get('plots')
        if plots:
            storage_service.save_molecule_data(molecule_name, basis, 'CELL11_plots', plots)
        
        logger_service.get_logger("api").info(f"SQD results saved for {session_id}")
        
        return jsonify({
            "status": "success",
            "message": "Results saved"
        }), 200
        
    except Exception as e:
        logger_service.log_error("save_sqd_results", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/process', methods=['POST'])
def process_sqd():
    """
    Process SQD results from job and generate plots
    
    Request body:
    {
        "job_id": "ibm_job_id",
        "session_id": "unique_session_id",
        "counts": {...},  # measurement counts from job
        "exact_energy": -100.0,  # optional, for comparison
        "sqd_options": {
            "energy_tol": 1e-3,
            "occupancies_tol": 1e-3,
            "max_iterations": 5
        },
        "eigenstate_options": {
            "num_batches": 3,
            "samples_per_batch": 300,
            "symmetrize_spin": true,
            "carryover_threshold": 1e-4,
            "max_cycle": 200,
            "spin_sq": 0.0
        }
    }
    """
    try:
        data = request.json
        
        logger_service.get_logger("api").info(f"SQD process request received: job_id={data.get('job_id')}, session_id={data.get('session_id')}, counts_keys={len(data.get('counts', {}))}")
        job_id = data.get('job_id')
        session_id = data.get('session_id')
        counts = data.get('counts')
        
        if not all([job_id, session_id, counts]):
            logger_service.get_logger("api").error(f"SQD validation failed: job_id={bool(job_id)}, session_id={bool(session_id)}, counts={bool(counts)}")
            return jsonify({"error": "job_id, session_id, and counts required"}), 400
        
        from app.utils.session_manager import session_manager
        calculator = session_manager.get_calculator(session_id)
        
        hcore = None
        eri = None
        nuclear_repulsion_energy = None
        num_orbitals = None
        nelec = None
        basis = None
        molecule_name = None
        
        if calculator and hasattr(calculator, 'hcore') and calculator.hcore is not None:
            hcore = calculator.hcore
            eri = calculator.eri
            nuclear_repulsion_energy = calculator.nuclear_repulsion_energy
            num_orbitals = calculator.num_orbitals
            nelec = (calculator.n_alpha, calculator.n_beta)
            basis = calculator.basis
            molecule_name = getattr(calculator, 'molecule_name', session_id)
        else:
            job_data = storage_service.load_job_id(session_id)
            if job_data:
                job_session_id = job_data.get('session_id', session_id)
                
                calc = session_manager.get_calculator(job_session_id)
                if calc and hasattr(calc, 'hcore') and calc.hcore is not None:
                    hcore = calc.hcore
                    eri = calc.eri
                    nuclear_repulsion_energy = calc.nuclear_repulsion_energy
                    num_orbitals = calc.num_orbitals
                    nelec = (calc.n_alpha, calc.n_beta)
                    basis = calc.basis
                    molecule_name = getattr(calc, 'molecule_name', job_session_id)
            
            if hcore is None:
                import os
                molecules_path = storage_service.molecules_path
                
                for dir_name in os.listdir(molecules_path):
                    dir_path = os.path.join(molecules_path, dir_name)
                    if not os.path.isdir(dir_path):
                        continue
                    
                    cell2_path = os.path.join(dir_path, 'CELL2')
                    if os.path.isdir(cell2_path):
                        integrals_path = os.path.join(cell2_path, 'CELL3')
                        if os.path.isdir(integrals_path):
                            if session_id in dir_name or (job_session_id if 'job_session_id' in locals() else None) in dir_name if 'job_session_id' in locals() else False:
                                try:
                                    parts = dir_name.rsplit('_', 1)
                                    if len(parts) == 2:
                                        mol_name = parts[0]
                                        mol_basis = parts[1]
                                    else:
                                        mol_name = dir_name
                                        mol_basis = '6-31g'
                                    
                                    integrals_data = storage_service.load_molecule_data(
                                        mol_name,
                                        mol_basis,
                                        'CELL3'
                                    )
                                    
                                    if integrals_data:
                                        hcore = np.array(integrals_data['hcore'])
                                        eri = np.array(integrals_data['eri'])
                                        nuclear_repulsion_energy = float(integrals_data.get('nuclear_repulsion_energy', 0.0))
                                        num_orbitals = hcore.shape[0]
                                        
                                        active_space_data = storage_service.load_molecule_data(mol_name, mol_basis, 'CELL2_active_space')
                                        if active_space_data:
                                            nelec = (active_space_data.get('n_alpha', 1), active_space_data.get('n_beta', 1))
                                        else:
                                            nelec = (1, 1)
                                        
                                        basis = mol_basis
                                        molecule_name = mol_name
                                        logger_service.get_logger("api").info(f"Loaded integrals from CELL3: {dir_name}")
                                        break
                                except Exception as e:
                                    logger_service.get_logger("api").warning(f"Error loading integrals from {dir_name}: {e}")
                                    continue
        
        if hcore is None or eri is None:
            error_msg = "Integrals not found. "
            
            logger_service.get_logger("api").error(f"SQD integrals missing: hcore={hcore is not None}, eri={eri is not None}, session_id={session_id}")
            
            import os
            session_dir = None
            molecules_path = storage_service.molecules_path
            for dir_name in os.listdir(molecules_path):
                if session_id in dir_name:
                    session_dir = dir_name
                    break
            
            if session_dir:
                logger_service.get_logger("api").info(f"Found session directory: {session_dir}")
                cell3_path = os.path.join(molecules_path, session_dir, 'CELL2', 'CELL3')
                if os.path.isdir(cell3_path):
                    error_msg += f"CELL3 directory found but could not load data. "
                    logger_service.get_logger("api").error(f"CELL3 exists at {cell3_path} but data load failed")
                else:
                    error_msg += "Please run the integrals computation step (CELL3) in the molecular calculation workflow first. "
                    error_msg += "This computes the molecular integrals (hcore and eri) needed for SQD post-processing. "
                    logger_service.get_logger("api").error(f"CELL3 directory not found at {cell3_path}")
            else:
                error_msg += "Session data not found in storage. Please ensure you have completed the full molecular calculation workflow including: "
                error_msg += "1) SCF calculation, 2) Active space setup, 3) Integrals & CCSD computation (CELL3). "
                logger_service.get_logger("api").error(f"No session directory found for session_id={session_id}")
            
            print(f"[SQD ERROR] {error_msg}")
            return jsonify({"error": error_msg}), 400
        
        logger_service.get_logger("api").info(f"Found integrals: num_orbitals={num_orbitals}, nelec={nelec}")
        
        exact_energy = data.get('exact_energy')
        
        sqd_opts = data.get('sqd_options', {})
        energy_tol = sqd_opts.get('energy_tol', 1e-3)
        occupancies_tol = sqd_opts.get('occupancies_tol', 1e-3)
        max_iterations = sqd_opts.get('max_iterations', 5)
        
        eigen_opts = data.get('eigenstate_options', {})
        num_batches = eigen_opts.get('num_batches', 3)
        samples_per_batch = eigen_opts.get('samples_per_batch', 300)
        symmetrize_spin = eigen_opts.get('symmetrize_spin', True)
        carryover_threshold = eigen_opts.get('carryover_threshold', 1e-4)
        max_cycle = eigen_opts.get('max_cycle', 200)
        spin_sq = eigen_opts.get('spin_sq', 0.0)
        
        logger_service.get_logger("api").info(f"Starting SQD processing for job {job_id}")
        
        try:
            from functools import partial
            from qiskit_addon_sqd.fermion import (
                SCIResult,
                diagonalize_fermionic_hamiltonian,
                solve_sci_batch,
            )
            from qiskit.primitives import BitArray
        except ImportError as e:
            error_msg = f"Missing required package: {str(e)}. Install qiskit-addon-sqd with: pip install qiskit-addon-sqd==0.8.0"
            logger_service.get_logger("api").error(f"SQD Import Error: {error_msg}")
            print(f"[SQD ERROR] {error_msg}")
            return jsonify({
                "error": error_msg,
                "status": "error"
            }), 500
        
        sci_solver = partial(solve_sci_batch, spin_sq=spin_sq, max_cycle=max_cycle)
        
        result_history = []
        
        def callback(results):
            result_history.append(results)
            
        bitstrings = []
        for bitstring, count in counts.items():
            bitstrings.extend([bitstring] * count)
        
        if not bitstrings:
            return jsonify({"error": "No measurement results found in counts"}), 400
        
        num_bits = len(bitstrings[0])
        logger_service.get_logger("api").info(f"Converting {len(bitstrings)} bitstrings to BitArray, each with {num_bits} bits")
        
        try:
            binary_array = np.array([[int(b) for b in bs] for bs in bitstrings], dtype=np.uint8)
            
            num_bytes = (num_bits + 7) // 8
            packed_array = np.packbits(binary_array, axis=1, bitorder='little')[:, :num_bytes]
            bit_array = BitArray(packed_array, num_bits)
            
            logger_service.get_logger("api").info(f"Created BitArray successfully with shape {packed_array.shape}")
        except Exception as e:
            logger_service.get_logger("api").error(f"Failed to create BitArray: {str(e)}")
            return jsonify({"error": f"Failed to create BitArray: {str(e)}"}), 500
        
        logger_service.get_logger("api").info(f"Starting diagonalization with norb={num_orbitals}, nelec={nelec}, num_batches={num_batches}")
        
        try:
            result = diagonalize_fermionic_hamiltonian(
                hcore,
                eri,
                bit_array,
                samples_per_batch=samples_per_batch,
                norb=num_orbitals,
                nelec=nelec,
                num_batches=num_batches,
                energy_tol=energy_tol,
                occupancies_tol=occupancies_tol,
                max_iterations=max_iterations,
                sci_solver=sci_solver,
                symmetrize_spin=symmetrize_spin,
                carryover_threshold=carryover_threshold,
                callback=callback,
                seed=12345,
            )
            
            logger_service.get_logger("api").info(f"SQD processing completed with {len(result_history)} iterations")
        except Exception as e:
            logger_service.get_logger("api").error(f"SQD diagonalization failed: {str(e)}")
            import traceback
            logger_service.get_logger("api").error(f"Traceback: {traceback.format_exc()}")
            return jsonify({"error": f"SQD diagonalization failed: {str(e)}"}), 500
        
        plots = {}
        
        if exact_energy is not None and len(result_history) > 0:
            x1 = list(range(len(result_history)))
            min_e = [
                min(res_list, key=lambda res: res.energy).energy + nuclear_repulsion_energy
                for res_list in result_history
            ]
            e_diff = [abs(e - exact_energy) for e in min_e]
            
            fig1, ax1 = plt.subplots(figsize=(8, 6))
            ax1.plot(x1, e_diff, label="energy error", marker="o", linewidth=2)
            ax1.set_xticks(x1)
            ax1.set_xticklabels(x1)
            ax1.set_yscale("log")
            ax1.set_ylim(1e-4, max(e_diff) * 2)
            ax1.axhline(y=0.001, color="#BF5700", linestyle="--", label="chemical accuracy", linewidth=2)
            ax1.set_title("Energy Error vs SQD Iterations", fontsize=14, fontweight='bold')
            ax1.set_xlabel("Iteration Index", fontsize=12)
            ax1.set_ylabel("Energy Error (Ha)", fontsize=12)
            ax1.legend()
            ax1.grid(True, alpha=0.3)
            
            buf1 = io.BytesIO()
            plt.savefig(buf1, format='png', dpi=100, bbox_inches='tight')
            buf1.seek(0)
            plots['energy_error'] = base64.b64encode(buf1.read()).decode('utf-8')
            plt.close(fig1)
        
        # Plot 2: Orbital occupancy
        y2 = np.sum(result.orbital_occupancies, axis=0)
        x2 = list(range(len(y2)))
        
        fig2, ax2 = plt.subplots(figsize=(8, 6))
        ax2.bar(x2, y2, width=0.8, color='#1f77b4', alpha=0.7, edgecolor='black')
        ax2.set_xticks(x2)
        ax2.set_xticklabels(x2)
        ax2.set_title("Avg Occupancy per Spatial Orbital", fontsize=14, fontweight='bold')
        ax2.set_xlabel("Orbital Index", fontsize=12)
        ax2.set_ylabel("Avg Occupancy", fontsize=12)
        ax2.grid(True, axis='y', alpha=0.3)
        
        buf2 = io.BytesIO()
        plt.savefig(buf2, format='png', dpi=100, bbox_inches='tight')
        buf2.seek(0)
        plots['orbital_occupancy'] = base64.b64encode(buf2.read()).decode('utf-8')
        plt.close(fig2)
        
        # Combined plot
        fig, axs = plt.subplots(1, 2, figsize=(14, 6))
        
        # Plot energies (left)
        if exact_energy is not None and len(result_history) > 0:
            axs[0].plot(x1, e_diff, label="energy error", marker="o", linewidth=2, markersize=8)
            axs[0].set_xticks(x1)
            axs[0].set_xticklabels(x1)
            axs[0].set_yscale("log")
            axs[0].set_ylim(1e-4, max(e_diff) * 2)
            axs[0].axhline(y=0.001, color="#BF5700", linestyle="--", label="chemical accuracy", linewidth=2)
            axs[0].set_title("Energy Error vs SQD Iterations", fontsize=14, fontweight='bold')
            axs[0].set_xlabel("Iteration Index", fontsize=12)
            axs[0].set_ylabel("Energy Error (Ha)", fontsize=12)
            axs[0].legend()
            axs[0].grid(True, alpha=0.3)
        else:
            axs[0].text(0.5, 0.5, 'Exact energy not provided', 
                       ha='center', va='center', fontsize=12, transform=axs[0].transAxes)
            axs[0].set_title("Energy Error vs SQD Iterations", fontsize=14, fontweight='bold')
        
        # Plot orbital occupancy (right)
        axs[1].bar(x2, y2, width=0.8, color='#1f77b4', alpha=0.7, edgecolor='black')
        axs[1].set_xticks(x2)
        axs[1].set_xticklabels(x2)
        axs[1].set_title("Avg Occupancy per Spatial Orbital", fontsize=14, fontweight='bold')
        axs[1].set_xlabel("Orbital Index", fontsize=12)
        axs[1].set_ylabel("Avg Occupancy", fontsize=12)
        axs[1].grid(True, axis='y', alpha=0.3)
        
        plt.tight_layout()
        buf_combined = io.BytesIO()
        plt.savefig(buf_combined, format='png', dpi=100, bbox_inches='tight')
        buf_combined.seek(0)
        plots['combined'] = base64.b64encode(buf_combined.read()).decode('utf-8')
        plt.close(fig)
        
        # Prepare response data
        final_energy = result.energy + nuclear_repulsion_energy
        
        # Handle orbital_occupancies - it's a tuple of (alpha_occupancies, beta_occupancies)
        if isinstance(result.orbital_occupancies, tuple):
            orbital_occupancies = [occ.tolist() if hasattr(occ, 'tolist') else list(occ) for occ in result.orbital_occupancies]
        else:
            orbital_occupancies = result.orbital_occupancies.tolist() if hasattr(result.orbital_occupancies, 'tolist') else list(result.orbital_occupancies)
        
        response_data = {
            "status": "success",
            "job_id": job_id,
            "session_id": session_id,
            "results": {
                "final_energy": float(final_energy),
                "nuclear_repulsion_energy": float(nuclear_repulsion_energy),
                "electronic_energy": float(result.energy),
                "num_iterations": len(result_history),
                "orbital_occupancies": orbital_occupancies,
                "converged": len(result_history) < max_iterations,
            },
            "plots": plots,
            "parameters_used": {
                "sqd_options": {
                    "energy_tol": energy_tol,
                    "occupancies_tol": occupancies_tol,
                    "max_iterations": max_iterations
                },
                "eigenstate_options": {
                    "num_batches": num_batches,
                    "samples_per_batch": samples_per_batch,
                    "symmetrize_spin": symmetrize_spin,
                    "carryover_threshold": carryover_threshold,
                    "max_cycle": max_cycle,
                    "spin_sq": spin_sq
                }
            }
        }
        
        if exact_energy is not None:
            response_data["results"]["exact_energy"] = float(exact_energy)
            response_data["results"]["energy_error"] = float(abs(final_energy - exact_energy))
        
        # Save results to storage
        save_molecule_name = molecule_name if molecule_name else data.get('molecule_name', session_id)
        save_basis = basis if basis else '6-31g'
        storage_service.save_molecule_data(save_molecule_name, save_basis, 'CELL10_sqd_results', response_data)
        
        logger_service.get_logger("api").info(f"SQD processing successful for job {job_id}")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[SQD ERROR] {str(e)}")
        print(f"[SQD TRACEBACK]\n{error_trace}")
        logger_service.log_error("process_sqd", e)
        return jsonify({
            "error": str(e),
            "traceback": error_trace,
            "status": "error"
        }), 500

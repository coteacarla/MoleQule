"""
Job management endpoints
"""
from flask import Blueprint, request, jsonify
from app.services.storage_service import storage_service
from app.services.logger_service import logger_service
from app.services.credential_manager import credential_manager
from qiskit_ibm_runtime import QiskitRuntimeService
from datetime import datetime
import os
import json
from qiskit.visualization import plot_histogram, plot_bloch_multivector, plot_state_qsphere
import base64
from io import BytesIO
from functools import lru_cache
import hashlib


bp = Blueprint('jobs', __name__, url_prefix='/api/v1/jobs')

_visualization_cache = {}


@bp.route('/submit', methods=['POST'])
def submit_job():
    """
    Submit job to IBM Quantum hardware
    
    Request body:
    {
        "session_id": "unique_session_id",
        "backend_name": "ibm_fez",
        "shots": 1000,
        "user_id": "user_identifier"
    }
    """
    try:
        data = request.json
        
        session_id = data.get('session_id')
        backend_name = data.get('backend_name')
        shots = data.get('shots', 1000)
        
        if not session_id or not backend_name:
            return jsonify({"error": "session_id and backend_name required"}), 400
        
        user_id = data.get('user_id', 'default')
        creds = credential_manager.load_credentials(user_id)
        
        if not creds:
            return jsonify({"error": "No credentials configured"}), 400
        
        # Get the transpiled circuit from session
        from app.utils.session_manager import session_manager
        builder = session_manager.get_circuit_builder(session_id)
        
        if builder is None:
            return jsonify({
                "error": "No circuit found. Please build and transpile circuit first."
            }), 400
        
        # Check if circuit has been transpiled
        if not hasattr(builder, 'isa_circuit') or builder.isa_circuit is None:
            return jsonify({
                "error": "Circuit not transpiled. Please transpile circuit for target backend first."
            }), 400
        
        # Initialize Qiskit Runtime Service
        from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler
        from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
        
        service = QiskitRuntimeService(
            channel="ibm_cloud",
            token=creds['token'],
            instance=creds['crn']
        )
        
        # Get backend
        backend = service.backend(backend_name)
        
        # Submit job using Sampler
        sampler = Sampler(backend)
        job = sampler.run([builder.isa_circuit], shots=shots)
        
        job_id = job.job_id()
        
        # Get molecule data from request
        molecule_data = data.get('molecule_data')
        
        # Save job metadata
        metadata = {
            "job_id": job_id,
            "backend_name": backend_name,
            "shots": shots,
            "submitted": True,
            "user_id": user_id,
            "status": "QUEUED",
            "session_id": session_id
        }
        
        # Add molecule data if provided
        if molecule_data:
            metadata["molecule_data"] = molecule_data
        
        storage_service.save_job_id(session_id, job_id, metadata)
        logger_service.log_quantum_job(session_id, job_id, backend_name, shots)
        logger_service.get_logger("api").info(f"Job submitted: {job_id} to {backend_name}")
        
        return jsonify({
            "status": "success",
            "message": "Job submitted to IBM Quantum",
            "session_id": session_id,
            "job_id": job_id,
            "backend_name": backend_name,
            "job_status": "QUEUED"
        }), 200
        
    except Exception as e:
        logger_service.log_error("submit_job", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/visualize/<job_id>', methods=['GET'])
def visualize_job(job_id):
    """
    Get visualizations for a job (async with threading to avoid blocking)
    """
    # Check cache first
    if job_id in _visualization_cache:
        print(f"[VISUALIZE] Returning cached visualization for {job_id}")
        logger_service.get_logger("api").info(f"Returning cached visualization for {job_id}")
        return jsonify(_visualization_cache[job_id]), 200
    
    print(f"[VISUALIZE] Starting visualization request for job_id: {job_id}")
    logger_service.get_logger("api").info(f"Visualization request for job_id: {job_id}")
    
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from qiskit.visualization import plot_histogram, plot_state_qsphere, plot_state_city, plot_bloch_multivector, plot_state_hinton
    from qiskit.quantum_info import Statevector
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import time
    
    try:
        start_time = time.time()
        print(f"[VISUALIZE] Loading job data for {job_id}")
        job_data = storage_service.load_job_by_id(job_id)
        if not job_data or 'result' not in job_data:
            print(f"[VISUALIZE] Job or result not found for {job_id}")
            return jsonify({"error": "Job or job result not found"}), 404

        counts = job_data['result'].get('counts')
        if not counts:
            print(f"[VISUALIZE] No counts found for {job_id}")
            return jsonify({"error": "No counts found in job result"}), 404

        print(f"[VISUALIZE] Found {len(counts)} states in counts")
        visualizations = {}
        
        # Get number of qubits from counts
        num_qubits = len(list(counts.keys())[0])
        
        # Sort counts and get top 20 for histogram
        sorted_counts = dict(sorted(counts.items(), key=lambda x: x[1], reverse=True)[:20])
        
        def generate_histogram():
            """Generate histogram plot"""
            try:
                fig_hist = plot_histogram(sorted_counts, figsize=(12, 6))
                try:
                    fig_hist.tight_layout()
                except:
                    pass  # Ignore tight_layout warnings
                hist_buffer = BytesIO()
                fig_hist.savefig(hist_buffer, format='png', dpi=100, bbox_inches='tight')
                hist_buffer.seek(0)
                result = f"data:image/png;base64,{base64.b64encode(hist_buffer.read()).decode('utf-8')}"
                plt.close(fig_hist)
                return ('histogram', result)
            except Exception as e:
                print(f"[VISUALIZE] Histogram plot failed: {str(e)}")
                logger_service.get_logger("api").warning(f"Histogram plot failed: {e}")
                return None
        
        # Generate statevector approximation from counts for other visualizations
        state = None
        try:
            total_shots = sum(counts.values())
            state_dict = {int(k, 2): v / total_shots for k, v in counts.items()}
            state_array = [0] * (2 ** num_qubits)
            for idx, prob in state_dict.items():
                state_array[idx] = prob ** 0.5  # sqrt for amplitude
            
            # Normalize
            norm = sum(abs(x)**2 for x in state_array) ** 0.5
            if norm > 0:
                state_array = [x / norm for x in state_array]
            
            state = Statevector(state_array)
        except Exception as e:
            logger_service.get_logger("api").warning(f"Statevector creation failed: {e}")
        
        def generate_qsphere():
            """Generate Q-sphere plot (for up to 10 qubits)"""
            if num_qubits > 10 or state is None:
                return None
            try:
                fig_qsphere = plot_state_qsphere(state, figsize=(8, 8))
                try:
                    fig_qsphere.tight_layout()
                except:
                    pass  # Ignore tight_layout warnings
                qsphere_buffer = BytesIO()
                fig_qsphere.savefig(qsphere_buffer, format='png', dpi=100, bbox_inches='tight')
                qsphere_buffer.seek(0)
                result = f"data:image/png;base64,{base64.b64encode(qsphere_buffer.read()).decode('utf-8')}"
                plt.close(fig_qsphere)
                return ('qsphere', result)
            except Exception as e:
                print(f"[VISUALIZE] Q-sphere plot failed: {str(e)}")
                logger_service.get_logger("api").warning(f"Q-sphere plot failed: {e}")
                return None
        
        def generate_state_city():
            """Generate State City plot (for up to 8 qubits)"""
            if num_qubits > 8 or state is None:
                return None
            try:
                fig_city = plot_state_city(state, figsize=(10, 6))
                try:
                    fig_city.tight_layout()
                except:
                    pass  # Ignore tight_layout warnings
                city_buffer = BytesIO()
                fig_city.savefig(city_buffer, format='png', dpi=100, bbox_inches='tight')
                city_buffer.seek(0)
                result = f"data:image/png;base64,{base64.b64encode(city_buffer.read()).decode('utf-8')}"
                plt.close(fig_city)
                return ('state_city', result)
            except Exception as e:
                print(f"[VISUALIZE] State city plot failed: {str(e)}")
                logger_service.get_logger("api").warning(f"State city plot failed: {e}")
                return None
        
        def generate_bloch_multivector():
            """Generate Bloch Multivector plot (for up to 5 qubits)"""
            if num_qubits > 5 or state is None:
                return None
            try:
                # Bloch multivector can fail with parse errors, skip tight_layout entirely
                fig_bloch = plot_bloch_multivector(state, figsize=(12, 6))
                bloch_buffer = BytesIO()
                fig_bloch.savefig(bloch_buffer, format='png', dpi=100, bbox_inches='tight')
                bloch_buffer.seek(0)
                result = f"data:image/png;base64,{base64.b64encode(bloch_buffer.read()).decode('utf-8')}"
                plt.close(fig_bloch)
                return ('bloch_multivector', result)
            except Exception as e:
                print(f"[VISUALIZE] Bloch multivector plot failed: {str(e)}")
                logger_service.get_logger("api").warning(f"Bloch multivector plot failed: {e}")
                return None
        
        def generate_hinton():
            """Generate Hinton plot (for up to 8 qubits)"""
            if num_qubits > 8 or state is None:
                return None
            try:
                fig_hinton = plot_state_hinton(state, figsize=(10, 10))
                try:
                    fig_hinton.tight_layout()
                except:
                    pass  # Ignore tight_layout warnings
                hinton_buffer = BytesIO()
                fig_hinton.savefig(hinton_buffer, format='png', dpi=100, bbox_inches='tight')
                hinton_buffer.seek(0)
                result = f"data:image/png;base64,{base64.b64encode(hinton_buffer.read()).decode('utf-8')}"
                plt.close(fig_hinton)
                return ('hinton', result)
            except Exception as e:
                print(f"[VISUALIZE] Hinton plot failed: {str(e)}")
                logger_service.get_logger("api").warning(f"Hinton plot failed: {e}")
                return None
        
        # Generate all plots in parallel using thread pool
        plot_generators = [
            generate_histogram,
            generate_qsphere,
            generate_state_city,
            generate_bloch_multivector,
            generate_hinton
        ]
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(gen) for gen in plot_generators]
            for future in as_completed(futures):
                result = future.result()
                if result:
                    plot_name, plot_data = result
                    visualizations[plot_name] = plot_data
                    print(f"[VISUALIZE] Generated plot: {plot_name}")
        
        elapsed = time.time() - start_time
        print(f"[VISUALIZE] Generated {len(visualizations)} visualizations in {elapsed:.2f}s")
        logger_service.get_logger("api").info(f"Generated {len(visualizations)} visualizations in {elapsed:.2f}s")
        
        response_data = {
            "status": "success",
            "visualizations": visualizations,
            "generation_time": elapsed
        }
        
        # Cache the result
        _visualization_cache[job_id] = response_data
        # Limit cache size to prevent memory issues
        if len(_visualization_cache) > 50:
            # Remove oldest entry
            oldest_key = next(iter(_visualization_cache))
            del _visualization_cache[oldest_key]
            print(f"[VISUALIZE] Cache size limit reached, removed oldest entry: {oldest_key}")
        
        print(f"[VISUALIZE] Returning response with keys: {list(response_data.keys())}")
        return jsonify(response_data), 200

    except Exception as e:
        print(f"[VISUALIZE ERROR] {str(e)}")
        logger_service.log_error("visualize_job", e)
        return jsonify({"error": str(e)}), 500


@bp.route('/retrieve', methods=['GET'])
def retrieve_job():
    """
    Retrieve job results
    
    Query params:
    - session_id: Session identifier
    - user_id: User ID for credentials
    """
    try:
        session_id = request.args.get('session_id')
        user_id = request.args.get('user_id', 'default')
        
        if not session_id:
            return jsonify({"error": "session_id required"}), 400
        
        job_data = storage_service.load_job_id(session_id)
        
        if not job_data:
            return jsonify({
                "error": "No job found for session"
            }), 404
        
        job_id = job_data.get('job_id')
        
        creds = credential_manager.load_credentials(user_id)
        if not creds:
            return jsonify({"error": "No credentials configured"}), 400
        
        service = QiskitRuntimeService(
            channel="ibm_cloud",
            token=creds['token'],
            instance=creds['crn']
        )
        
        job = service.job(job_id)
        result = job.result()
        
        logger_service.get_logger("quantum").info(f"Job retrieved: {job_id}")
        
        return jsonify({
            "status": "success",
            "job_id": job_id,
            "job_data": job_data,
            "result": str(result)
        }), 200
        
    except Exception as e:
        logger_service.log_error("retrieve_job", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/status', methods=['GET'])
def job_status():
    """
    Get job status
    
    Query params:
    - session_id: Session identifier
    """
    try:
        session_id = request.args.get('session_id')
        user_id = request.args.get('user_id', 'default')
        
        if not session_id:
            return jsonify({"error": "session_id required"}), 400
        
        job_data = storage_service.load_job_id(session_id)
        
        if not job_data:
            return jsonify({
                "status": "success",
                "has_job": False
            }), 200
        
        return jsonify({
            "status": "success",
            "has_job": True,
            "job_data": job_data
        }), 200
        
    except Exception as e:
        logger_service.log_error("job_status", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/list', methods=['GET'])
def list_jobs():
    """
    List all jobs for a user
    
    Query params:
    - user_id: User identifier
    """
    try:
        user_id = request.args.get('user_id', 'default')
        
        # Get all job files
        jobs_path = storage_service.jobs_path
        job_files = [f for f in os.listdir(jobs_path) if f.endswith('.json')]
        
        jobs = []
        for job_file in job_files:
            with open(os.path.join(jobs_path, job_file), 'r') as f:
                job_data = json.load(f)
                # Filter by user_id
                if job_data.get('user_id') == user_id:
                    jobs.append(job_data)
        
        # Sort by timestamp (newest first)
        jobs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return jsonify({
            "status": "success",
            "jobs": jobs
        }), 200
        
    except Exception as e:
        logger_service.log_error("list_jobs", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/check/<job_id>', methods=['GET'])
def check_job_status(job_id):
    """
    Check IBM Quantum job status and retrieve results if done
    
    Path params:
    - job_id: IBM Quantum job ID
    
    Query params:
    - user_id: User ID for credentials
    """
    try:
        user_id = request.args.get('user_id', 'default')
        
        creds = credential_manager.load_credentials(user_id)
        if not creds:
            return jsonify({"error": "No credentials configured"}), 400
        
        service = QiskitRuntimeService(
            channel="ibm_cloud",
            token=creds['token'],
            instance=creds['crn']
        )
        
        job = service.job(job_id)
        job_status = job.status()
        
        # Update stored job data
        jobs_path = storage_service.jobs_path
        job_files = [f for f in os.listdir(jobs_path) if f.endswith('.json')]
        
        updated_job_data = None
        for job_file in job_files:
            file_path = os.path.join(jobs_path, job_file)
            with open(file_path, 'r') as f:
                job_data = json.load(f)
            
            if job_data.get('job_id') == job_id:
                # Convert JobStatus enum to string
                status_str = str(job_status).replace('JobStatus.', '')
                job_data['status'] = status_str
                job_data['last_checked'] = datetime.now().isoformat()
                
                # If done, save results
                if status_str == 'DONE':
                    try:
                        result = job.result()
                        pub_result = result[0]
                        counts = pub_result.data.meas.get_counts()
                        
                        # Log the type for debugging
                        logger_service.get_logger("api").info(f"Counts type: {type(counts)}, Counts: {counts}")
                        
                        # Convert counts to a plain dictionary for JSON serialization
                        # get_counts() should return a dict, but ensure it's properly formatted
                        if isinstance(counts, dict):
                            counts_dict = counts
                        else:
                            # If it's not a dict, try to convert it properly
                            counts_dict = dict(counts)
                        
                        job_data['result'] = {
                            'counts': counts_dict,
                            'metadata': {
                                'shots': job_data.get('shots'),
                                'backend': job_data.get('backend_name')
                            }
                        }
                        logger_service.get_logger("api").info(f"Job {job_id} completed with {len(counts_dict)} unique measurement outcomes, total shots: {sum(counts_dict.values())}")
                    except Exception as e:
                        logger_service.get_logger("api").error(f"Error getting result for {job_id}: {e}")
                        import traceback
                        logger_service.get_logger("api").error(traceback.format_exc())
                        job_data['error'] = str(e)
                
                with open(file_path, 'w') as f:
                    json.dump(job_data, f, indent=2)
                
                updated_job_data = job_data
                break
        
        if not updated_job_data:
            return jsonify({
                "error": "Job not found in local storage"
            }), 404
        
        return jsonify({
            "status": "success",
            "job_id": job_id,
            "job_status": status_str,
            "job_data": updated_job_data
        }), 200
        
    except Exception as e:
        logger_service.log_error("check_job_status", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500


@bp.route('/delete/<job_id>', methods=['DELETE', 'POST'])
def delete_job(job_id):
    """
    Delete a job from storage
    
    Args:
        job_id: The job ID to delete
    """
    try:
        # Load job to verify it exists
        job_data = storage_service.load_job_by_id(job_id)
        if not job_data:
            return jsonify({"error": "Job not found"}), 404
        
        # Delete the job file
        job_file = storage_service.get_job_path(job_id)
        if os.path.exists(job_file):
            os.remove(job_file)
            logger_service.get_logger("api").info(f"Job deleted: {job_id}")
            return jsonify({
                "status": "success",
                "message": f"Job {job_id} deleted successfully"
            }), 200
        else:
            return jsonify({"error": "Job file not found"}), 404
        
    except Exception as e:
        logger_service.log_error("delete_job", e)
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

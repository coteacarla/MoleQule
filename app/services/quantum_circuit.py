"""
Quantum Circuit Builder Service
Handles UCJ circuit construction and transpilation for IBM backends
"""
import numpy as np
import ffsim
from qiskit import QuantumCircuit, QuantumRegister
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
from qiskit.providers import BackendV2
from typing import Dict, Any, List, Tuple, Sequence, Optional
import traceback
import rustworkx
from rustworkx import NoEdgeBetweenNodes, PyGraph


IBM_TWO_Q_GATES = {"cx", "ecr", "cz"}


class QuantumCircuitBuilder:
    """Builds and optimizes quantum circuits for molecular calculations"""
    
    def __init__(self, num_orbitals: int, nelec: Tuple[int, int], t1: np.ndarray, t2: np.ndarray):
        """
        Initialize circuit builder
        
        Args:
            num_orbitals: Number of spatial orbitals
            nelec: Tuple of (n_alpha, n_beta) electrons
            t1: CCSD t1 amplitudes
            t2: CCSD t2 amplitudes
        """
        self.num_orbitals = num_orbitals
        self.nelec = nelec
        self.t1 = t1
        self.t2 = t2
        self.circuit = None
        self.isa_circuit = None
        
    def build_ucj_circuit(self, n_reps: int = 1) -> Dict[str, Any]:
        """
        Build UCJ (Unitary Coupled Cluster Jastrow) quantum circuit
        
        Args:
            n_reps: Number of repetitions for UCJ operator
            
        Returns:
            Dict with circuit statistics
        """
        try:
            # Define interaction pairs
            alpha_alpha_indices = [(p, p + 1) for p in range(self.num_orbitals - 1)]
            alpha_beta_indices = [(p, p) for p in range(0, self.num_orbitals, 4)]
            
            # Build UCJ operator from CCSD amplitudes
            ucj_op = ffsim.UCJOpSpinBalanced.from_t_amplitudes(
                t2=self.t2,
                t1=self.t1,
                n_reps=n_reps,
                interaction_pairs=(alpha_alpha_indices, alpha_beta_indices),
                optimize=True,
                options=dict(maxiter=1000),
            )
            
            # Create quantum circuit
            qubits = QuantumRegister(2 * self.num_orbitals, name="q")
            self.circuit = QuantumCircuit(qubits)
            
            # Prepare Hartree-Fock reference state
            self.circuit.append(
                ffsim.qiskit.PrepareHartreeFockJW(self.num_orbitals, self.nelec),
                qubits
            )
            
            # Apply UCJ operator
            self.circuit.append(ffsim.qiskit.UCJOpSpinBalancedJW(ucj_op), qubits)
            
            # Add measurements
            self.circuit.measure_all()
            
            return {
                "status": "success",
                "num_qubits": self.circuit.num_qubits,
                "depth": self.circuit.depth(),
                "gate_counts": dict(self.circuit.count_ops()),
                "n_reps": n_reps,
                "alpha_alpha_pairs": len(alpha_alpha_indices),
                "alpha_beta_pairs": len(alpha_beta_indices)
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "traceback": traceback.format_exc()
            }
    
    def transpile_for_backend(
        self,
        backend: BackendV2,
        optimization_level: int = 3,
        use_pre_init: bool = True,
        use_zigzag_layout: bool = True
    ) -> Dict[str, Any]:
        """
        Transpile circuit for IBM backend
        
        Args:
            backend: IBM Quantum backend
            optimization_level: Optimization level (0-3)
            use_pre_init: Whether to use ffsim pre-init passes
            use_zigzag_layout: Whether to use zigzag physical layout
            
        Returns:
            Dict with transpilation results
        """
        try:
            if self.circuit is None:
                raise ValueError("Circuit not built. Call build_ucj_circuit first.")
            
            # Get initial layout if using zigzag
            initial_layout = None
            num_alpha_beta_qubits = 0
            if use_zigzag_layout:
                initial_layout, num_alpha_beta_qubits = self._get_zigzag_physical_layout(backend)
            
            # Create pass manager
            pass_manager = generate_preset_pass_manager(
                optimization_level=optimization_level,
                backend=backend,
                initial_layout=initial_layout
            )
            
            # Add PRE_INIT passes if requested
            if use_pre_init:
                pass_manager.pre_init = ffsim.qiskit.PRE_INIT
            
            # Transpile
            self.isa_circuit = pass_manager.run(self.circuit)
            
            # Extract qubit mapping from layout
            qubit_mapping = {}
            if self.isa_circuit.layout and self.isa_circuit.layout.initial_layout:
                initial = self.isa_circuit.layout.initial_layout
                # Get virtual to physical mapping
                virtual_bits = initial.get_virtual_bits()
                print(f"DEBUG: Found {len(virtual_bits)} virtual-physical qubit pairs")
                for virtual_qubit, physical_qubit in virtual_bits.items():
                    # Extract indices from Qubit objects
                    v_idx = virtual_qubit._index if hasattr(virtual_qubit, '_index') else virtual_qubit
                    p_idx = physical_qubit._index if hasattr(physical_qubit, '_index') else physical_qubit
                    qubit_mapping[v_idx] = p_idx
                    print(f"DEBUG: Virtual {v_idx} -> Physical {p_idx}")
            else:
                print("DEBUG: No layout information found in transpiled circuit")
            
            print(f"DEBUG: Final qubit_mapping has {len(qubit_mapping)} entries: {qubit_mapping}")
            
            return {
                "status": "success",
                "num_qubits": self.isa_circuit.num_qubits,
                "depth": self.isa_circuit.depth(),
                "gate_counts": dict(self.isa_circuit.count_ops()),
                "optimization_level": optimization_level,
                "used_pre_init": use_pre_init,
                "used_zigzag_layout": use_zigzag_layout,
                "num_alpha_beta_qubits": num_alpha_beta_qubits,
                "initial_layout": initial_layout[:10] if initial_layout else None,
                "qubit_mapping": qubit_mapping if qubit_mapping else {}
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "traceback": traceback.format_exc()
            }
    
    def _get_zigzag_physical_layout(self, backend: BackendV2) -> Tuple[List[int], int]:
        """
        Generate zigzag physical layout for IBM backend
        
        Args:
            backend: IBM Quantum backend
            
        Returns:
            Tuple of (layout, num_alpha_beta_qubits)
        """
        backend_coupling_graph = self._make_backend_cmap_pygraph(backend)
        
        G, num_alpha_beta_qubits = self._create_lucj_zigzag_layout(
            self.num_orbitals, backend_coupling_graph
        )
        
        isomorphic_mappings = rustworkx.vf2_mapping(
            backend_coupling_graph, G, subgraph=True
        )
        isomorphic_mappings = list(isomorphic_mappings)
        
        if not isomorphic_mappings:
            raise ValueError("No isomorphic mapping found for zigzag layout")
        
        edges = list(G.edge_list())
        layouts = []
        
        for mapping in isomorphic_mappings:
            initial_layout = [None] * (2 * self.num_orbitals + num_alpha_beta_qubits)
            for key, value in mapping.items():
                initial_layout[value] = key
            layouts.append(initial_layout)
        
        # Score layouts
        two_q_gate_name = IBM_TWO_Q_GATES.intersection(
            backend.configuration().basis_gates
        ).pop()
        
        scores = self._lightweight_layout_error_scoring(
            backend, edges, layouts, two_q_gate_name
        )
        
        # Return best layout (without alpha-beta qubits at the end)
        return scores[0][0][:-num_alpha_beta_qubits], num_alpha_beta_qubits
    
    @staticmethod
    def _create_linear_chains(num_orbitals: int) -> PyGraph:
        """Create two disconnected linear chains"""
        G = rustworkx.PyGraph()
        
        for n in range(num_orbitals):
            G.add_node(n)
        
        for n in range(num_orbitals - 1):
            G.add_edge(n, n + 1, None)
        
        for n in range(num_orbitals, 2 * num_orbitals):
            G.add_node(n)
        
        for n in range(num_orbitals, 2 * num_orbitals - 1):
            G.add_edge(n, n + 1, None)
        
        return G
    
    @staticmethod
    def _create_lucj_zigzag_layout(
        num_orbitals: int, backend_coupling_graph: PyGraph
    ) -> Tuple[PyGraph, int]:
        """Create complete zigzag graph for LUCJ ansatz"""
        isomorphic = False
        G = QuantumCircuitBuilder._create_linear_chains(num_orbitals)
        
        num_iters = num_orbitals
        while not isomorphic and num_iters > 0:
            G_new = G.copy()
            num_alpha_beta_qubits = 0
            for n in range(num_iters):
                if n % 4 == 0:
                    new_node = 2 * num_orbitals + num_alpha_beta_qubits
                    G_new.add_node(new_node)
                    G_new.add_edge(n, new_node, None)
                    G_new.add_edge(new_node, n + num_orbitals, None)
                    num_alpha_beta_qubits += 1
            
            isomorphic = rustworkx.is_subgraph_isomorphic(
                backend_coupling_graph, G_new
            )
            num_iters -= 1
        
        return G_new, num_alpha_beta_qubits
    
    @staticmethod
    def _lightweight_layout_error_scoring(
        backend: BackendV2,
        virtual_edges: Sequence[Sequence[int]],
        physical_layouts: Sequence[int],
        two_q_gate_name: str,
    ) -> List[List]:
        """Score physical layouts by gate and measurement errors"""
        props = backend.properties()
        scores = []
        
        for layout in physical_layouts:
            total_2q_error = 0
            for edge in virtual_edges:
                physical_edge = (layout[edge[0]], layout[edge[1]])
                try:
                    ge = props.gate_error(two_q_gate_name, physical_edge)
                except Exception:
                    ge = props.gate_error(two_q_gate_name, physical_edge[::-1])
                total_2q_error += ge
            
            total_measurement_error = 0
            for qubit in layout:
                meas_error = props.readout_error(qubit)
                total_measurement_error += meas_error
            
            scores.append([layout, total_2q_error + total_measurement_error])
        
        return sorted(scores, key=lambda x: x[1])
    
    @staticmethod
    def _make_backend_cmap_pygraph(backend: BackendV2) -> PyGraph:
        """Convert backend coupling map to undirected PyGraph"""
        graph = backend.coupling_map.graph
        if not graph.is_symmetric():
            graph.make_symmetric()
        backend_coupling_graph = graph.to_undirected()
        
        edge_list = backend_coupling_graph.edge_list()
        removed_edge = []
        for edge in edge_list:
            if set(edge) in removed_edge:
                continue
            try:
                backend_coupling_graph.remove_edge(edge[0], edge[1])
                removed_edge.append(set(edge))
            except NoEdgeBetweenNodes:
                pass
        
        return backend_coupling_graph
    
    def get_circuit_qasm(self) -> Optional[str]:
        """Get QASM representation of transpiled circuit"""
        if self.isa_circuit is not None:
            qasm_fn = getattr(self.isa_circuit, "qasm", None)
            if callable(qasm_fn):
                return qasm_fn()
        if self.circuit is not None:
            qasm_fn = getattr(self.circuit, "qasm", None)
            if callable(qasm_fn):
                return qasm_fn()
        return None

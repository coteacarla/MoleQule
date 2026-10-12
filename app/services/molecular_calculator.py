
"""
Molecular Calculator Service
Handles all quantum chemistry calculations using PySCF
"""
import numpy as np
import pyscf
import pyscf.scf
import pyscf.mcscf
import pyscf.cc
from pyscf import ao2mo
from typing import Optional, Tuple, Dict, Any, List
from dataclasses import dataclass, asdict
import traceback
import io
import sys


@dataclass
class ActiveSpaceConfig:
    """Configuration for active space selection"""
    mode: str  # 'range', 'explicit', or 'homo_lumo'
    act_start: Optional[int] = None
    act_stop: Optional[int] = None
    explicit_orbs: Optional[List[int]] = None
    n_below_homo: Optional[int] = None
    n_above_lumo: Optional[int] = None
    nelec_mode: str = 'auto'
    manual_nelec: Optional[Tuple[int, int]] = None


class MolecularCalculator:
    """Handles molecular calculations workflow using PySCF"""
    
    def __init__(self, xyz_data: str, basis: str = '6-31g', charge: int = 0, spin: int = 0):
        """
        Initialize molecular calculator
        
        Args:
            xyz_data: XYZ format molecular geometry
            basis: Basis set name (default: 6-31g)
            charge: Molecular charge (default: 0)
            spin: Spin multiplicity 2S (default: 0 for closed shell)
        """
        self.xyz_data = xyz_data
        self.basis = basis
        self.charge = charge
        self.spin = spin
        
        # Calculation objects
        self.mol = None
        self.mf = None
        self.cas = None
        
        # Active space parameters
        self.active_orbs = None
        self.num_orbitals = None
        self.n_alpha = None
        self.n_beta = None
        
        # Molecular integrals
        self.hcore = None
        self.eri = None
        self.nuclear_repulsion_energy = None
        
        # CCSD amplitudes
        self.t1 = None
        self.t2 = None
        
        # Results storage
        self.scf_energy = None
        self.ccsd_energy = None
        
    def build_molecule(self) -> Dict[str, Any]:
        """
        Build molecule from XYZ data
        
        Returns:
            Dict with status and molecular properties
        """
        try:
            self.mol = pyscf.gto.Mole()
            self.mol.build(
                atom=self.xyz_data,
                unit="Angstrom",
                basis=self.basis,
                charge=self.charge,
                spin=self.spin,
                symmetry=False,
            )
            
            return {
                "status": "success",
                "natom": self.mol.natm,
                "nelectron": self.mol.nelectron,
                "nbasis": self.mol.nao_nr(),
                "basis": self.basis,
                "charge": self.charge,
                "spin": self.spin
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "traceback": traceback.format_exc()
            }
    
    def run_scf(self) -> Dict[str, Any]:
        """
        Run Hartree-Fock (SCF) calculation
        
        Returns:
            Dict with SCF results
        """
        try:
            if self.mol is None:
                raise ValueError("Molecule not built. Call build_molecule first.")
            
            self.mf = pyscf.scf.RHF(self.mol).run()
            self.scf_energy = float(self.mf.e_tot)
            
            return {
                "status": "success",
                "scf_energy": self.scf_energy,
                "converged": bool(self.mf.converged),
                "mo_energies": self.mf.mo_energy.tolist(),
                "mo_occupations": self.mf.mo_occ.tolist(),
                "nmo": len(self.mf.mo_energy)
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "traceback": traceback.format_exc()
            }
    
    def setup_active_space(self, config: ActiveSpaceConfig) -> Dict[str, Any]:
        """
        Setup active space for CASCI calculation
        
        Args:
            config: Active space configuration
            
        Returns:
            Dict with active space details
        """
        try:
            if self.mf is None:
                raise ValueError("SCF not completed. Run run_scf first.")
            
            mo_e = self.mf.mo_energy
            mo_occ = self.mf.mo_occ
            nmo_total = len(mo_e)
            
            # Determine active orbital indices based on mode
            if config.mode == 'range':
                if config.act_start is None or config.act_stop is None:
                    raise ValueError("act_start and act_stop required for range mode")
                self.active_orbs = list(range(config.act_start, min(config.act_stop, nmo_total)))
                
            elif config.mode == 'explicit':
                if config.explicit_orbs is None:
                    raise ValueError("explicit_orbs required for explicit mode")
                self.active_orbs = sorted(int(i) for i in config.explicit_orbs if 0 <= i < nmo_total)
                
            elif config.mode == 'homo_lumo':
                if config.n_below_homo is None or config.n_above_lumo is None:
                    raise ValueError("n_below_homo and n_above_lumo required for homo_lumo mode")
                    
                n_docc = int(round(np.sum(mo_occ) / 2))
                homo = n_docc - 1
                lumo = homo + 1
                lo = max(0, homo - config.n_below_homo + 1)
                hi = min(nmo_total, lumo + config.n_above_lumo)
                self.active_orbs = list(range(lo, hi))
            else:
                raise ValueError(f"Invalid mode: {config.mode}. Must be 'range', 'explicit', or 'homo_lumo'")
            
            self.num_orbitals = len(self.active_orbs)
            
            # Determine electrons in active space
            if config.nelec_mode == 'auto':
                n_electrons = int(np.rint(np.sum(mo_occ[self.active_orbs])))
                self.n_alpha = (n_electrons + self.mol.spin) // 2
                self.n_beta = (n_electrons - self.mol.spin) // 2
            elif config.nelec_mode == 'manual':
                if config.manual_nelec is None:
                    raise ValueError("manual_nelec required when nelec_mode='manual'")
                self.n_alpha, self.n_beta = config.manual_nelec
            else:
                raise ValueError("nelec_mode must be 'auto' or 'manual'")
            
            # Validation
            if self.n_alpha < 0 or self.n_beta < 0:
                raise ValueError(f"Invalid electron counts: α={self.n_alpha}, β={self.n_beta}")
            if self.num_orbitals <= 0:
                raise ValueError("Active space is empty")
            if (self.n_alpha + self.n_beta) > 2 * self.num_orbitals:
                raise ValueError(f"Too many electrons ({self.n_alpha + self.n_beta}) for {self.num_orbitals} orbitals")
            
            # MO energy window
            mo_e_min = float(mo_e[min(self.active_orbs)])
            mo_e_max = float(mo_e[max(self.active_orbs)])
            
            return {
                "status": "success",
                "num_orbitals": self.num_orbitals,
                "n_alpha": self.n_alpha,
                "n_beta": self.n_beta,
                "total_electrons": self.n_alpha + self.n_beta,
                "active_orbital_indices": self.active_orbs,
                "mo_energy_window": [mo_e_min, mo_e_max]
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "traceback": traceback.format_exc()
            }
    
    def compute_integrals_and_ccsd(self, max_iter: int = 200) -> Dict[str, Any]:
        """
        Compute molecular integrals (CASCI) and CCSD amplitudes
        
        Args:
            max_iter: Maximum number of CCSD iterations (default: 200)
        
        Returns:
            Dict with integral and CCSD information
        """
        try:
            if self.active_orbs is None:
                raise ValueError("Active space not set. Call setup_active_space first.")
            
            # CASCI integrals
            self.cas = pyscf.mcscf.CASCI(self.mf, self.num_orbitals, (self.n_alpha, self.n_beta))
            mo_cas = self.cas.sort_mo(self.active_orbs, base=0)
            self.hcore, self.nuclear_repulsion_energy = self.cas.get_h1cas(mo_cas)
            self.eri = ao2mo.restore(1, self.cas.get_h2cas(mo_cas), self.num_orbitals)
            
            # CCSD amplitudes: use MANUAL electron counts, not SCF occupancies
            # Calculate number of occupied orbitals from manual electron configuration
            total_electrons = self.n_alpha + self.n_beta
            n_occ_orbitals = (total_electrons + 1) // 2  # Ceiling division for electron pairs
            n_virt_orbitals = self.num_orbitals - n_occ_orbitals
            
            print(f"[CCSD DEBUG] Active space: {self.num_orbitals} orbitals, {total_electrons} electrons (α={self.n_alpha}, β={self.n_beta})")
            print(f"[CCSD DEBUG] Derived: {n_occ_orbitals} occupied, {n_virt_orbitals} virtual")
            print(f"[CCSD DEBUG] Active orbital indices: {self.active_orbs}")
            
            # Validate that we have at least one virtual orbital for CCSD
            if n_virt_orbitals <= 0:
                raise ValueError(
                    f"Active space has no virtual orbitals ({n_occ_orbitals} occupied out of {self.num_orbitals} total). "
                    f"CCSD requires at least one virtual orbital. "
                    f"Try using fewer electrons or more orbitals in your active space."
                )
            
            # Sort active orbitals by energy to determine which are occupied vs virtual
            mo_energies = self.mf.mo_energy
            active_orbs_sorted = sorted(self.active_orbs, key=lambda idx: mo_energies[idx])
            
            # Split into occupied (lowest energy) and virtual (highest energy)
            occ_list = active_orbs_sorted[:n_occ_orbitals]
            virt_list = active_orbs_sorted[n_occ_orbitals:]
            
            print(f"[CCSD DEBUG] Occupied orbitals (sorted by energy): {occ_list}")
            print(f"[CCSD DEBUG] Virtual orbitals (sorted by energy): {virt_list}")
            
            # Reorder MOs: [ACTIVE_OCC | ACTIVE_VIR | FROZEN_REST]
            mo_order_active = occ_list + virt_list
            rest = [i for i in range(len(self.mf.mo_energy)) if i not in mo_order_active]
            mo_order_all = mo_order_active + rest
            
            mo_sorted = self.mf.mo_coeff[:, mo_order_all]
            
            # Prepare CCSD mean-field object
            mf_cc = self.mf.copy()
            mf_cc.mo_coeff = mo_sorted
            mo_occ_sorted = np.hstack([
                np.full(n_occ_orbitals, 2.0),
                np.zeros(n_virt_orbitals),
                self.mf.mo_occ[rest]
            ])
            mf_cc.mo_occ = mo_occ_sorted
            
            # Freeze everything after active block
            frozen_idx = list(range(self.num_orbitals, mo_sorted.shape[1]))
            
            # Capture CCSD output
            ccsd_output = io.StringIO()
            original_stdout = sys.stdout
            
            try:
                mycc = pyscf.cc.CCSD(mf_cc, frozen=frozen_idx)
                mycc.max_cycle = max_iter
                
                # Redirect stdout to capture CCSD output
                sys.stdout = ccsd_output
                mycc.run()
                sys.stdout = original_stdout
                
                # Get the output log
                log_output = ccsd_output.getvalue()
                
                # Check if CCSD converged
                converged = mycc.converged
                
                self.t1, self.t2 = mycc.t1, mycc.t2
                self.ccsd_energy = float(mycc.e_tot)
                
                # If not converged, include warning in result
                convergence_info = {
                    "converged": bool(converged),
                    "log": log_output if not converged else ""
                }
                
            except np.linalg.LinAlgError as e:
                sys.stdout = original_stdout
                log_output = ccsd_output.getvalue()
                raise ValueError(
                    f"CCSD failed with linear algebra error: {str(e)}. "
                    f"This often happens with problematic active space configurations. "
                    f"Try: (1) Use more electrons (currently {total_electrons}), "
                    f"(2) Select orbitals closer to HOMO/LUMO, "
                    f"(3) Use HOMO/LUMO mode instead of range mode.\n\n"
                    f"CCSD Log:\n{log_output}"
                )
            except Exception as e:
                sys.stdout = original_stdout
                log_output = ccsd_output.getvalue()
                if "singular" in str(e).lower():
                    raise ValueError(
                        f"CCSD encountered a singular matrix. "
                        f"Current config: {total_electrons} electrons in {self.num_orbitals} orbitals. "
                        f"Try using more electrons or selecting orbitals around HOMO/LUMO.\n\n"
                        f"CCSD Log:\n{log_output}"
                    )
                raise
            finally:
                sys.stdout = original_stdout
                ccsd_output.close()
            
            n_occ_act = n_occ_orbitals
            n_vir_act = n_virt_orbitals
            
            result = {
                "status": "success",
                "ccsd_energy": self.ccsd_energy,
                "nuclear_repulsion": float(self.nuclear_repulsion_energy),
                "t1_shape": list(self.t1.shape),
                "t2_shape": list(self.t2.shape),
                "expected_t1_shape": [n_occ_act, n_vir_act],
                "expected_t2_shape": [n_occ_act, n_occ_act, n_vir_act, n_vir_act],
                "hcore_shape": list(self.hcore.shape),
                "eri_shape": list(self.eri.shape),
                "n_occupied_active": n_occ_act,
                "n_virtual_active": n_vir_act,
                "converged": convergence_info["converged"],
                "ccsd_log": convergence_info["log"]
            }
            
            return result
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "traceback": traceback.format_exc()
            }
    
    def get_state_summary(self) -> Dict[str, Any]:
        """Get summary of current calculation state"""
        return {
            "molecule_built": self.mol is not None,
            "scf_completed": self.mf is not None,
            "active_space_set": self.active_orbs is not None,
            "integrals_computed": self.hcore is not None,
            "scf_energy": self.scf_energy,
            "ccsd_energy": self.ccsd_energy,
            "num_orbitals": self.num_orbitals,
            "n_alpha": self.n_alpha,
            "n_beta": self.n_beta,
            "natom": self.mol.natm if self.mol else None,
            "nelectron": self.mol.nelectron if self.mol else None
        }

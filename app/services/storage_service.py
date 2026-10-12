"""
Storage service for molecules, jobs, and results
"""
import os
import json
import pickle
from typing import Dict, Any, Optional
from datetime import datetime


class StorageService:
    """Handles persistent storage of molecules, jobs, and results"""
    
    def __init__(self, base_path: str = "storage"):
        self.base_path = base_path
        self.molecules_path = os.path.join(base_path, "molecules")
        self.jobs_path = os.path.join(base_path, "jobs")
        self.plots_path = os.path.join(base_path, "plots")
        
        os.makedirs(self.molecules_path, exist_ok=True)
        os.makedirs(self.jobs_path, exist_ok=True)
        os.makedirs(self.plots_path, exist_ok=True)
    
    def get_molecule_dir(self, molecule_name: str, basis: str, create_cell2: bool = False) -> str:
        """Get directory path for molecule+basis combination with optional CELL2 subdirectory"""
        dir_name = f"{molecule_name}_{basis}"
        dir_path = os.path.join(self.molecules_path, dir_name)
        os.makedirs(dir_path, exist_ok=True)
        
        if create_cell2:
            cell2_path = os.path.join(dir_path, "CELL2")
            os.makedirs(cell2_path, exist_ok=True)
            return cell2_path
        
        return dir_path
    
    def save_molecule_data(self, molecule_name: str, basis: str, cell: str, data: Dict[str, Any], use_cell2: bool = True) -> None:
        """Save molecule calculation data for a specific cell
        
        Args:
            molecule_name: Name of the molecule
            basis: Basis set used
            cell: Cell identifier (e.g., 'CELL2', 'scf_results', etc.)
            data: Dictionary of data to save
            use_cell2: If True, saves under /CELL2/{moleculeName}_{basis}/, else under /{moleculeName}_{basis}/
        """
        if use_cell2 and cell != 'CELL2':
            # Save under CELL2 subdirectory structure
            cell2_dir = self.get_molecule_dir(molecule_name, basis, create_cell2=True)
            target_dir = os.path.join(cell2_dir, cell)
        else:
            # Save directly under molecule directory
            mol_dir = self.get_molecule_dir(molecule_name, basis)
            target_dir = os.path.join(mol_dir, cell)
        
        os.makedirs(target_dir, exist_ok=True)
        
        metadata = {
            "timestamp": datetime.now().isoformat(),
            "molecule_name": molecule_name,
            "basis": basis,
            "cell": cell,
            "use_cell2": use_cell2
        }
        
        with open(os.path.join(target_dir, "metadata.json"), "w") as f:
            json.dump(metadata, f, indent=2)
        
        for key, value in data.items():
            # Try JSON first for simple types, fallback to pickle
            try:
                if isinstance(value, (str, int, float, bool, list, dict, type(None))):
                    filepath = os.path.join(target_dir, f"{key}.json")
                    with open(filepath, "w") as f:
                        json.dump(value, f, indent=2)
                else:
                    raise TypeError("Use pickle for complex types")
            except (TypeError, ValueError):
                filepath = os.path.join(target_dir, f"{key}.pkl")
                with open(filepath, "wb") as f:
                    pickle.dump(value, f)
    
    def load_job_by_id(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Load job data by job_id"""
        for filename in os.listdir(self.jobs_path):
            if filename.endswith(".json"):
                filepath = os.path.join(self.jobs_path, filename)
                with open(filepath, "r") as f:
                    try:
                        data = json.load(f)
                        if data.get("job_id") == job_id:
                            return data
                    except json.JSONDecodeError:
                        continue
        return None

    def get_job_path(self, job_id: str) -> Optional[str]:
        """Get the file path for a job by job_id"""
        for filename in os.listdir(self.jobs_path):
            if filename.endswith(".json"):
                filepath = os.path.join(self.jobs_path, filename)
                with open(filepath, "r") as f:
                    try:
                        data = json.load(f)
                        if data.get("job_id") == job_id:
                            return filepath
                    except json.JSONDecodeError:
                        continue
        return None

    def load_molecule_data(self, molecule_name: str, basis: str, cell: str, use_cell2: bool = True) -> Optional[Dict[str, Any]]:
        """Load molecule calculation data for a specific cell
        
        Args:
            molecule_name: Name of the molecule
            basis: Basis set used
            cell: Cell identifier
            use_cell2: If True, loads from /CELL2/{moleculeName}_{basis}/
        """
        if use_cell2 and cell != 'CELL2':
            cell2_dir = self.get_molecule_dir(molecule_name, basis, create_cell2=False)
            cell2_dir = os.path.join(cell2_dir, "CELL2")
            target_dir = os.path.join(cell2_dir, cell)
        else:
            mol_dir = self.get_molecule_dir(molecule_name, basis)
            target_dir = os.path.join(mol_dir, cell)
        
        if not os.path.exists(target_dir):
            return None
        
        data = {}
        for filename in os.listdir(target_dir):
            key = None
            if filename.endswith(".pkl"):
                key = filename[:-4]
                filepath = os.path.join(target_dir, filename)
                with open(filepath, "rb") as f:
                    data[key] = pickle.load(f)
            elif filename.endswith(".json") and filename != "metadata.json":
                key = filename[:-5]
                filepath = os.path.join(target_dir, filename)
                with open(filepath, "r") as f:
                    data[key] = json.load(f)
        
        return data if data else None
    
    def save_job_id(self, session_id: str, job_id: str, metadata: Dict[str, Any]) -> None:
        """Save job ID with metadata"""
        job_file = os.path.join(self.jobs_path, f"{session_id}.json")
        job_data = {
            "job_id": job_id,
            "session_id": session_id,
            "timestamp": datetime.now().isoformat(),
            **metadata
        }
        
        with open(job_file, "w") as f:
            json.dump(job_data, f, indent=2)
    
    def load_job_id(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Load job ID and metadata"""
        job_file = os.path.join(self.jobs_path, f"{session_id}.json")
        
        if not os.path.exists(job_file):
            return None
        
        with open(job_file, "r") as f:
            return json.load(f)
    
    def save_plot(self, session_id: str, plot_name: str, plot_data: bytes) -> str:
        """Save plot image"""
        plot_file = os.path.join(self.plots_path, f"{session_id}_{plot_name}.png")
        
        with open(plot_file, "wb") as f:
            f.write(plot_data)
        
        return plot_file
    
    def list_molecules(self) -> list:
        """List all saved molecules"""
        if not os.path.exists(self.molecules_path):
            return []
        
        molecules = []
        for mol_dir in os.listdir(self.molecules_path):
            mol_path = os.path.join(self.molecules_path, mol_dir)
            if os.path.isdir(mol_path):
                parts = mol_dir.rsplit("_", 1)
                if len(parts) == 2:
                    molecules.append({
                        "molecule_name": parts[0],
                        "basis": parts[1],
                        "path": mol_path
                    })
        
        return molecules


storage_service = StorageService()

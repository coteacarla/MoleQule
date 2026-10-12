"""
Molecule visualization module - Simplified for 2D image generation only
Backend service for generating 2D molecular structure images
"""
import numpy as np
from rdkit import Chem
from rdkit.Chem import AllChem, Draw


def read_xyz(filename):
    """Read XYZ file and return atoms and coordinates"""
    with open(filename, 'r') as f:
        lines = f.readlines()
    num_atoms = int(lines[0].strip())
    atom_lines = lines[2:2 + num_atoms]
    atoms, coords = [], []
    for line in atom_lines:
        parts = line.split()
        atoms.append(parts[0])
        coords.append(list(map(float, parts[1:4])))
    return atoms, coords


def guess_bonds_and_create_mol(atoms, coords, max_distance=1.8):
    """Create RDKit molecule from atoms and coordinates"""
    mol = Chem.RWMol()
    conf = Chem.Conformer(len(atoms))
    for i, (atom, (x, y, z)) in enumerate(zip(atoms, coords)):
        idx = mol.AddAtom(Chem.Atom(atom))
        conf.SetAtomPosition(idx, (x, y, z))
    mol.AddConformer(conf)
    
    for i in range(len(atoms)):
        for j in range(i + 1, len(atoms)):
            d = np.linalg.norm(np.array(coords[i]) - np.array(coords[j]))
            if 0.4 < d < max_distance: 
                mol.AddBond(i, j, Chem.BondType.SINGLE)
    
    try:
        Chem.SanitizeMol(mol)
    except Exception as e:
        print(f"Warning: Failed to sanitize molecule: {e}")
        pass
        
    return mol.GetMol()


def save_2d_molecule_image(mol, filename="molecule_2d.png"):
    """Generate and save 2D molecule image"""
    try:
        AllChem.Compute2DCoords(mol)
        img = Draw.MolToImage(mol, size=(400, 400))
        img.save(filename)
        return True, f"2D image saved as: {filename}"
    except Exception as e:
        return False, f"Failed to save 2D image: {e}"


def process_molecule_file(xyz_file, output_image="molecule_2d.png", launch_3d=False):
    """
    Main function to process a molecule file and generate 2D image
    
    Args:
        xyz_file: Path to XYZ file
        output_image: Path for output 2D image
        launch_3d: Ignored (kept for API compatibility)
        
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        # Read file
        atoms, coords = read_xyz(xyz_file)
        
        # Create molecule
        mol = guess_bonds_and_create_mol(atoms, coords)
        
        # Save 2D image
        success, msg = save_2d_molecule_image(mol, output_image)
        if not success:
            return False, msg
        
        return True, f"Processed molecule successfully. Image: {output_image}"
        
    except Exception as e:
        return False, f"Error processing molecule file: {e}"

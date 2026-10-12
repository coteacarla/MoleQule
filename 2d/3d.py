import sys
import tkinter as tk
from tkinter import filedialog
from rdkit import Chem
import numpy as np
import os
from rdkit.Chem import AllChem, Draw 

try:
    from PyQt6.QtWidgets import QApplication, QMainWindow, QWidget, QVBoxLayout
    
    import matplotlib
    matplotlib.use('QtAgg')
    
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
    from mpl_toolkits.mplot3d import Axes3D
    
    class MoleculesPlotCanvas(FigureCanvasQTAgg):
        
        def __init__(self, mol, parent=None, width=5, height=5, dpi=100):
            self.scale_factor = 1.0
            self.initial_ranges = None
            
            fig = plt.figure(figsize=(width, height), dpi=dpi)
            self.axes = fig.add_subplot(111, projection='3d')
            
            super().__init__(fig)
            self.setParent(parent)
            self.plot_molecule(mol)

        def update_limits(self):
            if self.initial_ranges is None:
                return
            
            x_base_min, x_base_max, y_base_min, y_base_max, z_base_min, z_base_max = self.initial_ranges
            
            mid_x = (x_base_max + x_base_min) * 0.5
            mid_y = (y_base_max + y_base_min) * 0.5
            mid_z = (z_base_max + z_base_min) * 0.5
            
            x_range = (x_base_max - x_base_min) * self.scale_factor
            y_range = (y_base_max - y_base_min) * self.scale_factor
            z_range = (z_base_max - z_base_min) * self.scale_factor
            
            self.axes.set_xlim(mid_x - x_range / 2.0, mid_x + x_range / 2.0)
            self.axes.set_ylim(mid_y - y_range / 2.0, mid_y + y_range / 2.0)
            self.axes.set_zlim(mid_z - z_range / 2.0, mid_z + z_range / 2.0)
            
            self.draw()

        def wheelEvent(self, event):
            delta = event.angleDelta().y()
            zoom_speed = 0.05
            
            if delta > 0:
                self.scale_factor *= (1.0 - zoom_speed)
            elif delta < 0:
                self.scale_factor *= (1.0 + zoom_speed)
            
            # Adjusted minimum scale factor to 0.001 to allow for deeper zoom.
            self.scale_factor = max(0.001, min(self.scale_factor, 5.0))
            
            self.update_limits()
            event.accept()

        def plot_molecule(self, mol):
            self.axes.clear()
            
            conf = mol.GetConformer()
            num_atoms = mol.GetNumAtoms()
            
            element_colors = {
                'C': 'gray', 'O': 'red', 'N': 'blue', 'H': 'black', 
                'S': 'yellow', 'P': 'orange', 'F': 'green', 'Cl': 'lime', 'Br': 'maroon',
                'I': 'purple'
            }

            atom_coords = []
            atom_colors = []
            
            for i in range(num_atoms):
                atom = mol.GetAtomWithIdx(i)
                pos = conf.GetAtomPosition(i)
                x, y, z = pos.x, pos.y, pos.z
                
                atom_coords.append([x, y, z])
                symbol = atom.GetSymbol()
                
                color = element_colors.get(symbol, 'magenta') 
                atom_colors.append(color)

            atom_coords = np.array(atom_coords)
            
            self.axes.scatter(
                atom_coords[:, 0], atom_coords[:, 1], atom_coords[:, 2], 
                c=atom_colors, s=200, marker='o'
            )

            for bond in mol.GetBonds():
                i = bond.GetBeginAtomIdx()
                j = bond.GetEndAtomIdx()
                
                p1 = conf.GetAtomPosition(i)
                p2 = conf.GetAtomPosition(j)
                
                xs = [p1.x, p2.x]
                ys = [p1.y, p2.y]
                zs = [p1.z, p2.z]
                
                self.axes.plot(xs, ys, zs, color='k', linewidth=2)

            self.axes.set_title("3D Molecule Plot")
            self.axes.view_init(elev=20., azim=30)
            
            # Re-enabling axes and setting colors to light gray
            self.axes.set_axis_on()
            self.axes.set_xlabel('X')
            self.axes.set_ylabel('Y')
            self.axes.set_zlabel('Z')
            self.axes.grid(True)
            self.axes.set_facecolor('#E0E0E0') 
            self.figure.patch.set_facecolor('#E0E0E0')
            
            x_min, x_max = atom_coords[:, 0].min(), atom_coords[:, 0].max()
            y_min, y_max = atom_coords[:, 1].min(), atom_coords[:, 1].max()
            z_min, z_max = atom_coords[:, 2].min(), atom_coords[:, 2].max()

            x_range = x_max - x_min
            y_range = y_max - y_min
            z_range = z_max - z_min
            max_range_coord = np.array([x_range, y_range, z_range]).max() / 2.0
            
            mid_x = (x_max + x_min) * 0.5
            mid_y = (y_max + y_min) * 0.5
            mid_z = (z_max + z_min) * 0.5
            
            self.initial_ranges = (mid_x - max_range_coord, mid_x + max_range_coord,
                                   mid_y - max_range_coord, mid_y + max_range_coord,
                                   mid_z - max_range_coord, mid_z + max_range_coord)

            self.update_limits()


    class MoleculeViewerWindow(QMainWindow):
        
        def __init__(self, mol):
            super().__init__()
            self.setWindowTitle("3D Molecule Viewer (Matplotlib/PyQt)")
            self.setGeometry(100, 100, 800, 700)

            central_widget = QWidget()
            self.setCentralWidget(central_widget)
            layout = QVBoxLayout(central_widget)

            self.plot_canvas = MoleculesPlotCanvas(mol)
            layout.addWidget(self.plot_canvas)
            
            print("✅ 3D viewer running in a native PyQt pop-up window using Matplotlib.")
            print("💡 The Matplotlib plot is rotatable/zoomable using the mouse.")
            
    PYQT_AVAILABLE = True

except ImportError as e:
    print(f"ERROR: Failed to import required modules: {e}")
    print("Ensure PyQt6, PyQt6-WebEngine (for the file dialog), and Matplotlib (with its Qt backend) are installed.")
    print("If Matplotlib is installed, try running: 'pip install PyQt6' and 'pip install matplotlib'")
    
    class MoleculesPlotCanvas: pass
    class MoleculeViewerWindow: pass

    PYQT_AVAILABLE = False
    

def read_xyz(filename):
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
        print(f"Warning: Failed to sanitize molecule for visualization: {e}")
        pass
        
    return mol.GetMol()

def save_2d_molecule_image(mol, filename="molecule_2d.png"):
    
    try:
        AllChem.Compute2DCoords(mol)
        img = Draw.MolToImage(mol, size=(400, 400))
        img.save(filename)
        print(f"🖼️ 2D molecule image saved as: {filename}")
    except Exception as e:
        print(f"❌ Failed to save 2D molecule image: {e}")


def choose_and_display():
    
    root = tk.Tk()
    root.withdraw() 

    filename = filedialog.askopenfilename(
        title="Select an XYZ file",
        filetypes=[("XYZ files", "*.xyz"), ("All files", "*.*")]
    )

    if not filename:
        print("❌ No file selected.")
        root.destroy()
        return

    print(f"📄 Loaded file: {filename}")
    
    atoms, coords = read_xyz(filename)
    mol = guess_bonds_and_create_mol(atoms, coords)

    save_2d_molecule_image(mol)

    if PYQT_AVAILABLE:
        app = QApplication(sys.argv)
        viewer_window = MoleculeViewerWindow(mol)
        viewer_window.show()
        sys.exit(app.exec())
    else:
        print("\nFATAL ERROR: The Matplotlib/PyQt environment is not configured correctly.")
        print("Please review the printed error message and ensure the necessary packages are fully installed and compatible.")

    root.destroy()
    

if __name__ == "__main__":
    choose_and_display()

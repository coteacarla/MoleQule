"""
Example test cases for the Quantum Chemistry API
Run with: pytest tests/test_api.py
"""
import pytest
from app import create_app
from config.settings import Config


@pytest.fixture
def client():
    """Create test client"""
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_health_check(client):
    """Test health check endpoint"""
    response = client.get('/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'healthy'
    assert 'service' in data


def test_build_molecule_success(client):
    """Test successful molecule building"""
    response = client.post('/api/v1/molecule/build', json={
        'session_id': 'test_h2',
        'xyz_data': 'H 0.0 0.0 0.0\nH 0.0 0.0 0.74',
        'basis': 'sto-3g',
        'charge': 0,
        'spin': 0
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert data['natom'] == 2
    assert data['nelectron'] == 2


def test_build_molecule_missing_xyz(client):
    """Test molecule building with missing XYZ data"""
    response = client.post('/api/v1/molecule/build', json={
        'session_id': 'test_fail',
        'basis': 'sto-3g'
    })
    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data


def test_session_list(client):
    """Test session listing"""
    # Create a session first
    client.post('/api/v1/molecule/build', json={
        'session_id': 'test_list',
        'xyz_data': 'H 0.0 0.0 0.0\nH 0.0 0.0 0.74',
        'basis': 'sto-3g'
    })
    
    # List sessions
    response = client.get('/api/v1/session/list')
    assert response.status_code == 200
    data = response.get_json()
    assert 'sessions' in data
    assert 'test_list' in data['sessions']


def test_session_info(client):
    """Test session info retrieval"""
    # Create a session
    session_id = 'test_info'
    client.post('/api/v1/molecule/build', json={
        'session_id': session_id,
        'xyz_data': 'H 0.0 0.0 0.0\nH 0.0 0.0 0.74',
        'basis': 'sto-3g'
    })
    
    # Get info
    response = client.get(f'/api/v1/session/info?session_id={session_id}')
    assert response.status_code == 200
    data = response.get_json()
    assert data['session_id'] == session_id
    assert data['molecule_built'] == True


def test_session_delete(client):
    """Test session deletion"""
    # Create a session
    session_id = 'test_delete'
    client.post('/api/v1/molecule/build', json={
        'session_id': session_id,
        'xyz_data': 'H 0.0 0.0 0.0\nH 0.0 0.0 0.74',
        'basis': 'sto-3g'
    })
    
    # Delete session
    response = client.delete('/api/v1/session/delete', json={
        'session_id': session_id
    })
    assert response.status_code == 200
    
    # Verify deletion
    response = client.get(f'/api/v1/session/info?session_id={session_id}')
    assert response.status_code == 404


def test_scf_without_molecule(client):
    """Test SCF run without building molecule first"""
    response = client.post('/api/v1/scf/run', json={
        'session_id': 'nonexistent'
    })
    assert response.status_code == 404
    data = response.get_json()
    assert 'error' in data


def test_full_workflow_h2(client):
    """Test complete workflow for H2 molecule"""
    session_id = 'test_h2_workflow'
    
    # 1. Build molecule
    response = client.post('/api/v1/molecule/build', json={
        'session_id': session_id,
        'xyz_data': 'H 0.0 0.0 0.0\nH 0.0 0.0 0.74',
        'basis': 'sto-3g'
    })
    assert response.status_code == 200
    
    # 2. Run SCF
    response = client.post('/api/v1/scf/run', json={
        'session_id': session_id
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['converged'] == True
    
    # 3. Setup active space
    response = client.post('/api/v1/active-space/setup', json={
        'session_id': session_id,
        'mode': 'homo_lumo',
        'n_below_homo': 1,
        'n_above_lumo': 1
    })
    assert response.status_code == 200
    
    # 4. Compute integrals
    response = client.post('/api/v1/integrals/compute', json={
        'session_id': session_id
    })
    assert response.status_code == 200
    
    # 5. Build circuit
    response = client.post('/api/v1/circuit/build', json={
        'session_id': session_id,
        'n_reps': 1
    })
    assert response.status_code == 200
    data = response.get_json()
    assert 'num_qubits' in data
    assert data['num_qubits'] == 4  # 2 orbitals * 2


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

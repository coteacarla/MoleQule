# Contributing Guide

## Development Setup

### 1. Clone and Setup
```bash
git clone <repository>
cd qiskit-project


### 2. Install Backend Dependencies
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Install Frontend Dependencies
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
cd interface-react
npm install
cd ..
```

**Terminal 1 - Backend:**
```bash
source venv/bin/activate
python app.py
# Runs on http://localhost:5000
```

**Terminal 2 - Frontend (React):**
```bash
cd interface-react
npm run dev
# Runs on http://localhost:5173
```
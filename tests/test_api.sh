#!/bin/bash
# Helper script for common API testing tasks

API_URL="http://localhost:5000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Quantum Chemistry API Test Helper   ║${NC}"
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo ""

# Function to test health
test_health() {
    echo -e "${YELLOW}Testing health endpoint...${NC}"
    curl -s "$API_URL/health" | python3 -m json.tool
    echo ""
}

# Function to create TRA-azo session
create_tra_azo() {
    SESSION_ID=${1:-"tra_azo"}
    echo -e "${YELLOW}Creating TRA-azo molecule session: $SESSION_ID${NC}"
    
    # Get script directory and find data folder
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
    XYZ_FILE="$PROJECT_ROOT/documents/TRA-azo.xyz"
    
    if [ ! -f "$XYZ_FILE" ]; then
        echo -e "${RED}Error: TRA-azo.xyz file not found at $XYZ_FILE${NC}"
        return 1
    fi
    
    # Read XYZ data (skip first 2 lines) and create proper JSON using Python
    XYZ_DATA=$(tail -n +3 "$XYZ_FILE")
    
    # Use Python to build proper JSON with escaped newlines
    JSON_PAYLOAD=$(python3 -c "
import json
xyz_data = '''$XYZ_DATA'''
payload = {
    'session_id': '$SESSION_ID',
    'basis': '6-31g',
    'charge': 0,
    'spin': 0,
    'xyz_data': xyz_data
}
print(json.dumps(payload))
")
    
    curl -s -X POST "$API_URL/api/v1/molecule/build" \
        -H "Content-Type: application/json" \
        -d "$JSON_PAYLOAD" | python3 -m json.tool
    echo ""
}

# Function to run complete workflow
run_workflow() {
    SESSION_ID=${1:-"test_workflow"}
    echo -e "${GREEN}Running complete workflow for session: $SESSION_ID${NC}"
    echo ""
    
    # 1. Build molecule
    echo -e "${YELLOW}Step 1: Building molecule...${NC}"
    curl -s -X POST "$API_URL/api/v1/molecule/build" \
        -H "Content-Type: application/json" \
        -d "{
            \"session_id\": \"$SESSION_ID\",
            \"basis\": \"6-31g\",
            \"xyz_data\": \"H 0.0 0.0 0.0\nH 0.0 0.0 0.74\"
        }" | python3 -m json.tool
    echo ""
    
    # 2. Run SCF
    echo -e "${YELLOW}Step 2: Running SCF...${NC}"
    curl -s -X POST "$API_URL/api/v1/scf/run" \
        -H "Content-Type: application/json" \
        -d "{\"session_id\": \"$SESSION_ID\"}" | python3 -m json.tool
    echo ""
    
    # 3. Setup active space
    echo -e "${YELLOW}Step 3: Setting up active space...${NC}"
    curl -s -X POST "$API_URL/api/v1/active-space/setup" \
        -H "Content-Type: application/json" \
        -d "{
            \"session_id\": \"$SESSION_ID\",
            \"mode\": \"homo_lumo\",
            \"n_below_homo\": 2,
            \"n_above_lumo\": 2
        }" | python3 -m json.tool
    echo ""
    
    # 4. Compute integrals
    echo -e "${YELLOW}Step 4: Computing integrals...${NC}"
    curl -s -X POST "$API_URL/api/v1/integrals/compute" \
        -H "Content-Type: application/json" \
        -d "{\"session_id\": \"$SESSION_ID\"}" | python3 -m json.tool
    echo ""
    
    # 5. Build circuit
    echo -e "${YELLOW}Step 5: Building circuit...${NC}"
    curl -s -X POST "$API_URL/api/v1/circuit/build" \
        -H "Content-Type: application/json" \
        -d "{\"session_id\": \"$SESSION_ID\", \"n_reps\": 1}" | python3 -m json.tool
    echo ""
    
    # 6. Check status
    echo -e "${YELLOW}Step 6: Checking session status...${NC}"
    curl -s "$API_URL/api/v1/session/info?session_id=$SESSION_ID" | python3 -m json.tool
    echo ""
    
    echo -e "${GREEN}✅ Workflow complete!${NC}"
}

# Function to list sessions
list_sessions() {
    echo -e "${YELLOW}Listing all sessions...${NC}"
    curl -s "$API_URL/api/v1/session/list" | python3 -m json.tool
    echo ""
}

# Function to get session info
session_info() {
    SESSION_ID=${1:-"default"}
    echo -e "${YELLOW}Getting info for session: $SESSION_ID${NC}"
    curl -s "$API_URL/api/v1/session/info?session_id=$SESSION_ID" | python3 -m json.tool
    echo ""
}

# Function to delete session
delete_session() {
    SESSION_ID=${1:-"default"}
    echo -e "${YELLOW}Deleting session: $SESSION_ID${NC}"
    curl -s -X DELETE "$API_URL/api/v1/session/delete" \
        -H "Content-Type: application/json" \
        -d "{\"session_id\": \"$SESSION_ID\"}" | python3 -m json.tool
    echo ""
}

# Menu
case "$1" in
    health)
        test_health
        ;;
    tra-azo)
        create_tra_azo "$2"
        ;;
    workflow)
        run_workflow "$2"
        ;;
    list)
        list_sessions
        ;;
    info)
        session_info "$2"
        ;;
    delete)
        delete_session "$2"
        ;;
    *)
        echo "Usage: $0 {health|tra-azo|workflow|list|info|delete} [session_id]"
        echo ""
        echo "Commands:"
        echo "  health           - Test health endpoint"
        echo "  tra-azo [id]     - Create TRA-azo molecule session"
        echo "  workflow [id]    - Run complete H2 workflow"
        echo "  list             - List all sessions"
        echo "  info [id]        - Get session information"
        echo "  delete [id]      - Delete a session"
        echo ""
        echo "Examples:"
        echo "  $0 health"
        echo "  $0 tra-azo my_session"
        echo "  $0 workflow test"
        echo "  $0 info my_session"
        exit 1
        ;;
esac

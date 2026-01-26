#!/bin/bash

# ChatGPT App Template - Setup Script
# This script sets up the repository for the first time

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_step() {
    echo -e "\n${GREEN}==>${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

echo_error() {
    echo -e "${RED}Error:${NC} $1"
}

# Check for required commands
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo_error "$1 is required but not installed."
        return 1
    fi
}

echo_step "Checking prerequisites..."

# Check for pnpm
if ! check_command pnpm; then
    echo "Please install pnpm: https://pnpm.io/installation"
    exit 1
fi

# Check for Python 3.12+
if ! check_command python3; then
    echo "Please install Python 3.12 or later"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 12 ]); then
    echo_error "Python 3.12 or later is required. Found: Python $PYTHON_VERSION"
    exit 1
fi

echo "  pnpm: $(pnpm --version)"
echo "  python: $PYTHON_VERSION"

# Install Node.js dependencies
echo_step "Installing Node.js dependencies..."
pnpm install

# Set up Python virtual environment
echo_step "Setting up Python virtual environment..."
cd server

if [ -d ".venv" ]; then
    echo "  Virtual environment already exists, skipping creation"
else
    python3 -m venv .venv
    echo "  Created virtual environment"
fi

# Activate venv and install dependencies
echo_step "Installing Python dependencies..."

# Check if uv is available (faster), otherwise use pip
if command -v uv &> /dev/null; then
    echo "  Using uv for package installation"
    uv pip install -e ".[dev]" --python .venv/bin/python
else
    echo "  Using pip for package installation"
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install -e ".[dev]"
fi

cd ..

# Install Playwright for UI testing
echo_step "Installing Playwright browser (Chromium)..."
pnpm run setup:test

# Build the widgets
echo_step "Building widgets..."
pnpm run build

# Run tests
echo_step "Running tests..."
pnpm run test

echo -e "\n${GREEN}✓ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  • Start the server:    pnpm run server"
echo "  • Open the simulator:  http://localhost:8000/assets/simulator.html"
echo "  • Test a widget:       pnpm run ui-test --widget <name>"
echo ""

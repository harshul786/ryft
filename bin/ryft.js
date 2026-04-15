#!/bin/bash
export NODE_OPTIONS="--import tsx"
# Capture the ACTUAL working directory BEFORE we change directories
# This preserves where the user actually ran the command from
ORIGINAL_CWD="$PWD"
# Resolve the actual location of this script (follow symlinks)
SCRIPT_PATH="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)/$(basename "$0")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
# Pass both the original cwd AND the Ryft installation directory to Node
# so skill discovery can find bundled skills regardless of where Ryft is run from
export RYFT_ORIGINAL_CWD="$ORIGINAL_CWD"
export RYFT_INSTALL_DIR="$PROJECT_ROOT"
# Change to project root so relative imports and working directory work correctly
cd "$PROJECT_ROOT"
exec node "$SCRIPT_DIR/cli.ts" "$@"

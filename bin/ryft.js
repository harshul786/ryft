#!/bin/bash
export NODE_OPTIONS="--import tsx"
# Capture the ACTUAL working directory BEFORE we change directories
# This preserves where the user actually ran the command from
ORIGINAL_CWD="$PWD"
# Resolve the actual location of this script (follow symlinks)
SCRIPT_PATH="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)/$(basename "$0")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
# Pass the original cwd to Node so cli.ts can use it (not the project directory)
export RYFT_ORIGINAL_CWD="$ORIGINAL_CWD"
# Change to project root so relative imports and working directory work correctly
cd "$PROJECT_ROOT"
exec node "$SCRIPT_DIR/cli.ts" "$@"

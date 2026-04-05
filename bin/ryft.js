#!/bin/bash
export NODE_OPTIONS="--import tsx"
# Resolve the actual location of this script (follow symlinks)
SCRIPT_PATH="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)/$(basename "$0")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
# Change to project root so relative imports and working directory work correctly
cd "$PROJECT_ROOT"
exec node "$SCRIPT_DIR/cli.ts" "$@"

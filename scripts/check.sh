#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "Checking types..."
bun run typecheck

echo "Checking lint..."
bun run lint

echo "Checking formatting..."
bun run check

echo "Running tests..."
bun run test

echo "Building production bundle..."
bun run build

echo "All checks passed."

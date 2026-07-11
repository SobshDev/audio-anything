#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Generating TanStack routes"
bun run generate-routes

echo "==> Typechecking"
bun run typecheck

echo "==> Linting"
bun run lint

echo "==> Running tests"
bun run test --passWithNoTests

echo "==> Building production bundle"
bun run build

echo "==> All checks passed"

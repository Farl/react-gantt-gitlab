#!/bin/bash

# Kitchen Sink Test Runner
# Opens the Vitest UI with kitchen sink integration tests

echo "Starting Vitest UI for Kitchen Sink tests..."
echo "Tests will be available at: http://localhost:51204/__vitest__/"
echo ""
echo "Press Ctrl+C to stop the server"

npm run test:ui

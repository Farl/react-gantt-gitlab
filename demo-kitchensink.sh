#!/bin/bash

# Simple HTTP server for kitchen sink demo

PORT=3001

echo "Starting Kitchen Sink Demo Server..."
echo "Demo will be available at: http://localhost:${PORT}/kitchen-sink-demo.html"
echo ""

# Kill any existing process on the port
lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true

# Start the server
python3 -m http.server ${PORT} &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Open browser
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:${PORT}/kitchen-sink-demo.html"
elif command -v open &> /dev/null; then
    open "http://localhost:${PORT}/kitchen-sink-demo.html"
elif command -v start &> /dev/null; then
    start "http://localhost:${PORT}/kitchen-sink-demo.html"
else
    echo "Browser auto-open not supported on this system"
    echo "Please open: http://localhost:${PORT}/kitchen-sink-demo.html"
fi

echo ""
echo "Server running in background (PID: $SERVER_PID)"
echo "Press Ctrl+C to stop the server"

# Cleanup on exit
trap "kill $SERVER_PID 2>/dev/null; echo ''; echo 'Server stopped'; exit 0" INT TERM

wait $SERVER_PID

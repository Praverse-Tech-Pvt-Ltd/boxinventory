#!/bin/bash

# Simple test script to call the cancel endpoint
# This script finds a token from browser cookies and uses it to test the API

echo "To test the cancel endpoint:"
echo "1. Log in to the application at http://localhost:5173"
echo "2. Open Developer Tools (F12)"
echo "3. Go to Application > Cookies > http://localhost:5173"
echo "4. Copy the 'token' value"
echo "5. Run the following command (replace TOKEN with the copied token):"
echo ""
echo "curl -X POST http://localhost:5000/api/challans/CHALLAN_ID/cancel \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Cookie: token=TOKEN' \\"
echo "  -d '{\"reason\": \"Test cancellation\"}'"
echo ""
echo "Watch the backend terminal for [cancelChallan] logs to see what's happening"

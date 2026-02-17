#!/bin/bash
# Challan Cancellation Troubleshooting Guide

echo "========================================="
echo "Challan Cancel Feature - Debug Checklist"
echo "========================================="
echo ""

# Step 1: Check backend is running
echo "1️⃣  Checking if backend is running..."
if curl -s http://localhost:5000/api/challans/test/auth-status > /dev/null 2>&1; then
  echo "✅ Backend is running on port 5000"
else
  echo "❌ Backend is NOT running. Start it with: npm start (in backend dir)"
  exit 1
fi

echo ""
echo "2️⃣  User Checklist:"
echo "   - ✋ Make sure you're logged in as an ADMIN user"
echo "   - ✋ Open browser DevTools (F12 or Ctrl+Shift+I)"  
echo "   - ✋ Go to 'Console' tab to see any error messages"
echo "   - ✋ Go to 'Network' tab to see API requests"

echo ""  
echo "3️⃣  To cancel a challan:"
echo "   - Click the red '✕ Cancel' button on a recent challan"
echo "   - Enter a reason in the popup (e.g., 'Wrong items')"
echo "   - Click 'Cancel Challan' button"
echo "   - Watch both the UI and DevTools Console for errors"

echo ""
echo "4️⃣  If you see an error:"
echo "   - Read the error message in the toast notification"
echo "   - Check the Console tab (F12) for detailed errors"
echo "   - Check the Network tab to see API response status"
echo "   - Copy the error and report it"

echo ""
echo "5️⃣  Common Issues:"
echo "   ⚠️  'Not authenticated' → You're not logged in properly"
echo "   ⚠️  'Access denied' → You're not an admin"
echo "   ⚠️  'Challan not found' → The challan ID is wrong"
echo "   ⚠️  'Server error' → There's a backend issue (check backend logs)"
echo ""
echo "========================================="

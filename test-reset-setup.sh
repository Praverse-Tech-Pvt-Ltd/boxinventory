#!/bin/bash
# Test script to verify reset functionality without actually resetting

echo "🧪 Testing Reset Script Setup..."
echo ""

# Check Node.js version
echo "✓ Node.js version:"
node --version
echo ""

# Check if backend directory exists
if [ -d "backend" ]; then
    echo "✓ Backend directory found"
else
    echo "✗ Backend directory not found"
    exit 1
fi

# Check if .env exists
if [ -f "backend/.env" ]; then
    echo "✓ .env file found"
else
    echo "✗ .env file not found"
    exit 1
fi

# Check if package.json has reset:data script
if grep -q '"reset:data"' backend/package.json; then
    echo "✓ reset:data script found in package.json"
else
    echo "✗ reset:data script not found in package.json"
    exit 1
fi

# Check if reset script exists
if [ -f "backend/scripts/resetProductionData.js" ]; then
    echo "✓ resetProductionData.js script found"
else
    echo "✗ resetProductionData.js script not found"
    exit 1
fi

echo ""
echo "📝 To run the actual reset:"
echo ""
echo "  cd backend"
echo "  npm install  # (if not done)"
echo "  RESET_CONFIRM=YES npm run reset:data"
echo ""
echo "⚠️  WARNING: This will delete all data except 2 admin accounts!"
echo ""

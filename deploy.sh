#!/bin/bash
# deploy.sh

echo "Installing backend dependencies..."
cd backend
npm ci --only=production

echo "Installing frontend dependencies..."
cd ../frontend
npm ci

echo "Building frontend..."
npm run build

echo "Deployment preparation complete!"
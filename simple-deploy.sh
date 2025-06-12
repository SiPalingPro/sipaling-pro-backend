#!/bin/bash

echo "🚀 Starting SiPaling.pro deployment..."

# Bersihkan Docker
echo "🧹 Cleaning Docker..."
docker-compose down
docker container prune -f

# Pastikan direktori ada
echo "📁 Creating directories..."
mkdir -p uploads/videos
mkdir -p ssl
chmod 755 uploads uploads/videos

# Deploy
echo "🚀 Deploying services..."
docker-compose up -d app nginx

# Tunggu startup
echo "⏳ Waiting for services to start..."
sleep 10

# Cek health
echo "🔍 Checking service health..."
if curl -s http://localhost:5000/api/health | grep -q "OK"; then
  echo "✅ Service is healthy!"
else
  echo "❌ Service failed to start. Check logs with: docker-compose logs app"
fi

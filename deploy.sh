#!/bin/bash

# SiPaling.pro Deployment Script
echo "🚀 Starting SiPaling.pro deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if port 27017 is in use
if netstat -tlnp | grep :27017 > /dev/null; then
    echo "⚠️  Port 27017 is already in use by MongoDB"
    echo "Choose an option:"
    echo "1. Stop local MongoDB and use Docker MongoDB"
    echo "2. Use local MongoDB (recommended)"
    echo "3. Use MongoDB Atlas"
    read -p "Enter your choice (1-3): " choice
    
    case $choice in
        1)
            echo "🛑 Stopping local MongoDB..."
            sudo systemctl stop mongod 2>/dev/null || true
            sudo pkill mongod 2>/dev/null || true
            ;;
        2)
            echo "📝 Configuring to use local MongoDB..."
            # Update docker-compose.yml to remove mongo service
            sed -i '/mongo:/,/restart: unless-stopped/d' docker-compose.yml
            sed -i 's/mongodb:\/\/mongo:27017/mongodb:\/\/host.docker.internal:27017/' docker-compose.yml
            ;;
        3)
            echo "☁️  Please update MONGODB_URI in .env with your Atlas connection string"
            read -p "Press enter after updating .env file..."
            # Update docker-compose.yml to remove mongo service
            sed -i '/mongo:/,/restart: unless-stopped/d' docker-compose.yml
            ;;
    esac
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p uploads/videos
mkdir -p ssl
mkdir -p logs

# Set permissions
chmod 755 uploads
chmod 755 uploads/videos

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing."
    echo "   Required: MONGODB_URI, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, RECAPTCHA_SECRET_KEY"
    read -p "Press enter to continue after editing .env file..."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down 2>/dev/null || true

# Build and start services
echo "🐳 Building and starting Docker containers..."
docker-compose build
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Check if services are running
echo "🔍 Checking service health..."
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Backend service is running"
else
    echo "❌ Backend service failed to start"
    echo "📋 Container logs:"
    docker-compose logs app
    exit 1
fi

# Display status
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Service Status:"
docker-compose ps
echo ""
echo "🌐 Access your application:"
echo "   - Backend API: http://localhost:5000"
echo "   - Health Check: http://localhost:5000/api/health"
echo ""
echo "📋 Next steps:"
echo "   1. Configure your domain DNS to point to this server"
echo "   2. Add SSL certificates to ./ssl/ directory"
echo "   3. Update FRONTEND_URL in .env to your domain"
echo "   4. Configure Google OAuth and reCAPTCHA"

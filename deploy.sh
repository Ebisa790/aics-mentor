#!/bin/bash

# Build and deploy with Docker Compose
echo "🚀 Starting deployment..."

# Pull latest images
docker-compose pull

# Build images
docker-compose build

# Run migrations
docker-compose run backend alembic upgrade head

# Start services
docker-compose up -d

echo "✅ Deployment complete!"
echo "Frontend: http://localhost"
echo "Backend: http://localhost:8000"

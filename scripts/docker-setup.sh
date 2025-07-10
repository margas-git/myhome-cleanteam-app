#!/bin/bash

# Docker setup script for MyHome CleanTeam
# This script helps set up the database and run initial migrations

set -e

echo "🐳 Setting up MyHome CleanTeam with Docker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it and try again."
    exit 1
fi

# Function to wait for database to be ready
wait_for_db() {
    echo "⏳ Waiting for database to be ready..."
    until docker-compose exec -T db pg_isready -U postgres -d myhome_cleanteam; do
        sleep 2
    done
    echo "✅ Database is ready!"
}

# Function to run database setup
setup_database() {
    echo "🗄️ Setting up database..."
    
    # Wait for database to be ready
    wait_for_db
    
    # Run database migrations and seed
    echo "📦 Running database migrations and seeding..."
    docker-compose exec app npm run db:setup
    
    echo "✅ Database setup complete!"
}

# Function to start services
start_services() {
    echo "🚀 Starting services..."
    
    # Start the services
    docker-compose up -d
    
    # Wait a bit for services to start
    sleep 10
    
    # Setup database
    setup_database
    
    echo "✅ Services are running!"
    echo "🌐 Application: http://localhost:4000"
    echo "🗄️ Database: localhost:5432"
}

# Function to stop services
stop_services() {
    echo "🛑 Stopping services..."
    docker-compose down
    echo "✅ Services stopped!"
}

# Function to show logs
show_logs() {
    echo "📋 Showing logs..."
    docker-compose logs -f
}

# Function to reset everything
reset_all() {
    echo "🔄 Resetting everything..."
    docker-compose down -v
    docker-compose up -d
    sleep 15
    setup_database
    echo "✅ Reset complete!"
}

# Main script logic
case "${1:-start}" in
    "start")
        start_services
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        stop_services
        start_services
        ;;
    "logs")
        show_logs
        ;;
    "reset")
        reset_all
        ;;
    "setup-db")
        setup_database
        ;;
    "dev")
        echo "🚀 Starting development environment..."
        docker-compose -f docker-compose.dev.yml up -d
        echo "✅ Development environment started!"
        echo "🌐 Application: http://localhost:4000"
        echo "🎨 Client dev server: http://localhost:5173"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|reset|setup-db|dev}"
        echo ""
        echo "Commands:"
        echo "  start      - Start the production services"
        echo "  stop       - Stop all services"
        echo "  restart    - Restart all services"
        echo "  logs       - Show service logs"
        echo "  reset      - Reset everything (database + services)"
        echo "  setup-db   - Setup database only"
        echo "  dev        - Start development environment with hot reloading"
        exit 1
        ;;
esac 
# Docker Setup for MyHome CleanTeam

This Docker setup mimics the Railway deployment environment and provides both production and development configurations.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Environment variables set up (see Environment Variables section)

### Production Setup
```bash
# Start the production environment
./scripts/docker-setup.sh start

# Or manually
docker-compose up -d
```

### Development Setup
```bash
# Start the development environment with hot reloading
./scripts/docker-setup.sh dev

# Or manually
docker-compose -f docker-compose.dev.yml up -d
```

## 📁 Files Overview

### Production Files
- `Dockerfile` - Multi-stage production build
- `docker-compose.yml` - Production services configuration
- `.dockerignore` - Files to exclude from Docker build

### Development Files
- `Dockerfile.dev` - Development build with hot reloading
- `docker-compose.dev.yml` - Development services configuration

### Scripts
- `scripts/docker-setup.sh` - Helper script for common operations

## 🔧 Available Commands

### Using the Setup Script
```bash
# Start production services
./scripts/docker-setup.sh start

# Start development environment
./scripts/docker-setup.sh dev

# Stop all services
./scripts/docker-setup.sh stop

# Restart services
./scripts/docker-setup.sh restart

# View logs
./scripts/docker-setup.sh logs

# Reset everything (database + services)
./scripts/docker-setup.sh reset

# Setup database only
./scripts/docker-setup.sh setup-db
```

### Manual Docker Commands
```bash
# Production
docker-compose up -d
docker-compose down
docker-compose logs -f

# Development
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml logs -f
```

## 🌍 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Required
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
JWT_SECRET=your_jwt_secret_here

# Optional (defaults provided)
DATABASE_URL=postgresql://postgres:password@db:5432/myhome_cleanteam
CORS_ORIGIN=http://localhost:4000
PORT=4000
NODE_ENV=production
```

## 🗄️ Database

The setup includes a PostgreSQL database with:
- **Database**: `myhome_cleanteam`
- **User**: `postgres`
- **Password**: `password`
- **Port**: `5432` (accessible from host)

### Database Operations
```bash
# Run migrations and seed data
docker-compose exec app npm run db:setup

# Run migrations only
docker-compose exec app npm run db:push

# Generate new migrations
docker-compose exec app npm run db:generate
```

## 🔍 Health Checks

The setup includes health checks for both the application and database:

- **Application**: `http://localhost:4000/api/health`
- **Database**: PostgreSQL readiness check

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Check what's using the port
   lsof -i :4000
   lsof -i :5432
   
   # Stop conflicting services
   docker-compose down
   ```

2. **Database connection issues**
   ```bash
   # Check database logs
   docker-compose logs db
   
   # Restart database
   docker-compose restart db
   ```

3. **Build issues**
   ```bash
   # Rebuild without cache
   docker-compose build --no-cache
   ```

4. **Permission issues**
   ```bash
   # Fix script permissions
   chmod +x scripts/docker-setup.sh
   ```

### Logs and Debugging
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
docker-compose logs -f db

# Access container shell
docker-compose exec app sh
docker-compose exec db psql -U postgres -d myhome_cleanteam
```

## 🔄 Railway Migration

This Docker setup is designed to mimic Railway's deployment:

### Railway vs Docker Comparison

| Feature | Railway | Docker |
|---------|---------|--------|
| **Build Process** | Nixpacks | Multi-stage Dockerfile |
| **Health Check** | `/api/health` | `/api/health` |
| **Restart Policy** | `on_failure` | `unless-stopped` |
| **Database** | Railway PostgreSQL | Local PostgreSQL |
| **Environment** | Railway env vars | `.env` file |

### Migration Steps
1. Set up environment variables in `.env`
2. Run `./scripts/docker-setup.sh start`
3. Verify health check at `http://localhost:4000/api/health`

## 📊 Performance

### Production Optimizations
- Multi-stage Docker build
- Alpine Linux base image
- Non-root user for security
- Optimized layer caching
- Health checks for reliability

### Development Features
- Hot reloading for both client and server
- Volume mounting for live code changes
- Development dependencies included
- Separate development database

## 🔐 Security

- Non-root user in production containers
- Environment variables for sensitive data
- CORS configuration for production
- Helmet.js security headers (production only)

## 📝 Notes

- The development setup includes all dependencies for hot reloading
- Production setup uses optimized build with only production dependencies
- Database data persists in Docker volumes
- Health checks ensure service reliability
- Scripts provide convenient management commands

## 🆘 Support

If you encounter issues:

1. Check the logs: `./scripts/docker-setup.sh logs`
2. Verify environment variables are set
3. Ensure Docker and Docker Compose are running
4. Try resetting: `./scripts/docker-setup.sh reset` 
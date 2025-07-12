# Railway Environment Variables Setup

## Required Environment Variables

Configure these in your Railway project dashboard:

### Database
- `DATABASE_URL` - Railway will provide this automatically when you add a PostgreSQL database

### Google Maps API
- `GOOGLE_MAPS_API_KEY` - Your Google Maps API key

### Security
- `JWT_SECRET` - A secure random string for JWT token signing
- `NODE_ENV=production` - Railway sets this automatically

### Optional
- `CORS_ORIGIN` - Your Railway app URL (auto-detected if not set)

## Setup Steps
1. Go to your Railway project dashboard
2. Navigate to "Variables" tab
3. Add each variable above
4. For `JWT_SECRET`, generate a secure random string
5. Add your Google Maps API key to `GOOGLE_MAPS_API_KEY`

## Database Setup
1. Add a PostgreSQL database in Railway
2. Railway will automatically set `DATABASE_URL`
3. The app will automatically run migrations on first deploy 
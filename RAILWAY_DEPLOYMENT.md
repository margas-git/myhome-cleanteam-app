# Railway Deployment Guide

## Prerequisites
- Railway account
- Google Maps API key
- Git repository connected to Railway

## Step 1: Connect Repository
1. Go to [Railway Dashboard](https://railway.app)
2. Create new project
3. Connect your GitHub repository
4. Select the `main` branch (or your preferred branch)

## Step 2: Add PostgreSQL Database
1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically set `DATABASE_URL` environment variable

## Step 3: Configure Environment Variables
Add these variables in Railway project settings:

### Required Variables
```
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
JWT_SECRET=your_secure_random_string_here
NODE_ENV=production
```

### Optional Variables
```
CORS_ORIGIN=https://your-app-name.up.railway.app
```

## Step 4: Deploy
1. Railway will automatically detect the build process
2. The `postinstall` script will run database migrations
3. The app will start with `npm start`

## Step 5: Verify Deployment
1. Check the deployment logs in Railway dashboard
2. Visit your app URL: `https://your-app-name.up.railway.app`
3. Test the health endpoint: `/api/health`

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Check Railway PostgreSQL logs
- Ensure database is provisioned

### Build Failures
- Check Railway build logs
- Verify all dependencies are in `package.json`
- Ensure TypeScript compilation succeeds

### Runtime Errors
- Check Railway deployment logs
- Verify environment variables are set
- Test database connection

## Monitoring
- Railway provides built-in monitoring
- Check logs in Railway dashboard
- Monitor database performance
- Set up alerts for downtime

## Updates
- Push to your connected branch to trigger automatic deployment
- Railway will rebuild and redeploy automatically
- Database migrations run on each deployment 
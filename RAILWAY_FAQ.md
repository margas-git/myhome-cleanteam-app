# Railway Deployment FAQ

## File Structure Issues

### Q: Will Railway know where the pages are with regards to /client/dist etc.?

**A: Yes, but we've made specific adjustments:**

1. **Static File Paths**: The server now detects the environment and uses the correct paths:
   - **Development**: `../client/dist` (relative to server directory)
   - **Production (Railway)**: `../../client/dist` (from built server location)

2. **Build Verification**: Added `scripts/verify-build.js` to check that all required files exist after build

3. **Railway Build Process**: 
   - Railway uses Nixpacks (not Docker)
   - Files are built in the root directory
   - The server runs from `dist/server/index.js`
   - Static files are served from `client/dist/`

## Common Issues & Solutions

### Build Failures
- **Issue**: Missing dependencies
- **Solution**: All dependencies are in `package.json`

### Static Files Not Found
- **Issue**: Wrong file paths
- **Solution**: Environment-aware path resolution in `server/server.ts`

### Database Connection Issues
- **Issue**: DATABASE_URL not set
- **Solution**: Add PostgreSQL database in Railway dashboard

### Health Check Failures
- **Issue**: App not starting properly
- **Solution**: Check Railway logs for startup errors

## File Structure After Build
```
/
├── dist/
│   └── server/
│       └── index.js          # Built server
├── client/
│   └── dist/
│       ├── index.html        # React app
│       └── assets/           # Built assets
└── package.json
```

## Verification Steps
1. Build runs: `npm run railway:build`
2. Verification script checks all files exist
3. Server starts with proper static file serving
4. Health check passes: `/api/health`
5. React app loads correctly

## Debugging
- Check Railway deployment logs
- Verify environment variables are set
- Test database connection
- Check static file paths in server logs 
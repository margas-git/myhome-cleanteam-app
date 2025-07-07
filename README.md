# MyHome CleanTeam

A comprehensive cleaning service management application with admin and staff portals.

## Features

### Staff Portal
- Clock in/out for jobs
- View nearby customers and job assignments
- Track work progress with timers
- Manage lunch breaks
- View completed work for the day

### Admin Portal
- Dashboard with real-time metrics (active cleans, revenue, wage ratios)
- Customer management (add, edit, archive customers)
- Team management (create teams, assign staff)
- Staff directory management
- Reports and timesheets
- System settings (lunch breaks, geolocation radius, price tiers)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + shadcn/ui + wouter
- **Backend**: Express.js API
- **Database**: PostgreSQL with Drizzle ORM
- **Deployment**: Railway-ready with unified build
- **Maps**: Google Maps integration for location services
- **PWA**: Progressive Web App with offline support

## Project Structure

```
/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── config/        # Configuration files
│   │   └── utils/         # Utility functions
│   └── dist/              # Built frontend files
├── server/                # Express backend
│   ├── db/               # Database schema and connection
│   ├── routes/           # API route handlers
│   ├── middleware/       # Express middleware
│   └── index.ts          # Server entry point
├── database/             # Database migrations
└── package.json          # Unified dependencies
```

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up the database:**
   ```bash
   npm run db:push
   npm run seed
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

## Development

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:4000
- **Database**: PostgreSQL (configure in .env)

## Deployment

This project is configured for Railway deployment with a unified build process.

## License

Private - MyHome CleanTeam

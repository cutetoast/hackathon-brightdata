# Crypto Tracker Backend

This is the backend service for the Crypto Tracker application. It consists of two main components:
1. REST API server
2. Crypto data scraper

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the backend directory with the following variables:
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
BROWSER_WS=your_browser_ws_endpoint
PORT=3001
```

3. Run the services:
```bash
# Start API server
npm start

# Start scraper
npm run start:scraper
```

## Deployment to Railway

1. Create a new project on Railway
2. Connect your GitHub repository
3. Add the environment variables in Railway dashboard
4. Railway will automatically detect the Procfile and run both services

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/crypto` - Get all crypto data (latest 100 entries)
- `GET /api/crypto/latest` - Get the latest crypto data entry

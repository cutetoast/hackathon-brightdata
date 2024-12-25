# Crypto Tracker Frontend

Next.js frontend for the Crypto Tracker application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file with:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

3. Run the development server:
```bash
npm run dev
```

## Deployment to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard:
   - For production: Set `NEXT_PUBLIC_API_URL` to your Railway backend URL
4. Deploy!

## Features

- Real-time crypto price tracking
- Responsive design with Tailwind CSS
- Automatic data refresh every minute
- TypeScript for better type safety

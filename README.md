# ContactHub

A full-stack web application for managing phone contacts and groups, built with React, TypeScript, Express, and PostgreSQL.

## Features

- User authentication (signup/login)
- Contact management (CRUD operations)
- Group management with scheduling
- Message logging
- Responsive UI with shadcn/ui components

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: TanStack Query

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd contact-book
   ```

2. Install dependencies:
   ```bash
   npm install
   npm install firebase
   npm install -g firebase-tools
   ```

3. Set up environment variables:
   Create a `.env` file with:
   ```
   DATABASE_URL=your_postgresql_connection_string
   ```

4. Push database schema:
   ```bash
   npm run db:push
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Run TypeScript checks
- `npm run db:push` - Push database schema changes

## Project Structure

```
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and schemas
├── script/          # Build scripts
└── migrations/      # Database migrations
```

## Deployment

The app is configured for deployment on platforms like Vercel, Netlify, or Railway. Make sure to set the `DATABASE_URL` environment variable in your deployment platform.

## License

MIT


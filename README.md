# History Map Application

An interactive historical map application.

## Features

-   **Interactive Historical Map**: Explore historical events, people, and places on a dynamic map
-   **Vector Search**: Advanced semantic search using Pinecone
-   **User Authentication**: Secure login with Clerk and JWT tokens
-   **Subscription Tiers**:
    -   Student: Basic access to maps and events
    -   Scholar: Enhanced access with advanced search features
    -   Historian: Full access with data analysis capabilities
-   **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

-   **Frontend**: Next.js with React, TypeScript
-   **Backend**: FastAPI (Python)
-   **Authentication**: Clerk + JWT for backend API protection
-   **Vector Database**: Pinecone
-   **Database**: PostgreSQL
-   **Styling**: CSS with Tailwind

## Getting Started

### Prerequisites

-   Node.js 18+ and npm
-   Python 3.9+
-   PostgreSQL
-   Clerk account
-   Pinecone account
-   OpenAI API key

### Environment Variables

Create a `.env.local` file in the root directory with:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_pub_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

And a `.env` file for the backend with:

```
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=history-map
JWT_SECRET=your_secret_key
DATABASE_URL=postgresql://user:password@localhost:5432/history_map_db
```

### Installation

1. **Frontend (Next.js)**

```bash
npm install
npm run dev
```

2. **Backend (FastAPI)**

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

## Usage

1. Sign up or sign in with Clerk
2. The application will automatically create a backend user for you with Student tier
3. Explore the interactive map by searching for historical topics
4. View your profile and upgrade your subscription tier as needed
5. Access advanced search features (Scholar tier) and data analysis (Historian tier)

## Subscription Features

### Student Tier

-   Basic map viewing
-   Limited event search results
-   Access to main timeline features

### Scholar Tier

-   All Student features
-   Advanced semantic search
-   More search results
-   AI-generated event suggestions

### Historian Tier

-   All Scholar features
-   Historical data analysis
-   Maximum search results
-   Premium data access

## Project Structure

```
history-map/
├── src/                 # Frontend source code
│   ├── app/             # Next.js pages and components
│   ├── contexts/        # React contexts for state management
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── backend/             # FastAPI backend service
│   ├── models/          # Pydantic models
│   ├── routes/          # API endpoints
│   └── services/        # Business logic
└── database/            # Database migration scripts
```

## Learn More

To learn more about Next.js, take a look at the following resources:

-   [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
-   [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

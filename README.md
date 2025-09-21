# Health Journey

A comprehensive healthcare platform that streamlines patient care from intake through consultation to documentation. Features AI-powered form generation, voice-enabled intake, and automated PHI redaction.

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.8+
- PostgreSQL
- Docker (optional)

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Setup Database
```bash
# Start PostgreSQL
docker-compose up db -d

# Run migrations
cd frontend
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

### 3. Start Application
```bash
# Start frontend (Next.js)
npm run dev

# Start backend (optional)
cd backend
uvicorn app.main:app --reload --port 8000
```

### 4. Run Tests
```bash
# Run all tests
npm run test:all

# Run specific tests
npm run test:latency      # Performance tests
npm run test:grounding    # Citation validation
npm run test:redaction    # PHI protection tests
```

## Project Structure
```
├── frontend/     # Next.js app (UI, API routes, database)
├── backend/      # Python FastAPI (AI services)
└── tests/        # Test suites
```

## Key Features
- **Voice Intake**: Speech-to-text patient intake with LangGraph
- **AI Forms**: Automated form generation with RAG and PHI redaction
- **Security**: Audit logging, RBAC, data encryption
- **Testing**: Comprehensive test suite for alignment and performance

## Development
```bash
npm run dev          # Start frontend
npm run build        # Build for production
npm run lint         # Run ESLint
```

## Testing
```bash
npm run test:all     # All tests
npm run test:latency # Performance profiling
npm run test:grounding # Citation validation
npm run test:redaction # PHI redaction tests
```

## Docker
```bash
docker-compose up    # Start all services
```

## Tech Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Prisma
- **Backend**: Python FastAPI, LangChain, Ollama
- **Database**: PostgreSQL
- **AI**: Ollama LLM, RAG with PubMed
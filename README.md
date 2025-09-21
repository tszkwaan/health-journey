# Health Journey

A comprehensive healthcare platform that streamlines patient care from intake through consultation to documentation. Features AI-powered form generation, voice-enabled intake, and automated PHI redaction.

## Demo

### Intake Process
[![Intake Process Demo](https://img.youtube.com/vi/sXoOlSeLNQ4/0.jpg)](https://www.youtube.com/watch?v=sXoOlSeLNQ4)

*Voice-enabled patient intake with real-time transcription*

### Q&A Bot
[![Q&A Bot Demo](https://img.youtube.com/vi/CbsNa307Who/0.jpg)](https://www.youtube.com/watch?v=CbsNa307Who)

*AI-powered Q&A chatbot with PubMed integration*

### Consultation
[![Consultation Demo](https://img.youtube.com/vi/m3mxLIFzTP8/0.jpg)](https://www.youtube.com/watch?v=m3mxLIFzTP8)

*Doctor consultation interface with form generation*

### Summary Generation
[![Summary Generation Demo](https://img.youtube.com/vi/d8RHxhn3quk/0.jpg)](https://www.youtube.com/watch?v=d8RHxhn3quk)

*AI-generated patient summaries and documentation*

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.8+
- Docker (for database and Ollama LLM)

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Setup Services
```bash
# Start database and Ollama LLM
docker compose up db ollama -d

# Run migrations
cd frontend
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

### 3. Start Application
```bash
# Option 1: Start all services with Docker
docker compose up

# Option 2: Start manually
npm run dev  # Frontend only
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
Ensure all services all started to run the tests.
```bash
npm run test:all     # All tests
npm run test:latency # Performance profiling
npm run test:grounding # Citation validation
npm run test:redaction # PHI redaction tests
npm run test:summary # Summary
```

## Docker
```bash
docker compose up    # Start all services
```

## Tech Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Prisma
- **Backend**: Python FastAPI, LangChain
- **Database**: PostgreSQL (Docker)
- **AI**: Ollama LLM (Docker), RAG with PubMed

## Test user accounts:

Doctor
emily.rodriguez@clinic.com
password123

Patient
John Doe
john.doe@example.com
password123
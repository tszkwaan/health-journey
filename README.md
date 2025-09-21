# Health Journey - Healthcare Platform

A comprehensive healthcare platform that streamlines the patient journey from pre-care intake through consultation to post-care documentation.

## Project Structure

```
health-journey/
├── frontend/          # Next.js frontend application
│   ├── src/          # Source code
│   ├── prisma/       # Database schema and migrations
│   ├── public/       # Static assets
│   └── scripts/      # Frontend scripts
├── backend/          # Python FastAPI backend
│   └── app/          # Backend application code
├── tests/            # Test files
│   ├── test_*.py     # Python test files
│   └── run_tests.py  # Test runner
└── docker-compose.yml # Docker configuration
```

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.8+
- PostgreSQL
- Docker (optional)

### Installation

1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

2. **Set up the database:**
   ```bash
   # Start PostgreSQL (if using Docker)
   docker-compose up db -d
   
   # Or use your local PostgreSQL instance
   # Update DATABASE_URL in frontend/.env.local
   ```

3. **Run database migrations:**
   ```bash
   cd frontend
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Seed the database:**
   ```bash
   npm run db:seed
   ```

### Development

1. **Start the frontend:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

2. **Start the backend (optional):**
   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```

3. **Start with Docker:**
   ```bash
   docker-compose up
   ```

### Testing

Run the test suite:

```bash
# Run all tests
npm run test:all

# Run specific tests
npm run test              # Basic summary tests
npm run test:enhanced     # Enhanced summary tests
npm run test:latency      # Latency tests
npm run test:grounding    # Grounding tests
npm run test:redaction    # PHI redaction tests
```

## Features

- **Patient Intake**: Voice-enabled intake chatbot with LangGraph
- **Consultation Management**: Real-time consultation with voice transcription
- **Form Generation**: AI-powered form generation with RAG
- **Security**: PHI redaction, audit logging, RBAC
- **Testing**: Comprehensive test suite for alignment and performance

## Technology Stack

### Frontend
- Next.js 15.5.3 with App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- NextAuth.js

### Backend
- Python FastAPI
- SQLAlchemy
- LangChain/LangGraph
- Ollama LLM

### Testing
- Python pytest-style tests
- Real API endpoint testing
- Performance profiling
- Alignment validation

## Development Commands

```bash
# Frontend commands
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Backend commands
cd backend
uvicorn app.main:app --reload  # Start backend server

# Database commands
cd frontend
npx prisma studio        # Open Prisma Studio
npx prisma migrate dev   # Run migrations
npx prisma generate      # Generate Prisma client
```

## Security Features

- PHI (Protected Health Information) redaction
- Audit logging and trail
- Role-based access control (RBAC)
- Data encryption at rest and in transit
- Consent management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test:all`
5. Submit a pull request

## License

This project is licensed under the MIT License.
# Technology Stack

## Architecture
- **Monorepo Structure**: npm workspaces with shared packages
- **Frontend**: React 18 with TypeScript and Vite
- **Backend**: Node.js with Express and TypeScript
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Containerization**: Docker with Docker Compose

## Frontend Stack
- **Framework**: React 18.2.0 with TypeScript
- **Build Tool**: Vite 4.4.0
- **UI Library**: Material-UI (MUI) 5.14.0
- **Routing**: React Router DOM 6.14.0
- **State Management**: React Query 3.39.0
- **Forms**: React Hook Form 7.45.0
- **Date Handling**: Day.js 1.11.0
- **HTTP Client**: Axios 1.4.0
- **Testing**: Vitest with Testing Library

## Backend Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express 4.18.2
- **Database**: PostgreSQL with pg driver
- **Cache**: Redis with ioredis client
- **Authentication**: JWT with bcrypt
- **Queue System**: Bull (Redis-based)
- **File Upload**: Multer
- **API Documentation**: Swagger with OpenAPI
- **Security**: Helmet, CORS, rate limiting
- **Logging**: Winston
- **Testing**: Jest with Supertest

## Shared Packages
- **Validation**: Zod for schema validation
- **Types**: Shared TypeScript interfaces and types

## Development Tools
- **TypeScript**: 5.1.0 with composite project references
- **Linting**: ESLint with TypeScript and Prettier integration
- **Formatting**: Prettier with consistent configuration
- **Testing**: Jest (backend), Vitest (frontend)
- **Process Management**: Nodemon for development
- **Concurrency**: Concurrently for running multiple services

## Common Commands

### Development
```bash
# Start all services in development mode
npm run dev

# Start individual services
npm run dev:backend
npm run dev:frontend

# Using Docker (recommended)
npm run docker:dev
```

### Building
```bash
# Build all packages
npm run build

# Build shared package first (required for others)
npm run build --workspace=@sma/shared
```

### Testing
```bash
# Run all tests
npm run test

# Run specific test types
npm run test:unit
npm run test:e2e
npm run test:performance
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Code Quality
```bash
# Lint all code
npm run lint
npm run lint:fix

# Format all code
npm run format
npm run format:check
```

### Database
```bash
# Initialize database
npm run db:init --workspace=@sma/backend
npm run db:migrate --workspace=@sma/backend
```

### Production
```bash
# Start production environment
npm run docker:prod
```

## Configuration Requirements
- Node.js 18+ and npm 9+
- Docker and Docker Compose for containerized development
- PostgreSQL 15+ (if running locally)
- Redis 7+ (if running locally)
- Environment variables configured (see .env.example)
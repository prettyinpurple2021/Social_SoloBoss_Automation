# Project Structure

## Monorepo Organization
The project uses npm workspaces with a clear separation of concerns across three main packages.

```
├── packages/
│   ├── frontend/          # React frontend application
│   ├── backend/           # Node.js backend services  
│   └── shared/            # Shared types and utilities
├── docs/                  # Documentation files
├── terraform/             # Infrastructure as code
├── .github/workflows/     # CI/CD pipelines
├── .kiro/                 # Kiro AI assistant configuration
└── docker-compose.*.yml  # Container orchestration
```

## Backend Structure (`packages/backend/src/`)
```
├── database/              # Database connection and migrations
├── docs/                  # API documentation (Swagger/OpenAPI)
├── middleware/            # Express middleware (auth, validation, security)
├── models/                # Data models and database schemas
├── routes/                # API route handlers
├── services/              # Business logic and external integrations
├── test/                  # Test files (unit, integration, e2e, performance)
├── types/                 # TypeScript type definitions
└── index.ts               # Application entry point
```

### Key Backend Directories
- **`services/`**: Contains all business logic including OAuth, scheduling, integrations
- **`models/`**: Database models for User, Post, PlatformConnection, etc.
- **`routes/`**: RESTful API endpoints organized by feature
- **`middleware/`**: Reusable middleware for authentication, validation, security
- **`test/`**: Comprehensive test suite with mocks and utilities

## Frontend Structure (`packages/frontend/src/`)
```
├── components/            # React components
│   ├── Dashboard/         # Dashboard-specific components
│   └── Settings/          # Settings-specific components
├── services/              # API client services
├── test/                  # Frontend tests including e2e
├── types/                 # Frontend-specific types
├── App.tsx                # Main application component
└── main.tsx               # Application entry point
```

## Shared Package (`packages/shared/src/`)
- Common TypeScript interfaces and types
- Shared validation schemas using Zod
- Utilities used by both frontend and backend

## Configuration Files
- **`tsconfig.json`**: TypeScript configuration with project references
- **`.eslintrc.js`**: ESLint configuration with TypeScript and Prettier
- **`.prettierrc`**: Code formatting rules
- **`package.json`**: Workspace configuration and scripts
- **`docker-compose.*.yml`**: Development and production container setup

## Documentation Structure (`docs/`)
- API documentation and guides
- Testing documentation
- User guides
- Deployment instructions

## Infrastructure (`terraform/`)
- Google Cloud Platform deployment configuration
- Infrastructure as code for production environments

## Development Workflow
1. **Shared Package First**: Always build shared package before others
2. **Feature-Based Development**: Organize code by feature, not by file type
3. **Test-Driven Development**: Comprehensive test coverage across all layers
4. **API-First Design**: OpenAPI specification drives backend development
5. **Component-Based Frontend**: Reusable React components with Material-UI

## Naming Conventions
- **Files**: kebab-case for directories, PascalCase for React components
- **Variables**: camelCase for variables and functions
- **Constants**: UPPER_SNAKE_CASE for environment variables
- **Database**: snake_case for table and column names
- **API Routes**: kebab-case for URL paths
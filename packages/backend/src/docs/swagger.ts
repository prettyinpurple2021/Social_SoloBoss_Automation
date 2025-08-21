import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Social Media Automation Platform API',
      version: '1.0.0',
      description: 'A comprehensive API for managing and scheduling posts across multiple social media platforms.',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.sma-platform.com/api'
          : 'http://localhost:3001/api',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
  },
  apis: [
    path.join(__dirname, '../routes/*.ts'),
    path.join(__dirname, '../models/*.ts'),
    path.join(__dirname, './openapi.yaml'),
  ],
};

// Load OpenAPI spec from YAML file
const loadOpenAPISpec = () => {
  try {
    const yamlPath = path.join(__dirname, 'openapi.yaml');
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    return yaml.load(yamlContent) as any;
  } catch (error) {
    console.error('Error loading OpenAPI spec:', error);
    return null;
  }
};

// Generate Swagger specification
const generateSwaggerSpec = () => {
  const yamlSpec = loadOpenAPISpec();
  if (yamlSpec) {
    return yamlSpec;
  }
  
  // Fallback to JSDoc generation if YAML fails
  return swaggerJsdoc(options);
};

// Custom CSS for Swagger UI
const customCss = `
  .swagger-ui .topbar { display: none; }
  .swagger-ui .info { margin: 20px 0; }
  .swagger-ui .info .title { color: #1976d2; }
  .swagger-ui .scheme-container { background: #fafafa; padding: 15px; margin: 20px 0; }
`;

// Swagger UI options
const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  customCss,
  customSiteTitle: 'SMA Platform API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    requestInterceptor: (req: any) => {
      // Add custom headers or modify requests if needed
      return req;
    },
  },
};

export const setupSwagger = (app: Express): void => {
  const specs = generateSwaggerSpec();
  
  if (!specs) {
    console.error('Failed to generate Swagger specification');
    return;
  }

  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(specs, swaggerUiOptions));

  // Serve raw OpenAPI spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // Serve OpenAPI spec in YAML format
  app.get('/api-docs.yaml', (req, res) => {
    res.setHeader('Content-Type', 'text/yaml');
    res.send(yaml.dump(specs));
  });

  console.log('📚 API Documentation available at:');
  console.log(`   - Swagger UI: http://localhost:${process.env.PORT || 3001}/api-docs`);
  console.log(`   - JSON spec: http://localhost:${process.env.PORT || 3001}/api-docs.json`);
  console.log(`   - YAML spec: http://localhost:${process.env.PORT || 3001}/api-docs.yaml`);
};

export { generateSwaggerSpec };
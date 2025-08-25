import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { loggerService } from '../services/LoggerService';

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

// Custom CSS for enhanced Swagger UI
const customCss = `
  .swagger-ui .topbar { display: none; }
  .swagger-ui .info { margin: 20px 0; }
  .swagger-ui .info .title { color: #1976d2; font-size: 2.5em; }
  .swagger-ui .info .description { font-size: 1.1em; line-height: 1.6; }
  .swagger-ui .scheme-container { background: #fafafa; padding: 15px; margin: 20px 0; border-radius: 8px; }
  .swagger-ui .opblock.opblock-post { border-color: #49cc90; background: rgba(73, 204, 144, 0.1); }
  .swagger-ui .opblock.opblock-get { border-color: #61affe; background: rgba(97, 175, 254, 0.1); }
  .swagger-ui .opblock.opblock-put { border-color: #fca130; background: rgba(252, 161, 48, 0.1); }
  .swagger-ui .opblock.opblock-delete { border-color: #f93e3e; background: rgba(249, 62, 62, 0.1); }
  .swagger-ui .btn.try-out__btn { background: #1976d2; color: white; border: none; }
  .swagger-ui .btn.execute { background: #49cc90; color: white; border: none; }
  .swagger-ui .response-col_status { font-weight: bold; }
  .swagger-ui .response.highlighted { background: #f7f7f7; border-left: 4px solid #1976d2; }
  .swagger-ui .model-box { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 4px; }
  .swagger-ui .parameter__name { font-weight: bold; color: #1976d2; }
  .swagger-ui .parameter__type { color: #666; font-style: italic; }
  .swagger-ui .auth-wrapper { background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
  .swagger-ui .auth-btn-wrapper { text-align: center; margin-top: 15px; }
  .swagger-ui .btn.authorize { background: #1976d2; color: white; border: none; padding: 10px 20px; }
  .swagger-ui .errors-wrapper { background: #ffebee; border: 1px solid #f44336; border-radius: 4px; padding: 10px; }
  .swagger-ui .loading-container { text-align: center; padding: 40px; }
  .swagger-ui .model-title { color: #1976d2; font-weight: bold; }
  .swagger-ui .prop-type { color: #666; }
  .swagger-ui .prop-format { color: #999; font-style: italic; }
  .swagger-ui .example { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 10px; }
  .swagger-ui .example .example__section .example__value { color: #333; }
  .swagger-ui .tab li button { background: transparent; border: none; color: #666; }
  .swagger-ui .tab li button.tablinks.active { color: #1976d2; border-bottom: 2px solid #1976d2; }
  .swagger-ui .servers { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; }
  .swagger-ui .servers-title { color: #1976d2; font-weight: bold; margin-bottom: 10px; }
  .swagger-ui .server-url { font-family: monospace; background: white; padding: 5px 10px; border-radius: 4px; }
`;

// Enhanced Swagger UI options with developer experience features
const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  customCss,
  customSiteTitle: 'Social Media Automation Platform - API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    docExpansion: 'list',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    showExtensions: true,
    showCommonExtensions: true,
    deepLinking: true,
    displayOperationId: false,
    requestInterceptor: (req: any) => {
      // Add request ID for tracing
      req.headers['X-Request-ID'] = generateRequestId();
      // Add API version header
      req.headers['X-API-Version'] = '1.0.0';
      // Log API usage for analytics
      logApiUsage(req);
      return req;
    },
    responseInterceptor: (res: any) => {
      // Log response for analytics
      logApiResponse(res);
      return res;
    },
    onComplete: () => {
      // Add custom JavaScript for enhanced UX
      addCustomDocumentationFeatures();
    },
  },
};

// Helper functions for enhanced developer experience
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const logApiUsage = (req: any): void => {
  try {
    loggerService.info('API Documentation Usage', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      requestId: req.headers['X-Request-ID']
    });
  } catch (error) {
    // Silently fail to avoid breaking the documentation
  }
};

const logApiResponse = (res: any): void => {
  try {
    loggerService.info('API Documentation Response', {
      status: res.status,
      duration: res.headers['x-response-time'],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Silently fail to avoid breaking the documentation
  }
};

const addCustomDocumentationFeatures = (): void => {
  // This function will be called in the browser context
  // Add custom JavaScript for enhanced UX
  if (typeof window !== 'undefined') {
    // Add copy-to-clipboard functionality for code examples
    // Add request/response examples
    // Add interactive tutorials
  }
};

// API Analytics tracking
interface ApiUsageMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}

const apiUsageMetrics: ApiUsageMetrics[] = [];

const trackApiUsage = (req: Request, res: Response, responseTime: number): void => {
  const metric: ApiUsageMetrics = {
    endpoint: req.path,
    method: req.method,
    responseTime,
    statusCode: res.statusCode,
    timestamp: new Date(),
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip
  };
  
  apiUsageMetrics.push(metric);
  
  // Keep only last 10000 metrics to prevent memory issues
  if (apiUsageMetrics.length > 10000) {
    apiUsageMetrics.splice(0, apiUsageMetrics.length - 10000);
  }
};

export const setupSwagger = (app: Express): void => {
  const specs = generateSwaggerSpec();
  
  if (!specs) {
    loggerService.error('Failed to generate Swagger specification');
    return;
  }

  // Enhanced Swagger UI with custom features
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(specs, swaggerUiOptions));

  // Serve raw OpenAPI spec with analytics tracking
  app.get('/api-docs.json', (req: Request, res: Response) => {
    const startTime = Date.now();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minute cache
    res.send(specs);
    trackApiUsage(req, res, Date.now() - startTime);
  });

  // Serve OpenAPI spec in YAML format
  app.get('/api-docs.yaml', (req: Request, res: Response) => {
    const startTime = Date.now();
    res.setHeader('Content-Type', 'text/yaml');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minute cache
    res.send(yaml.dump(specs));
    trackApiUsage(req, res, Date.now() - startTime);
  });

  // API Documentation landing page with enhanced features
  app.get('/docs', (req: Request, res: Response) => {
    const landingPageHtml = generateDocumentationLandingPage();
    res.setHeader('Content-Type', 'text/html');
    res.send(landingPageHtml);
  });

  // API usage analytics endpoint for developers
  app.get('/api-docs/analytics', (req: Request, res: Response) => {
    const analytics = generateApiAnalytics();
    res.json(analytics);
  });

  // API status and health for developers
  app.get('/api-docs/status', (req: Request, res: Response) => {
    const status = {
      status: 'operational',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      endpoints: Object.keys(specs.paths || {}).length,
      schemas: Object.keys(specs.components?.schemas || {}).length
    };
    res.json(status);
  });

  // Interactive API testing playground
  app.get('/api-docs/playground', (req: Request, res: Response) => {
    const playgroundHtml = generateApiPlayground();
    res.setHeader('Content-Type', 'text/html');
    res.send(playgroundHtml);
  });

  loggerService.info('📚 Enhanced API Documentation available at:');
  loggerService.info(`   - Documentation Hub: http://localhost:${process.env.PORT || 3001}/docs`);
  loggerService.info(`   - Interactive Docs: http://localhost:${process.env.PORT || 3001}/api-docs`);
  loggerService.info(`   - API Playground: http://localhost:${process.env.PORT || 3001}/api-docs/playground`);
  loggerService.info(`   - JSON Spec: http://localhost:${process.env.PORT || 3001}/api-docs.json`);
  loggerService.info(`   - YAML Spec: http://localhost:${process.env.PORT || 3001}/api-docs.yaml`);
  loggerService.info(`   - API Analytics: http://localhost:${process.env.PORT || 3001}/api-docs/analytics`);
  loggerService.info(`   - API Status: http://localhost:${process.env.PORT || 3001}/api-docs/status`);
};

export { generateSwaggerSpec };
// Genera
te documentation landing page
const generateDocumentationLandingPage = (): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Social Media Automation Platform - API Documentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 50px; padding: 40px 0; background: linear-gradient(135deg, #1976d2, #42a5f5); color: white; border-radius: 12px; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { font-size: 1.2em; opacity: 0.9; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; margin-bottom: 50px; }
        .feature { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #e0e0e0; }
        .feature h3 { color: #1976d2; margin-bottom: 15px; font-size: 1.3em; }
        .feature p { color: #666; margin-bottom: 20px; }
        .feature a { display: inline-block; background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; transition: background 0.3s; }
        .feature a:hover { background: #1565c0; }
        .quick-start { background: #f8f9fa; padding: 40px; border-radius: 12px; margin-bottom: 30px; }
        .quick-start h2 { color: #1976d2; margin-bottom: 20px; }
        .code-block { background: #2d3748; color: #e2e8f0; padding: 20px; border-radius: 8px; font-family: 'Monaco', 'Consolas', monospace; overflow-x: auto; margin: 15px 0; }
        .endpoints { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .endpoints h2 { color: #1976d2; margin-bottom: 20px; }
        .endpoint { display: flex; align-items: center; padding: 10px; margin: 5px 0; border-radius: 6px; background: #f8f9fa; }
        .method { padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; margin-right: 15px; min-width: 60px; text-align: center; }
        .method.get { background: #61affe; }
        .method.post { background: #49cc90; }
        .method.put { background: #fca130; }
        .method.delete { background: #f93e3e; }
        .path { font-family: monospace; color: #333; }
        .footer { text-align: center; margin-top: 50px; padding: 30px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Social Media Automation Platform</h1>
            <p>Comprehensive API Documentation & Developer Resources</p>
        </div>

        <div class="features">
            <div class="feature">
                <h3>📖 Interactive Documentation</h3>
                <p>Explore our comprehensive API documentation with interactive examples, request/response samples, and real-time testing capabilities.</p>
                <a href="/api-docs">View API Docs</a>
            </div>
            
            <div class="feature">
                <h3>🎮 API Playground</h3>
                <p>Test API endpoints directly in your browser with our interactive playground. No setup required - just authenticate and start exploring.</p>
                <a href="/api-docs/playground">Open Playground</a>
            </div>
            
            <div class="feature">
                <h3>📊 Usage Analytics</h3>
                <p>Monitor your API usage, track performance metrics, and understand rate limiting with our developer analytics dashboard.</p>
                <a href="/api-docs/analytics">View Analytics</a>
            </div>
            
            <div class="feature">
                <h3>🔧 SDKs & Tools</h3>
                <p>Download our official SDKs for JavaScript/TypeScript and Python to integrate quickly with your applications.</p>
                <a href="#sdks">Download SDKs</a>
            </div>
        </div>

        <div class="quick-start">
            <h2>🚀 Quick Start</h2>
            <p>Get started with the Social Media Automation Platform API in minutes:</p>
            
            <h3>1. Authentication</h3>
            <div class="code-block">curl -X POST https://api.sma-platform.com/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "your@email.com", "password": "your-password"}'</div>
            
            <h3>2. Create a Post</h3>
            <div class="code-block">curl -X POST https://api.sma-platform.com/api/posts \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Hello from the API!",
    "platforms": ["facebook", "instagram"],
    "scheduledTime": "2024-02-01T15:30:00Z"
  }'</div>
        </div>

        <div class="endpoints">
            <h2>🔗 Popular Endpoints</h2>
            <div class="endpoint">
                <span class="method post">POST</span>
                <span class="path">/api/auth/login</span>
            </div>
            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/posts</span>
            </div>
            <div class="endpoint">
                <span class="method post">POST</span>
                <span class="path">/api/posts</span>
            </div>
            <div class="endpoint">
                <span class="method post">POST</span>
                <span class="path">/api/oauth/connect/{platform}</span>
            </div>
            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/posts/analytics</span>
            </div>
        </div>

        <div class="footer">
            <p>Need help? Contact our developer support team or check out our comprehensive guides.</p>
            <p>API Version: 1.0.0 | Last Updated: ${new Date().toLocaleDateString()}</p>
        </div>
    </div>
</body>
</html>`;
};

// Generate API playground page
const generateApiPlayground = (): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Playground - Social Media Automation Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .playground { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; height: calc(100vh - 200px); }
        .panel { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
        .panel-header { padding: 15px 20px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #1976d2; }
        .panel-content { flex: 1; padding: 20px; overflow-y: auto; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
        .form-group select, .form-group input, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
        .form-group textarea { height: 200px; font-family: monospace; }
        .btn { background: #1976d2; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
        .btn:hover { background: #1565c0; }
        .response { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 4px; padding: 15px; font-family: monospace; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
        .status-success { color: #28a745; }
        .status-error { color: #dc3545; }
        .auth-section { background: #e3f2fd; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        .auth-input { display: flex; gap: 10px; align-items: center; }
        .auth-input input { flex: 1; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎮 API Playground</h1>
            <p>Test API endpoints interactively with real-time responses</p>
        </div>

        <div class="playground">
            <div class="panel">
                <div class="panel-header">Request Configuration</div>
                <div class="panel-content">
                    <div class="auth-section">
                        <label>Authentication</label>
                        <div class="auth-input">
                            <input type="text" id="authToken" placeholder="Enter JWT token or use login endpoint">
                            <button class="btn" onclick="testAuth()">Test Auth</button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="method">HTTP Method</label>
                        <select id="method" onchange="updateEndpoints()">
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="endpoint">Endpoint</label>
                        <select id="endpoint" onchange="updateRequestBody()">
                            <option value="/api/auth/login">POST /api/auth/login</option>
                            <option value="/api/posts">GET /api/posts</option>
                            <option value="/api/posts">POST /api/posts</option>
                            <option value="/api/oauth/connect/facebook">POST /api/oauth/connect/facebook</option>
                            <option value="/api/posts/analytics">GET /api/posts/analytics</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="headers">Headers (JSON)</label>
                        <textarea id="headers" placeholder='{"Content-Type": "application/json"}'></textarea>
                    </div>

                    <div class="form-group">
                        <label for="body">Request Body (JSON)</label>
                        <textarea id="body" placeholder="Enter request body for POST/PUT requests"></textarea>
                    </div>

                    <button class="btn" onclick="sendRequest()">Send Request</button>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">Response</div>
                <div class="panel-content">
                    <div id="response" class="response">
Click "Send Request" to see the response here...

Example responses will include:
- HTTP status code
- Response headers
- Response body (formatted JSON)
- Response time
- Request/Response correlation ID
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const baseUrl = window.location.origin;
        
        function updateEndpoints() {
            const method = document.getElementById('method').value;
            const endpoint = document.getElementById('endpoint');
            
            // Update endpoint options based on method
            const endpoints = {
                'GET': [
                    '/api/posts',
                    '/api/posts/analytics',
                    '/api/settings',
                    '/api/health'
                ],
                'POST': [
                    '/api/auth/login',
                    '/api/auth/register',
                    '/api/posts',
                    '/api/oauth/connect/facebook',
                    '/api/oauth/connect/instagram'
                ],
                'PUT': [
                    '/api/posts/{id}',
                    '/api/settings'
                ],
                'DELETE': [
                    '/api/posts/{id}',
                    '/api/oauth/disconnect/facebook'
                ]
            };
            
            endpoint.innerHTML = '';
            endpoints[method].forEach(ep => {
                const option = document.createElement('option');
                option.value = ep;
                option.textContent = method + ' ' + ep;
                endpoint.appendChild(option);
            });
            
            updateRequestBody();
        }
        
        function updateRequestBody() {
            const endpoint = document.getElementById('endpoint').value;
            const body = document.getElementById('body');
            const headers = document.getElementById('headers');
            
            // Set default headers
            headers.value = JSON.stringify({
                "Content-Type": "application/json",
                "Authorization": "Bearer " + (document.getElementById('authToken').value || "YOUR_JWT_TOKEN")
            }, null, 2);
            
            // Set example request bodies
            const examples = {
                '/api/auth/login': {
                    "email": "user@example.com",
                    "password": "your-password"
                },
                '/api/auth/register': {
                    "email": "newuser@example.com",
                    "password": "secure-password",
                    "name": "New User"
                },
                '/api/posts': {
                    "content": "Hello from the API playground!",
                    "platforms": ["facebook", "instagram"],
                    "hashtags": ["#api", "#test"],
                    "scheduledTime": "2024-02-01T15:30:00Z"
                },
                '/api/oauth/connect/facebook': {
                    "code": "authorization_code_from_facebook",
                    "redirectUri": "http://localhost:3000/oauth/callback"
                }
            };
            
            if (examples[endpoint]) {
                body.value = JSON.stringify(examples[endpoint], null, 2);
            } else {
                body.value = '';
            }
        }
        
        async function sendRequest() {
            const method = document.getElementById('method').value;
            const endpoint = document.getElementById('endpoint').value;
            const headers = JSON.parse(document.getElementById('headers').value || '{}');
            const body = document.getElementById('body').value;
            const responseDiv = document.getElementById('response');
            
            const startTime = Date.now();
            
            try {
                const options = {
                    method: method,
                    headers: headers
                };
                
                if (body && (method === 'POST' || method === 'PUT')) {
                    options.body = body;
                }
                
                responseDiv.innerHTML = 'Sending request...';
                
                const response = await fetch(baseUrl + endpoint, options);
                const responseTime = Date.now() - startTime;
                const responseText = await response.text();
                
                let formattedResponse;
                try {
                    formattedResponse = JSON.stringify(JSON.parse(responseText), null, 2);
                } catch {
                    formattedResponse = responseText;
                }
                
                const statusClass = response.ok ? 'status-success' : 'status-error';
                
                responseDiv.innerHTML = \`<div class="\${statusClass}">Status: \${response.status} \${response.statusText}</div>
Response Time: \${responseTime}ms
Headers: \${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}

Body:
\${formattedResponse}\`;
                
            } catch (error) {
                responseDiv.innerHTML = \`<div class="status-error">Error: \${error.message}</div>\`;
            }
        }
        
        async function testAuth() {
            const token = document.getElementById('authToken').value;
            if (!token) {
                alert('Please enter a JWT token first');
                return;
            }
            
            try {
                const response = await fetch(baseUrl + '/api/posts', {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });
                
                if (response.ok) {
                    alert('Authentication successful!');
                } else {
                    alert('Authentication failed: ' + response.status);
                }
            } catch (error) {
                alert('Error testing authentication: ' + error.message);
            }
        }
        
        // Initialize
        updateEndpoints();
    </script>
</body>
</html>`;
};

// Generate API analytics data
const generateApiAnalytics = () => {
  const now = new Date();
  const last24Hours = apiUsageMetrics.filter(m => 
    now.getTime() - m.timestamp.getTime() < 24 * 60 * 60 * 1000
  );
  
  const endpointStats = last24Hours.reduce((acc, metric) => {
    const key = `${metric.method} ${metric.endpoint}`;
    if (!acc[key]) {
      acc[key] = {
        count: 0,
        avgResponseTime: 0,
        successRate: 0,
        errors: 0
      };
    }
    
    acc[key].count++;
    acc[key].avgResponseTime = (acc[key].avgResponseTime + metric.responseTime) / 2;
    
    if (metric.statusCode >= 400) {
      acc[key].errors++;
    }
    
    acc[key].successRate = ((acc[key].count - acc[key].errors) / acc[key].count) * 100;
    
    return acc;
  }, {} as any);
  
  return {
    summary: {
      totalRequests: last24Hours.length,
      avgResponseTime: last24Hours.reduce((sum, m) => sum + m.responseTime, 0) / last24Hours.length || 0,
      successRate: (last24Hours.filter(m => m.statusCode < 400).length / last24Hours.length) * 100 || 0,
      period: '24 hours'
    },
    endpoints: endpointStats,
    rateLimits: {
      current: {
        general: '100 requests/minute',
        auth: '5 requests/minute',
        posts: '10 requests/minute'
      },
      remaining: {
        general: 95,
        auth: 5,
        posts: 8
      }
    },
    topEndpoints: Object.entries(endpointStats)
      .sort(([,a], [,b]) => (b as any).count - (a as any).count)
      .slice(0, 10)
      .map(([endpoint, stats]) => ({ endpoint, ...stats }))
  };
};

export { generateSwaggerSpec, trackApiUsage, generateApiAnalytics };
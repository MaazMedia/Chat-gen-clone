import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as http from 'http';
import * as url from 'url';
import { MathAssistant } from './agents/math-assistant';
import { WebResearcher } from './agents/web-researcher';
import { DatabaseManager } from './database/manager';

dotenv.config();

interface Agent {
  id: string;
  name: string;
  description: string;
  invoke(message: string, context?: any): Promise<any>;
  executeTool(toolId: string, input: any): Promise<any>;
  tools: any[];
}

class ADKServer {
  private server: http.Server;
  private db: Pool;
  private dbManager: DatabaseManager;
  private agents: Map<string, Agent> = new Map();
  private port: number;
  private host: string;

  constructor(config: any) {
    this.port = config.port || 8080;
    this.host = config.host || '0.0.0.0';
    
    // Initialize database connection
    this.db = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'adk_chat',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password',
    });

    this.dbManager = new DatabaseManager(this.db);
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  registerAgent(id: string, agent: Agent) {
    this.agents.set(id, agent);
    console.log(`Registered agent: ${id} (${agent.name})`);
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url || '', true);
    const path = parsedUrl.pathname || '';
    const method = req.method || 'GET';

    try {
      // Route handlers
      if (path === '/agents' && method === 'GET') {
        await this.handleGetAgents(req, res);
      } else if (path === '/threads' && method === 'GET') {
        await this.handleGetThreads(req, res);
      } else if (path === '/threads' && method === 'POST') {
        await this.handleCreateThread(req, res);
      } else if (path.startsWith('/threads/') && path.endsWith('/messages') && method === 'GET') {
        await this.handleGetMessages(req, res);
      } else if (path.startsWith('/threads/') && path.endsWith('/messages') && method === 'POST') {
        await this.handleSendMessage(req, res);
      } else if (path.startsWith('/threads/') && path.includes('/messages/') && path.endsWith('/stream') && method === 'POST') {
        await this.handleStreamMessage(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      console.error('Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  private async handleGetAgents(req: http.IncomingMessage, res: http.ServerResponse) {
    const agents = Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      tools: agent.tools,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ agents }));
  }

  private async handleGetThreads(req: http.IncomingMessage, res: http.ServerResponse) {
    const parsedUrl = url.parse(req.url || '', true);
    const agentId = parsedUrl.query.agent_id as string;
    
    const threads = await this.dbManager.getThreads(agentId);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ threads }));
  }

  private async handleCreateThread(req: http.IncomingMessage, res: http.ServerResponse) {
    const body = await this.getRequestBody(req);
    const { agent_id, title } = JSON.parse(body);
    
    const thread = await this.dbManager.createThread(agent_id, title);
    
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ thread }));
  }

  private async handleGetMessages(req: http.IncomingMessage, res: http.ServerResponse) {
    const path = url.parse(req.url || '').pathname || '';
    const threadId = path.split('/')[2];
    
    const messages = await this.dbManager.getMessages(threadId);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages }));
  }

  private async handleSendMessage(req: http.IncomingMessage, res: http.ServerResponse) {
    const path = url.parse(req.url || '').pathname || '';
    const threadId = path.split('/')[2];
    
    const body = await this.getRequestBody(req);
    const { content, role = 'user', agent_id } = JSON.parse(body);
    
    // Add user message
    const userMessage = await this.dbManager.addMessage(threadId, role, content);
    
    // Get agent response if this is a user message
    if (role === 'user' && agent_id) {
      const agent = this.agents.get(agent_id);
      if (agent) {
        const response = await agent.invoke(content);
        const assistantMessage = await this.dbManager.addMessage(threadId, 'assistant', response.content);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          userMessage,
          assistantMessage,
          toolCalls: response.toolCalls || []
        }));
        return;
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: userMessage }));
  }

  private async handleStreamMessage(req: http.IncomingMessage, res: http.ServerResponse) {
    const path = url.parse(req.url || '').pathname || '';
    const threadId = path.split('/')[2];
    
    const body = await this.getRequestBody(req);
    const { content, agent_id } = JSON.parse(body);
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Add user message
    const userMessage = await this.dbManager.addMessage(threadId, 'user', content);
    
    // Send user message event
    res.write(`data: ${JSON.stringify({
      type: 'message',
      message: userMessage
    })}\n\n`);

    // Get agent and process response
    if (agent_id) {
      const agent = this.agents.get(agent_id);
      if (agent) {
        try {
          const response = await agent.invoke(content);
          
          // Simulate streaming by sending chunks
          const responseContent = response.content || '';
          const chunks = responseContent.split(' ');
          
          let accumulatedContent = '';
          for (const chunk of chunks) {
            accumulatedContent += chunk + ' ';
            
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: chunk + ' '
            })}\n\n`);
            
            // Small delay to simulate real streaming
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          // Save the complete assistant message
          const assistantMessage = await this.dbManager.addMessage(threadId, 'assistant', responseContent.trim());
          
          // Send final message event
          res.write(`data: ${JSON.stringify({
            type: 'message',
            message: assistantMessage
          })}\n\n`);
          
          // Send tool calls if any
          if (response.toolCalls && response.toolCalls.length > 0) {
            for (const toolCall of response.toolCalls) {
              res.write(`data: ${JSON.stringify({
                type: 'tool_call',
                toolCall
              })}\n\n`);
            }
          }
        } catch (error) {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: 'Failed to generate response'
          })}\n\n`);
        }
      }
    }
    
    // End the stream
    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
    res.end();
  }

  private async getRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }

  async start() {
    await this.dbManager.initialize();
    
    return new Promise<void>((resolve) => {
      this.server.listen(this.port, this.host, () => {
        console.log(`ADK Server started on http://${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  async stop() {
    return new Promise<void>((resolve) => {
      this.server.close(() => {
        this.db.end();
        resolve();
      });
    });
  }
}

class ChatServer {
  private adkServer: ADKServer;

  constructor() {
    this.adkServer = new ADKServer({
      port: parseInt(process.env.ADK_PORT || '8080'),
      host: process.env.ADK_HOST || '0.0.0.0',
    });

    this.setupAgents();
  }

  private setupAgents() {
    // Register math assistant
    const mathAssistant = new MathAssistant();
    this.adkServer.registerAgent('math-assistant', mathAssistant);

    // Register web researcher
    const webResearcher = new WebResearcher();
    this.adkServer.registerAgent('web-researcher', webResearcher);
  }

  async start() {
    try {
      await this.adkServer.start();
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop() {
    await this.adkServer.stop();
  }
}

// Start the server
const chatServer = new ChatServer();
chatServer.start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await chatServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await chatServer.stop();
  process.exit(0);
});
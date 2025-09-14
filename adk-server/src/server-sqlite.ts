import * as dotenv from 'dotenv';
import * as http from 'http';
import * as url from 'url';
import { MathAssistant } from './agents/math-assistant';
import { WebResearcher } from './agents/web-researcher';
import { SQLiteDatabaseManager } from './database/sqlite-manager';

dotenv.config();

interface Agent {
  id: string;
  name: string;
  description: string;
  invoke(message: string, context?: any): Promise<any>;
  executeTool(toolId: string, input: any): Promise<any>;
  tools: any[];
}

class ADKServerSQLite {
  private server: http.Server;
  private dbManager: SQLiteDatabaseManager;
  private agents: Map<string, Agent> = new Map();
  private port: number;
  private host: string;

  constructor(config: any) {
    this.port = config.port || 8080;
    this.host = config.host || '0.0.0.0';
    
    // Initialize SQLite database
    this.dbManager = new SQLiteDatabaseManager();
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  registerAgent(id: string, agent: Agent) {
    this.agents.set(id, agent);
    console.log(`Registered agent: ${id} (${agent.name})`);
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url || '', true);
    const path = parsedUrl.pathname || '';
    const method = req.method || 'GET';

    console.log(`${method} ${path}`);

    try {
      if (path === '/agents' && method === 'GET') {
        await this.handleGetAgents(res);
      } else if (path === '/threads' && method === 'GET') {
        await this.handleGetThreads(req, res);
      } else if (path === '/threads' && method === 'POST') {
        await this.handleCreateThread(req, res);
      } else if (path.match(/^\/threads\/[^\/]+\/messages$/) && method === 'GET') {
        await this.handleGetMessages(req, res);
      } else if (path.match(/^\/threads\/[^\/]+\/messages$/) && method === 'POST') {
        await this.handleSendMessage(req, res);
      } else if (path.match(/^\/threads\/[^\/]+\/messages\/stream$/) && method === 'POST') {
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

  private async handleGetAgents(res: http.ServerResponse) {
    const agents = Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      tools: agent.tools.map(tool => ({
        name: tool.name,
        description: tool.description
      }))
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
    const body = await this.readRequestBody(req);
    const { agent_id, title } = JSON.parse(body);

    if (!agent_id || !this.agents.has(agent_id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid agent_id' }));
      return;
    }

    const threadId = await this.dbManager.createThread(agent_id, title);
    
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      id: threadId,
      agent_id,
      title: title || 'New Chat',
      created_at: new Date().toISOString()
    }));
  }

  private async handleGetMessages(req: http.IncomingMessage, res: http.ServerResponse) {
    const path = req.url || '';
    const threadId = path.split('/')[2];

    if (!threadId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Thread ID required' }));
      return;
    }

    const messages = await this.dbManager.getMessages(threadId);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages }));
  }

  private async handleSendMessage(req: http.IncomingMessage, res: http.ServerResponse) {
    const path = req.url || '';
    const threadId = path.split('/')[2];
    const body = await this.readRequestBody(req);
    const { message } = JSON.parse(body);

    if (!threadId || !message) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Thread ID and message required' }));
      return;
    }

    // Get thread to find agent
    const thread = await this.dbManager.getThread(threadId);
    if (!thread) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Thread not found' }));
      return;
    }

    const agent = this.agents.get(thread.agent_id);
    if (!agent) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent not found' }));
      return;
    }

    // Save user message
    const userMessageId = await this.dbManager.addMessage(threadId, 'user', message);

    // Get agent response
    const response = await agent.invoke(message);
    
    // Save assistant message
    const assistantMessageId = await this.dbManager.addMessage(threadId, 'assistant', response.content);

    // Save tool calls if any
    if (response.tool_calls) {
      for (const toolCall of response.tool_calls) {
        await this.dbManager.addToolCall(assistantMessageId, toolCall.name, toolCall.input);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: assistantMessageId,
      role: 'assistant',
      content: response.content,
      tool_calls: response.tool_calls || []
    }));
  }

  private async handleStreamMessage(req: http.IncomingMessage, res: http.ServerResponse) {
    const path = req.url || '';
    const threadId = path.split('/')[2];
    const body = await this.readRequestBody(req);
    const { message } = JSON.parse(body);

    if (!threadId || !message) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Thread ID and message required' }));
      return;
    }

    // Get thread to find agent
    const thread = await this.dbManager.getThread(threadId);
    if (!thread) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Thread not found' }));
      return;
    }

    const agent = this.agents.get(thread.agent_id);
    if (!agent) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent not found' }));
      return;
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Save user message
    const userMessageId = await this.dbManager.addMessage(threadId, 'user', message);

    try {
      // Stream thinking
      res.write(`data: ${JSON.stringify({ type: 'thinking', content: 'Processing your request...' })}\n\n`);

      // Get agent response
      const response = await agent.invoke(message);
      
      // Stream response
      const words = response.content.split(' ');
      for (let i = 0; i < words.length; i++) {
        const chunk = words.slice(0, i + 1).join(' ');
        res.write(`data: ${JSON.stringify({ 
          type: 'content', 
          content: chunk,
          partial: i < words.length - 1
        })}\n\n`);
        
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Save assistant message
      const assistantMessageId = await this.dbManager.addMessage(threadId, 'assistant', response.content);

      // Stream tool calls if any
      if (response.tool_calls) {
        for (const toolCall of response.tool_calls) {
          res.write(`data: ${JSON.stringify({ 
            type: 'tool_call', 
            tool_name: toolCall.name,
            tool_input: toolCall.input,
            tool_output: toolCall.output
          })}\n\n`);
          
          await this.dbManager.addToolCall(assistantMessageId, toolCall.name, toolCall.input);
        }
      }

      // End stream
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Something went wrong' })}\n\n`);
    }

    res.end();
  }

  private readRequestBody(req: http.IncomingMessage): Promise<string> {
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
    // Test database connection
    const isConnected = await this.dbManager.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to SQLite database');
    }
    console.log('✅ SQLite database connected successfully');

    // Register agents
    this.registerAgent('math-assistant', new MathAssistant());
    this.registerAgent('web-researcher', new WebResearcher());

    this.server.listen(this.port, this.host, () => {
      console.log(`🚀 ADK Server (SQLite) running on http://${this.host}:${this.port}`);
      console.log(`📊 Database file: adk_chat.db`);
    });
  }

  async stop() {
    this.dbManager.close();
    this.server.close();
  }
}

// Start server
const server = new ADKServerSQLite({
  port: parseInt(process.env.ADK_PORT || '8080'),
  host: process.env.ADK_HOST || '0.0.0.0'
});

server.start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await server.stop();
  process.exit(0);
});
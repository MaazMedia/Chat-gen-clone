import * as dotenv from "dotenv";
import * as http from "http";
import * as url from "url";
import { MathAssistant } from "./agents/math-assistant";
import { WebResearcher } from "./agents/web-researcher";
import { SQLiteDatabaseManager } from "./database/sqlite-manager";

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
    this.host = config.host || "0.0.0.0";

    // Initialize SQLite database
    this.dbManager = new SQLiteDatabaseManager();
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  registerAgent(id: string, agent: Agent) {
    this.agents.set(id, agent);
    console.log(`Registered agent: ${id} (${agent.name})`);
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url || "", true);
    const path = parsedUrl.pathname || "";
    const method = req.method || "GET";

    console.log(`${method} ${path}`);
    console.log(`🔍 Route debugging - Path: "${path}", Method: "${method}"`);
    console.log(
      `🧪 Delete route regex test: ${/^\/threads\/[^\/]+$/.test(path)} for path: ${path}`,
    );

    try {
      if (path === "/agents" && method === "GET") {
        await this.handleGetAgents(res);
      } else if (path === "/threads" && method === "GET") {
        await this.handleGetThreads(req, res);
      } else if (path === "/threads" && method === "POST") {
        await this.handleCreateThread(req, res);
      } else if (path.match(/^\/threads\/[^\/]+$/) && method === "DELETE") {
        console.log(
          `🎯 DELETE route matched! Path: ${path}, Method: ${method}`,
        );
        await this.handleDeleteThread(req, res);
      } else if (
        path.match(/^\/threads\/[^\/]+\/messages$/) &&
        method === "GET"
      ) {
        await this.handleGetMessages(req, res);
      } else if (
        path.match(/^\/threads\/[^\/]+\/messages$/) &&
        method === "POST"
      ) {
        await this.handleSendMessage(req, res);
      } else if (
        path.match(/^\/threads\/[^\/]+\/messages\/stream$/) &&
        method === "POST"
      ) {
        await this.handleStreamMessage(req, res);
      } else {
        console.log(`❌ No route matched for ${method} ${path}`);
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    } catch (error) {
      console.error("Request error:", error);
      // Only send error response if headers haven't been sent yet
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      } else {
        // If we're in the middle of a stream, send error as SSE
        try {
          res.write(
            `data: ${JSON.stringify({ type: "error", content: "Internal server error" })}\n\n`,
          );
          res.end();
        } catch (streamError) {
          console.error("Failed to send error in stream:", streamError);
        }
      }
    }
  }

  private async handleGetAgents(res: http.ServerResponse) {
    const agents = Array.from(this.agents.values()).map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      tools: agent.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ agents }));
  }

  private async handleGetThreads(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    const parsedUrl = url.parse(req.url || "", true);
    const agentId = parsedUrl.query.agent_id as string;

    console.log(
      `🔍 [ADK-Server] handleGetThreads called with agentId: ${agentId}`,
    );

    try {
      const threads = await this.dbManager.getThreads(agentId);

      console.log(
        `📊 [ADK-Server] getThreads returned ${threads.length} threads`,
      );

      if (threads.length > 0) {
        console.log(
          `🗂️  [ADK-Server] Thread IDs from DB:`,
          threads.map((t) => t.id),
        );
        console.log(
          `📝 [ADK-Server] Thread titles from DB:`,
          threads.map((t) => t.title),
        );
        console.log(
          `👤 [ADK-Server] Thread agents from DB:`,
          threads.map((t) => t.agent_id),
        );
        console.log(
          `📅 [ADK-Server] Thread updated_at from DB:`,
          threads.map((t) => t.updated_at),
        );
      } else {
        console.log(`📭 [ADK-Server] No threads found for agentId: ${agentId}`);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ threads }));
    } catch (error) {
      console.error(`❌ [ADK-Server] Error in handleGetThreads:`, error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to get threads" }));
    }
  }

  private async handleCreateThread(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    console.log(`🆕 [ADK-Server] handleCreateThread called`);

    try {
      const body = await this.readRequestBody(req);
      console.log(`📋 [ADK-Server] Request body: ${body}`);

      const { agent_id, title } = JSON.parse(body);
      console.log(`🤖 [ADK-Server] Agent ID: ${agent_id}`);
      console.log(`📝 [ADK-Server] Title: ${title || "No title provided"}`);

      if (!agent_id || !this.agents.has(agent_id)) {
        console.log(`❌ [ADK-Server] Invalid agent_id: ${agent_id}`);
        console.log(
          `🤖 [ADK-Server] Available agents:`,
          Array.from(this.agents.keys()),
        );
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid agent_id" }));
        return;
      }

      console.log(`✅ [ADK-Server] Agent validated, creating thread...`);
      const threadId = await this.dbManager.createThread(agent_id, title);
      console.log(`🆔 [ADK-Server] Thread created with ID: ${threadId}`);

      const responseData = {
        id: threadId,
        agent_id,
        title: title || "New Chat",
        created_at: new Date().toISOString(),
      };

      console.log(`📤 [ADK-Server] Sending response:`, responseData);

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(responseData));
    } catch (error) {
      console.error(`❌ [ADK-Server] Error in handleCreateThread:`, error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to create thread" }));
    }
  }

  private async handleDeleteThread(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    const path = req.url || "";
    const threadId = path.split("/")[2];

    console.log(
      `🗑️  Delete thread request - Path: ${path}, Thread ID: ${threadId}`,
    );

    if (!threadId) {
      console.log("❌ Delete thread failed - No thread ID provided");
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Thread ID required" }));
      return;
    }

    try {
      console.log(`🔍 Attempting to delete thread: ${threadId}`);
      await this.dbManager.deleteThread(threadId);
      console.log(`✅ Successfully deleted thread: ${threadId}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      console.error(`❌ Failed to delete thread ${threadId}:`, error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to delete thread" }));
    }
  }

  private async handleGetMessages(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    const path = req.url || "";
    const threadId = path.split("/")[2];

    if (!threadId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Thread ID required" }));
      return;
    }

    const messages = await this.dbManager.getMessages(threadId);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ messages }));
  }

  private async handleSendMessage(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    const path = req.url || "";
    const threadId = path.split("/")[2];
    const body = await this.readRequestBody(req);
    const { message } = JSON.parse(body);

    if (!threadId || !message) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Thread ID and message required" }));
      return;
    }

    // Get thread to find agent
    const thread = await this.dbManager.getThread(threadId);
    if (!thread) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Thread not found" }));
      return;
    }

    const agent = this.agents.get(thread.agent_id);
    if (!agent) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Agent not found" }));
      return;
    }

    // Save user message
    const userMessageId = await this.dbManager.addMessage(
      threadId,
      "user",
      message,
    );

    // Get agent response
    const response = await agent.invoke(message);

    // Save assistant message
    const assistantMessageId = await this.dbManager.addMessage(
      threadId,
      "assistant",
      response.content,
    );

    // Save tool calls if any
    if (response.tool_calls) {
      for (const toolCall of response.tool_calls) {
        await this.dbManager.addToolCall(
          assistantMessageId,
          toolCall.name,
          toolCall.input,
        );
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: assistantMessageId,
        role: "assistant",
        content: response.content,
        tool_calls: response.tool_calls || [],
      }),
    );
  }

  private async handleStreamMessage(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    console.log(`🔥 [Server] handleStreamMessage called`);
    const path = req.url || "";
    const threadId = path.split("/")[2];
    console.log(`🧵 [Server] Extracted threadId: ${threadId}`);

    const body = await this.readRequestBody(req);
    console.log(`📦 [Server] Request body:`, body);

    const { message } = JSON.parse(body);
    console.log(`📝 [Server] Parsed message:`, message);

    if (!threadId || !message) {
      console.log(
        `❌ [Server] Missing threadId (${threadId}) or message (${message})`,
      );
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Thread ID and message required" }));
      return;
    }

    // Get thread to find agent
    console.log(`🔍 [Server] Looking up thread: ${threadId}`);
    const thread = await this.dbManager.getThread(threadId);
    console.log(`🧵 [Server] Thread found:`, thread);
    if (!thread) {
      console.log(`❌ [Server] Thread not found: ${threadId}`);
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Thread not found" }));
      return;
    }

    console.log(`🤖 [Server] Looking up agent: ${thread.agent_id}`);
    const agent = this.agents.get(thread.agent_id);
    console.log(`🤖 [Server] Agent found:`, !!agent);
    if (!agent) {
      console.log(`❌ [Server] Agent not found: ${thread.agent_id}`);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Agent not found" }));
      return;
    }

    console.log(
      `✅ [Server] Starting SSE stream for thread ${threadId} with agent ${thread.agent_id}`,
    );
    // Set up SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Save user message
    console.log(`💾 [Server] Saving user message, type:`, typeof message);
    console.log(`📝 [Server] Message content:`, message);

    // Convert multimodal content to string for SQLite storage
    let messageContentForDb: string;
    if (typeof message === "string") {
      messageContentForDb = message;
    } else if (Array.isArray(message)) {
      // Extract text content from multimodal array and note that it has attachments
      const textParts = message
        .filter((part) => part.type === "text")
        .map((part) => part.text);
      const imageCount = message.filter(
        (part) => part.type === "image_url",
      ).length;
      messageContentForDb =
        textParts.join(" ") +
        (imageCount > 0 ? ` [${imageCount} image(s) attached]` : "");
    } else {
      messageContentForDb = JSON.stringify(message);
    }

    const userMessageId = await this.dbManager.addMessage(
      threadId,
      "user",
      messageContentForDb,
    );

    try {
      // Stream thinking
      res.write(
        `data: ${JSON.stringify({ type: "thinking", content: "Processing your request..." })}\n\n`,
      );

      // Get agent response
      console.log(`🤖 [Server] Invoking agent with message: "${message}"`);
      const response = await agent.invoke(message);
      console.log(`📤 [Server] Agent response:`, response);
      console.log(`🔧 [Server] Tool calls in response:`, response.toolCalls);

      // Stream response
      const words = response.content.split(" ");
      for (let i = 0; i < words.length; i++) {
        const chunk = words.slice(0, i + 1).join(" ");
        res.write(
          `data: ${JSON.stringify({
            type: "content",
            content: chunk,
            partial: i < words.length - 1,
          })}\n\n`,
        );

        // Small delay to simulate streaming
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Save assistant message
      const assistantMessageId = await this.dbManager.addMessage(
        threadId,
        "assistant",
        response.content,
      );

      // Stream tool calls if any
      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log(
          `🔧 [Server] Processing ${response.toolCalls.length} tool calls`,
        );
        for (const toolCall of response.toolCalls) {
          console.log(
            `🛠️ [Server] Executing tool: ${toolCall.name}`,
            toolCall.input,
          );

          // Execute the tool to get the result
          let toolOutput;
          try {
            toolOutput = await agent.executeTool(toolCall.id, toolCall.input);
            console.log(`✅ [Server] Tool execution result:`, toolOutput);
          } catch (error) {
            console.error(`❌ [Server] Tool execution failed:`, error);
            toolOutput = {
              error: "Tool execution failed",
              message: error instanceof Error ? error.message : "Unknown error",
            };
          }

          res.write(
            `data: ${JSON.stringify({
              type: "tool_call",
              tool_name: toolCall.name,
              tool_input: toolCall.input,
              tool_output: toolOutput,
            })}\n\n`,
          );

          await this.dbManager.addToolCall(
            assistantMessageId,
            toolCall.name,
            toolCall.input,
          );
        }
      } else {
        console.log(`📝 [Server] No tool calls in response`);
      }

      // End stream
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ type: "error", content: "Something went wrong" })}\n\n`,
      );
    }

    res.end();
  }

  private readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        resolve(body);
      });
      req.on("error", reject);
    });
  }

  async start() {
    // Test database connection
    const isConnected = await this.dbManager.testConnection();
    if (!isConnected) {
      throw new Error("Failed to connect to SQLite database");
    }
    console.log("✅ SQLite database connected successfully");

    // Register agents
    this.registerAgent("math-assistant", new MathAssistant());
    this.registerAgent("web-researcher", new WebResearcher());

    this.server.listen(this.port, this.host, () => {
      console.log(
        `🚀 ADK Server (SQLite) running on http://${this.host}:${this.port}`,
      );
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
  port: parseInt(process.env.ADK_PORT || "8080"),
  host: process.env.ADK_HOST || "0.0.0.0",
});

server.start().catch(console.error);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down server...");
  await server.stop();
  process.exit(0);
});

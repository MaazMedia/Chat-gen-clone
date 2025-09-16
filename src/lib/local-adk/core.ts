// Local ADK Core Implementation
// Implements Google ADK patterns locally within Next.js

import OpenAI from "openai";

export interface ADKMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string | any[];
  created_at: string;
  thread_id?: string;
  tool_calls?: any[];
}

export interface ADKThread {
  id: string;
  created_at: string;
  messages: ADKMessage[];
  metadata?: Record<string, any>;
}

export interface ADKTool {
  id: string;
  name: string;
  description: string;
  schema: Record<string, any>;
}

export interface ADKInvokeResult {
  content: string;
  toolCalls?: any[];
}

export interface ADKAgent {
  id: string;
  name: string;
  description: string;
  tools: ADKTool[];
  invoke(message: string, context?: any): Promise<string | ADKInvokeResult>;
  streamInvoke(
    message: string,
    context?: any,
  ): AsyncGenerator<string, void, unknown>;
  executeTool(toolId: string, input: any): Promise<any>;
}

export class LocalADKCore {
  private openai: OpenAI;
  private agents: Map<string, ADKAgent> = new Map();
  private threads: Map<string, ADKThread> = new Map();

  constructor(openaiApiKey: string, model: string = "gpt-4o-mini") {
    this.openai = new OpenAI({
      apiKey: openaiApiKey,
    });
  }

  registerAgent(agent: ADKAgent): void {
    this.agents.set(agent.id, agent);
    console.log(`[Local ADK] Registered agent: ${agent.id}`);
  }

  getAgent(id: string): ADKAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): ADKAgent[] {
    return Array.from(this.agents.values());
  }

  createThread(): ADKThread {
    const thread: ADKThread = {
      id: `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      messages: [],
    };
    this.threads.set(thread.id, thread);
    console.log(`[Local ADK Core] Thread created: ${thread.id}`);
    console.log(
      `[Local ADK Core] Total threads in memory: ${this.threads.size}`,
    );
    return thread;
  }

  getThread(id: string): ADKThread | undefined {
    return this.threads.get(id);
  }

  getAllThreads(): ADKThread[] {
    return Array.from(this.threads.values()).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  addMessageToThread(
    threadId: string,
    message: Omit<ADKMessage, "id" | "created_at">,
  ): ADKMessage {
    const thread = this.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    const adkMessage: ADKMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      thread_id: threadId,
    };

    thread.messages.push(adkMessage);
    return adkMessage;
  }

  async invokeAgent(
    agentId: string,
    message: string | any[],
    threadId?: string,
    context?: any,
  ): Promise<string> {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Convert multimodal content to string for now
    const textMessage =
      typeof message === "string"
        ? message
        : Array.isArray(message)
          ? message
              .map((item) =>
                item.type === "text"
                  ? item.text
                  : item.type === "image"
                    ? "[Image uploaded]"
                    : "[File uploaded]",
              )
              .join(" ")
          : String(message);

    // Add user message to thread if threadId provided
    if (threadId) {
      this.addMessageToThread(threadId, {
        role: "user",
        content: message, // Store original multimodal content
      });
    }

    const response = await agent.invoke(textMessage, context);

    // Handle both string and object responses
    let responseContent: string | any[];
    let toolCalls: any[] | undefined;

    if (typeof response === "string") {
      responseContent = response;
    } else {
      responseContent = response.content;
      toolCalls = response.toolCalls;
    }

    // Add assistant response to thread if threadId provided
    if (threadId) {
      this.addMessageToThread(threadId, {
        role: "assistant",
        content: responseContent,
        tool_calls: toolCalls,
      });
    }

    return typeof response === "string" ? response : response.content;
  }

  async *streamInvokeAgent(
    agentId: string,
    message: string,
    threadId?: string,
    context?: any,
  ): AsyncGenerator<string, void, unknown> {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Add user message to thread if threadId provided
    if (threadId) {
      this.addMessageToThread(threadId, {
        role: "user",
        content: message,
      });
    }

    let fullResponse = "";

    for await (const chunk of agent.streamInvoke(message, context)) {
      fullResponse += chunk;
      yield chunk;
    }

    // Add complete assistant response to thread if threadId provided
    if (threadId) {
      this.addMessageToThread(threadId, {
        role: "assistant",
        content: fullResponse,
      });
    }
  }

  getOpenAI(): OpenAI {
    return this.openai;
  }
}

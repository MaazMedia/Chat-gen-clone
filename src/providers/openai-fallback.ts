// OpenAI fallback client for when ADK server is not available
import OpenAI from 'openai';
import { ADKServerError } from './client';

export interface OpenAIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface OpenAIThread {
  id: string;
  created_at: string;
  messages: OpenAIMessage[];
}

export class OpenAIFallbackClient {
  private openai: OpenAI;
  private model: string;
  private threads: Map<string, OpenAIThread> = new Map();
  
  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true, // Only for development
    });
    this.model = model;
  }

  async getAgents() {
    // Return mock agents that work with OpenAI
    return {
      agents: [
        {
          id: 'openai-assistant',
          name: 'OpenAI Assistant',
          description: 'AI assistant powered by OpenAI GPT models',
          model: this.model,
          tools: ['general_conversation', 'math_calculations', 'code_assistance']
        },
        {
          id: 'openai-math',
          name: 'Math Assistant (OpenAI)',
          description: 'Mathematical problem solver using OpenAI',
          model: this.model,
          tools: ['calculator', 'math_reasoning']
        }
      ]
    };
  }

  async getThreads(agentId?: string) {
    const threads = Array.from(this.threads.values());
    return {
      threads: threads.map(thread => ({
        thread_id: thread.id,
        created_at: thread.created_at,
        agent_id: agentId || 'openai-assistant'
      }))
    };
  }

  async createThread(agentId: string, title?: string) {
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const thread: OpenAIThread = {
      id: threadId,
      created_at: new Date().toISOString(),
      messages: []
    };
    
    this.threads.set(threadId, thread);
    
    return {
      thread: {
        id: threadId,
        created_at: thread.created_at,
        agent_id: agentId,
        title: title || 'OpenAI Conversation'
      }
    };
  }

  async getMessages(threadId: string) {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new ADKServerError('THREAD_NOT_FOUND', 'Thread not found', undefined, 404);
    }

    return {
      messages: thread.messages
    };
  }

  async sendMessage(threadId: string, content: string, agentId: string) {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new ADKServerError('THREAD_NOT_FOUND', 'Thread not found', undefined, 404);
    }

    // Add user message
    const userMessage: OpenAIMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content,
      created_at: new Date().toISOString()
    };
    thread.messages.push(userMessage);

    // Get AI response
    const systemPrompt = this.getSystemPrompt(agentId);
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...thread.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    const assistantMessage: OpenAIMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant',
      content: response.choices[0]?.message?.content || 'Sorry, I could not generate a response.',
      created_at: new Date().toISOString()
    };
    thread.messages.push(assistantMessage);

    return {
      message: assistantMessage
    };
  }

  async streamMessage(threadId: string, content: string, agentId: string): Promise<ReadableStream> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new ADKServerError('THREAD_NOT_FOUND', 'Thread not found', undefined, 404);
    }

    // Add user message
    const userMessage: OpenAIMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content,
      created_at: new Date().toISOString()
    };
    thread.messages.push(userMessage);

    const systemPrompt = this.getSystemPrompt(agentId);
    const openaiInstance = this.openai;
    const model = this.model;
    const threadsMap = this.threads;
    
    return new ReadableStream({
      async start(controller) {
        try {
          const stream = await openaiInstance.chat.completions.create({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...thread.messages.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
              }))
            ],
            max_tokens: 1000,
            temperature: 0.7,
            stream: true
          });

          let fullContent = '';
          const messageId = `msg_${Date.now()}_assistant`;

          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              
              // Send chunk in ADK-compatible format
              const data = JSON.stringify({
                type: 'chunk',
                content: content
              });
              controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
            }
          }

          // Add complete message to thread
          const assistantMessage: OpenAIMessage = {
            id: messageId,
            role: 'assistant',
            content: fullContent,
            created_at: new Date().toISOString()
          };
          const currentThread = threadsMap.get(threadId);
          if (currentThread) {
            currentThread.messages.push(assistantMessage);
          }

          // Send final message
          const finalData = JSON.stringify({
            type: 'message',
            message: assistantMessage
          });
          controller.enqueue(new TextEncoder().encode(`data: ${finalData}\n\n`));

          // Send end signal
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'end' })}\n\n`));
          
        } catch (error) {
          controller.error(error);
        } finally {
          controller.close();
        }
      }
    });
  }

  private getSystemPrompt(agentId: string): string {
    switch (agentId) {
      case 'openai-math':
        return `You are a helpful math assistant. You can solve mathematical problems, explain mathematical concepts, and help with calculations. Be precise and show your work when solving problems.`;
      
      case 'openai-assistant':
      default:
        return `You are a helpful AI assistant. You can help with a wide variety of tasks including answering questions, providing explanations, helping with analysis, writing, coding, and general conversation. Be helpful, accurate, and concise.`;
    }
  }
}
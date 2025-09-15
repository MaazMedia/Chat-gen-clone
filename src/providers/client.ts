import { OpenAIFallbackClient } from './openai-fallback';

export interface ADKClient {
  apiUrl: string;
  apiKey?: string;
}

export interface ADKError {
  error: string;
  message: string;
  details?: string;
  timestamp?: string;
}

export class ADKServerError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ADKServerError';
  }
}

export function createClient(apiUrl: string, apiKey: string | undefined): ADKClient {
  return {
    apiUrl,
    apiKey,
  };
}

// ADK API client functions
export class AdkApiClient {
  private fallbackClient?: OpenAIFallbackClient;
  private useFallback = false;

  constructor(
    private client: ADKClient, 
    openaiConfig?: { apiKey: string; model?: string; enabled?: boolean }
  ) {
    // Initialize OpenAI fallback if configuration is provided
    if (openaiConfig?.apiKey && openaiConfig?.enabled !== false) {
      this.fallbackClient = new OpenAIFallbackClient(
        openaiConfig.apiKey, 
        openaiConfig.model || 'gpt-4o-mini'
      );
    }
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      let errorData: ADKError | undefined;
      
      try {
        errorData = await response.json() as ADKError;
      } catch {
        // Response isn't JSON, create a generic error
        errorData = {
          error: 'UNKNOWN_ERROR',
          message: response.statusText || 'Unknown error occurred',
        };
      }

      // Specific handling for ADK server unavailable
      if (response.status === 503 && errorData.error === 'ADK_SERVER_UNAVAILABLE') {
        throw new ADKServerError(
          'ADK_SERVER_UNAVAILABLE',
          'ADK server is not running. Please start the server or check your configuration.',
          errorData.details,
          503
        );
      }

      // Generic error handling
      throw new ADKServerError(
        errorData.error,
        errorData.message,
        errorData.details,
        response.status
      );
    }

    return response;
  }

  async getAgents() {
    try {
      const response = await fetch(`${this.client.apiUrl}/agents`, {
        headers: this.getHeaders(),
      });
      await this.handleResponse(response);
      this.useFallback = false; // ADK is working
      return response.json();
    } catch (error) {
      if (error instanceof ADKServerError) {
        // Try fallback if ADK server is unavailable
        if ((error.code === 'ADK_SERVER_UNAVAILABLE' || error.code === 'NETWORK_ERROR') && this.fallbackClient) {
          console.log('🔄 ADK server unavailable, using OpenAI fallback...');
          this.useFallback = true;
          return await this.fallbackClient.getAgents();
        }
        throw error;
      }
      // Network error (fetch failed)
      if (this.fallbackClient) {
        console.log('🔄 Network error, using OpenAI fallback...');
        this.useFallback = true;
        return await this.fallbackClient.getAgents();
      }
      throw new ADKServerError(
        'NETWORK_ERROR',
        'Unable to connect to ADK server. Please check if the server is running.',
        error instanceof Error ? error.message : 'Unknown network error',
        0
      );
    }
  }

  async getThreads(agentId?: string) {
    if (this.useFallback && this.fallbackClient) {
      return await this.fallbackClient.getThreads(agentId);
    }

    try {
      const url = new URL(`${this.client.apiUrl}/threads`);
      if (agentId) {
        url.searchParams.set('agent_id', agentId);
      }
      
      const response = await fetch(url.toString(), {
        headers: this.getHeaders(),
      });
      await this.handleResponse(response);
      return response.json();
    } catch (error) {
      if (error instanceof ADKServerError && this.fallbackClient) {
        console.log('🔄 Falling back to OpenAI for threads...');
        this.useFallback = true;
        return await this.fallbackClient.getThreads(agentId);
      }
      if (error instanceof ADKServerError) {
        throw error;
      }
      throw new ADKServerError(
        'NETWORK_ERROR',
        'Unable to connect to ADK server. Please check if the server is running.',
        error instanceof Error ? error.message : 'Unknown network error',
        0
      );
    }
  }

  async createThread(agentId: string, title?: string) {
    if (this.useFallback && this.fallbackClient) {
      return await this.fallbackClient.createThread(agentId, title);
    }

    try {
      const response = await fetch(`${this.client.apiUrl}/threads`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ agent_id: agentId, title }),
      });
      await this.handleResponse(response);
      return response.json();
    } catch (error) {
      if (error instanceof ADKServerError && this.fallbackClient) {
        console.log('🔄 Falling back to OpenAI for thread creation...');
        this.useFallback = true;
        return await this.fallbackClient.createThread(agentId, title);
      }
      if (error instanceof ADKServerError) {
        throw error;
      }
      throw new ADKServerError(
        'NETWORK_ERROR',
        'Unable to connect to ADK server. Please check if the server is running.',
        error instanceof Error ? error.message : 'Unknown network error',
        0
      );
    }
  }
  async getMessages(threadId: string) {
    if (this.useFallback && this.fallbackClient) {
      return await this.fallbackClient.getMessages(threadId);
    }

    try {
      const response = await fetch(`${this.client.apiUrl}/threads/${threadId}/messages`, {
        headers: this.getHeaders(),
      });
      await this.handleResponse(response);
      return response.json();
    } catch (error) {
      if (error instanceof ADKServerError && this.fallbackClient) {
        console.log('🔄 Falling back to OpenAI for messages...');
        this.useFallback = true;
        return await this.fallbackClient.getMessages(threadId);
      }
      if (error instanceof ADKServerError) {
        throw error;
      }
      throw new ADKServerError(
        'NETWORK_ERROR',
        'Unable to connect to ADK server. Please check if the server is running.',
        error instanceof Error ? error.message : 'Unknown network error',
        0
      );
    }
  }

  async sendMessage(threadId: string, content: string, agentId: string) {
    if (this.useFallback && this.fallbackClient) {
      return await this.fallbackClient.sendMessage(threadId, content, agentId);
    }

    try {
      const response = await fetch(`${this.client.apiUrl}/threads/${threadId}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ content, role: 'user', agent_id: agentId }),
      });
      await this.handleResponse(response);
      return response.json();
    } catch (error) {
      if (error instanceof ADKServerError && this.fallbackClient) {
        console.log('🔄 Falling back to OpenAI for sending message...');
        this.useFallback = true;
        return await this.fallbackClient.sendMessage(threadId, content, agentId);
      }
      if (error instanceof ADKServerError) {
        throw error;
      }
      throw new ADKServerError(
        'NETWORK_ERROR',
        'Unable to connect to ADK server. Please check if the server is running.',
        error instanceof Error ? error.message : 'Unknown network error',
        0
      );
    }
  }

  async streamMessage(threadId: string, content: string, agentId: string): Promise<ReadableStream> {
    if (this.useFallback && this.fallbackClient) {
      return await this.fallbackClient.streamMessage(threadId, content, agentId);
    }

    try {
      const response = await fetch(`${this.client.apiUrl}/threads/${threadId}/messages/stream`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ content, agent_id: agentId }),
      });
      
      await this.handleResponse(response);
      
      if (!response.body) {
        throw new ADKServerError(
          'NO_RESPONSE_BODY',
          'No response body received from server',
          undefined,
          response.status
        );
      }
      
      return response.body;
    } catch (error) {
      if (error instanceof ADKServerError && this.fallbackClient) {
        console.log('🔄 Falling back to OpenAI for streaming...');
        this.useFallback = true;
        return await this.fallbackClient.streamMessage(threadId, content, agentId);
      }
      if (error instanceof ADKServerError) {
        throw error;
      }
      throw new ADKServerError(
        'NETWORK_ERROR',
        'Unable to connect to ADK server. Please check if the server is running.',
        error instanceof Error ? error.message : 'Unknown network error',
        0
      );
    }
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.client.apiKey) {
      headers['Authorization'] = `Bearer ${this.client.apiKey}`;
    }
    
    return headers;
  }
}

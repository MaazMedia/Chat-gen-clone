export interface ADKClient {
  apiUrl: string;
  apiKey?: string;
}

export function createClient(apiUrl: string, apiKey: string | undefined): ADKClient {
  return {
    apiUrl,
    apiKey,
  };
}

// ADK API client functions
export class AdkApiClient {
  constructor(private client: ADKClient) {}

  async getAgents() {
    const response = await fetch(`${this.client.apiUrl}/agents`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch agents: ${response.statusText}`);
    }
    return response.json();
  }

  async getThreads(agentId?: string) {
    const url = new URL(`${this.client.apiUrl}/threads`);
    if (agentId) {
      url.searchParams.set('agent_id', agentId);
    }
    
    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch threads: ${response.statusText}`);
    }
    return response.json();
  }

  async createThread(agentId: string, title?: string) {
    const response = await fetch(`${this.client.apiUrl}/threads`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ agent_id: agentId, title }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create thread: ${response.statusText}`);
    }
    return response.json();
  }

  async getMessages(threadId: string) {
    const response = await fetch(`${this.client.apiUrl}/threads/${threadId}/messages`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.statusText}`);
    }
    return response.json();
  }

  async sendMessage(threadId: string, content: string, agentId: string) {
    const response = await fetch(`${this.client.apiUrl}/threads/${threadId}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ content, role: 'user', agent_id: agentId }),
    });
    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
    return response.json();
  }

  async streamMessage(threadId: string, content: string, agentId: string): Promise<ReadableStream> {
    const response = await fetch(`${this.client.apiUrl}/threads/${threadId}/messages/stream`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ content, agent_id: agentId }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to stream message: ${response.statusText}`);
    }
    
    if (!response.body) {
      throw new Error('No response body');
    }
    
    return response.body;
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

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
    public statusCode?: number,
  ) {
    super(message);
    this.name = "ADKServerError";
  }
}

export function createClient(
  apiUrl: string,
  apiKey: string | undefined,
): ADKClient {
  return {
    apiUrl,
    apiKey,
  };
}

// ADK API client functions
export class AdkApiClient {
  constructor(
    private client: ADKClient,
    openaiConfig?: { apiKey: string; model?: string; enabled?: boolean },
  ) {
    // Note: Fallback disabled - using ADK server exclusively
    // The ADK server handles OpenAI integration internally
    console.log(
      "🔧 ADK Client initialized - using ADK server exclusively at:",
      client.apiUrl,
    );
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      let errorData: ADKError | undefined;

      try {
        errorData = (await response.json()) as ADKError;
      } catch {
        // Response isn't JSON, create a generic error
        errorData = {
          error: "UNKNOWN_ERROR",
          message: response.statusText || "Unknown error occurred",
        };
      }

      // Specific handling for ADK server unavailable
      if (
        response.status === 503 &&
        errorData.error === "ADK_SERVER_UNAVAILABLE"
      ) {
        throw new ADKServerError(
          "ADK_SERVER_UNAVAILABLE",
          "ADK server is not running. Please start the server or check your configuration.",
          errorData.details,
          503,
        );
      }

      // Generic error handling
      throw new ADKServerError(
        errorData.error,
        errorData.message,
        errorData.details,
        response.status,
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
      return response.json();
    } catch (error) {
      if (error instanceof ADKServerError) {
        throw error;
      }
      // Network error (fetch failed)
      throw new ADKServerError(
        "NETWORK_ERROR",
        "Unable to connect to ADK server. Please check if the server is running.",
        error instanceof Error ? error.message : "Unknown network error",
        0,
      );
    }
  }

  async getThreads(agentId?: string) {
    console.log(`🔍 [Client] getThreads called with agentId: ${agentId}`);

    try {
      const url = new URL(`${this.client.apiUrl}/threads`);
      if (agentId) {
        url.searchParams.set("agent_id", agentId);
      }

      console.log(`📡 [Client] Fetching threads from: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        headers: this.getHeaders(),
      });

      console.log(`📊 [Client] getThreads response status: ${response.status}`);

      await this.handleResponse(response);
      const data = await response.json();

      console.log(`📋 [Client] getThreads response data:`, data);
      console.log(
        `📏 [Client] Number of threads received: ${data.threads ? data.threads.length : 0}`,
      );

      if (data.threads && data.threads.length > 0) {
        console.log(
          `🗂️  [Client] Thread IDs:`,
          data.threads.map((t: any) => t.id),
        );
        console.log(
          `📝 [Client] Thread titles:`,
          data.threads.map((t: any) => t.title || "No title"),
        );
      }

      return data;
    } catch (error) {
      console.error(`❌ [Client] getThreads failed:`, error);
      if (error instanceof ADKServerError) {
        throw error;
      }
      throw new ADKServerError(
        "NETWORK_ERROR",
        "Unable to connect to ADK server. Please check if the server is running.",
        error instanceof Error ? error.message : "Unknown network error",
        0,
      );
    }
  }

  async createThread(agentId: string, title?: string) {
    title = "New Chat";
    console.log(`🆕 [Client] createThread called with:`);
    console.log(`🤖 [Client] Agent ID: ${agentId}`);
    console.log(`📝 [Client] Title: ${title || "No title (will use default)"}`);
    try {
      const requestBody = { agent_id: agentId, title };
      console.log(`📡 [Client] Sending POST to: ${this.client.apiUrl}/threads`);
      console.log(`📋 [Client] Request body:`, requestBody);

      const response = await fetch(`${this.client.apiUrl}/threads`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      console.log(
        `📊 [Client] createThread response status: ${response.status}`,
      );

      await this.handleResponse(response);
      const data = await response.json();

      console.log(`✅ [Client] createThread response data:`, data);
      console.log(`🆔 [Client] New thread ID: ${data.id || data.thread?.id}`);
      console.log(
        `📝 [Client] Thread title: ${data.title || data.thread?.title}`,
      );

      return data;
    } catch (error) {
      console.error(`❌ [Client] createThread failed:`, error);
      if (error instanceof ADKServerError) {
        throw error;
      }
      throw new ADKServerError(
        "NETWORK_ERROR",
        "Unable to connect to ADK server. Please check if the server is running.",
        error instanceof Error ? error.message : "Unknown network error",
        0,
      );
    }
  }

  async deleteThread(threadId: string) {
    console.log(`🌐 Client: Attempting to delete thread ${threadId}`);

    try {
      const response = await fetch(
        `${this.client.apiUrl}/threads/${threadId}`,
        {
          method: "DELETE",
          headers: this.getHeaders(),
        },
      );

      console.log(
        `📡 Client: Delete request sent for thread ${threadId}, status: ${response.status}`,
      );

      await this.handleResponse(response);
      const result = await response.json();

      console.log(`✅ Client: Thread ${threadId} deleted successfully`, result);
      return result;
    } catch (error) {
      console.error(`❌ Client: Failed to delete thread ${threadId}:`, error);

      if (error instanceof ADKServerError) {
        throw error;
      }
      throw new ADKServerError(
        "NETWORK_ERROR",
        "Unable to connect to ADK server. Please check if the server is running.",
        error instanceof Error ? error.message : "Unknown network error",
        0,
      );
    }
  }
  async getMessages(threadId: string) {
    try {
      const response = await fetch(
        `${this.client.apiUrl}/threads/${threadId}/messages`,
        {
          headers: this.getHeaders(),
        },
      );
      await this.handleResponse(response);
      return response.json();
    } catch (error) {
      if (error instanceof ADKServerError) {
        throw error;
      }
      throw new ADKServerError(
        "NETWORK_ERROR",
        "Unable to connect to ADK server. Please check if the server is running.",
        error instanceof Error ? error.message : "Unknown network error",
        0,
      );
    }
  }

  async sendMessage(threadId: string, content: string, agentId: string) {
    try {
      const response = await fetch(
        `${this.client.apiUrl}/threads/${threadId}/messages`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({ content, role: "user", agent_id: agentId }),
        },
      );
      await this.handleResponse(response);
      return response.json();
    } catch (error) {
      if (error instanceof ADKServerError) {
        throw error;
      }
      throw new ADKServerError(
        "NETWORK_ERROR",
        "Unable to connect to ADK server. Please check if the server is running.",
        error instanceof Error ? error.message : "Unknown network error",
        0,
      );
    }
  }

  async streamMessage(
    threadId: string,
    content: string | any[],
    agentId: string,
  ): Promise<ReadableStream> {
    const streamUrl = `${this.client.apiUrl}/threads/${threadId}/messages/stream`;
    console.log(`📡 [Client] streamMessage - URL being used: ${streamUrl}`);
    console.log(`🧵 [Client] streamMessage - Thread ID: ${threadId}`);
    console.log(`🤖 [Client] streamMessage - Agent ID: ${agentId}`);
    console.log(`📝 [Client] streamMessage - Content:`, content);

    try {
      const response = await fetch(streamUrl, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ message: content }),
      });

      console.log(
        `📊 [Client] streamMessage response status: ${response.status}`,
      );
      console.log(`🌐 [Client] streamMessage response URL: ${response.url}`);

      // If there's an error, let's see what the server says
      if (!response.ok) {
        try {
          const errorText = await response.text();
          console.log(`❌ [Client] Server error response:`, errorText);
        } catch (e) {
          console.log(`❌ [Client] Could not read error response:`, e);
        }
      }

      await this.handleResponse(response);

      if (!response.body) {
        throw new ADKServerError(
          "NO_RESPONSE_BODY",
          "No response body received from server",
          undefined,
          response.status,
        );
      }

      return response.body;
    } catch (error) {
      console.error(`❌ [Client] streamMessage failed:`, error);
      if (error instanceof ADKServerError) {
        throw error;
      }
      throw new ADKServerError(
        "NETWORK_ERROR",
        "Unable to connect to ADK server. Please check if the server is running.",
        error instanceof Error ? error.message : "Unknown network error",
        0,
      );
    }
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.client.apiKey) {
      headers["Authorization"] = `Bearer ${this.client.apiKey}`;
    }

    return headers;
  }
}

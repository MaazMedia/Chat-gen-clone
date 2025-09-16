// Web Researcher Agent
// Provides web search and URL fetching capabilities

export class WebResearcher {
  public id = "web-researcher";
  public name = "Web Researcher";
  public description =
    "An assistant that can search the web and fetch information from URLs";

  public tools = [
    {
      id: "web_search",
      name: "Web Search",
      description: "Searches the web for information using a search query",
      schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find relevant information",
          },
          max_results: {
            type: "number",
            description:
              "Maximum number of search results to return (default: 5)",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
    {
      id: "url_fetcher",
      name: "URL Fetcher",
      description: "Fetches and extracts content from a given URL",
      schema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "URL to fetch content from",
          },
          extract_text: {
            type: "boolean",
            description: "Whether to extract only text content (default: true)",
            default: true,
          },
        },
        required: ["url"],
      },
    },
  ];

  async invoke(message: string, context: any = {}) {
    console.log(`🔍 [WebResearcher] Processing message: "${message}"`);

    // Check if message contains URLs that should be fetched
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const urls = message.match(urlPattern);

    if (urls && urls.length > 0) {
      console.log(
        `🌐 [WebResearcher] Detected URLs, fetching content: ${urls}`,
      );
      const url = urls[0]; // Use the first URL found
      const fetchResult = await this.fetchUrl(url, true);

      if ("error" in fetchResult) {
        return {
          content: `I tried to fetch information from ${url}, but encountered an issue: ${fetchResult.message}. Could you check if the URL is accessible?`,
          toolCalls: [],
        };
      } else {
        return {
          content: `I've fetched the content from the URL you provided. Here's what I found: ${fetchResult.content ? fetchResult.content.substring(0, 500) + "..." : "Content successfully retrieved."}`,
          toolCalls: [
            {
              id: "url_fetcher",
              name: "URL Fetcher",
              input: { url: url, extract_text: true },
              result: fetchResult,
            },
          ],
        };
      }
    }

    // Check if the message is asking for web search
    if (
      message.toLowerCase().includes("search") ||
      message.toLowerCase().includes("find") ||
      message.toLowerCase().includes("look up") ||
      message.toLowerCase().includes("research") ||
      message.toLowerCase().includes("what is") ||
      message.toLowerCase().includes("who is") ||
      message.toLowerCase().includes("how to") ||
      message.toLowerCase().includes("latest") ||
      message.toLowerCase().includes("news about")
    ) {
      console.log(
        `🔎 [WebResearcher] Detected search intent, searching for: ${message}`,
      );

      // Extract the actual search query (remove common question words)
      let searchQuery = message
        .replace(
          /^(search for|find|look up|research|what is|who is|how to|latest|news about)\s*/i,
          "",
        )
        .trim();

      if (!searchQuery) {
        searchQuery = message; // Use the full message if we can't extract a clean query
      }

      const searchResult = await this.searchWeb(searchQuery, 5);

      if ("error" in searchResult) {
        return {
          content: `I tried to search for "${searchQuery}" but encountered an issue: ${searchResult.message}. Let me try a different approach or you could rephrase your query.`,
          toolCalls: [],
        };
      } else {
        return {
          content: `I found some information about "${searchQuery}". Here are the search results I discovered for you.`,
          toolCalls: [
            {
              id: "web_search",
              name: "Web Search",
              input: { query: searchQuery, max_results: 5 },
              result: searchResult,
            },
          ],
        };
      }
    }

    // Check for general research-related queries
    if (
      message.toLowerCase().includes("web") ||
      message.toLowerCase().includes("internet") ||
      message.toLowerCase().includes("online") ||
      message.toLowerCase().includes("website")
    ) {
      return {
        content:
          "I'm here to help you research information on the web! I can search for topics, fetch content from specific URLs, and find the latest information online. What would you like me to research for you?",
        toolCalls: [],
      };
    }

    // Default friendly greeting
    return {
      content:
        "Hello! I'm your Web Researcher. I can search the web for information, fetch content from URLs, and help you find answers to your questions online. Just tell me what you'd like to research, or paste a URL you'd like me to analyze!",
      toolCalls: [],
    };
  }

  async executeTool(toolId: string, input: any) {
    switch (toolId) {
      case "web_search":
        return this.searchWeb(input.query, input.max_results || 5);
      case "url_fetcher":
        return this.fetchUrl(input.url, input.extract_text !== false);
      default:
        throw new Error(`Unknown tool: ${toolId}`);
    }
  }

  private async searchWeb(query: string, maxResults: number = 5) {
    try {
      // Simulate web search results
      // In a real implementation, you'd use a search API like Google Custom Search, Bing, or DuckDuckGo
      const mockResults = [
        {
          title: `Search results for: ${query}`,
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
          snippet: `This is a simulated search result for "${query}". In a real implementation, this would use actual search APIs.`,
          source: "Example.com",
        },
        {
          title: `${query} - Wikipedia`,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
          snippet: `Wikipedia article about ${query}. This is a mock result for demonstration purposes.`,
          source: "Wikipedia",
        },
        {
          title: `Learn about ${query}`,
          url: `https://learning.example.com/${encodeURIComponent(query)}`,
          snippet: `Educational content about ${query}. This is another simulated search result.`,
          source: "Learning.example.com",
        },
      ];

      return {
        query: query,
        results: mockResults.slice(0, maxResults),
        total_results: mockResults.length,
        search_time: "0.23 seconds",
        note: "This is a simulated search result. In production, integrate with real search APIs.",
      };
    } catch (error) {
      return {
        error: "Failed to search web",
        message: error instanceof Error ? error.message : "Unknown error",
        query: query,
      };
    }
  }

  private async fetchUrl(url: string, extractText: boolean = true) {
    try {
      // Validate URL
      const urlObj = new URL(url);

      // Simulate URL fetching
      // In a real implementation, you'd use fetch() or a library like Puppeteer for complex sites
      const mockContent = {
        url: url,
        title: `Content from ${urlObj.hostname}`,
        content: extractText
          ? `This is simulated text content extracted from ${url}. In a real implementation, this would fetch and parse the actual webpage content.`
          : `<html><head><title>Simulated Content</title></head><body><p>This is simulated HTML content from ${url}</p></body></html>`,
        content_type: extractText ? "text/plain" : "text/html",
        status_code: 200,
        fetch_time: new Date().toISOString(),
        note: "This is simulated content. In production, implement actual web scraping.",
      };

      return mockContent;
    } catch (error) {
      return {
        error: "Failed to fetch URL",
        message: error instanceof Error ? error.message : "Unknown error",
        url: url,
      };
    }
  }
}

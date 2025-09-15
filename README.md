# ADK Agent Chat UI

A complete reference architecture for a chat AI bot using Next.js frontend with Google Agent Development Kit (ADK) backend. This project preserves the exact style and user interaction experience of the original [agent-chat-ui](https://github.com/langchain-ai/agent-chat-ui) from LangChain while replacing LangGraph with ADK.

## Features

- 🎨 **Preserved UI/UX**: Maintains the exact look, feel, and behavior of the original agent-chat-ui
- 🤖 **Agent Picker**: Dynamic agent selection from ADK backend
- 💬 **Thread Management**: Create, continue, and manage conversation threads
- 🔄 **Streaming Responses**: Real-time token-by-token response streaming
- 🛠️ **Tool Invocation**: Visual tool call events with expand/collapse functionality
- 📁 **File Uploads**: Support for text, image, and PDF uploads with previews
- 🐳 **Docker Ready**: Complete containerization with docker-compose
- 🗄️ **PostgreSQL**: Persistent storage for threads, messages, and tool calls
- 🔧 **Dual Deployment**: Run via CLI or Docker containers

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js Web   │    │   ADK Server     │    │   PostgreSQL    │
│     (Port 3000) │◄──►│   (Port 8080)    │◄──►│   (Port 5432)   │
│                 │    │                  │    │                 │
│ • Agent Chat UI │    │ • Math Assistant │    │ • Threads       │
│ • Proxy Routes  │    │ • Web Researcher │    │ • Messages      │
│ • File Uploads  │    │ • Tool Execution │    │ • Tool Calls    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │     pgAdmin      │
                       │   (Port 5050)    │
                       │                  │
                       │ • DB Management  │
                       │ • Query Interface│
                       └──────────────────┘
```

## Quick Start

### Option 1: Docker Compose (Recommended)

1. **Clone and setup**:
   ```bash
   git clone <your-repo-url>
   cd agent-chat-ui
   ```

2. **Start the full stack**:
   ```bash
   docker-compose up --build
   ```

3. **Access the services**:
   - **Chat UI**: http://localhost:3000
   - **ADK Server**: http://localhost:8080
   - **pgAdmin**: http://localhost:5050 (admin@example.com / admin)

### Option 2: Local Development

1. **Prerequisites**:
   - Node.js 20+
   - PostgreSQL 17+
   - pnpm (recommended) or npm

2. **Setup PostgreSQL**:
   ```bash
   # Install and start PostgreSQL
   createdb adk_chat
   ```

3. **Setup ADK Server**:
   ```bash
   cd adk-server
   npm install
   cp .env.example .env
   # Edit .env with your database connection details
   npm run dev
   ```

4. **Setup Frontend**:
   ```bash
   # In project root
   pnpm install
   cp .env.example .env.local
   # Edit .env.local if needed
   pnpm dev
   ```

5. **Access the application**:
   - Frontend: http://localhost:3000
   - ADK Server: http://localhost:8080

## Configuration

### Environment Variables

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_ASSISTANT_ID=math-assistant
ADK_API_URL=http://localhost:8080
ADK_API_KEY=
```

#### ADK Server (.env)
```bash
ADK_PORT=8080
ADK_HOST=0.0.0.0
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=adk_chat
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
```

#### OpenAI Fallback Configuration

When the ADK server is unavailable, the application can automatically fall back to OpenAI's API for a seamless user experience. Add these variables to your `.env.local`:

```bash
# OpenAI Fallback Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
ENABLE_OPENAI_FALLBACK=true
```

**Features:**
- 🔄 **Automatic Fallback**: Seamlessly switches to OpenAI when ADK server is down
- 🎯 **Preserved Experience**: Maintains same UI/UX with OpenAI backend
- 📝 **Thread Management**: Creates and manages conversation threads
- 🔒 **Secure**: Only activates when ADK is unreachable and properly configured

**Note**: The OpenAI fallback provides a similar chat experience but won't have access to the custom tools available in the ADK agents (calculator, web search, etc.).

### Agents and Tools

The ADK server comes with two sample agents:

#### Math Assistant (`math-assistant`)
- **Tools**: Calculator, Equation Solver
- **Capabilities**: Basic arithmetic, linear equation solving
- **Example**: "Calculate 2 + 3 * 4" or "Solve 2x + 5 = 13"

#### Web Researcher (`web-researcher`)
- **Tools**: Web Search, URL Fetcher
- **Capabilities**: Simulated web search and content fetching
- **Example**: "Search for information about Next.js" or "Fetch content from https://example.com"

## Database Schema

The ADK server automatically creates the following tables:

- `threads`: Conversation threads
- `messages`: Individual messages in threads
- `tool_calls`: Tool invocation records
- `attachments`: File upload metadata

## API Endpoints

### ADK Server
- `GET /agents` - List available agents
- `GET /threads` - List threads (optional agent_id filter)
- `POST /threads` - Create new thread
- `GET /threads/:id/messages` - Get thread messages
- `POST /threads/:id/messages` - Send message
- `POST /threads/:id/messages/stream` - Stream message response

### Next.js Proxy
- `/api/*` - Proxies all requests to ADK server

## Development

### Adding New Agents

1. Create agent class in `adk-server/src/agents/`:
   ```typescript
   export class MyAgent {
     public id = 'my-agent';
     public name = 'My Agent';
     public description = 'Description of what the agent does';
     
     public tools = [
       // Define tools here
     ];
     
     async invoke(message: string, context: any = {}) {
       // Agent logic here
     }
     
     async executeTool(toolId: string, input: any) {
       // Tool execution logic here
     }
   }
   ```

2. Register in `adk-server/src/server.ts`:
   ```typescript
   const myAgent = new MyAgent();
   this.adkServer.registerAgent('my-agent', myAgent);
   ```

### Customizing the UI

The frontend preserves all the original agent-chat-ui components. Key files:

- `src/components/thread/index.tsx` - Main chat interface
- `src/components/agent-picker.tsx` - Agent selection dropdown
- `src/providers/Stream.tsx` - Streaming chat logic
- `src/providers/Thread.tsx` - Thread management

## Testing ADK-Web Compatibility

To verify ADK-web compatibility:

1. **Install adk-web**:
   ```bash
   git clone https://github.com/google/adk-web
   cd adk-web
   # Follow adk-web setup instructions
   ```

2. **Point to your ADK server**:
   ```bash
   # Configure adk-web to use http://localhost:8080
   ```

3. **Verify data consistency**:
   - Threads and messages should be visible in both UIs
   - Tool calls should be properly recorded
   - File attachments should be accessible

## Troubleshooting

### Common Issues

1. **Connection errors**:
   - Ensure PostgreSQL is running
   - Check database connection strings
   - Verify ADK server is accessible

2. **Docker issues**:
   ```bash
   # Reset containers
   docker-compose down -v
   docker-compose up --build
   ```

3. **Port conflicts**:
   - Change ports in docker-compose.yml if needed
   - Update NEXT_PUBLIC_API_URL accordingly

4. **Missing dependencies**:
   ```bash
   # Frontend
   pnpm install
   
   # Backend
   cd adk-server && npm install
   ```

### Logs

```bash
# View logs
docker-compose logs -f adk-server
docker-compose logs -f web
docker-compose logs -f postgres

# Individual service logs
docker logs adk-server
docker logs adk-web
```

## Production Deployment

For production deployment:

1. **Security**:
   - Change default passwords
   - Use environment-specific secrets
   - Enable HTTPS
   - Configure proper CORS settings

2. **Performance**:
   - Use connection pooling for PostgreSQL
   - Configure Redis for session storage
   - Set up CDN for static assets
   - Enable compression

3. **Monitoring**:
   - Add health checks
   - Configure logging
   - Set up metrics collection
   - Monitor database performance

## Migration from LangGraph

This project demonstrates how to migrate from LangGraph to ADK while preserving UI/UX:

1. **API Layer**: Replaced LangGraph SDK with ADK HTTP client
2. **Streaming**: Adapted from LangGraph SSE to ADK streaming format
3. **Providers**: Updated Stream and Thread providers for ADK APIs
4. **Components**: Preserved all UI components with minimal interface changes
5. **Backend**: Created ADK server with compatible agent and tool patterns

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project maintains the same license as the original agent-chat-ui.

## Acknowledgments

- Original [agent-chat-ui](https://github.com/langchain-ai/agent-chat-ui) by LangChain
- [Google ADK](https://google.github.io/adk-docs/) for the agent framework
- Next.js and React communities for the excellent tooling
  content?: string;
  description?: string;
}) {
  const [Artifact, { open, setOpen }] = useArtifact();

  return (
    <>
      <div
        onClick={() => setOpen(!open)}
        className="cursor-pointer rounded-lg border p-4"
      >
        <p className="font-medium">{props.title}</p>
        <p className="text-sm text-gray-500">{props.description}</p>
      </div>

      <Artifact title={props.title}>
        <p className="p-4 whitespace-pre-wrap">{props.content}</p>
      </Artifact>
    </>
  );
}
```

## Going to Production

Once you're ready to go to production, you'll need to update how you connect, and authenticate requests to your deployment. By default, the Agent Chat UI is setup for local development, and connects to your LangGraph server directly from the client. This is not possible if you want to go to production, because it requires every user to have their own LangSmith API key, and set the LangGraph configuration themselves.

### Production Setup

To productionize the Agent Chat UI, you'll need to pick one of two ways to authenticate requests to your LangGraph server. Below, I'll outline the two options:

### Quickstart - API Passthrough

The quickest way to productionize the Agent Chat UI is to use the [API Passthrough](https://github.com/bracesproul/langgraph-nextjs-api-passthrough) package ([NPM link here](https://www.npmjs.com/package/langgraph-nextjs-api-passthrough)). This package provides a simple way to proxy requests to your LangGraph server, and handle authentication for you.

This repository already contains all of the code you need to start using this method. The only configuration you need to do is set the proper environment variables.

```bash
NEXT_PUBLIC_ASSISTANT_ID="agent"
# This should be the deployment URL of your LangGraph server
LANGGRAPH_API_URL="https://my-agent.default.us.langgraph.app"
# This should be the URL of your website + "/api". This is how you connect to the API proxy
NEXT_PUBLIC_API_URL="https://my-website.com/api"
# Your LangSmith API key which is injected into requests inside the API proxy
LANGSMITH_API_KEY="lsv2_..."
```

Let's cover what each of these environment variables does:

- `NEXT_PUBLIC_ASSISTANT_ID`: The ID of the assistant you want to use when fetching, and submitting runs via the chat interface. This still needs the `NEXT_PUBLIC_` prefix, since it's not a secret, and we use it on the client when submitting requests.
- `LANGGRAPH_API_URL`: The URL of your LangGraph server. This should be the production deployment URL.
- `NEXT_PUBLIC_API_URL`: The URL of your website + `/api`. This is how you connect to the API proxy. For the [Agent Chat demo](https://agentchat.vercel.app), this would be set as `https://agentchat.vercel.app/api`. You should set this to whatever your production URL is.
- `LANGSMITH_API_KEY`: Your LangSmith API key to use when authenticating requests sent to LangGraph servers. Once again, do _not_ prefix this with `NEXT_PUBLIC_` since it's a secret, and is only used on the server when the API proxy injects it into the request to your deployed LangGraph server.

For in depth documentation, consult the [LangGraph Next.js API Passthrough](https://www.npmjs.com/package/langgraph-nextjs-api-passthrough) docs.

### Advanced Setup - Custom Authentication

Custom authentication in your LangGraph deployment is an advanced, and more robust way of authenticating requests to your LangGraph server. Using custom authentication, you can allow requests to be made from the client, without the need for a LangSmith API key. Additionally, you can specify custom access controls on requests.

To set this up in your LangGraph deployment, please read the LangGraph custom authentication docs for [Python](https://langchain-ai.github.io/langgraph/tutorials/auth/getting_started/), and [TypeScript here](https://langchain-ai.github.io/langgraphjs/how-tos/auth/custom_auth/).

Once you've set it up on your deployment, you should make the following changes to the Agent Chat UI:

1. Configure any additional API requests to fetch the authentication token from your LangGraph deployment which will be used to authenticate requests from the client.
2. Set the `NEXT_PUBLIC_API_URL` environment variable to your production LangGraph deployment URL.
3. Set the `NEXT_PUBLIC_ASSISTANT_ID` environment variable to the ID of the assistant you want to use when fetching, and submitting runs via the chat interface.
4. Modify the [`useTypedStream`](src/providers/Stream.tsx) (extension of `useStream`) hook to pass your authentication token through headers to the LangGraph server:

```tsx
const streamValue = useTypedStream({
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  assistantId: process.env.NEXT_PUBLIC_ASSISTANT_ID,
  // ... other fields
  defaultHeaders: {
    Authentication: `Bearer ${addYourTokenHere}`, // this is where you would pass your authentication token
  },
});
```

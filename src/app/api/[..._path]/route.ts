// Local ADK API Implementation
// Handles ADK requests directly within Next.js using local implementation

import { getADKInstance } from "@/lib/local-adk";
import { NextRequest } from "next/server";

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
}

async function handleADKRequest(request: NextRequest, method: string) {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split("/").slice(3); // Remove /api prefix
  const adkPath = pathSegments.join("/");

  try {
    const adk = getADKInstance();

    // Handle different ADK endpoints
    switch (true) {
      case adkPath === "agents" && method === "GET":
        return handleGetAgents(adk);

      case adkPath === "threads" && method === "GET":
        return handleGetThreads(adk);

      case adkPath === "threads" && method === "POST":
        return handleCreateThread(adk);

      case adkPath.startsWith("threads/") &&
        adkPath.endsWith("/messages") &&
        method === "GET":
        const threadId = adkPath.split("/")[1];
        return handleGetMessages(adk, threadId);

      case adkPath.startsWith("threads/") &&
        adkPath.endsWith("/messages") &&
        method === "POST":
        const postThreadId = adkPath.split("/")[1];
        return handleSendMessage(adk, postThreadId, request);

      case adkPath.includes("/messages/") &&
        adkPath.endsWith("/stream") &&
        method === "POST":
        const parts = adkPath.split("/");
        const streamThreadId = parts[1];
        return handleStreamMessage(adk, streamThreadId, request);

      default:
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { ...corsHeaders(), "content-type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Local ADK error:", error);

    const errorResponse = {
      error: "LOCAL_ADK_ERROR",
      message:
        error instanceof Error ? error.message : "Unknown local ADK error",
      details: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders(), "content-type": "application/json" },
    });
  }
}

async function handleGetAgents(adk: any) {
  const agents = adk.getAllAgents().map((agent: any) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    tools: agent.tools,
  }));

  return new Response(JSON.stringify({ agents }), {
    headers: { ...corsHeaders(), "content-type": "application/json" },
  });
}

async function handleGetThreads(adk: any) {
  const threads = adk.getAllThreads();
  return new Response(JSON.stringify({ threads }), {
    headers: { ...corsHeaders(), "content-type": "application/json" },
  });
}

async function handleCreateThread(adk: any) {
  const thread = adk.createThread();
  return new Response(JSON.stringify({ thread }), {
    headers: { ...corsHeaders(), "content-type": "application/json" },
  });
}

async function handleGetMessages(adk: any, threadId: string) {
  const thread = adk.getThread(threadId);
  if (!thread) {
    return new Response(JSON.stringify({ error: "Thread not found" }), {
      status: 404,
      headers: { ...corsHeaders(), "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ messages: thread.messages }), {
    headers: { ...corsHeaders(), "content-type": "application/json" },
  });
}

async function handleSendMessage(
  adk: any,
  threadId: string,
  request: NextRequest,
) {
  const body = await request.json();
  const { message, agent_id = "math-assistant" } = body;

  if (!message) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { ...corsHeaders(), "content-type": "application/json" },
    });
  }

  const response = await adk.invokeAgent(agent_id, message, threadId);

  return new Response(JSON.stringify({ response }), {
    headers: { ...corsHeaders(), "content-type": "application/json" },
  });
}

async function handleStreamMessage(
  adk: any,
  threadId: string,
  request: NextRequest,
) {
  const body = await request.json();
  const { message, agent_id = "math-assistant" } = body;

  if (!message) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { ...corsHeaders(), "content-type": "application/json" },
    });
  }

  // Create a streaming response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of adk.streamInvokeAgent(
          agent_id,
          message,
          threadId,
        )) {
          const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("Streaming error:", error);
        const errorData = `data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders(),
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function GET(request: NextRequest) {
  return handleADKRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  return handleADKRequest(request, "POST");
}

export async function PUT(request: NextRequest) {
  return handleADKRequest(request, "PUT");
}

export async function PATCH(request: NextRequest) {
  return handleADKRequest(request, "PATCH");
}

export async function DELETE(request: NextRequest) {
  return handleADKRequest(request, "DELETE");
}

export const runtime = "edge";

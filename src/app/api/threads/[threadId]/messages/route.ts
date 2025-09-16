// Local ADK Messages API
import { getADKInstance } from "@/lib/local-adk";

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const resolvedParams = await params;
    const adk = getADKInstance();

    // Debug: Log all available threads
    const allThreads = adk.getAllThreads();
    console.log(
      `[Messages API] Looking for thread: ${resolvedParams.threadId}`,
    );
    console.log(
      `[Messages API] Available threads: ${allThreads.map((t) => t.id).join(", ")}`,
    );

    const thread = adk.getThread(resolvedParams.threadId);

    if (!thread) {
      console.log(
        `[Messages API] Thread not found: ${resolvedParams.threadId}`,
      );
      return new Response(
        JSON.stringify({
          error: "Thread not found",
          threadId: resolvedParams.threadId,
          availableThreads: allThreads.map((t) => t.id),
        }),
        {
          status: 404,
          headers: { ...corsHeaders(), "content-type": "application/json" },
        },
      );
    }

    console.log(
      `[Messages API] Found thread with ${thread.messages.length} messages`,
    );
    const messages = thread.messages;

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { ...corsHeaders(), "content-type": "application/json" },
    });
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    const { content, agent_id } = body;

    const adk = getADKInstance();

    // Check if thread exists
    const thread = adk.getThread(resolvedParams.threadId);
    if (!thread) {
      return new Response(JSON.stringify({ error: "Thread not found" }), {
        status: 404,
        headers: { ...corsHeaders(), "content-type": "application/json" },
      });
    }

    // Use the invokeAgent method to send message and get response
    const response = await adk.invokeAgent(
      agent_id,
      content,
      resolvedParams.threadId,
    );

    // Get the last message (assistant response) from the thread
    const messages = thread.messages;
    const lastMessage = messages[messages.length - 1];

    return new Response(JSON.stringify({ message: lastMessage }), {
      status: 201,
      headers: { ...corsHeaders(), "content-type": "application/json" },
    });
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

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

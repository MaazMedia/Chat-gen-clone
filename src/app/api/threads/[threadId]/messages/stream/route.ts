// Local ADK Messages Stream API
import { getADKInstance } from "@/lib/local-adk";

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    const { content, agent_id } = body;

    if (!content || !agent_id) {
      return new Response(
        JSON.stringify({
          error: "BAD_REQUEST",
          message: "Content and agent_id are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders(), "content-type": "application/json" },
        },
      );
    }

    const adk = getADKInstance();

    // Check if thread exists
    const thread = adk.getThread(resolvedParams.threadId);
    if (!thread) {
      return new Response(
        JSON.stringify({
          error: "NOT_FOUND",
          message: "Thread not found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders(), "content-type": "application/json" },
        },
      );
    }

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Get AI response - this will add both user and assistant messages to the thread
          const response = await adk.invokeAgent(
            agent_id,
            content,
            resolvedParams.threadId,
          );

          // Get the messages from the thread (should have both user and assistant messages now)
          const messages = thread.messages;
          const userMessage = messages[messages.length - 2]; // Second to last should be user message
          const assistantMessage = messages[messages.length - 1]; // Last should be assistant message

          // Send user message event if it exists
          if (userMessage && userMessage.role === "user") {
            const userMessageEvent = `data: ${JSON.stringify({
              type: "message",
              message: userMessage,
            })}\n\n`;
            controller.enqueue(encoder.encode(userMessageEvent));
          }

          // Send assistant message event if it exists
          if (assistantMessage && assistantMessage.role === "assistant") {
            const assistantMessageEvent = `data: ${JSON.stringify({
              type: "message",
              message: assistantMessage,
            })}\n\n`;
            controller.enqueue(encoder.encode(assistantMessageEvent));
          }

          // Send completion event
          const completeEvent = `data: ${JSON.stringify({
            type: "complete",
          })}\n\n`;
          controller.enqueue(encoder.encode(completeEvent));
        } catch (error) {
          console.error("Stream error:", error);

          // Send error event
          const errorEvent = `data: ${JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Local ADK stream error:", error);

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

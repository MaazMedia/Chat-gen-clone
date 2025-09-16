// Local ADK Agents API
import { getADKInstance } from "@/lib/local-adk";

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
}

export async function GET() {
  try {
    const adk = getADKInstance();

    const agents = adk.getAllAgents().map((agent: any) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      tools: agent.tools,
    }));

    return new Response(JSON.stringify({ agents }), {
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

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

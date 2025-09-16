import { NextResponse } from "next/server";

export async function GET() {
  const openaiConfig = {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    enabled: true, // Always enabled for local ADK implementation
    useLocal: true, // Indicate this is for local ADK, not fallback
  };

  // Check if we have an OpenAI API key for the local implementation
  if (!openaiConfig.apiKey || openaiConfig.apiKey.includes("placeholder")) {
    return NextResponse.json({
      enabled: false,
      error: "OpenAI API key required for local ADK implementation",
    });
  }

  return NextResponse.json(openaiConfig);
}

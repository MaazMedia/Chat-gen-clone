import { NextResponse } from 'next/server';

export async function GET() {
  const openaiConfig = {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    enabled: process.env.ENABLE_OPENAI_FALLBACK === 'true'
  };

  // Only return the config if OpenAI fallback is enabled
  if (!openaiConfig.enabled || !openaiConfig.apiKey) {
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json(openaiConfig);
}
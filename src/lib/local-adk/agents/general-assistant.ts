// General Assistant Agent for Local ADK
// Provides general conversation and question answering capabilities

import { BaseADKAgent } from "../base-agent";
import { ADKTool } from "../core";

export class GeneralAssistantAgent extends BaseADKAgent {
  id = "general-assistant";
  name = "General Assistant";
  description =
    "A helpful AI assistant that can answer questions, help with tasks, and have conversations on a wide range of topics";

  tools: ADKTool[] = [
    {
      id: "text_generation",
      name: "Text Generation",
      description: "Generates helpful responses to user questions and requests",
      schema: {
        type: "object",
        properties: {
          user_input: {
            type: "string",
            description: "The user's question or request",
          },
          context: {
            type: "string",
            description: "Additional context for the response",
          },
        },
        required: ["user_input"],
      },
    },
    {
      id: "explanation",
      name: "Explanation",
      description: "Provides detailed explanations on various topics",
      schema: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "The topic to explain",
          },
          detail_level: {
            type: "string",
            description: "Level of detail (basic, intermediate, advanced)",
            enum: ["basic", "intermediate", "advanced"],
          },
        },
        required: ["topic"],
      },
    },
  ];

  async executeTool(toolId: string, input: any): Promise<any> {
    console.log(`[General Assistant] Executing tool: ${toolId}`, input);

    switch (toolId) {
      case "text_generation":
        return {
          response: `I'll help you with that. Let me think about your request: "${input.user_input}"`,
          type: "text_response",
        };

      case "explanation":
        const level = input.detail_level || "intermediate";
        return {
          explanation: `Here's a ${level} explanation of ${input.topic}:`,
          detail_level: level,
          type: "explanation",
        };

      default:
        throw new Error(`Unknown tool: ${toolId}`);
    }
  }

  async invoke(
    message: string,
    context?: any,
  ): Promise<{ content: string; toolCalls?: any[] }> {
    console.log(`[General Assistant] Processing message: ${message}`);

    // Use the base implementation which calls OpenAI
    return super.invoke(message, context);
  }

  protected getSystemPrompt(): string {
    return `You are a helpful AI assistant. You can answer questions, help with various tasks, and have conversations on a wide range of topics. 

Key capabilities:
- Answer questions accurately and helpfully
- Provide explanations and educational content
- Help with writing, analysis, and problem-solving
- Engage in natural conversation
- Admit when you don't know something

Please be:
- Helpful and informative
- Clear and concise
- Honest about limitations
- Respectful and professional`;
  }
}

// Base Agent Implementation for Local ADK
// Provides common functionality for all agents

import OpenAI from "openai";
import { ADKAgent, ADKTool } from "./core";

export abstract class BaseADKAgent implements ADKAgent {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract tools: ADKTool[];

  protected openai: OpenAI;
  protected model: string;

  constructor(openai: OpenAI, model: string = "gpt-4o-mini") {
    this.openai = openai;
    this.model = model;
  }

  protected getSystemPrompt(): string {
    return `You are ${this.name}, ${this.description}

Available tools:
${this.tools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n")}

When you need to use a tool, respond with: TOOL_CALL:${JSON.stringify({ toolId: "tool_id", input: {} })}

Always be helpful and provide accurate information.`;
  }

  async invoke(
    message: string,
    context?: any,
  ): Promise<{ content: string; toolCalls?: any[] }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: this.getSystemPrompt() },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      let content = response.choices[0]?.message?.content || "";
      const toolCalls: any[] = [];

      // Check if the response contains a tool call
      if (content.includes("TOOL_CALL:")) {
        // Find the start of the JSON after TOOL_CALL:
        const toolCallStart = content.indexOf("TOOL_CALL:");
        if (toolCallStart !== -1) {
          const jsonStart = toolCallStart + "TOOL_CALL:".length;
          let jsonStr = "";
          let braceCount = 0;
          let inJson = false;

          // Extract complete JSON object by counting braces
          for (let i = jsonStart; i < content.length; i++) {
            const char = content[i];
            if (char === "{") {
              inJson = true;
              braceCount++;
            }
            if (inJson) {
              jsonStr += char;
            }
            if (char === "}") {
              braceCount--;
              if (braceCount === 0 && inJson) {
                break;
              }
            }
          }

          if (jsonStr) {
            try {
              const toolCall = JSON.parse(jsonStr);
              const toolResult = await this.executeTool(
                toolCall.toolId,
                toolCall.input,
              );

              // Add tool call info for UI display
              const foundTool = this.tools.find(
                (t) => t.id === toolCall.toolId,
              );
              toolCalls.push({
                id: `call_${Date.now()}`,
                tool_name: foundTool?.name || toolCall.toolId,
                tool_input: toolCall.input,
                tool_output: toolResult,
                status: "completed",
              });

              // Get a follow-up response incorporating the tool result
              const followUpResponse =
                await this.openai.chat.completions.create({
                  model: this.model,
                  messages: [
                    { role: "system", content: this.getSystemPrompt() },
                    { role: "user", content: message },
                    { role: "assistant", content: content },
                    {
                      role: "user",
                      content: `Tool result: ${JSON.stringify(toolResult)}. Please provide a natural response based on this result.`,
                    },
                  ],
                  temperature: 0.7,
                  max_tokens: 1000,
                });

              content =
                followUpResponse.choices[0]?.message?.content || content;
            } catch (error) {
              console.error("Tool execution error:", error);
              console.error("Failed JSON string:", jsonStr);
              content = content.replace(
                /TOOL_CALL:.*/,
                "I encountered an error while using the tool. Let me provide a direct response instead.",
              );
            }
          }
        }
      }

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      console.error("Agent invoke error:", error);
      throw new Error(
        `Failed to invoke agent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async *streamInvoke(
    message: string,
    context?: any,
  ): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: this.getSystemPrompt() },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });

      let fullContent = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullContent += content;
          yield content;
        }
      }

      // Handle tool calls in streaming (simplified - no tool execution in streaming for now)
      if (fullContent.includes("TOOL_CALL:")) {
        const toolCallMatch = fullContent.match(/TOOL_CALL:({.*?})/);
        if (toolCallMatch) {
          try {
            const toolCall = JSON.parse(toolCallMatch[1]);
            const toolResult = await this.executeTool(
              toolCall.toolId,
              toolCall.input,
            );

            // Stream a follow-up response
            yield "\n\n";
            const followUpStream = await this.openai.chat.completions.create({
              model: this.model,
              messages: [
                { role: "system", content: this.getSystemPrompt() },
                { role: "user", content: message },
                {
                  role: "user",
                  content: `Tool result: ${JSON.stringify(toolResult)}. Please provide a natural response based on this result.`,
                },
              ],
              temperature: 0.7,
              max_tokens: 1000,
              stream: true,
            });

            for await (const chunk of followUpStream) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                yield content;
              }
            }
          } catch (error) {
            console.error("Tool execution error in stream:", error);
            yield "\n\nI encountered an error while using the tool. Let me provide a direct response instead.";
          }
        }
      }
    } catch (error) {
      console.error("Agent stream invoke error:", error);
      throw new Error(
        `Failed to stream invoke agent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  abstract executeTool(toolId: string, input: any): Promise<any>;
}

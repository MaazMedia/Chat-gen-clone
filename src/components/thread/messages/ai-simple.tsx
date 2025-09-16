import { useStreamContext } from "@/providers/Stream";
import { Message, ToolCall } from "@/lib/adk-types";
import { MarkdownText } from "../markdown-text";
import { cn } from "@/lib/utils";
import { ToolCalls } from "./tool-calls";

interface AIMessageProps {
  message: Message;
  className?: string;
}

export function AIMessage({ message, className }: AIMessageProps) {
  const thread = useStreamContext();
  const { hideToolCalls } = thread;

  console.log("🚀 AI-SIMPLE MESSAGE COMPONENT CALLED!", message?.id);
  console.log("=== AI-SIMPLE MESSAGE DEBUG ===");
  console.log("Message:", message);
  console.log("Message role:", message?.role);
  console.log("Message content:", message?.content);
  console.log("Tool calls raw:", message?.tool_calls);
  console.log("Hide tool calls:", hideToolCalls);
  console.log("================================");

  if (!message || message.role !== "assistant") {
    console.log("❌ AI-Simple: Not an assistant message, returning null");
    return null;
  }

  const toolCalls = message.tool_calls || [];
  const hasToolCalls = toolCalls.length > 0;

  console.log("✅ AI-Simple: Processing assistant message");
  console.log("Tool calls array:", toolCalls);
  console.log("Has tool calls:", hasToolCalls);
  console.log("Should show tool calls:", !hideToolCalls && hasToolCalls);

  return (
    <div className={cn("group flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-2">
        {/* Message content */}
        {message.content && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MarkdownText>{message.content}</MarkdownText>
          </div>
        )}

        {/* Tool calls */}
        {!hideToolCalls && hasToolCalls && (
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm">
              Tool calls executed:
            </div>
            {toolCalls.map((toolCall, index) => {
              console.log("🔧 [ai-simple] Rendering tool call:", toolCall);
              console.log(
                "🔧 [ai-simple] Tool input type:",
                typeof toolCall.tool_input,
              );
              console.log("🔧 [ai-simple] Tool output:", toolCall.tool_output);

              // Parse tool_input if it's a string
              let parsedInput = toolCall.tool_input;
              if (typeof toolCall.tool_input === "string") {
                try {
                  parsedInput = JSON.parse(toolCall.tool_input);
                } catch (e) {
                  console.log(
                    "🔧 [ai-simple] Failed to parse tool_input as JSON:",
                    e,
                  );
                }
              }

              return (
                <div
                  key={toolCall.id || index}
                  className="bg-muted rounded-md p-2 text-sm"
                >
                  <div className="font-medium">{toolCall.tool_name}</div>
                  <div className="text-muted-foreground">
                    Input: {JSON.stringify(parsedInput)}
                  </div>
                  {toolCall.tool_output && (
                    <div className="text-muted-foreground">
                      Output: {JSON.stringify(toolCall.tool_output)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

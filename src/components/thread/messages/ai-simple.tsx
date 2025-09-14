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

  if (!message || message.role !== 'assistant') {
    return null;
  }

  const toolCalls = message.tool_calls || [];
  const hasToolCalls = toolCalls.length > 0;

  return (
    <div className={cn("group flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-2">
        {/* Message content */}
        {message.content && (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <MarkdownText>{message.content}</MarkdownText>
          </div>
        )}

        {/* Tool calls */}
        {hasToolCalls && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Tool calls executed:
            </div>
            {toolCalls.map((toolCall, index) => (
              <div key={toolCall.id || index} className="bg-muted p-2 rounded-md text-sm">
                <div className="font-medium">{toolCall.tool_name}</div>
                <div className="text-muted-foreground">
                  Input: {JSON.stringify(toolCall.tool_input)}
                </div>
                {toolCall.tool_output && (
                  <div className="text-muted-foreground">
                    Output: {JSON.stringify(toolCall.tool_output)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
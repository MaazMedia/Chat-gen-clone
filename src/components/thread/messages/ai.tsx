import { parsePartialJson } from "@/lib/adk-types";
import { useStreamContext } from "@/providers/Stream";
import {
  AIMessage,
  Checkpoint,
  Message,
  MessageContentComplex,
  getContentString,
} from "@/lib/adk-types";
import { BranchSwitcher, CommandBar } from "./shared";
import { MarkdownText } from "../markdown-text";
import { cn } from "@/lib/utils";
import { ToolCalls, ToolResult } from "./tool-calls";
import { Fragment } from "react/jsx-runtime";
// import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
// import { ThreadView } from "../agent-inbox";
import { useQueryState, parseAsBoolean } from "nuqs";
import { GenericInterruptView } from "./generic-interrupt";
import { useArtifact } from "../artifact";

function CustomComponent({
  message,
  thread,
}: {
  message: Message;
  thread: ReturnType<typeof useStreamContext>;
}) {
  const artifact = useArtifact();
  const { values } = useStreamContext();
  const customComponents = values.ui?.filter(
    (ui) => ui.metadata?.message_id === message.id,
  );

  if (!customComponents?.length) return null;
  return (
    <Fragment key={message.id}>
      {customComponents.map((customComponent) => (
        <LoadExternalComponent
          key={customComponent.id}
          stream={thread}
          message={customComponent}
          meta={{ ui: customComponent, artifact }}
        />
      ))}
    </Fragment>
  );
}

function parseAnthropicStreamedToolCalls(
  content: MessageContentComplex[],
): AIMessage["tool_calls"] {
  const toolCallContents = content.filter((c) => c.type === "tool_use" && c.id);

  return toolCallContents.map((tc) => {
    const toolCall = tc as Record<string, any>;
    let json: Record<string, any> = {};
    if (toolCall?.input) {
      try {
        json = parsePartialJson(toolCall.input) ?? {};
      } catch {
        // Pass
      }
    }
    return {
      name: toolCall.name ?? "",
      id: toolCall.id ?? "",
      args: json,
      type: "tool_call",
    };
  });
}

interface InterruptProps {
  interruptValue?: unknown;
  isLastMessage: boolean;
  hasNoAIOrToolMessages: boolean;
}

function Interrupt({
  interruptValue,
  isLastMessage,
  hasNoAIOrToolMessages,
}: InterruptProps) {
  return (
    <>
      {/* Agent inbox functionality temporarily disabled */}
      {false && interruptValue && (isLastMessage || hasNoAIOrToolMessages) && (
        <div>Agent inbox interrupt handling (disabled)</div>
      )}
      {interruptValue && true && (isLastMessage || hasNoAIOrToolMessages) ? (
        <GenericInterruptView interrupt={interruptValue} />
      ) : null}
    </>
  );
}

export function AssistantMessage({
  message,
  isLoading,
  handleRegenerate,
}: {
  message: Message | undefined;
  isLoading: boolean;
  handleRegenerate: (parentCheckpoint: Checkpoint | null | undefined) => void;
}) {
  console.log("🚀 ASSISTANT MESSAGE COMPONENT CALLED!", message?.id);
  const content = message?.content ?? [];
  const contentString = getContentString(content);

  const thread = useStreamContext();
  const { hideToolCalls } = thread;
  const isLastMessage =
    thread.messages[thread.messages.length - 1].id === message?.id;
  const hasNoAIOrToolMessages = !thread.messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );
  const meta = message ? thread.getMessagesMetadata(message) : undefined;
  const threadInterrupt = thread.interrupt;

  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;
  const anthropicStreamedToolCalls = Array.isArray(content)
    ? parseAnthropicStreamedToolCalls(content)
    : undefined;

  const hasToolCalls =
    message &&
    "tool_calls" in message &&
    message.tool_calls &&
    message.tool_calls.length > 0;

  console.log("=== ASSISTANT MESSAGE DEBUG ===");
  console.log("Message ID:", message?.id);
  console.log("Message type:", message?.type);
  console.log("Full message object:", message);
  console.log("Has tool_calls property:", "tool_calls" in (message || {}));
  console.log("Tool calls raw:", message?.tool_calls);
  console.log("Tool calls type:", typeof message?.tool_calls);
  console.log("Tool calls length:", message?.tool_calls?.length);
  console.log("Has tool calls (computed):", hasToolCalls);
  console.log("Hide tool calls prop:", hideToolCalls);
  console.log("Should show tool calls:", !hideToolCalls && hasToolCalls);
  console.log("Content string:", contentString);
  console.log("==============================");
  const hasAnthropicToolCalls = !!anthropicStreamedToolCalls?.length;
  const isToolResult = message?.type === "tool";

  if (isToolResult && hideToolCalls) {
    return null;
  }

  return (
    <div className="group mr-auto flex items-start gap-2">
      <div className="flex flex-col gap-2">
        {isToolResult ? (
          <>
            <ToolResult message={message} />
            <Interrupt
              interruptValue={threadInterrupt?.value}
              isLastMessage={isLastMessage}
              hasNoAIOrToolMessages={hasNoAIOrToolMessages}
            />
          </>
        ) : (
          <>
            {contentString.length > 0 && (
              <div className="py-1">
                <MarkdownText>{contentString}</MarkdownText>
              </div>
            )}

            {!hideToolCalls && hasToolCalls && (
              <ToolCalls toolCalls={message.tool_calls || []} />
            )}

            {/* TEMPORARY: Force display test tool call */}
            {!hideToolCalls && (
              <div
                style={{
                  border: "2px solid red",
                  padding: "10px",
                  margin: "10px",
                }}
              >
                <h3>TEST TOOL CALL DISPLAY:</h3>
                <ToolCalls
                  toolCalls={[
                    {
                      id: "test-tool-call-123",
                      tool_name: "TestCalculator",
                      tool_input: { expression: "2 + 2" },
                      tool_output: { result: 4 },
                    },
                  ]}
                />
              </div>
            )}

            {/* Temporary test: Show tool calls for any assistant message that mentions a calculation */}
            {!hideToolCalls &&
              message &&
              message.role === "assistant" &&
              typeof message.content === "string" &&
              message.content.includes("answer") && (
                <div className="mt-2 rounded border border-blue-500 p-2">
                  <p className="mb-2 text-sm text-blue-600">
                    Test Tool Call Display:
                  </p>
                  <ToolCalls
                    toolCalls={[
                      {
                        id: "test_tool_call",
                        tool_name: "Calculator",
                        tool_input: '{"expression":"test"}',
                        tool_output: {
                          result: "test",
                          explanation: "This is a test tool call",
                        },
                        status: "completed" as const,
                      },
                    ]}
                  />
                </div>
              )}

            {message && (
              <CustomComponent
                message={message}
                thread={thread}
              />
            )}
            <Interrupt
              interruptValue={threadInterrupt?.value}
              isLastMessage={isLastMessage}
              hasNoAIOrToolMessages={hasNoAIOrToolMessages}
            />
            <div
              className={cn(
                "mr-auto flex items-center gap-2 transition-opacity",
                "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
              )}
            >
              <BranchSwitcher
                branch={meta?.branch}
                branchOptions={meta?.branchOptions}
                onSelect={(branch) => thread.setBranch(branch)}
                isLoading={isLoading}
              />
              <CommandBar
                content={contentString}
                isLoading={isLoading}
                isAiMessage={true}
                handleRegenerate={() => handleRegenerate(parentCheckpoint)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AssistantMessageLoading() {
  return (
    <div className="mr-auto flex items-start gap-2">
      <div className="bg-muted flex h-8 items-center gap-1 rounded-2xl px-4 py-2">
        <div className="bg-foreground/50 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full"></div>
        <div className="bg-foreground/50 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_0.5s_infinite] rounded-full"></div>
        <div className="bg-foreground/50 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_1s_infinite] rounded-full"></div>
      </div>
    </div>
  );
}

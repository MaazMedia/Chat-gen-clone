import { ReactNode, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext, AdkMessage } from "@/providers/Stream";
import { useState, FormEvent } from "react";
import { Button } from "../ui/button";
import { AIMessage } from "./messages/ai-simple";
import { HumanMessage } from "./messages/human";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
  ArrowDown,
  LoaderCircle,
  PanelRightOpen,
  PanelRightClose,
  SquarePen,
  XIcon,
} from "lucide-react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import ThreadHistory from "./history";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { GitHubSVG } from "../icons/github";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ContentBlocksPreview } from "./ContentBlocksPreview";
import {
  useArtifactOpen,
  ArtifactContent,
  ArtifactTitle,
  useArtifactContext,
} from "./artifact";
import { AgentPicker } from "../agent-picker";

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div
        ref={context.contentRef}
        className={props.contentClassName}
      >
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="h-4 w-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function OpenGitHubRepo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href="https://github.com/langchain-ai/agent-chat-ui"
            target="_blank"
            className="flex items-center justify-center"
          >
            <GitHubSVG
              width="24"
              height="24"
            />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Open GitHub repo</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Convert AdkMessage to the format expected by existing message components
function convertAdkMessageToLangGraphMessage(message: AdkMessage) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    created_at: message.created_at,
    tool_calls: [],
  };
}

export function Thread() {
  const [artifactContext, setArtifactContext] = useArtifactContext();
  const [artifactOpen, closeArtifact] = useArtifactOpen();

  const [threadId, _setThreadId] = useQueryState("threadId");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );
  const [input, setInput] = useState("");
  const {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks: _resetBlocks,
    dragOver,
    handlePaste,
  } = useFileUpload();
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const stream = useStreamContext();
  const messages = stream.state.messages;
  const isLoading = stream.state.isStreaming;

  const lastError = useRef<string | undefined>(undefined);

  const setThreadId = (id: string | null) => {
    _setThreadId(id);

    // close artifact and reset artifact context
    closeArtifact();
    setArtifactContext({});
  };

  useEffect(() => {
    if (!stream.state.error) {
      lastError.current = undefined;
      return;
    }
    
    const message = stream.state.error;
    if (!message || lastError.current === message) {
      return;
    }

    lastError.current = message;
    toast.error("An error occurred. Please try again.", {
      description: (
        <p>
          <strong>Error:</strong> <code>{message}</code>
        </p>
      ),
      richColors: true,
      closeButton: true,
    });
  }, [stream.state.error]);

  // TODO: this should be part of the useStream hook
  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length &&
      messages[messages.length - 1].role === "assistant"
    ) {
      setFirstTokenReceived(true);
    }

    prevMessageLength.current = messages.length;
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((input.trim().length === 0 && contentBlocks.length === 0) || isLoading)
      return;
    
    setFirstTokenReceived(false);

    // Send message through ADK stream
    stream.sendMessage(input.trim());

    setInput("");
    setContentBlocks([]);
  };

  const chatStarted = !!threadId || !!messages.length;
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.role === "assistant",
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="relative hidden lg:flex">
        <motion.div
          className="absolute z-20 h-full overflow-hidden border-r bg-white"
          style={{ width: 300 }}
          animate={
            isLargeScreen
              ? { x: chatHistoryOpen ? 0 : -300 }
              : { x: chatHistoryOpen ? 0 : -300 }
          }
          initial={{ x: -300 }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          <div
            className="relative h-full"
            style={{ width: 300 }}
          >
            <ThreadHistory />
          </div>
        </motion.div>
      </div>

      <div
        className={cn(
          "grid w-full grid-cols-[1fr_0fr] transition-all duration-500",
          artifactOpen && "grid-cols-[3fr_2fr]",
        )}
      >
        <motion.div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden",
            !chatStarted && "grid-rows-[1fr]",
          )}
          layout={isLargeScreen}
          animate={{
            marginLeft: chatHistoryOpen ? (isLargeScreen ? 300 : 0) : 0,
            width: chatHistoryOpen
              ? isLargeScreen
                ? "calc(100% - 300px)"
                : "100%"
              : "100%",
          }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          {/* Agent Picker */}
          <AgentPicker />

          {/* Chat Area */}
          <div className="flex min-h-0 flex-1 flex-col">
            <StickToBottom className="flex h-full flex-1 flex-col">
              <StickyToBottomContent
                className="flex-1 overflow-y-auto"
                contentClassName="relative flex-1 space-y-4 p-4"
                content={
                  <>
                    {/* Welcome Screen */}
                    {!chatStarted && (
                      <div className="flex h-full flex-col items-center justify-center space-y-6 pb-32">
                        <div className="flex flex-col items-center space-y-4">
                          <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                            <span className="text-primary font-bold">ADK</span>
                          </div>
                          <div className="text-center">
                            <h1 className="text-2xl font-semibold">
                              ADK Agent Chat
                            </h1>
                            <p className="text-muted-foreground">
                              Start a conversation with your AI agent
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Messages */}
                    {messages.map((message, index) => {
                      const convertedMessage = convertAdkMessageToLangGraphMessage(message);
                      
                      if (convertedMessage.role === "user") {
                        return (
                          <HumanMessage
                            key={convertedMessage.id}
                            message={convertedMessage}
                            isLoading={false}
                          />
                        );
                      } else if (convertedMessage.role === "assistant") {
                        return (
                          <AIMessage
                            key={convertedMessage.id}
                            message={convertedMessage}
                            className="rounded-2xl border bg-muted/30 p-6 border-solid"
                          />
                        );
                      }
                      return null;
                    })}

                    {/* Loading indicator for streaming */}
                    {isLoading && !firstTokenReceived && (
                      <div className="rounded-2xl border bg-muted/30 p-6 border-dashed opacity-60">
                        <div className="flex items-center gap-2">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Assistant is thinking...</span>
                        </div>
                      </div>
                    )}
                  </>
                }
                footer={
                  <div className="mx-4 mb-4 mt-2 space-y-4">
                    <ScrollToBottom className="mx-auto" />
                    
                    {/* Tool calls toggle */}
                    {chatStarted && !hasNoAIOrToolMessages && (
                      <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="hide-tool-calls">Hide tool calls</Label>
                          <div className="text-xs text-muted-foreground">
                            Hide the details of tool calls in messages
                          </div>
                        </div>
                        <Switch
                          id="hide-tool-calls"
                          checked={hideToolCalls}
                          onCheckedChange={setHideToolCalls}
                        />
                      </div>
                    )}

                    {/* Content blocks preview */}
                    {contentBlocks.length > 0 && (
                      <ContentBlocksPreview
                        blocks={contentBlocks}
                        onRemove={removeBlock}
                      />
                    )}

                    {/* Input form */}
                    <form
                      onSubmit={handleSubmit}
                      className="relative"
                    >
                      <div
                        ref={dropRef}
                        className={cn(
                          "relative rounded-lg border bg-background transition-colors",
                          dragOver && "border-blue-500 bg-blue-50",
                        )}
                      >
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onPaste={handlePaste}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSubmit(e);
                            }
                          }}
                          placeholder="Type your message..."
                          className="min-h-[60px] w-full resize-none border-0 bg-transparent px-3 py-3 text-sm focus:outline-none focus:ring-0"
                          disabled={isLoading}
                        />
                        
                        <div className="flex items-center justify-between p-3 pt-0">
                          <div className="flex items-center gap-2">
                            {/* File upload would go here */}
                          </div>
                          
                          <Button
                            type="submit"
                            size="sm"
                            disabled={
                              isLoading ||
                              (input.trim().length === 0 && contentBlocks.length === 0)
                            }
                          >
                            {isLoading ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              "Send"
                            )}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                }
              />
            </StickToBottom>
          </div>

          {/* Header with controls */}
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            {chatStarted && (
              <TooltipIconButton
                tooltip="New thread"
                onClick={() => setThreadId(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <SquarePen className="h-4 w-4" />
              </TooltipIconButton>
            )}

            <TooltipIconButton
              tooltip={chatHistoryOpen ? "Hide chat history" : "Show chat history"}
              onClick={() => setChatHistoryOpen(!chatHistoryOpen)}
              className="text-muted-foreground hover:text-foreground"
            >
              {chatHistoryOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </TooltipIconButton>

            <OpenGitHubRepo />
          </div>
        </motion.div>

        {/* Artifact panel */}
        {artifactOpen && (
          <motion.div
            className="border-l"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex h-full flex-col">
              <div className="border-b p-4">
                <div className="flex items-center justify-between">
                  <ArtifactTitle />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeArtifact}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <ArtifactContent />
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
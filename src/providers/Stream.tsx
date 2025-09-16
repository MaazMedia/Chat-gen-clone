import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LangGraphLogoSVG } from "@/components/icons/langgraph";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { getApiKey } from "@/lib/api-key";
import { useThreads } from "./Thread";
import { toast } from "sonner";
import { createClient, AdkApiClient, ADKServerError } from "./client";
import { Message } from "@/lib/adk-types";

// ADK Stream State using standard Message type
export interface AdkStreamState {
  messages: Message[];
  isStreaming: boolean;
  error?: string;
}

interface StreamContextType {
  state: AdkStreamState;
  sendMessage: (content: string, contentBlocks?: any[]) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => void;
  createThread: () => Promise<string | null>;
  loadMessages: (threadId: string) => Promise<void>;
  clearError: () => void;
  // Hide tool calls functionality
  hideToolCalls: boolean;
  setHideToolCalls: (hide: boolean) => void;
  // LangGraph compatibility methods
  messages: Message[];
  getMessagesMetadata: (message: any) => any;
  submit: (content: string, options?: any) => Promise<void>;
  setBranch: (branch: any) => void;
  interrupt: any;
}

const StreamContext = createContext<StreamContextType | undefined>(undefined);

async function sleep(ms = 4000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkApiStatus(
  apiUrl: string,
  apiKey: string | null,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/agents`, {
      ...(apiKey && {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }),
    });

    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

const StreamSession = ({
  children,
  apiKey,
  apiUrl,
  assistantId,
}: {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
}) => {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { getThreads, setThreads } = useThreads();
  const [state, setState] = useState<AdkStreamState>({
    messages: [],
    isStreaming: false,
  });

  // Hide tool calls state with localStorage persistence
  const [hideToolCalls, setHideToolCalls] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("adk:hideToolCalls");
      return stored ? JSON.parse(stored) : false;
    }
    return false;
  });

  // Persist hideToolCalls preference to localStorage
  const updateHideToolCalls = (hide: boolean) => {
    setHideToolCalls(hide);
    if (typeof window !== "undefined") {
      localStorage.setItem("adk:hideToolCalls", JSON.stringify(hide));
    }
  };

  const [openaiConfig, setOpenaiConfig] = useState<{
    apiKey: string;
    model: string;
    enabled: boolean;
  } | null>(null);

  // Load OpenAI configuration on mount
  useEffect(() => {
    const loadOpenAIConfig = async () => {
      try {
        const response = await fetch("/api/openai-config");
        const config = await response.json();
        if (config.enabled) {
          setOpenaiConfig(config);
        }
      } catch (error) {
        console.log("OpenAI fallback not configured:", error);
      }
    };
    loadOpenAIConfig();
  }, []);

  const apiClient = useMemo(() => {
    const client = createClient(apiUrl, apiKey ?? undefined);
    return new AdkApiClient(client, openaiConfig || undefined);
  }, [apiUrl, apiKey, openaiConfig]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      try {
        const response = await apiClient.getMessages(threadId);
        setState((prev) => ({ ...prev, messages: response.messages || [] }));
      } catch (error) {
        console.error("Failed to load messages:", error);
        setState((prev) => ({
          ...prev,
          error: "Failed to load messages",
        }));
      }
    },
    [apiClient],
  );

  const createThread = useCallback(async (): Promise<string | null> => {
    console.log(`🆕 [Stream] createThread called`);
    console.log(`🤖 [Stream] Assistant ID: ${assistantId}`);

    try {
      console.log(`📡 [Stream] Calling apiClient.createThread...`);
      const response = await apiClient.createThread(assistantId);
      console.log(`✅ [Stream] createThread response:`, response);

      const newThreadId = response.thread?.id || response.id;
      console.log(`🆔 [Stream] New thread ID: ${newThreadId}`);

      if (!newThreadId) {
        console.error(`❌ [Stream] No thread ID found in response:`, response);
        return null;
      }

      console.log(`🔄 [Stream] Setting thread ID to: ${newThreadId}`);
      setThreadId(newThreadId);

      // Note: Thread will appear in history after first message is sent
      // (threads without messages are now filtered out)
      console.log(
        `📝 [Stream] Thread created successfully, will appear in history after first message`,
      );

      return newThreadId;
    } catch (error) {
      console.error("Failed to create thread:", error);

      if (error instanceof ADKServerError) {
        if (
          error.code === "ADK_SERVER_UNAVAILABLE" ||
          error.code === "NETWORK_ERROR"
        ) {
          toast.error("Connection Error", {
            description:
              "Unable to connect to the local ADK implementation. Please check your configuration or refresh the page.",
            duration: 10000,
            action: {
              label: "Retry",
              onClick: () => window.location.reload(),
            },
          });
        } else {
          toast.error("Failed to create thread", {
            description: error.message,
            duration: 5000,
          });
        }
      } else {
        toast.error("Failed to create thread", {
          description: "An unexpected error occurred.",
          duration: 5000,
        });
      }

      setState((prev) => ({
        ...prev,
        error: "Failed to create thread",
      }));
      return null;
    }
  }, [assistantId, apiClient, setThreadId, getThreads, setThreads]);

  const sendMessage = useCallback(
    async (content: string, contentBlocks?: any[]) => {
      console.log(`💬 [Stream] sendMessage called`);
      console.log(`📝 [Stream] Message content: ${content}`);
      console.log(`📎 [Stream] Content blocks: ${contentBlocks?.length || 0}`);
      console.log(`🧵 [Stream] Current thread ID: ${threadId || "None"}`);

      let currentThreadId = threadId;
      if (!currentThreadId) {
        console.log(`🆕 [Stream] No current thread, creating new one...`);
        currentThreadId = await createThread();
        console.log(`🆔 [Stream] Created thread ID: ${currentThreadId}`);
      } else {
        console.log(`🔄 [Stream] Using existing thread: ${currentThreadId}`);
      }

      if (!currentThreadId) {
        console.error(
          `❌ [Stream] Failed to get thread ID, aborting message send`,
        );
        return;
      }

      setState((prev) => ({ ...prev, isStreaming: true, error: undefined }));

      try {
        // Create user message content
        let messageContent: string | any[] = content;

        // If we have content blocks (images/files), create multimodal content
        if (contentBlocks && contentBlocks.length > 0) {
          messageContent = [{ type: "text", text: content }, ...contentBlocks];
        }

        // Add user message to state immediately
        const userMessage: Message = {
          id: Date.now().toString(),
          role: "user",
          content: messageContent,
          created_at: new Date().toISOString(),
        };

        setState((prev) => {
          // Remove any existing message with the same ID to prevent duplicates
          const filteredMessages = prev.messages.filter(
            (m) => m.id !== userMessage.id,
          );
          return {
            ...prev,
            messages: [...filteredMessages, userMessage],
          };
        });

        // For now, send only text content to the server
        // TODO: Update server to handle multimodal content
        const stream = await apiClient.streamMessage(
          currentThreadId,
          messageContent, // Send full multimodal content
          assistantId,
        );
        const reader = stream.getReader();
        const decoder = new TextDecoder();

        let accumulatedContent = "";
        let assistantMessage: Message | null = null;
        let tempAssistantMessageId: string | null = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  console.log(`📦 [Stream] Received SSE data:`, data);

                  if (data.type === "thinking") {
                    console.log(
                      `🤔 [Stream] Agent is thinking: ${data.content}`,
                    );
                    // Optionally show thinking indicator
                  } else if (data.type === "content") {
                    if (data.partial === false) {
                      // Final content - replace any accumulated content
                      accumulatedContent = data.content;
                    } else {
                      // Partial content for streaming effect
                      accumulatedContent = data.content;
                    }

                    // Update or create assistant message
                    setState((prev) => {
                      const messages = [...prev.messages];
                      const lastMessageIndex = messages.length - 1;

                      if (assistantMessage && tempAssistantMessageId) {
                        // Update existing assistant message
                        const updatedMessage = {
                          ...assistantMessage,
                          content: accumulatedContent,
                        };
                        messages[lastMessageIndex] = updatedMessage;
                        assistantMessage = updatedMessage;
                      } else {
                        // Create new assistant message
                        tempAssistantMessageId = `temp-${Date.now()}`;
                        assistantMessage = {
                          id: tempAssistantMessageId,
                          role: "assistant",
                          content: accumulatedContent,
                          created_at: new Date().toISOString(),
                        };
                        messages.push(assistantMessage);
                      }

                      return { ...prev, messages };
                    });
                  } else if (data.type === "tool_call") {
                    console.log(`🔧 [Stream] Tool call received:`, data);
                    console.log(
                      `🔧 [Stream] Current assistant message:`,
                      assistantMessage,
                    );

                    // Add tool call to the current assistant message
                    setState((prev) => {
                      console.log(
                        `🔧 [Stream] Before adding tool call, state:`,
                        prev,
                      );
                      const messages = [...prev.messages];
                      const lastMessageIndex = messages.length - 1;

                      if (assistantMessage && lastMessageIndex >= 0) {
                        const newToolCall = {
                          id: `tool_${Date.now()}`,
                          tool_name: data.tool_name,
                          tool_input:
                            typeof data.tool_input === "string"
                              ? data.tool_input
                              : JSON.stringify(data.tool_input),
                          tool_output: data.tool_output,
                          status: "completed" as const,
                        };

                        const updatedMessage = {
                          ...messages[lastMessageIndex],
                          tool_calls: [
                            ...(messages[lastMessageIndex].tool_calls || []),
                            newToolCall,
                          ],
                        };

                        messages[lastMessageIndex] = updatedMessage;
                        assistantMessage = updatedMessage;

                        console.log(
                          `🔧 [Stream] After adding tool call, updated message:`,
                          updatedMessage,
                        );
                      }

                      const newState = { ...prev, messages };
                      console.log(
                        `🔧 [Stream] New state after tool call:`,
                        newState,
                      );
                      return newState;
                    });
                  } else if (data.type === "done") {
                    console.log(`✅ [Stream] Stream completed`);
                    break;
                  }
                } catch (e) {
                  console.error("Failed to parse SSE data:", e);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
          setState((prev) => ({ ...prev, isStreaming: false }));

          // Refresh thread list since this thread now has messages and should appear in history
          console.log(
            `🔄 [Stream] Message streaming complete, refreshing thread list...`,
          );
          getThreads()
            .then((updatedThreads) => {
              console.log(
                `✅ [Stream] Thread list refreshed, got ${updatedThreads.length} threads`,
              );
              setThreads(updatedThreads);
            })
            .catch((error) => {
              console.error(
                `❌ [Stream] Failed to refresh thread list:`,
                error,
              );
            });
        }
      } catch (error) {
        console.error("Failed to send message:", error);

        if (error instanceof ADKServerError) {
          if (
            error.code === "ADK_SERVER_UNAVAILABLE" ||
            error.code === "NETWORK_ERROR"
          ) {
            toast.error("Connection Error", {
              description:
                "Unable to connect to the local ADK implementation. Please check your configuration or refresh the page.",
              duration: 10000,
              action: {
                label: "Retry",
                onClick: () => window.location.reload(),
              },
            });
          } else {
            toast.error("Failed to send message", {
              description: error.message,
              duration: 5000,
            });
          }
        } else {
          toast.error("Failed to send message", {
            description: "An unexpected error occurred.",
            duration: 5000,
          });
        }

        setState((prev) => ({
          ...prev,
          error: "Failed to send message",
        }));
      } finally {
        setState((prev) => ({ ...prev, isStreaming: false }));
      }
    },
    [threadId, assistantId, apiClient, createThread],
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: undefined }));
  }, []);

  const editMessage = useCallback((messageId: string, newContent: string) => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((msg) =>
        msg.id === messageId ? { ...msg, content: newContent } : msg,
      ),
    }));
  }, []);

  // Load messages when thread ID changes
  useEffect(() => {
    if (threadId) {
      loadMessages(threadId);
    } else {
      setState((prev) => ({ ...prev, messages: [] }));
    }
  }, [threadId, loadMessages]);

  useEffect(() => {
    checkApiStatus(apiUrl, apiKey).then((ok) => {
      if (!ok) {
        toast.error("Local ADK Connection Issue", {
          description: () => (
            <p>
              Unable to connect to the local ADK implementation at{" "}
              <code>{apiUrl}</code>. Please ensure your OpenAI API key is
              configured correctly.
            </p>
          ),
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, [apiKey, apiUrl]);

  const contextValue: StreamContextType = {
    state,
    sendMessage,
    editMessage,
    createThread,
    loadMessages,
    clearError,
    // Hide tool calls functionality
    hideToolCalls,
    setHideToolCalls: updateHideToolCalls,
    // LangGraph compatibility methods
    messages: state.messages,
    getMessagesMetadata: (message: any) => {
      // Return empty metadata for ADK compatibility
      return {
        firstSeenState: null,
        parentCheckpoint: null,
      };
    },
    submit: async (content: string, options?: any) => {
      // Redirect to sendMessage for ADK compatibility
      await sendMessage(content, options?.files);
    },
    setBranch: (branch: any) => {
      // No-op for ADK compatibility
      console.log("setBranch not implemented for ADK");
    },
    interrupt: null, // No interrupt support in ADK
  };

  return (
    <StreamContext.Provider value={contextValue}>
      {children}
    </StreamContext.Provider>
  );
};

// Default values for the form
const DEFAULT_API_URL = "http://localhost:8080";
const DEFAULT_ASSISTANT_ID = "general-assistant";

export const StreamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Get environment variables
  const envApiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL;
  const envAssistantId: string | undefined =
    process.env.NEXT_PUBLIC_ASSISTANT_ID;

  // Check for special parameters
  const [forceConfig] = useQueryState("setup");
  const [clearConfig] = useQueryState("clear");

  // Use URL params with env var fallbacks
  const [apiUrl, setApiUrl] = useQueryState("apiUrl", {
    defaultValue: "",
  });
  const [assistantId, setAssistantId] = useQueryState("assistantId", {
    defaultValue: "",
  });

  // For API key, use localStorage with env var fallback
  const [apiKey, _setApiKey] = useState(() => {
    // Clear localStorage if requested
    if (clearConfig === "true") {
      window.localStorage.removeItem("lg:chat:apiKey");
      return "";
    }
    const storedKey = getApiKey();
    return storedKey || "";
  });

  const setApiKey = (key: string) => {
    window.localStorage.setItem("lg:chat:apiKey", key);
    _setApiKey(key);
  };

  // Check if user has configured anything before (first-time check)
  const hasUserConfigured = () => {
    // Force show config if requested
    if (forceConfig === "true" || clearConfig === "true") {
      return false;
    }

    // Check if user has any stored configuration
    const hasStoredApiKey = !!getApiKey();
    const hasUrlParams = !!(apiUrl || assistantId);
    const hasEnvVars = !!(envApiUrl || envAssistantId);

    // If there are URL params, user has configured something
    if (hasUrlParams) return true;

    // If there are env vars but no stored key and no URL params,
    // treat as configured (developer has set up environment)
    if (hasEnvVars && !hasStoredApiKey) return true;

    // If user has stored an API key, they've configured before
    if (hasStoredApiKey) return true;

    return false;
  };

  // Determine final values to use, prioritizing URL params then env vars then defaults
  const finalApiUrl = apiUrl || envApiUrl || DEFAULT_API_URL;
  const finalAssistantId =
    assistantId || envAssistantId || DEFAULT_ASSISTANT_ID;

  // Show the form if the user hasn't configured anything before
  if (!hasUserConfigured()) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4">
        <div className="animate-in fade-in-0 zoom-in-95 bg-background flex max-w-3xl flex-col rounded-lg border shadow-lg">
          <div className="mt-14 flex flex-col gap-2 border-b p-6">
            <div className="flex flex-col items-start gap-2">
              <LangGraphLogoSVG className="h-7" />
              <h1 className="text-xl font-semibold tracking-tight">
                ADK Agent Chat
              </h1>
            </div>
            <p className="text-muted-foreground">
              Welcome to ADK Agent Chat! This application uses a local ADK
              implementation with OpenAI for AI responses. The default values
              should work for most setups.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();

              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const apiUrl = formData.get("apiUrl") as string;
              const assistantId = formData.get("assistantId") as string;
              const apiKey = formData.get("apiKey") as string;

              setApiUrl(apiUrl);
              setApiKey(apiKey);
              setAssistantId(assistantId);

              form.reset();
            }}
            className="bg-muted/50 flex flex-col gap-6 p-6"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="apiUrl">
                Local ADK API URL<span className="text-rose-500">*</span>
              </Label>
              <p className="text-muted-foreground text-sm">
                This is the URL of your local ADK implementation. This should be
                your Next.js API endpoint (e.g., http://localhost:3000/api).
              </p>
              <Input
                id="apiUrl"
                name="apiUrl"
                className="bg-background"
                defaultValue={apiUrl || envApiUrl || DEFAULT_API_URL}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="assistantId">
                Agent ID<span className="text-rose-500">*</span>
              </Label>
              <p className="text-muted-foreground text-sm">
                This is the ID of the agent to use for conversations.
              </p>
              <Input
                id="assistantId"
                name="assistantId"
                className="bg-background"
                defaultValue={
                  assistantId || envAssistantId || DEFAULT_ASSISTANT_ID
                }
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="apiKey">API Key (Optional)</Label>
              <p className="text-muted-foreground text-sm">
                This is <strong>NOT</strong> required for the local ADK
                implementation. The system uses OpenAI directly, which is
                configured via environment variables.
              </p>
              <PasswordInput
                id="apiKey"
                name="apiKey"
                defaultValue={apiKey ?? ""}
                className="bg-background"
                placeholder="your-adk-api-key..."
              />
            </div>

            <div className="mt-2 flex justify-end">
              <Button
                type="submit"
                size="lg"
              >
                Continue
                <ArrowRight className="size-5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <StreamSession
      apiKey={apiKey}
      apiUrl={finalApiUrl}
      assistantId={finalAssistantId}
    >
      {children}
    </StreamSession>
  );
};

// Create a custom hook to use the context
export const useStreamContext = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
};

export default StreamContext;

import { validate } from "uuid";
import { getApiKey } from "@/lib/api-key";
import { useQueryState } from "nuqs";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { createClient, AdkApiClient } from "./client";

// ADK Thread interface
interface AdkThread {
  id: string;
  agent_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

interface ThreadContextType {
  getThreads: () => Promise<AdkThread[]>;
  deleteThread: (threadId: string) => Promise<void>;
  threads: AdkThread[];
  setThreads: Dispatch<SetStateAction<AdkThread[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

export function ThreadProvider({ children }: { children: ReactNode }) {
  const [apiUrl] = useQueryState("apiUrl");
  const [assistantId] = useQueryState("assistantId");
  const [threads, setThreads] = useState<AdkThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const getThreads = useCallback(async (): Promise<AdkThread[]> => {
    // Use default API URL if none is provided
    const effectiveApiUrl = apiUrl || "http://localhost:8080";
    const effectiveAssistantId = assistantId || "general-assistant";

    console.log(`🔍 [ThreadProvider] getThreads called with:`);
    console.log(`🌐 [ThreadProvider] API URL: ${effectiveApiUrl}`);
    console.log(`🤖 [ThreadProvider] Assistant ID: ${effectiveAssistantId}`);

    try {
      const client = createClient(effectiveApiUrl, getApiKey() ?? undefined);
      const apiClient = new AdkApiClient(client);

      console.log(`📡 [ThreadProvider] Calling apiClient.getThreads...`);
      const response = await apiClient.getThreads(effectiveAssistantId);

      console.log(`✅ [ThreadProvider] getThreads response:`, response);
      console.log(
        `📊 [ThreadProvider] Number of threads: ${response.threads ? response.threads.length : 0}`,
      );

      return response.threads || [];
    } catch (error) {
      console.error("❌ [ThreadProvider] Failed to fetch threads:", error);
      return [];
    }
  }, [apiUrl, assistantId]);

  const deleteThread = useCallback(
    async (threadId: string): Promise<void> => {
      console.log(`🔄 ThreadProvider: Starting deletion of thread ${threadId}`);

      const effectiveApiUrl = apiUrl || "http://localhost:8080";

      try {
        const client = createClient(effectiveApiUrl, getApiKey() ?? undefined);
        const apiClient = new AdkApiClient(client);

        console.log(
          `📞 ThreadProvider: Calling API to delete thread ${threadId}`,
        );
        await apiClient.deleteThread(threadId);

        console.log(
          `🗂️  ThreadProvider: Removing thread ${threadId} from local state`,
        );
        // Remove the thread from local state
        setThreads((prev) => {
          const filteredThreads = prev.filter(
            (thread) => thread.id !== threadId,
          );
          console.log(
            `📊 ThreadProvider: Updated thread count: ${filteredThreads.length} (was ${prev.length})`,
          );
          return filteredThreads;
        });

        console.log(
          `✅ ThreadProvider: Thread ${threadId} deletion completed successfully`,
        );
      } catch (error) {
        console.error(
          `❌ ThreadProvider: Failed to delete thread ${threadId}:`,
          error,
        );
        throw error;
      }
    },
    [apiUrl, setThreads],
  );

  const value = {
    getThreads,
    deleteThread,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
  };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

export function useThreads() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
}

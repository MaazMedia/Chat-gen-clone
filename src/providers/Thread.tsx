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
    if (!apiUrl || !assistantId) return [];
    
    try {
      const client = createClient(apiUrl, getApiKey() ?? undefined);
      const apiClient = new AdkApiClient(client);
      
      const response = await apiClient.getThreads(assistantId);
      return response.threads || [];
    } catch (error) {
      console.error('Failed to fetch threads:', error);
      return [];
    }
  }, [apiUrl, assistantId]);

  const value = {
    getThreads,
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

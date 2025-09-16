import React, { useState, useEffect } from "react";
import { useQueryState } from "nuqs";
import { createClient, AdkApiClient, ADKServerError } from "@/providers/client";
import { getApiKey } from "@/lib/api-key";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Agent {
  id: string;
  name: string;
  description: string;
  tools: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export function AgentPicker() {
  const [apiUrl] = useQueryState("apiUrl");
  const [assistantId, setAssistantId] = useQueryState("assistantId");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);

  // Use default API URL if none is provided
  const effectiveApiUrl = apiUrl || "http://localhost:8080";

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const client = createClient(effectiveApiUrl, getApiKey() ?? undefined);
      const apiClient = new AdkApiClient(client);

      const response = await apiClient.getAgents();
      setAgents(response.agents || []);

      // If no agent is selected and we have agents, select the first one
      if (!assistantId && response.agents && response.agents.length > 0) {
        setAssistantId(response.agents[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);

      if (error instanceof ADKServerError) {
        if (
          error.code === "ADK_SERVER_UNAVAILABLE" ||
          error.code === "NETWORK_ERROR"
        ) {
          toast.error("ADK Server Unavailable", {
            description:
              "Please start the ADK server (npm start in adk-server folder) or check your connection.",
            duration: 10000,
            action: {
              label: "Retry",
              onClick: () => fetchAgents(),
            },
          });
        } else {
          toast.error("Failed to load agents", {
            description: error.message,
            duration: 5000,
          });
        }
      } else {
        toast.error("Failed to load agents", {
          description: "Could not fetch available agents from the server.",
          duration: 5000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [effectiveApiUrl]);

  // Always show the AgentPicker since we have a default API URL
  const selectedAgent = agents.find((agent) => agent.id === assistantId);

  return (
    <div className="mr-4 flex items-center gap-2">
      <Select
        value={assistantId || ""}
        onValueChange={setAssistantId}
        disabled={loading || agents.length === 0}
      >
        <SelectTrigger className="h-8 w-[160px] text-sm">
          <SelectValue placeholder="Select agent..." />
        </SelectTrigger>
        <SelectContent>
          {agents.map((agent) => (
            <SelectItem
              key={agent.id}
              value={agent.id}
            >
              <span className="font-medium">{agent.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

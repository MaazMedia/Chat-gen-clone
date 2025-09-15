import React, { useState, useEffect } from 'react';
import { useQueryState } from 'nuqs';
import { createClient, AdkApiClient, ADKServerError } from '@/providers/client';
import { getApiKey } from '@/lib/api-key';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

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

  const fetchAgents = async () => {
    if (!apiUrl) return;

    setLoading(true);
    try {
      const client = createClient(apiUrl, getApiKey() ?? undefined);
      const apiClient = new AdkApiClient(client);
      
      const response = await apiClient.getAgents();
      setAgents(response.agents || []);
      
      // If no agent is selected and we have agents, select the first one
      if (!assistantId && response.agents && response.agents.length > 0) {
        setAssistantId(response.agents[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      
      if (error instanceof ADKServerError) {
        if (error.code === 'ADK_SERVER_UNAVAILABLE' || error.code === 'NETWORK_ERROR') {
          toast.error('ADK Server Unavailable', {
            description: 'Please start the ADK server (npm start in adk-server folder) or check your connection.',
            duration: 10000,
            action: {
              label: 'Retry',
              onClick: () => fetchAgents(),
            },
          });
        } else {
          toast.error('Failed to load agents', {
            description: error.message,
            duration: 5000,
          });
        }
      } else {
        toast.error('Failed to load agents', {
          description: 'Could not fetch available agents from the server.',
          duration: 5000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [apiUrl]);

  if (!apiUrl) {
    return null;
  }

  const selectedAgent = agents.find(agent => agent.id === assistantId);

  return (
    <div className="flex items-center gap-3 p-4 border-b bg-background">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <label htmlFor="agent-select" className="text-sm font-medium text-muted-foreground">
            Agent:
          </label>
          <Select
            value={assistantId || ''}
            onValueChange={setAssistantId}
            disabled={loading || agents.length === 0}
          >
            <SelectTrigger id="agent-select" className="w-[200px]">
              <SelectValue placeholder="Select an agent..." />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{agent.name}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {agent.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAgents}
            disabled={loading}
            className="p-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {selectedAgent && (
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium">Tools:</span>{' '}
            {selectedAgent.tools.length > 0 
              ? selectedAgent.tools.map(tool => tool.name).join(', ')
              : 'None'
            }
          </div>
        )}
      </div>
    </div>
  );
}
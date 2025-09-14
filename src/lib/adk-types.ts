// ADK-compatible types to replace LangGraph SDK types
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  created_at?: string;
  tool_calls?: ToolCall[];
}

export interface AIMessage extends Message {
  role: 'assistant';
}

export interface ToolCall {
  id: string;
  tool_name: string;
  tool_input: any;
  tool_output?: any;
  status?: 'pending' | 'completed' | 'failed';
}

export interface ToolMessage extends Message {
  role: 'tool';
  tool_call_id: string;
}

export interface Base64ContentBlock {
  type: 'base64';
  media_type: string;
  data: string;
}

export interface TextContentBlock {
  type: 'text';
  text: string;
}

export type ContentBlock = Base64ContentBlock | TextContentBlock;

export interface MessageContentComplex {
  type: 'text' | 'image';
  text?: string;
  image_url?: { url: string };
}

export interface Checkpoint {
  thread_id: string;
  checkpoint_id: string;
  created_at: string;
}

// LangGraph prebuilt types compatibility
export interface HumanInterrupt {
  type: 'human_interrupt';
  message: string;
  options?: string[];
  timeout?: number;
}

export interface HumanResponse {
  type: 'human_response';
  response: string;
  interrupt_id: string;
}

export interface ActionRequest {
  type: 'action_request';
  action: string;
  parameters?: any;
}

// Thread types
export interface Thread {
  thread_id: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export type ThreadStatus = 'active' | 'idle' | 'busy' | 'interrupted' | 'error';

// Special constants
export const END = '__end__';

// Utility functions
export function parsePartialJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    // Try to parse partial JSON by attempting to complete it
    const completedStr = str.trim().endsWith('}') ? str : str + '}';
    try {
      return JSON.parse(completedStr);
    } catch {
      return null;
    }
  }
}

export function getContentString(content: string | MessageContentComplex[]): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(item => item.text || '[Media Content]').join(' ');
  }
  return String(content);
}
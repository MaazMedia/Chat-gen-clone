# Agent Inbox Components (Temporarily Disabled)

These components were temporarily disabled during the LangGraph to ADK migration to allow the build to complete successfully.

The agent-inbox functionality is an advanced feature for handling human interrupts and interactive agent workflows. It requires:

1. Complex LangGraph prebuilt types (HumanInterrupt, HumanResponse, etc.)
2. Thread submission and interrupt handling APIs
3. Sophisticated state management for interactive workflows

## Components Moved Here:
- `agent-inbox/` - Main inbox functionality
- `hooks/use-interrupted-actions.tsx` - Interrupt handling logic
- `types.ts` - Complex type definitions
- `utils.ts` - Interrupt processing utilities

## To Re-enable:
1. Complete the LangGraph to ADK type migration for these components
2. Implement ADK-compatible interrupt handling in the server
3. Update the frontend to use ADK's interrupt APIs
4. Move components back to the active directory

This allows the core agent chat functionality to work while preserving the advanced features for future implementation.
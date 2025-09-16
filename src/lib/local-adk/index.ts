// Local ADK Instance Manager
// Manages the single instance of LocalADKCore with registered agents

import { LocalADKCore } from "./core";
import { MathAssistantAgent } from "./agents/math-assistant";
import { WebResearcherAgent } from "./agents/web-researcher";
import { GeneralAssistantAgent } from "./agents/general-assistant";

// Use globalThis to persist across module reloads in development
declare global {
  var __adkInstance: LocalADKCore | null;
}

export function getADKInstance(): LocalADKCore {
  // Check both the module-level variable and the global variable
  const existingInstance = global.__adkInstance;

  if (!existingInstance) {
    // Get OpenAI API key from environment
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    // Initialize ADK core
    const newInstance = new LocalADKCore(openaiApiKey, "gpt-4o-mini");

    // Register agents
    const generalAgent = new GeneralAssistantAgent(newInstance.getOpenAI());
    const mathAgent = new MathAssistantAgent(newInstance.getOpenAI());
    const webAgent = new WebResearcherAgent(newInstance.getOpenAI());

    newInstance.registerAgent(generalAgent);
    newInstance.registerAgent(mathAgent);
    newInstance.registerAgent(webAgent);

    // Store in global variable to persist across module reloads
    global.__adkInstance = newInstance;

    console.log("[Local ADK] Instance created and agents registered");
    return newInstance;
  }

  return existingInstance;
}

export function resetADKInstance(): void {
  global.__adkInstance = null;
  console.log("[Local ADK] Instance reset");
}

// Export types for convenience
export type { ADKMessage, ADKThread, ADKAgent, ADKTool } from "./core";
export { LocalADKCore } from "./core";

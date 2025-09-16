import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calculator, Search, MessageCircle } from "lucide-react";

interface TestPromptsProps {
  onPromptClick: (prompt: string) => void;
  selectedAgent?: string;
}

export function TestPrompts({
  onPromptClick,
  selectedAgent,
}: TestPromptsProps) {
  const getPromptsForAgent = () => {
    switch (selectedAgent) {
      case "math-assistant":
        return {
          icon: <Calculator className="h-5 w-5" />,
          title: "Math Assistant Test Prompts",
          description: "Try these prompts to test mathematical calculations",
          prompts: [
            "Calculate 2 + 2 * 3",
            "What is the square root of 144?",
            "Solve: (15 * 4) / (3 + 2)",
            "Calculate the area of a circle with radius 5",
            "What is 2^8?",
          ],
        };

      case "web-researcher":
        return {
          icon: <Search className="h-5 w-5" />,
          title: "Web Researcher Test Prompts",
          description: "Try these prompts to test web search capabilities",
          prompts: [
            "Search for the latest news about AI",
            "Find information about Next.js 15 features",
            "What are the current trends in web development?",
            "Search for OpenAI API documentation",
            "Find recent articles about TypeScript",
          ],
        };

      default:
        return {
          icon: <Calculator className="h-5 w-5" />,
          title: "Math Assistant Test Prompts",
          description: "Try these prompts to test mathematical calculations",
          prompts: [
            "Calculate 2 + 2 * 3",
            "What is the square root of 144?",
            "Solve: (15 * 4) / (3 + 2)",
            "Calculate the area of a circle with radius 5",
            "What is 2^8?",
          ],
        };
    }
  };

  const promptData = getPromptsForAgent();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {promptData.icon}
          {promptData.title}
        </CardTitle>
        <CardDescription>{promptData.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {promptData.prompts.map((prompt, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => onPromptClick(prompt)}
              className="h-auto justify-start p-3 text-left"
            >
              {prompt}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

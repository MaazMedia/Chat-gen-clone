// Math Assistant Agent for Local ADK
// Provides mathematical calculation and equation solving capabilities

import { BaseADKAgent } from "../base-agent";
import { ADKTool } from "../core";

export class MathAssistantAgent extends BaseADKAgent {
  id = "math-assistant";
  name = "Math Assistant";
  description =
    "A helpful assistant that can perform mathematical calculations and solve problems";

  tools: ADKTool[] = [
    {
      id: "calculator",
      name: "Calculator",
      description:
        "Performs basic mathematical operations (addition, subtraction, multiplication, division)",
      schema: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description:
              'Mathematical expression to evaluate (e.g., "2 + 3 * 4")',
          },
        },
        required: ["expression"],
      },
    },
    {
      id: "equation_solver",
      name: "Equation Solver",
      description:
        "Solves mathematical equations and provides step-by-step solutions",
      schema: {
        type: "object",
        properties: {
          equation: {
            type: "string",
            description: 'Mathematical equation to solve (e.g., "2x + 5 = 13")',
          },
          variable: {
            type: "string",
            description: "Variable to solve for (default: x)",
            default: "x",
          },
        },
        required: ["equation"],
      },
    },
  ];

  async executeTool(toolId: string, input: any): Promise<any> {
    switch (toolId) {
      case "calculator":
        return this.calculate(input.expression);
      case "equation_solver":
        return this.solveEquation(input.equation, input.variable || "x");
      default:
        throw new Error(`Unknown tool: ${toolId}`);
    }
  }

  private calculate(expression: string): any {
    try {
      // Simple calculator - evaluate basic math expressions safely
      // Remove any non-math characters for security
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, "");

      if (!sanitized) {
        throw new Error("Invalid expression");
      }

      // Use Function constructor for safe evaluation (limited scope)
      const result = Function(`"use strict"; return (${sanitized})`)();

      if (!isFinite(result)) {
        throw new Error("Result is not a finite number");
      }

      return {
        expression: expression,
        result: result,
        steps: [`Evaluating: ${expression}`, `Result: ${result}`],
      };
    } catch (error) {
      return {
        expression: expression,
        error: `Calculation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        result: null,
      };
    }
  }

  private solveEquation(equation: string, variable: string = "x"): any {
    try {
      // Simple equation solver for linear equations
      // This is a basic implementation - in a real scenario, you'd use a math library

      // Handle simple linear equations like "2x + 5 = 13"
      const sides = equation.split("=").map((s) => s.trim());
      if (sides.length !== 2) {
        throw new Error("Equation must have exactly one equals sign");
      }

      const [left, right] = sides;

      // For demo purposes, handle simple cases
      if (
        equation.includes("x + ") ||
        equation.includes("x - ") ||
        equation.includes("x * ") ||
        equation.includes("x / ")
      ) {
        // This is a simplified solver - in practice, you'd use a proper math library
        const steps = [
          `Given equation: ${equation}`,
          `Isolating ${variable}...`,
          `This is a demonstration solver for simple linear equations.`,
        ];

        // Try to extract coefficient and constant (very basic)
        const match = left.match(/([+-]?\d*)\s*\*?\s*x\s*([+-]\s*\d+)?/);
        if (match) {
          const coefficient = match[1] ? parseFloat(match[1]) || 1 : 1;
          const constant = match[2]
            ? parseFloat(match[2].replace(/\s/g, ""))
            : 0;
          const rightValue = parseFloat(right);

          const solution = (rightValue - constant) / coefficient;

          return {
            equation: equation,
            variable: variable,
            solution: solution,
            steps: [...steps, `${variable} = ${solution}`],
          };
        }
      }

      return {
        equation: equation,
        variable: variable,
        solution: "Unable to solve automatically",
        steps: [
          `Given equation: ${equation}`,
          "This equation requires manual solving or a more advanced solver.",
          "Please provide a simpler linear equation for automatic solving.",
        ],
      };
    } catch (error) {
      return {
        equation: equation,
        variable: variable,
        error: `Solving error: ${error instanceof Error ? error.message : "Unknown error"}`,
        solution: null,
      };
    }
  }
}

// Math Assistant Agent
// Provides mathematical calculation and equation solving capabilities

export class MathAssistant {
  public id = "math-assistant";
  public name = "Math Assistant";
  public description =
    "A helpful assistant that can perform mathematical calculations and solve problems";

  public tools = [
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

  async invoke(message: string, context: any = {}) {
    console.log(`🧮 [MathAssistant] Processing message: "${message}"`);

    // Check if the message contains a mathematical expression that we can calculate
    const mathExpressionPattern = /^[0-9+\-*/.() ]+$/;
    const containsNumbers = /\d/.test(message);
    const containsMathOperators = /[+\-*/=]/.test(message);

    // First, try to extract mathematical expressions from questions like "What is 2+2?"
    const extractedExpressions = message.match(/([0-9+\-*/.() ]+)/g);
    if (extractedExpressions) {
      for (const expr of extractedExpressions) {
        const cleanExpr = expr.trim();
        if (mathExpressionPattern.test(cleanExpr) && cleanExpr.length >= 3) {
          // At least "1+1"
          console.log(
            `🔢 [MathAssistant] Extracted and calculating expression: ${cleanExpr}`,
          );
          const calculationResult = this.calculate(cleanExpr);

          if (!calculationResult.error) {
            return {
              content: `The answer to ${cleanExpr} is ${calculationResult.result}.`,
              toolCalls: [
                {
                  id: "calculator",
                  name: "Calculator",
                  input: { expression: cleanExpr },
                  result: calculationResult,
                },
              ],
            };
          }
        }
      }
    }

    // If it looks like a simple math expression, calculate it and give a natural response
    if (mathExpressionPattern.test(message.trim()) && containsNumbers) {
      console.log(
        `🔢 [MathAssistant] Detected math expression, calculating: ${message.trim()}`,
      );
      const calculationResult = this.calculate(message.trim());

      if (calculationResult.error) {
        return {
          content: `I tried to calculate "${message.trim()}" but encountered an error: ${calculationResult.message}. Could you check the expression and try again?`,
          toolCalls: [],
        };
      } else {
        return {
          content: `The answer to ${message.trim()} is ${calculationResult.result}.`,
          toolCalls: [
            {
              id: "calculator",
              name: "Calculator",
              input: { expression: message.trim() },
              result: calculationResult,
            },
          ],
        };
      }
    }

    // Check for equation solving patterns (contains = sign)
    if (message.includes("=") && containsNumbers) {
      console.log(
        `⚖️ [MathAssistant] Detected equation, attempting to solve: ${message}`,
      );
      // Try to extract variable (default to 'x' if not clear)
      const variableMatch = message.match(/[a-z]/i);
      const variable = variableMatch ? variableMatch[0] : "x";

      const solutionResult = this.solveEquation(message, variable);

      if (solutionResult.error) {
        return {
          content: `I see you have an equation there! Unfortunately, I encountered an issue: ${solutionResult.message}. Could you try rephrasing it? For example, "2x + 5 = 13" works well.`,
          toolCalls: [],
        };
      } else {
        return {
          content: `Let me solve that equation for you! The solution is ${variable} = ${solutionResult.solution}.`,
          toolCalls: [
            {
              id: "equation_solver",
              name: "Equation Solver",
              input: { equation: message, variable: variable },
              result: solutionResult,
            },
          ],
        };
      }
    }

    // Check if the message is asking for calculations but not a direct expression
    if (
      message.toLowerCase().includes("calculate") ||
      (message.toLowerCase().includes("what is") && containsNumbers) ||
      message.toLowerCase().includes("solve") ||
      (message.toLowerCase().includes("find the") && containsMathOperators)
    ) {
      // Try to extract a mathematical expression from the message
      const expressionMatch = message.match(/([0-9+\-*/.() ]+)/);
      if (expressionMatch && expressionMatch[1].trim()) {
        const expression = expressionMatch[1].trim();
        console.log(
          `🔍 [MathAssistant] Extracted expression from message: ${expression}`,
        );
        const calculationResult = this.calculate(expression);

        if (!calculationResult.error) {
          return {
            content: `I can help you with that calculation! ${expression} equals ${calculationResult.result}.`,
            toolCalls: [
              {
                id: "calculator",
                name: "Calculator",
                input: { expression: expression },
                result: calculationResult,
              },
            ],
          };
        }
      }

      return {
        content:
          "I'd be happy to help with calculations! You can give me expressions like '2+2' or '5*6-3', or ask me to solve equations like '2x + 5 = 13'. What would you like me to calculate?",
        toolCalls: [],
      };
    }

    // Check for general math-related queries
    if (
      message.toLowerCase().includes("math") ||
      message.toLowerCase().includes("equation") ||
      message.toLowerCase().includes("formula")
    ) {
      return {
        content:
          "I'm here to help with all your mathematical needs! I can perform calculations, solve equations, and explain mathematical concepts. Just send me an expression like '2+2' or an equation like '2x + 5 = 13', and I'll solve it for you. What can I help you calculate today?",
        toolCalls: [],
      };
    }

    // Default friendly greeting
    return {
      content:
        "Hello! I'm your Math Assistant. I can help you with calculations and solve equations. You can send me math expressions like '2+2' or equations like '2x + 5 = 13', and I'll solve them for you. What mathematical problem can I help you with today?",
      toolCalls: [],
    };
  }

  async executeTool(toolId: string, input: any) {
    switch (toolId) {
      case "calculator":
        return this.calculate(input.expression);
      case "equation_solver":
        return this.solveEquation(input.equation, input.variable || "x");
      default:
        throw new Error(`Unknown tool: ${toolId}`);
    }
  }

  private calculate(expression: string) {
    try {
      // Basic safety check - only allow numbers, operators, and parentheses
      if (!/^[0-9+\-*/.() ]+$/.test(expression)) {
        throw new Error("Invalid characters in expression");
      }

      // Use Function constructor for safe evaluation (better than eval)
      const result = Function(`"use strict"; return (${expression})`)();

      return {
        result: result,
        expression: expression,
        explanation: `The result of ${expression} is ${result}`,
      };
    } catch (error) {
      return {
        error: "Failed to calculate expression",
        message: error instanceof Error ? error.message : "Unknown error",
        expression: expression,
      };
    }
  }

  private solveEquation(equation: string, variable: string = "x") {
    try {
      // Simple linear equation solver (ax + b = c format)
      // This is a very basic implementation - in production you'd use a proper math library

      const cleanEquation = equation.replace(/\s/g, "");

      // Check if it's a simple linear equation like "2x + 5 = 13"
      const linearMatch = cleanEquation.match(
        /^([+-]?\d*)?([a-z])\s*([+-]\d+)?\s*=\s*([+-]?\d+)$/i,
      );

      if (linearMatch) {
        const [, coeff, var_name, constant, result] = linearMatch;

        if (var_name.toLowerCase() !== variable.toLowerCase()) {
          throw new Error(
            `Equation contains variable ${var_name}, but solving for ${variable}`,
          );
        }

        const a = coeff ? parseFloat(coeff) || 1 : 1;
        const b = constant ? parseFloat(constant) : 0;
        const c = parseFloat(result);

        const solution = (c - b) / a;

        return {
          solution: solution,
          equation: equation,
          variable: variable,
          steps: [
            `Original equation: ${equation}`,
            `Rearrange to: ${a}${variable} = ${c} - ${b}`,
            `Simplify: ${a}${variable} = ${c - b}`,
            `Divide by ${a}: ${variable} = ${solution}`,
          ],
        };
      } else {
        return {
          error: "Equation format not supported",
          message:
            'Currently only simple linear equations are supported (e.g., "2x + 5 = 13")',
          equation: equation,
        };
      }
    } catch (error) {
      return {
        error: "Failed to solve equation",
        message: error instanceof Error ? error.message : "Unknown error",
        equation: equation,
      };
    }
  }
}

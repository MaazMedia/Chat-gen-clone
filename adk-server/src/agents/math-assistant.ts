// Math Assistant Agent
// Provides mathematical calculation and equation solving capabilities

export class MathAssistant {
  public id = 'math-assistant';
  public name = 'Math Assistant';
  public description = 'A helpful assistant that can perform mathematical calculations and solve problems';

  public tools = [
    {
      id: 'calculator',
      name: 'Calculator',
      description: 'Performs basic mathematical operations (addition, subtraction, multiplication, division)',
      schema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4")',
          },
        },
        required: ['expression'],
      },
    },
    {
      id: 'equation_solver',
      name: 'Equation Solver',
      description: 'Solves mathematical equations and provides step-by-step solutions',
      schema: {
        type: 'object',
        properties: {
          equation: {
            type: 'string',
            description: 'Mathematical equation to solve (e.g., "2x + 5 = 13")',
          },
          variable: {
            type: 'string',
            description: 'Variable to solve for (default: x)',
            default: 'x',
          },
        },
        required: ['equation'],
      },
    },
  ];

  async invoke(message: string, context: any = {}) {
    // Simple response generation for math assistant
    if (message.toLowerCase().includes('calculate') || message.toLowerCase().includes('math')) {
      return {
        content: "I'm ready to help with mathematical calculations! You can ask me to calculate expressions or solve equations. What would you like me to calculate?",
        toolCalls: [],
      };
    }

    return {
      content: "Hello! I'm your Math Assistant. I can help you with calculations and solve equations. What mathematical problem can I help you with today?",
      toolCalls: [],
    };
  }

  async executeTool(toolId: string, input: any) {
    switch (toolId) {
      case 'calculator':
        return this.calculate(input.expression);
      case 'equation_solver':
        return this.solveEquation(input.equation, input.variable || 'x');
      default:
        throw new Error(`Unknown tool: ${toolId}`);
    }
  }

  private calculate(expression: string) {
    try {
      // Basic safety check - only allow numbers, operators, and parentheses
      if (!/^[0-9+\-*/.() ]+$/.test(expression)) {
        throw new Error('Invalid characters in expression');
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
        error: 'Failed to calculate expression',
        message: error instanceof Error ? error.message : 'Unknown error',
        expression: expression,
      };
    }
  }

  private solveEquation(equation: string, variable: string = 'x') {
    try {
      // Simple linear equation solver (ax + b = c format)
      // This is a very basic implementation - in production you'd use a proper math library
      
      const cleanEquation = equation.replace(/\s/g, '');
      
      // Check if it's a simple linear equation like "2x + 5 = 13"
      const linearMatch = cleanEquation.match(/^([+-]?\d*)?([a-z])\s*([+-]\d+)?\s*=\s*([+-]?\d+)$/i);
      
      if (linearMatch) {
        const [, coeff, var_name, constant, result] = linearMatch;
        
        if (var_name.toLowerCase() !== variable.toLowerCase()) {
          throw new Error(`Equation contains variable ${var_name}, but solving for ${variable}`);
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
          error: 'Equation format not supported',
          message: 'Currently only simple linear equations are supported (e.g., "2x + 5 = 13")',
          equation: equation,
        };
      }
    } catch (error) {
      return {
        error: 'Failed to solve equation',
        message: error instanceof Error ? error.message : 'Unknown error',
        equation: equation,
      };
    }
  }
}
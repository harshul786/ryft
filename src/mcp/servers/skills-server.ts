import { getAllSkillsAcrossModes } from "../../modes/skill-merger.ts";

/**
 * MCP server for skill invocation
 * Exposes skills as callable tools via JSON-RPC
 */
export class SkillsMcpServer {
  private skillsCache: Map<string, string> = new Map();
  private allSkillsCache: Map<
    string,
    { name: string; description: string; filePath: string }
  > | null = null;

  /**
   * Load all available skills from filesystem
   */
  private async loadAllSkills(): Promise<
    Map<string, { name: string; description: string; filePath: string }>
  > {
    if (this.allSkillsCache) {
      return this.allSkillsCache;
    }

    try {
      // Get all skills from skills database
      const skillEntries = getAllSkillsAcrossModes();

      const skillMap = new Map<
        string,
        { name: string; description: string; filePath: string }
      >();
      for (const entry of skillEntries) {
        skillMap.set(entry.name, {
          name: entry.name,
          description: entry.description,
          filePath: entry.filePath,
        });
      }

      this.allSkillsCache = skillMap;
      return skillMap;
    } catch (error) {
      console.error("Failed to load skills:", error);
      return new Map();
    }
  }

  /**
   * List all available skills as MCP tools
   */
  async listSkills(): Promise<
    Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>
  > {
    const allSkills = await this.loadAllSkills();
    const skillNames = Array.from(allSkills.keys()).join(", ");

    return [
      {
        name: "list_skills",
        description:
          "List all available skills that can be invoked. Returns skill names and descriptions.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "invoke_skill",
        description:
          "Invoke a specific skill by name to perform a task. Available skills: " +
          skillNames,
        inputSchema: {
          type: "object",
          properties: {
            skill: {
              type: "string",
              description: `The name of the skill to invoke. Available: ${skillNames}`,
            },
          },
          required: ["skill"],
        },
      },
    ];
  }

  /**
   * Invoke a specific skill
   */
  async invokeSkill(skillName: string): Promise<string> {
    try {
      // Check cache first
      if (this.skillsCache.has(skillName)) {
        return this.skillsCache.get(skillName)!;
      }

      // Load all skills
      const skills = await this.loadAllSkills();
      const skill = skills.get(skillName);
      if (!skill) {
        throw new Error(`Skill not found: ${skillName}`);
      }

      // Read skill file
      const fs = await import("fs/promises");
      const content = await fs.readFile(skill.filePath, "utf-8");

      // Cache for future requests
      this.skillsCache.set(skillName, content);

      return content;
    } catch (error) {
      throw new Error(
        `Failed to invoke skill '${skillName}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * JSON-RPC handler for skills MCP server
 */
export async function handleSkillsMcpRequest(
  method: string,
  params: Record<string, unknown>,
  server: SkillsMcpServer,
): Promise<unknown> {
  switch (method) {
    case "list_skills": {
      // Return structured list of available skills
      const skills = await server.listSkills();
      const listSkillsTool = skills.find((t) => t.name === "list_skills");

      if (!listSkillsTool) {
        return {
          skills: skills
            .filter((t) => t.name !== "list_skills")
            .map((t) => ({
              name: t.name,
              description: t.description,
            })),
        };
      }

      return {
        skills: skills
          .filter((t) => t.name !== "list_skills")
          .map((t) => ({
            name: t.name,
            description: t.description,
          })),
      };
    }

    case "invoke_skill":
      return server.invokeSkill(params.skill as string);

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

/**
 * Main entry point if run as standalone process
 * Handles JSON-RPC calls from stdin
 */
export async function runSkillsMcpServerProcess(): Promise<void> {
  const server = new SkillsMcpServer();
  const readline = await import("readline");

  // Signal ready
  process.stdout.write(JSON.stringify({ type: "ready" }) + "\n");

  // Handle JSON-RPC calls from stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line: string) => {
    try {
      const request = JSON.parse(line) as {
        id?: string | number;
        method: string;
        params?: Record<string, unknown>;
      };
      const result = await handleSkillsMcpRequest(
        request.method,
        request.params || {},
        server,
      );
      const response = { id: request.id, result };
      process.stdout.write(JSON.stringify(response) + "\n");
    } catch (error) {
      const response = {
        id: undefined,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

// Run if this file is executed directly (ES module variant)
if (import.meta.url === `file://${process.argv[1]}`) {
  runSkillsMcpServerProcess().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

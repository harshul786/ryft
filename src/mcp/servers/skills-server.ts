import { getAllSkillsAcrossModes } from "../../modes/skill-merger.ts";
import { resolve } from "node:path";

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
      // Get all skills from skills database, filtered to active modes when set
      const allSkillEntries = getAllSkillsAcrossModes();
      const activeModes = (process.env.RYFT_ACTIVE_MODES ?? "")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      const skillEntries =
        activeModes.length > 0
          ? allSkillEntries.filter((e) =>
              e.modes.some((m) => activeModes.includes(m)),
            )
          : allSkillEntries;

      const skillMap = new Map<
        string,
        { name: string; description: string; filePath: string }
      >();
      for (const entry of skillEntries) {
        skillMap.set(entry.name, {
          name: entry.name,
          description: entry.description,
          filePath: resolve(process.cwd(), entry.path),
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
   * List all available skills as MCP tools.
   * Each skill is exposed as its own named tool so the model can call
   * e.g. `edit({context: "…"})` or `compact({})` directly.
   */
  async listSkills(): Promise<
    Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>
  > {
    const allSkills = await this.loadAllSkills();

    return Array.from(allSkills.values()).map((skill) => ({
      name: skill.name,
      description: skill.description,
      inputSchema: {
        type: "object",
        properties: {
          context: {
            type: "string",
            description:
              "Optional extra context or instructions for this skill invocation.",
          },
        },
        required: [],
      },
    }));
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

      // Wrap with imperative framing so the model knows it must execute,
      // not just read and respond with text.
      return [
        `=== SKILL ACTIVATED: ${skillName} ===`,
        `You MUST execute every step below using your available tools.`,
        `Do NOT respond with text — call your tools now to carry out each step.`,
        ``,
        content.trim(),
        ``,
        `=== BEGIN EXECUTION: Call your first tool now to start Step 1 above. ===`,
      ].join("\n");
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
  // Handle standard MCP methods
  if (method === "tools/list") {
    const skills = await server.listSkills();
    return { tools: skills };
  }

  if (method === "tools/call") {
    const toolName = params.name as string;
    if (!toolName) {
      throw new Error("Missing required parameter: name");
    }

    // Every skill is a directly callable tool by its own name.
    const content = await server.invokeSkill(toolName);
    return { type: "text", text: content };
  }

  throw new Error(`Unknown method: ${method}`);
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
    let requestId: string | number | undefined;
    try {
      const request = JSON.parse(line) as {
        id?: string | number;
        method: string;
        params?: Record<string, unknown>;
      };
      requestId = request.id;
      const result = await handleSkillsMcpRequest(
        request.method,
        request.params || {},
        server,
      );
      const response = { id: request.id, result };
      process.stdout.write(JSON.stringify(response) + "\n");
    } catch (error) {
      const response = {
        id: requestId,
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
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.includes("skills-server.ts")
) {
  runSkillsMcpServerProcess().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

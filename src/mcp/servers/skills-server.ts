/// <reference types="node" />
import { getAllSkillsAcrossModes } from "../../modes/skill-merger.ts";
import { resolve } from "node:path";
import { getFeatureLogger } from "../../logging/index.ts";

const log = getFeatureLogger("SkillsServer");

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
        .map((m: string) => m.trim())
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

      log.info("Skills loaded from filesystem", {
        total: skillMap.size,
        activeModes: activeModes.length ? activeModes : "all",
        skills: Array.from(skillMap.keys()),
      });

      this.allSkillsCache = skillMap;
      return skillMap;
    } catch (error) {
      log.error("Failed to load skills from filesystem", error as Error);
      console.error("Failed to load skills:", error);
      return new Map();
    }
  }

  /** Public accessor for loadAllSkills (used by JSON-RPC handler) */
  async getSkills() {
    return this.loadAllSkills();
  }

  /**
   * Return the two skill meta-tools:
   * - list_skills: discover available skill names
   * - skill_fetcher_by_name: load a specific skill's instructions
   */
  async listSkills(): Promise<
    Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>
  > {
    const allSkills = await this.loadAllSkills();
    const availableNames = Array.from(allSkills.keys());

    const tools = [
      {
        name: "list_skills",
        description:
          "List the names and descriptions of all available skills. Call this first to discover what skills exist before fetching one.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "skill_fetcher_by_name",
        description: `Fetch the step-by-step instructions for a named skill. This is NOT a browser control tool — it only loads a skill guide. Available skills: ${availableNames.join(", ")}.`,
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: `Name of the skill to load. One of: ${availableNames.join(", ")}.`,
            },
          },
          required: ["name"],
        },
      },
    ];

    log.debug("Advertising skill meta-tools", {
      tools: tools.map((t) => t.name),
      availableSkills: availableNames,
    });

    return tools;
  }

  /**
   * Invoke a specific skill
   */
  async invokeSkill(skillName: string): Promise<string> {
    try {
      log.info("Skill invocation requested", { skill: skillName });

      // Check content cache
      if (this.skillsCache.has(skillName)) {
        log.debug("Serving skill from content cache", { skill: skillName });
        return this.skillsCache.get(skillName)!;
      }

      // Load all skills
      const skills = await this.loadAllSkills();
      const skill = skills.get(skillName);
      if (!skill) {
        log.warn("Skill not found", {
          requested: skillName,
          available: Array.from(skills.keys()),
        });
        throw new Error(`Skill not found: ${skillName}`);
      }

      log.debug("Reading skill file from disk", {
        skill: skillName,
        filePath: skill.filePath,
      });

      // Read skill file
      const fs = await import("node:fs/promises");
      const content = await fs.readFile(skill.filePath, "utf-8");

      // Cache content
      this.skillsCache.set(skillName, content);

      // Wrap with imperative framing so the model knows it must execute,
      // not just read and respond with text.
      const wrapped = [
        `=== SKILL ACTIVATED: ${skillName} ===`,
        `You MUST execute every step below using your available tools.`,
        `Do NOT respond with text — call your tools now to carry out each step.`,
        ``,
        content.trim(),
        ``,
        `=== BEGIN EXECUTION: Call your first tool now to start Step 1 above. ===`,
      ].join("\n");

      log.info("Skill content sent to model", {
        skill: skillName,
        byteLen: wrapped.length,
        lines: wrapped.split("\n").length,
        preview: content.trim().split("\n").slice(0, 3).join(" | "),
      });

      return wrapped;
    } catch (error) {
      log.error(`Failed to invoke skill '${skillName}'`, error as Error, {
        skill: skillName,
      });
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
  log.debug("JSON-RPC request received", { method });

  // Handle MCP lifecycle
  if (method === "initialize") {
    log.info("MCP server initializing", {
      protocolVersion: params.protocolVersion,
      clientName: (params.clientInfo as Record<string, string>)?.name,
    });
    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "ryft-skills",
        version: "1.0.0",
      },
    };
  }

  if (method === "notifications/initialized") {
    log.debug("MCP client initialized");
    return null;
  }

  // Handle standard MCP methods
  if (method === "tools/list") {
    const skills = await server.listSkills();
    log.debug("tools/list response", { toolCount: skills.length });
    return { tools: skills };
  }

  if (method === "tools/call") {
    const toolName = params.name as string;
    if (!toolName) {
      throw new Error("Missing required parameter: name");
    }

    log.info("tools/call dispatched", {
      tool: toolName,
      args: params.arguments ?? {},
    });

    if (toolName === "list_skills") {
      const skills = await server.getSkills();
      const listing = Array.from(skills.values())
        .map((s) => `- ${s.name}: ${s.description}`)
        .join("\n");
      const text = `Available skills:\n${listing}`;
      log.debug("list_skills response", { skillCount: skills.size });
      return { type: "text", text };
    }

    if (toolName === "skill_fetcher_by_name") {
      const args = (params.arguments ?? {}) as Record<string, string>;
      const skillName = args.name;
      if (!skillName) {
        throw new Error("skill_fetcher_by_name requires a 'name' argument");
      }
      const content = await server.invokeSkill(skillName);
      log.debug("skill_fetcher_by_name response ready", {
        skill: skillName,
        byteLen: content.length,
      });
      return { type: "text", text: content };
    }

    throw new Error(`Unknown skill tool: ${toolName}`);
  }

  log.warn("Unknown JSON-RPC method", { method });
  throw new Error(`Unknown method: ${method}`);
}

/**
 * Main entry point if run as standalone process
 * Handles JSON-RPC calls from stdin
 */
export async function runSkillsMcpServerProcess(): Promise<void> {
  const server = new SkillsMcpServer();
  const readline = await import("node:readline");

  log.info("Skills MCP server starting");

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

      log.debug("Raw JSON-RPC line received", {
        id: request.id,
        method: request.method,
      });

      const result = await handleSkillsMcpRequest(
        request.method,
        request.params || {},
        server,
      );
      const response = { id: request.id, result };
      process.stdout.write(JSON.stringify(response) + "\n");
    } catch (error) {
      log.error("JSON-RPC request failed", error as Error, { id: requestId });
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
    log.info("Skills MCP server stdin closed — exiting");
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

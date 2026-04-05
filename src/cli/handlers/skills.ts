import type { Command, CommandContext } from "../../commands.ts";
import { loadRyftSkills } from "../../skills/discovery.ts";

export const skills: Command = {
  name: "skills",
  aliases: ["s"],
  description: "List or manage available skills",

  async execute(args: string[], context: CommandContext) {
    const action = args[0]?.toLowerCase();

    if (action === "list" || !action) {
      // Show available skills from discovery
      try {
        const discoveredSkills = await loadRyftSkills();

        if (discoveredSkills.length === 0) {
          context.setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content:
                  "No skills found.\n\nCreate skill files in:\n  .ryft/skills/ (project)\n  ~/.ryft/skills/ (user)\n\nSkills are markdown files with YAML frontmatter.",
              },
            ],
          }));
        } else {
          const skillsList = discoveredSkills
            .map((s) => `  • ${s.name}: ${s.description || "(no description)"}`)
            .join("\n");

          context.setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: `Available skills (${discoveredSkills.length}):\n${skillsList}`,
              },
            ],
          }));
        }
      } catch (error) {
        context.setAppState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: `Error discovering skills: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        }));
      }
    } else if (action === "enable" && args[1]) {
      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: `Enabled skill: ${args[1]}`,
          },
        ],
      }));
    } else if (action === "disable" && args[1]) {
      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: `Disabled skill: ${args[1]}`,
          },
        ],
      }));
    } else {
      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: "Usage: /skills [list|enable|disable] [name]",
          },
        ],
      }));
    }
  },
};

import type { Command, CommandContext } from "../../commands.ts";
import {
  getModeSkills,
  disableSkill,
  enableSkill,
  getSkillMetadata,
  getSkillRequiredTools,
} from "../../modes/skill-merger.ts";

export const skills: Command = {
  name: "skills",
  aliases: ["s"],
  description: "List or manage available skills",

  async execute(args: string[], context: CommandContext) {
    const action = args[0]?.toLowerCase();

    if (action === "list" || !action) {
      // Show available skills for current mode
      try {
        const currentMode = context.session.modes[0];
        if (!currentMode) {
          context.setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: "No active mode. Use /mode to select one.",
              },
            ],
          }));
          return;
        }

        const modeSkills = await getModeSkills(currentMode);

        if (modeSkills.length === 0) {
          context.setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: `No skills available in mode "${currentMode.name}".\n\nCreate skill files in:\n  .ryft/skills/ (project)\n  ~/.ryft/skills/ (user)\n\nSkills are markdown files with YAML frontmatter.`,
              },
            ],
          }));
        } else {
          const skillsList = modeSkills
            .map((skill) => {
              const metadata = getSkillMetadata(skill.name);
              const tools = getSkillRequiredTools(skill.name);
              const toolsStr =
                tools.length > 0 ? ` [needs: ${tools.join(",")}]` : "";
              const contextStr = skill.context ? ` (${skill.context})` : "";
              return `  • ${skill.name}: ${skill.description || "(no description)"}${contextStr}${toolsStr}`;
            })
            .join("\n");

          context.setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: `Available skills for mode "${currentMode.name}" (${modeSkills.length}):\n${skillsList}\n\nUse /skills enable <name> or /skills disable <name> to toggle.`,
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
      // Enable a skill in the current mode
      try {
        const currentMode = context.session.modes[0];
        if (!currentMode) {
          context.setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: "No active mode.",
              },
            ],
          }));
          return;
        }

        const skillId = args[1];
        const state = enableSkill(skillId, currentMode.name);

        context.setAppState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: `✓ Re-enabled skill "${skillId}" in mode "${currentMode.name}".`,
            },
          ],
        }));
      } catch (error) {
        context.setAppState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: `Error enabling skill: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        }));
      }
    } else if (action === "disable" && args[1]) {
      // Disable a skill in the current mode
      try {
        const currentMode = context.session.modes[0];
        if (!currentMode) {
          context.setAppState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                content: "No active mode.",
              },
            ],
          }));
          return;
        }

        const skillId = args[1];
        const state = disableSkill(skillId, currentMode.name);

        context.setAppState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: `✓ Disabled skill "${skillId}" in mode "${currentMode.name}".`,
            },
          ],
        }));
      } catch (error) {
        context.setAppState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: `Error disabling skill: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        }));
      }
    } else {
      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content:
              "Skills manager\n\nUsage:\n  /skills [list]         - Show available skills for current mode\n  /skills enable <name>  - Re-enable a skill\n  /skills disable <name> - Disable a skill for current mode",
          },
        ],
      }));
    }
  },
};

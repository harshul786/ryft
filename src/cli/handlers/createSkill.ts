import type { Command, CommandContext } from "../../commands.ts";
import {
  saveSkillToFilesystem,
  createSkillFromResponses,
  formatFrontmatterPreview,
  parseToolsFromText,
  extractSkillName,
  parseEffortLevel,
  type SkillCreationResult,
} from "../../commands/createSkill.ts";
import { getFeatureLogger } from "../../logging/index.ts";

const log = getFeatureLogger("CreateSkillCommand");

/**
 * Interactive skill creation command
 * Conducts LLM-driven interview to create new skills
 */
export const createSkill: Command = {
  name: "create-skill",
  aliases: ["cs", "skill-create"],
  description: "Create a new skill interactively with LLM guidance",

  async execute(args: string[], context: CommandContext) {
    try {
      log.info("Starting skill creation flow");

      // Show introduction
      const introMessage = `🛠️ **Skill Builder** - Let's create a new skill!

I'll guide you through 3 quick questions to define your skill. You can type **cancel** anytime to stop.

**Round 1 of 3:** What problem does this skill solve? Describe the use case briefly.`;

      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: introMessage,
          },
        ],
      }));

      log.info("Skill creation interview started");
    } catch (error) {
      log.error(
        "Error initiating skill creation",
        error instanceof Error ? error : new Error(String(error)),
      );
      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: `❌ Error starting skill creation: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }));
    }
  },
};

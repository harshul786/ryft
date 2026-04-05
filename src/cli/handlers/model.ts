import type { Command, CommandContext } from "../../commands.ts";
import { listModelOptions, resolveModelOption } from "../../models/catalog.ts";
import type { SelectOption } from "../../state/AppStateStore.ts";

export const model: Command = {
  name: "model",
  aliases: ["m"],
  description: "Select or show current model",

  execute(args: string[], context: CommandContext) {
    const modelArg = args.join(" ").trim();
    const allModels = listModelOptions();

    if (modelArg) {
      // Try to resolve the model by name, label, or provider
      const found = resolveModelOption(modelArg);

      if (found) {
        context.session.setModel(found);
        context.setAppState((prev) => ({
          ...prev,
          currentModel: found,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: `✓ Model switched to: ${found.label} (${found.id})`,
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
              content: `Model not found: ${modelArg}\n\nAvailable models:\n${allModels
                .map((m) => `  ${m.id.padEnd(20)} - ${m.label}`)
                .join("\n")}`,
            },
          ],
        }));
      }
    } else {
      // Show interactive selector
      const currentIndex = allModels.findIndex(
        (m) => m.id === context.appState.currentModel.id,
      );

      const options: SelectOption[] = allModels.map((m) => ({
        label: `${m.label}`,
        value: m.id,
        description: m.description,
      }));

      context.setAppState((prev) => ({
        ...prev,
        selector: {
          type: "select",
          title: "Select a model (use arrow keys)",
          options,
          initialFocusIndex: currentIndex >= 0 ? currentIndex : 0,
          onSelect: (modelId: string) => {
            const selected = resolveModelOption(modelId);
            if (selected) {
              context.session.setModel(selected);
              context.setAppState((p) => ({
                ...p,
                currentModel: selected,
                messages: [
                  ...p.messages,
                  {
                    role: "assistant",
                    content: `✓ Model set to: ${selected.label}`,
                  },
                ],
              }));
            }
          },
          onCancel: () => {
            context.setAppState((p) => ({
              ...p,
              messages: [
                ...p.messages,
                {
                  role: "assistant",
                  content: "Model selection cancelled",
                },
              ],
            }));
          },
        },
      }));
    }
  },
};

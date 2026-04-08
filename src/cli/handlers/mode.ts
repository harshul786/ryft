import type { Command, CommandContext } from "../../commands.ts";
import { resolveModes, listModes } from "../../modes/catalog.ts";
import { renderStatusLine } from "../../ui/chalkDraw.ts";
import type { SelectOption } from "../../state/AppStateStore.ts";

function postMessage(context: CommandContext, content: string) {
  context.setAppState((prev) => ({
    ...prev,
    messages: [...prev.messages, { role: "assistant" as const, content }],
  }));
}

function openModePicker(context: CommandContext) {
  const allModes = listModes();
  const currentNames = context.session.config.modes.map((m) => m.name);

  const options: SelectOption<string>[] = allModes.map((m) => ({
    label: m.name,
    value: m.name,
    description: m.description,
  }));

  const initialFocusIndex = Math.max(
    0,
    options.findIndex((o) => o.value === currentNames[0]),
  );

  context.setAppState((prev) => ({
    ...prev,
    selector: {
      type: "select",
      title: "Select a mode",
      options,
      initialFocusIndex,
      onSelect: (modeName: string) => {
        context.setAppState((prev) => ({ ...prev, selector: null }));
        applyModeChange(context, [modeName]);
      },
      onCancel: () => {
        postMessage(context, "Mode selection cancelled.");
      },
    },
  }));
}

function applyModeChange(context: CommandContext, modeNames: string[]) {
  const resolved = resolveModes(modeNames);
  if (resolved.length === 0) {
    postMessage(
      context,
      `Invalid modes: ${modeNames.join(", ")}. Available: ${listModes()
        .map((m) => m.name)
        .join(", ")}`,
    );
    return;
  }
  postMessage(
    context,
    `Switching to ${resolved.map((m) => m.name).join(", ")}… loading tools`,
  );
  context.setAppState((prev) => ({ ...prev, isSwitchingMode: true }));
  context.session
    .setModes(resolved)
    .then(() => {
      const statusLine = renderStatusLine(context.session);
      const stats = context.session.toolRegistry.getStats();
      context.setAppState((prev) => ({ ...prev, isSwitchingMode: false }));
      postMessage(
        context,
        `✓ ${statusLine}\n  ${stats.totalTools} tool(s) ready — you can now send messages`,
      );
    })
    .catch((err) => {
      context.setAppState((prev) => ({ ...prev, isSwitchingMode: false }));
      postMessage(
        context,
        `❌ Failed to switch modes: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
}

export const mode: Command = {
  name: "mode",
  aliases: ["m"],
  description: "Select or show current modes",

  execute(args: string[], context: CommandContext) {
    if (args.length === 0) {
      // No args — open interactive picker
      openModePicker(context);
      return;
    }

    // Args provided — resolve directly (supports multi-mode: /mode coder browser-surff)
    const resolvedModes = resolveModes(args);

    if (resolvedModes.length === 0) {
      postMessage(
        context,
        `Invalid modes: ${args.join(", ")}. Available: ${listModes()
          .map((m) => m.name)
          .join(", ")}`,
      );
    } else {
      applyModeChange(
        context,
        resolvedModes.map((m) => m.name),
      );
    }
  },
};

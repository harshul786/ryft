import chalk from "chalk";
import type { Session } from "../runtime/session.ts";
import type { Usage } from "../types.ts";

export function renderBanner(session: Session): string {
  const brand = chalk.bold.blue("Ryft");
  const tagline = chalk.dim("modular AI coding CLI");
  const sep = chalk.blue("│");

  const modeVal = chalk.blueBright(session.modes.map((m) => m.name).join(", "));
  const memVal = chalk.cyan(session.memoryMode.name);
  const modelVal = chalk.white(`${session.config.model.label}`);
  const provVal = chalk.dim(`(${session.config.model.provider})`);

  const divider = chalk.blue("─".repeat(50));

  return [
    "",
    ` ${brand}  ${sep}  ${tagline}`,
    ` ${chalk.dim("mode")}   ${modeVal}   ${chalk.dim("memory")}  ${memVal}`,
    ` ${chalk.dim("model")}  ${modelVal} ${provVal}`,
    ` ${divider}`,
    "",
  ].join("\n");
}

export function renderStatusLine(session: Session, usage?: Usage): string {
  const parts = [
    chalk.blue(`mode=${session.modes.map((m) => m.name).join("+")} `),
    chalk.cyan(`memory=${session.memoryMode.name}`),
    chalk.white(`model=${session.config.model.id}`),
  ];
  if (usage) {
    parts.push(
      chalk.yellow(
        `tokens=${usage.input_tokens ?? 0}↑ ${usage.output_tokens ?? 0}↓`,
      ),
    );
  }
  return parts.join(chalk.dim("  ·  "));
}

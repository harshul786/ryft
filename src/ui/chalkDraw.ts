import chalk from 'chalk';
import type { Session } from '../runtime/session.ts';
import type { Usage } from '../types.ts';

export function renderBanner(session: Session): string {
  const title = chalk.bold.cyan('Ryft');
  const subtitle = chalk.dim('OpenAI-native modular code CLI [TEST CHANGE]');
  const modeLine = chalk.white(`modes: ${session.modes.map(mode => mode.name).join(', ')}`);
  const memoryLine = chalk.white(`memory: ${session.memoryMode.name}`);
  const modelLine = chalk.white(`model: ${session.config.model.label} (${session.config.model.provider})`);
  return [
    '',
    ` ${title}  ${subtitle}`,
    ` ${modeLine}`,
    ` ${memoryLine}`,
    ` ${modelLine}`,
    '',
  ].join('\n');
}

export function renderStatusLine(session: Session, usage?: Usage): string {
  const parts = [
    chalk.green(`modes=${session.modes.map(mode => mode.name).join('+')}`),
    chalk.blue(`memory=${session.memoryMode.name}`),
    chalk.magenta(`model=${session.config.model.id}`),
  ];
  if (usage) {
    parts.push(chalk.yellow(`tokens=${usage.input_tokens ?? 0}/${usage.output_tokens ?? 0}`));
  }
  return parts.join('  ');
}

import chalk from 'chalk';
import type { Session } from '../runtime/session.ts';
import { createBrowserController } from './controller.ts';
import { formatBrowserTabs } from './common.ts';

export async function initBrowser(session: Session): Promise<void> {
  const browserModes = session.modes.filter(mode => mode.name === 'browser-surff');
  if (!browserModes.length) {
    console.log(chalk.yellow('Browser mode is not active. Re-run with --mode browser-surff or /mode browser-surff.'));
    return;
  }

  if (!session.browser) {
    session.setBrowser(await createBrowserController());
  }

  const controller = session.browser;
  if (!controller) {
    console.log(chalk.red('Failed to initialize browser controller.'));
    return;
  }

  console.log(chalk.green('Browser session is enabled for this conversation.'));
  console.log(chalk.dim((await controller.isReady()) ? controller.description : 'Starting browser session...'));
  const tabs = await controller.listTabs();
  if (tabs.length > 0) {
    console.log(formatBrowserTabs(tabs));
    console.log(chalk.dim('Start with the current tab context before opening anything new.'));
  }
}

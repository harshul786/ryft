import type { ChatMessage } from '../types.ts';
import { BROWSER_SURFF_PROMPT, BROWSER_SURFF_SKILL_HINT } from '../browser/prompt.ts';
import { buildMemoryPrompt } from '../memory/compose.ts';
import { buildModePrompt } from '../modes/compose.ts';
import { applyTokenCap } from './tokenBudget.ts';
import type { Session } from './session.ts';

export async function promptWithSession(session: Session, userText: string): Promise<ChatMessage[]> {
  const browserModeActive = session.modes.some(mode => mode.name === 'browser-surff');
  const memoryPrompt = await buildMemoryPrompt({
    memoryMode: session.memoryMode,
    cwd: session.config.cwd ?? process.cwd(),
    homeDir: session.config.homeDir,
    sessionSnapshot: session.memoryState.snapshot,
  });
  const systemPrompt = applyTokenCap(
    [
      buildModePrompt(session.modes),
      memoryPrompt,
      ...(browserModeActive ? [BROWSER_SURFF_PROMPT, BROWSER_SURFF_SKILL_HINT] : []),
      'Keep responses concise, use tools sparingly, and prefer simple architectures.',
    ].join('\n\n'),
    200,
  );

  return [
    { role: 'system', content: systemPrompt },
    ...session.history,
    { role: 'user', content: userText },
  ];
}

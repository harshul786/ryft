/**
 * Logging Integration Guide
 * 
 * This guide shows how to integrate the logging system throughout the Ryft project.
 * Each feature should have its own logger instance with a descriptive name.
 */

// ============================================================================
// BASIC USAGE
// ============================================================================

/*
Import the logger or getFeatureLogger:

  import { logger } from '../logging';
  import { getFeatureLogger } from '../logging';

Create a feature logger (recommended):

  const log = getFeatureLogger('MCP');        // [MCP]:: prefix
  const log = getFeatureLogger('Browser');    // [Browser]:: prefix
  const log = getFeatureLogger('Skills');     // [Skills]:: prefix
*/

// ============================================================================
// LOGGING METHODS
// ============================================================================

/*
All logging methods support both regular and feature-based signatures:

BASIC (without feature):
  logger.debug(message, context);
  logger.info(message, context);
  logger.warn(message, context);
  logger.error(message, error, context);

WITH FEATURE (using feature logger):
  const log = getFeatureLogger('MyFeature');
  log.debug(message, context);
  log.info(message, context);
  log.warn(message, context);
  log.error(message, error, context);

DIRECT (with feature parameter):
  logger.debug(message, context, 'MyFeature');
  logger.info(message, context, 'MyFeature');
  logger.warn(message, context, 'MyFeature');
  logger.error(message, error, context, 'MyFeature');
*/

// ============================================================================
// EXAMPLE 1: MCP Module Logging
// ============================================================================

/*
// src/mcp/mcpClient.ts

import { getFeatureLogger } from '../logging';

const log = getFeatureLogger('MCP');

export class MCPClient {
  constructor() {
    log.info('Initializing MCP client');
  }

  async connect(url: string) {
    log.debug('Connecting to MCP server', { url });
    try {
      // connection logic
      log.info('Connected to MCP server', { url });
    } catch (error) {
      log.error('Failed to connect to MCP server', error as Error, { url });
      throw error;
    }
  }

  async executeCommand(command: string, args: Record<string, unknown>) {
    log.debug('Executing MCP command', { command, args });
    try {
      const result = await this.dispatch(command, args);
      log.debug('MCP command executed', { command, result });
      return result;
    } catch (error) {
      log.error('MCP command execution failed', error as Error, { command });
      throw error;
    }
  }
}
*/

// ============================================================================
// EXAMPLE 2: Browser Module Logging
// ============================================================================

/*
// src/browser/browserManager.ts

import { getFeatureLogger } from '../logging';

const log = getFeatureLogger('Browser');

export class BrowserManager {
  async launch() {
    log.info('Launching browser');
    try {
      // launch logic
      log.info('Browser launched successfully');
    } catch (error) {
      log.error('Failed to launch browser', error as Error);
      throw error;
    }
  }

  async navigate(url: string) {
    log.debug('Navigating to URL', { url });
    try {
      // navigate logic
      log.info('Navigated successfully', { url });
    } catch (error) {
      log.error('Navigation failed', error as Error, { url });
      throw error;
    }
  }
}
*/

// ============================================================================
// EXAMPLE 3: Skills Module Logging
// ============================================================================

/*
// src/skills/skillExecutor.ts

import { getFeatureLogger } from '../logging';

const log = getFeatureLogger('Skills');

export async function executeSkill(name: string, args: unknown[]) {
  log.debug('Executing skill', { name, argsCount: Array.isArray(args) ? args.length : 0 });
  
  try {
    log.info('Starting skill execution', { name });
    
    const result = await skill.execute(args);
    
    log.info('Skill executed successfully', { name, resultType: typeof result });
    return result;
  } catch (error) {
    log.error(
      'Skill execution failed',
      error as Error,
      { name, args },
    );
    throw error;
  }
}
*/

// ============================================================================
// EXAMPLE 4: Session/Runtime Module Logging
// ============================================================================

/*
// src/runtime/session.ts

import { getFeatureLogger } from '../logging';

const log = getFeatureLogger('Session');

export class Session {
  constructor(config: SessionConfig) {
    log.info('Creating new session', { 
      modes: config.modes.length,
      model: config.model.id 
    });
  }

  async appendMessage(message: ChatMessage) {
    log.debug('Appending message to session', {
      role: message.role,
      contentLength: message.content.length,
    });
    this.history.push(message);
  }

  async execute() {
    log.info('Starting session execution');
    try {
      // execution logic
      log.info('Session completed successfully');
    } catch (error) {
      log.error('Session execution failed', error as Error);
      throw error;
    }
  }
}
*/

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

/*
Control logging at runtime:

Enable/disable logging:
  export RYFT_LOGS_ENABLED=1
  export RYFT_LOGS_ENABLED=0

Set log level:
  export RYFT_LOG_LEVEL=debug
  export RYFT_LOG_LEVEL=info
  export RYFT_LOG_LEVEL=warn
  export RYFT_LOG_LEVEL=error

Example:
  RYFT_LOGS_ENABLED=1 RYFT_LOG_LEVEL=debug npm start
*/

// ============================================================================
// COMMAND-LINE TOOLS
// ============================================================================

/*
View logs from CLI:

Show logs status:
  ryft logs status

View all general logs (last 20):
  ryft logs view general

View error logs:
  ryft logs view error

Filter logs by feature:
  ryft logs view general MCP
  ryft logs view error Browser 50

Clear logs:
  ryft logs clear all
  ryft logs clear error

Change log level:
  ryft logs level debug
  ryft logs level info
*/

// ============================================================================
// LOG STORAGE
// ============================================================================

/*
Logs are stored locally in:
  ~/.ryft/logs/

Files:
  - general.log: All log entries with JSON format
  - debug.log: Debug-level entries
  - error.log: Error-level entries

Each line is a JSON object with:
  {
    "timestamp": "4/6/2026, 10:30:45 AM",
    "isoTime": "2026-04-06T14:30:45.123Z",
    "level": "info",
    "feature": "MCP",
    "message": "[MCP]:: Server initialized",
    "context": { "url": "localhost:3000" }
  }

Parse logs programmatically:
  import { readLogFile, getLogStats, searchLogs } from '../logging';
  
  const entries = readLogFile(join(homedir(), '.ryft/logs/general.log'));
  const stats = getLogStats(join(homedir(), '.ryft/logs/error.log'));
  const results = searchLogs(path, 'error pattern');
*/

// ============================================================================
// INTEGRATION CHECKLIST
// ============================================================================

/*
When adding logging to a module:

[ ] Import getFeatureLogger from '../logging'
[ ] Create feature logger at top of file: const log = getFeatureLogger('FeatureName')
[ ] Replace console.log/console.error/console.debug with:
    - log.info() for informational messages
    - log.debug() for detailed debugging info
    - log.warn() for warnings
    - log.error() for errors (include Error object as 2nd param)
[ ] Include relevant context in 3rd parameter (optional)
[ ] Test with: RYFT_LOGS_ENABLED=1 RYFT_LOG_LEVEL=debug npm start
[ ] Verify logs are written to ~/.ryft/logs/
[ ] Check logs with: ryft logs view general FeatureName
*/

// ============================================================================
// BEST PRACTICES
// ============================================================================

/*
1. Use feature-specific loggers:
   const log = getFeatureLogger('MyFeature');
   
   NOT:
   logger.info(message, context, 'MyFeature');

2. Include context for debugging:
   log.error('Failed to process', error, { userId: 123, action: 'save' });

3. Use appropriate log levels:
   - debug: Detailed info for developers (variable values, function calls)
   - info: General information about progress and events
   - warn: Something unexpected but not critical
   - error: Critical errors that need attention

4. Log at process boundaries:
   - Function entry/exit (debug level)
   - External API calls (debug/info)
   - Error conditions (error level)
   - State changes (info level)

5. Include enough context:
   log.info('Starting task', { taskId: task.id, type: task.type });
   NOT:
   log.info('Starting task');

6. Don't log sensitive data:
   // Good
   log.debug('User action', { userId: user.id });
   
   // Bad
   log.debug('User action', { email: user.email, password: user.password });
*/

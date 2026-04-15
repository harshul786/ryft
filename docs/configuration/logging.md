# Logging Integration Guide

This guide shows how to integrate and use Ryft's logging system throughout the project.

## Basic Usage

### Import the Logger

```typescript
import { logger } from '../logging';
import { getFeatureLogger } from '../logging';
```

### Create a Feature Logger (Recommended)

```typescript
const log = getFeatureLogger('MCP');        // Creates [MCP]:: prefix
const log = getFeatureLogger('Browser');    // Creates [Browser]:: prefix
const log = getFeatureLogger('Skills');     // Creates [Skills]:: prefix
```

## Logging Methods

All logging methods support both regular and feature-based signatures:

### Basic Signature (without feature)

```typescript
logger.debug(message, context);
logger.info(message, context);
logger.warn(message, context);
logger.error(message, error, context);
```

### Feature Logger Signature (recommended)

```typescript
const log = getFeatureLogger('MyFeature');
log.debug(message, context);
log.info(message, context);
log.warn(message, context);
log.error(message, error, context);
```

### Direct Feature Parameter

```typescript
logger.debug(message, context, 'MyFeature');
logger.info(message, context, 'MyFeature');
logger.warn(message, context, 'MyFeature');
logger.error(message, error, context, 'MyFeature');
```

## Examples

### MCP Module Logging

```typescript
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
```

### Browser Module Logging

```typescript
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
```

### Skills Module Logging

```typescript
// src/skills/skillExecutor.ts

import { getFeatureLogger } from '../logging';

const log = getFeatureLogger('Skills');

export async function executeSkill(name: string, args: unknown[]) {
  log.debug('Executing skill', { 
    name, 
    argsCount: Array.isArray(args) ? args.length : 0 
  });
  
  try {
    log.info('Starting skill execution', { name });
    
    const result = await skill.execute(args);
    
    log.info('Skill executed successfully', { 
      name, 
      resultType: typeof result 
    });
    return result;
  } catch (error) {
    log.error('Skill execution failed', error as Error, { name, args });
    throw error;
  }
}
```

### Session/Runtime Module Logging

```typescript
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
```

## Environment Variables

Control logging at runtime:

### Enable/Disable Logging

```bash
export RYFT_LOGS_ENABLED=1
export RYFT_LOGS_ENABLED=0
```

### Set Log Level

```bash
export RYFT_LOG_LEVEL=debug
export RYFT_LOG_LEVEL=info
export RYFT_LOG_LEVEL=warn
export RYFT_LOG_LEVEL=error
```

### Example

```bash
RYFT_LOGS_ENABLED=1 RYFT_LOG_LEVEL=debug npm start
```

## Command-Line Tools

View logs from the CLI:

### Show Logs Status

```bash
ryft logs status
```

### View General Logs

```bash
# View all general logs (last 20)
ryft logs view general

# Filter by feature
ryft logs view general MCP
ryft logs view general Browser 50
```

### View Error Logs

```bash
# All error logs
ryft logs view error

# Filter by feature
ryft logs view error Browser
ryft logs view error MCP 50
```

### Clear Logs

```bash
# Clear all logs
ryft logs clear all

# Clear specific logs
ryft logs clear error
```

### Change Log Level

```bash
ryft logs level debug
ryft logs level info
```

## Log Storage

Logs are stored locally in `~/.ryft/logs/`

### Log Files

- **general.log** - All log entries (JSON format)
- **debug.log** - Debug-level entries only
- **error.log** - Error-level entries only

### Log Entry Format

Each line is a JSON object:

```json
{
  "timestamp": "4/6/2026, 10:30:45 AM",
  "isoTime": "2026-04-06T14:30:45.123Z",
  "level": "info",
  "feature": "MCP",
  "message": "[MCP]:: Server initialized",
  "context": { "url": "localhost:3000" }
}
```

### Programmatic Access

```typescript
import { readLogFile, getLogStats, searchLogs } from '../logging';

const entries = readLogFile(join(homedir(), '.ryft/logs/general.log'));
const stats = getLogStats(join(homedir(), '.ryft/logs/error.log'));
const results = searchLogs(path, 'error pattern');
```

## Integration Checklist

When adding logging to a module:

- [ ] Import `getFeatureLogger` from '../logging'
- [ ] Create feature logger: `const log = getFeatureLogger('FeatureName')`
- [ ] Replace `console.log` with:
  - `log.info()` for informational messages
  - `log.debug()` for detailed debugging info
  - `log.warn()` for warnings
  - `log.error()` for errors (include Error object)
- [ ] Include relevant context in the method call
- [ ] Test with: `RYFT_LOGS_ENABLED=1 RYFT_LOG_LEVEL=debug npm start`
- [ ] Verify logs written to `~/.ryft/logs/`
- [ ] Check logs with: `ryft logs view general FeatureName`

## Best Practices

### 1. Use Feature-Specific Loggers

✅ Good:
```typescript
const log = getFeatureLogger('MyFeature');
```

❌ Avoid:
```typescript
logger.info(message, context, 'MyFeature');
```

### 2. Include Context for Debugging

```typescript
log.error('Failed to process', error, { userId: 123, action: 'save' });
```

### 3. Use Appropriate Log Levels

- **debug** - Detailed info for developers (values, function calls)
- **info** - General information about progress and events
- **warn** - Something unexpected but not critical
- **error** - Critical errors needing attention

### 4. Log at Process Boundaries

- Function entry/exit (debug level)
- External API calls (debug/info)
- Error conditions (error level)
- State changes (info level)

### 5. Include Enough Context

✅ Good:
```typescript
log.info('Starting task', { taskId: task.id, type: task.type });
```

❌ Insufficient:
```typescript
log.info('Starting task');
```

### 6. Don't Log Sensitive Data

✅ Safe:
```typescript
log.debug('User action', { userId: user.id });
```

❌ Unsafe:
```typescript
log.debug('User action', { email: user.email, password: user.password });
```

## Troubleshooting

### Logs Not Appearing

1. Check environment variable:
   ```bash
   echo $RYFT_LOGS_ENABLED
   ```

2. Set it explicitly:
   ```bash
   RYFT_LOGS_ENABLED=1 npm start
   ```

### Can't Find Log Files

Logs are stored in `~/.ryft/logs/`

```bash
# View files
ls ~/.ryft/logs/

# Check permissions
ls -la ~/.ryft/logs/

# Export logs for analysis
cat ~/.ryft/logs/general.log | head -20
```

### Log Level Not Working

Make sure you're starting Ryft with the environment variable:

```bash
RYFT_LOG_LEVEL=debug npm start
```

Change at runtime in REPL:

```bash
ryft logs level debug
```

## See Also

- [Architecture Overview](../architecture/README.md)
- [Development Guide](../skills/development.md)
- [Troubleshooting](../troubleshooting/README.md)

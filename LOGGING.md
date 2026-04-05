# Ryft Logging System

A comprehensive, feature-based logging system for the Ryft CLI tool that stores logs locally and can be controlled via environment variables or CLI commands.

## Features

✅ **Feature-based logging** - Tag logs with feature names (e.g., `[MCP]::`, `[Browser]::`)
✅ **Multiple log files** - Separate logs for general, debug, and error levels
✅ **Local storage** - Logs stored in `~/.ryft/logs/`
✅ **Toggle on/off** - Enable/disable logging with `RYFT_LOGS_ENABLED` 
✅ **Configurable levels** - Set via `RYFT_LOG_LEVEL` (debug, info, warn, error)
✅ **CLI management** - View, filter, and clear logs from command line
✅ **Auto-rotation** - Logs rotate when they exceed max file size
✅ **Context support** - Include structured data with logs

## Quick Start

### Enable logging for a command:
```bash
RYFT_LOGS_ENABLED=1 RYFT_LOG_LEVEL=debug npm start
```

### View logs:
```bash
ryft logs status                    # Show logs overview
ryft logs view general              # View general logs
ryft logs view error                # View errors
ryft logs view debug MCP            # View debug logs for MCP feature
```

### Manage logs:
```bash
ryft logs clear all                 # Clear all logs
ryft logs level debug               # Set log level to debug
ryft logs enable                    # Enable logging
ryft logs disable                   # Disable logging
```

## Integration in Code

### 1. Import the logger:
```typescript
import { getFeatureLogger } from '../logging';

// Create a feature-specific logger
const log = getFeatureLogger('MyFeature');
```

### 2. Use logging methods:
```typescript
log.debug('Detailed debug info', { userId: 123 });
log.info('Something important happened', { action: 'save' });
log.warn('This might be a problem', { count: 0 });
log.error('An error occurred', errorObj, { context: 'details' });
```

### 3. Output:
```
[2026-04-06T14:30:45.123Z] [INFO] [MyFeature]:: Something important happened
```

## Environment Variables

```bash
RYFT_LOGS_ENABLED=1        # Enable logging (1/yes/true, default varies)
RYFT_LOGS_ENABLED=0        # Disable logging (0/no/false)
RYFT_LOG_LEVEL=debug       # Log level: debug, info, warn, error
```

## CLI Commands

```bash
ryft logs status            # Show logs status and active features
ryft logs view [type] [feature] [limit]
  type: general | debug | error (default: general)
  feature: optional filter (e.g., MCP, Browser)
  limit: number of entries to show (default: 20)

ryft logs clear [type]      # Clear logs (default: all)
ryft logs enable            # Enable logging
ryft logs disable           # Disable logging
ryft logs level [level]     # Get/set log level
ryft logs help              # Show command help
```

## Log Storage

Logs are stored as JSONL (one JSON object per line) in:
```
~/.ryft/logs/
├── general.log  - All log entries
├── debug.log    - Debug-level entries
└── error.log    - Error-level entries
```

Each log entry contains:
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

## Example Usage by Feature

### MCP Module:
```typescript
import { getFeatureLogger } from '../logging';

const log = getFeatureLogger('MCP');

export class MCPClient {
  async connect(url: string) {
    log.debug('Connecting to MCP server', { url });
    try {
      // connection code
      log.info('Connected to MCP server', { url });
    } catch (error) {
      log.error('Failed to connect', error as Error, { url });
    }
  }
}
```

### Browser Module:
```typescript
const log = getFeatureLogger('Browser');

export async function navigate(url: string) {
  log.debug('Navigating', { url });
  try {
    // navigate code
    log.info('Navigation complete', { url, title: pageTitle });
  } catch (error) {
    log.error('Navigation failed', error as Error, { url });
  }
}
```

### Skills Module:
```typescript
const log = getFeatureLogger('Skills');

export async function executeSkill(name: string) {
  log.info('Executing skill', { name });
  try {
    const result = await skill.execute();
    log.debug('Skill completed', { name, resultLength: result.length });
    return result;
  } catch (error) {
    log.error('Skill failed', error as Error, { name });
  }
}
```

## Configuration

Logging is configured in [src/logging/logger.ts](src/logging/logger.ts):

```typescript
export interface LoggerConfig {
  enabled: boolean;           // Logging enabled/disabled
  level: LogLevel;           // debug, info, warn, error
  maxFileSize: number;       // Max file size before rotation (default: 10MB)
  maxFiles: number;          // Max rotated files to keep (default: 5)
  logsDir: string;           // Directory for log files
}
```

## Programmatic API

### Reading logs:
```typescript
import { readLogFile, getLogStats, searchLogs } from '../logging';
import { join } from 'node:path';
import { homedir } from 'node:os';

const logsPath = join(homedir(), '.ryft/logs/general.log');

// Read entries
const entries = readLogFile(logsPath);

// Get statistics
const stats = getLogStats(logsPath);
console.log(`Total: ${stats.totalEntries}, Errors: ${stats.errorCount}`);

// Search logs
const results = searchLogs(logsPath, 'error pattern');
```

### Managing logger:
```typescript
import { logger } from '../logging';

logger.enable();
logger.disable();
logger.setLevel('debug');
logger.isEnabled();
logger.getConfig();
```

## Best Practices

1. **Use feature-specific loggers**
   ```typescript
   const log = getFeatureLogger('MyFeature');
   // NOT: logger.info(msg, ctx, 'MyFeature');
   ```

2. **Include relevant context**
   ```typescript
   log.error('Request failed', error, { userId, endpoint, status });
   ```

3. **Use appropriate levels**
   - `debug`: Detailed info (variable values, function calls)
   - `info`: General progress and important events
   - `warn`: Unexpected but not critical
   - `error`: Critical failures

4. **Log at boundaries**
   - External API calls
   - Error cases
   - State changes
   - Async operations

5. **Don't log sensitive data**
   ```typescript
   // Good
   log.debug('User action', { userId: user.id });
   
   // Bad
   log.debug('User action', { password: user.password });
   ```

## See Also

- [LOGGING_GUIDE.md](LOGGING_GUIDE.md) - Comprehensive integration guide
- [src/logging/logger.ts](src/logging/logger.ts) - Logger implementation
- [src/commands/logs.ts](src/commands/logs.ts) - CLI command implementation

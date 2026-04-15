# Memory Management

Understanding and managing conversation context in Ryft.

## Overview

Memory modes control how Ryft manages conversation history and context.

- **[Memory Modes](./memory-modes.md)** - Three strategies for context management

## Quick Start

### Memory Modes

Ryft supports 3 different memory modes to control context management:

| Mode          | Best For            | Context      | Cost   |
| ------------- | ------------------- | ------------ | ------ |
| **normal**    | General use, Claude | Full history | Medium |
| **hierarchy** | Long conversations  | Compressed   | Low    |
| **session**   | Single-shot tasks   | Current only | Lowest |

### Switch Memory Mode

```bash
# Change during session
ryft> /memory-mode hierarchy

# Set via environment
export RYFT_MEMORY_MODE=hierarchy
ryft
```

See: [Memory Modes Guide](./memory-modes.md) for detailed information.

## See Also

- [Configuration](../configuration/README.md) - All configuration options
- [Token Management](../configuration/token-management.md) - Track token usage

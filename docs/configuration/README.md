# Configuration & Customization

How to configure and customize Ryft for your needs.

## Overview

This section covers configuration options and customization:

- **[Token Management](./token-management.md)** - Track and optimize token usage
- **[Logging](./logging.md)** - Enable debugging and diagnostics

## Quick Start

### I want to...

- **Optimize token usage** → [Token Management](./token-management.md)
- **Debug with logging** → [Logging](./logging.md)

## Configuration Priority

Ryft uses this priority order for configuration (highest to lowest):

1. **CLI Flags** - `ryft --memory-mode hierarchy`
2. **Environment Variables** - `RYFT_MEMORY_MODE=hierarchy`
3. **Workspace Config** - `.ryft.json` in current directory
4. **User Config** - `~/.ryftrc` in home directory
5. **Defaults** - Built-in defaults

## Common Configurations

### To Monitor Token Usage

Enable token display:

```bash
ryft> /config set showTokens true
```

See: [Token Management](./token-management.md)

### To Debug Issues

Enable logging:

```bash
export DEBUG=ryft:*
ryft
```

See: [Logging](./logging.md)

## See Also

- [Memory Management](../memory/README.md) - Context management strategies
- [Getting Started](../getting-started/README.md) - Installation and setup
- [Operations](../operations/README.md) - How to use Ryft
- [Core Concepts](../core-concepts/README.md) - Understanding Ryft
- [Installation Guide](../getting-started/installation.md) - Provider setup

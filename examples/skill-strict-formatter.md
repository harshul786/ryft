---
name: strict-formatter
title: Strict Formatting Rules
description: Enforces strict formatting conventions
version: 2.0.0
dependencies:
  formatter: "^3.0"
---

# Strict Formatter

Applies strict formatting rules with no exceptions.

## What it does
- Enforces strict code formatting standards
- Rejects code that doesn't meet formatting requirements
- Provides detailed formatting violation reports

## When to use
- For critical code paths
- To maintain maximum code consistency
- When integration with strict linting rules is needed

## Dependencies
- **formatter**: Version ^3.0.0 (requires version 3.0.0 or compatible)

## Note
This skill requires formatter v3.0.0 or higher. If you have an older version installed,
you'll see a dependency conflict warning. To resolve:
1. Upgrade the formatter skill to v3.0.0 or higher
2. Or use the 'advanced-format' skill which works with v2.0.0+

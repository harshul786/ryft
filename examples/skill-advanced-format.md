---
name: advanced-format
title: Advanced Code Quality
description: Combines formatting and linting for comprehensive code quality
version: 1.0.0
dependencies:
  formatter: "^2.0"
  linter: "~1.5"
---

# Advanced Code Quality

Provides integrated code formatting and linting for comprehensive quality assurance.

## What it does

- Applies code formatting with formatter skill
- Analyzes code with linter skill
- Provides comprehensive quality report
- Automatically fixes common issues

## When to use

- Before submitting pull requests
- As a pre-commit hook
- To maintain consistent code quality across the team

## Dependencies

- **formatter**: Version ^2.0.0 (compatible with 2.0.0 and above, but not 3.0.0+)
- **linter**: Version ~1.5 (approximately 1.5, accepts patch updates like 1.5.2)

## Notes

- This skill gracefully handles missing dependencies
- If dependencies are unavailable, the skill will work with reduced functionality
- Version conflicts are logged with detailed information

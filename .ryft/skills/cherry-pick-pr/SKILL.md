---
name: cherry-pick-pr
description: Automate cherry-picking merged PRs to release branches for quick hotfix backporting
context: inline
allowed-tools:
  - bash
  - git
effort: High
when_to_use: "Use when you need to backport a merged PR from main to a release branch quickly without manual rebasing"
---

# Cherry-Pick PR

Automate the process of cherry-picking merged PRs to release branches for efficient hotfix backporting.

## When to Use

Use this skill when:
- Post-release hotfixes are already merged to main
- Need to backport features to older release branches
- Want to selectively cherry-pick without full branch merges
- Conflict resolution is needed during cherry-pick

## File Contexts

Operates on:
- Git repositories with branch structure
- Release branches following v*.* or stable naming conventions

## Tools Required

Needs: bash, git

## How It Works

This skill helps with the following workflow:

1. **Input**: Receive the PR number or commit hash to cherry-pick and target release branch
2. **Process**: Execute the cherry-pick operation with conflict detection
3. **Output**: Report success or guide through conflict resolution

## Success Criteria

The skill succeeds when:
- Commit is successfully cherry-picked to target branch
- Conflicts are resolved or reported clearly
- Branch is ready for push to remote

## Example Usage

Use this skill by invoking:
```
/cherry-pick-pr
```

Or reference it in instructions for Claude.

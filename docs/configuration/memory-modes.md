# Memory Modes Guide

Ryft supports three different memory/context management modes to control how conversation history is maintained and processed by the LLM.

## Overview

Memory modes control how Ryft manages conversation history and context:

| Mode | Behavior | Best For | Cost Impact |
|------|----------|----------|------------|
| **normal** | Native LLM context window | General use, Claude | Low to medium |
| **hierarchy** | Hierarchical summarization | Long conversations | Medium |
| **session** | Session-scoped context | Single-shot tasks | Low |

## Memory Modes

### 1. Normal Mode (Default)

Uses the native LLM context window directly, sending all history to the model.

**When to use:**
- General conversations
- Using Anthropic Claude (recommended)
- When you want full conversation context
- Shorter sessions (under 100K tokens)

**How it works:**
- Ryft stores all messages in memory
- Full history sent to LLM on each request
- LLM manages context window natively
- No summarization needed

**Configuration:**

```bash
# Set in config file (~/.ryftrc)
export RYFT_MEMORY_MODE=normal

# Or via CLI
ryft --memory-mode=normal
```

**Pros:**
- ✅ Simple and intuitive
- ✅ Full context for reasoning
- ✅ Works with all LLM providers

**Cons:**
- ❌ Costs increase with conversation length
- ❌ Slower with very long histories
- ❌ May hit context window limits

---

### 2. Hierarchy Mode

Implements hierarchical summarization to compress older context while keeping recent interaction detailed.

**When to use:**
- Very long conversations (100K+ tokens)
- Reducing API costs
- Complex multi-step tasks
- Working with expensive models

**How it works:**
- Recent messages: Full detail (kept as-is)
- Older messages: Hierarchically summarized
- LLM summarizes conversation branches
- Only summaries + recent history sent to model

**Configuration:**

```bash
# Set in config file (~/.ryftrc)
export RYFT_MEMORY_MODE=hierarchy

# Or via CLI
ryft --memory-mode=hierarchy
```

**Parameters:**

```bash
# Configure hierarchy depth
RYFT_HIERARCHY_DEPTH=10      # Depth of summarization tree
RYFT_RECENT_MESSAGES=20     # How many recent messages to keep full
```

**Pros:**
- ✅ Significantly reduces token usage
- ✅ Handles very long conversations
- ✅ Lower API costs

**Cons:**
- ❌ Older context becomes lossy (summarized)
- ❌ More complex processing
- ❌ May lose specific details from old messages

**Example:**

```
Conversation:
1. User asks question about x
2. Discussion of approach
3. Implementation begins
4. Testing phase
5. Refinements
6. Final result
↓ Hierarchy Mode
Recent (Full): Messages 5-6
Summary: "Discussion of approach and implementation (messages 2-4)"
Summary: "Initial question and context (messages 1)"
```

---

### 3. Session Mode

Keeps memory scoped to current session only. Useful for independent tasks.

**When to use:**
- Single-shot tasks
- Isolated commands
- Minimal context needed
- Testing/experimentation
- Cost-conscious usage

**How it works:**
- Only current session kept in memory
- Previous sessions not loaded
- Context reset on new session
- Minimal history overhead

**Configuration:**

```bash
# Set in config file (~/.ryftrc)
export RYFT_MEMORY_MODE=session

# Or via CLI
ryft --memory-mode=session
```

**Pros:**
- ✅ Minimal token usage
- ✅ Lowest cost
- ✅ Fresh perspective each session

**Cons:**
- ❌ No cross-session context
- ❌ Can't reference earlier work
- ❌ Less continuity

---

## Comparing Memory Modes

### Token Usage Example

Assume: 10-message conversation, each message ~200 tokens

| Mode | Total Tokens | API Calls | Cost (GPT-4o) |
|------|--------------|-----------|---------------|
| **normal** | ~2,000 | 10 | ~$0.05 |
| **hierarchy** | ~800 | 10 | ~$0.02 |
| **session** | ~500 | 10 | ~$0.01 |

*Note: Actual costs vary by provider and model*

### Context Retention

| Mode | Current Context | Historical Context | Details |
|------|-----------------|-------------------|---------|
| **normal** | 100% | 100% | Full conversation |
| **hierarchy** | 100% | ~70% | Summarized older |
| **session** | 100% | 0% | Current only |

---

## Switching Between Modes

### Mid-Conversation Switch

```bash
# During session
ryft> /memory-mode hierarchy
# Switches to hierarchy mode for remaining conversation

ryft> /memory-mode session
# Switches to session mode

ryft> /memory-mode normal
# Back to default
```

### Via Configuration

Edit `~/.ryftrc`:

```json
{
  "memoryMode": "hierarchy",
  "hierarchyDepth": 10,
  "recentMessages": 20
}
```

### Via Environment Variable

```bash
export RYFT_MEMORY_MODE=hierarchy
ryft
```

---

## Best Practices

### 1. Choose Based on Task

- **Code analysis:** normal (need to reference earlier code)
- **Long troubleshooting:** hierarchy (compress history)
- **Quick fixes:** session (isolated task)

### 2. Monitor Token Usage

```bash
# Ryft shows token budget in REPL
ryft [gpt-4o]> (tokens: 4,200 / 8,000)
       ↑ Current usage        ↑ Budget
```

If approaching 80-90% budget, consider:
- Switching to hierarchy mode
- Starting a new session
- Clearing history

### 3. For Long Conversations

- Start with normal
- Switch to hierarchy if tokens exceed 50% of budget
- Session mode for unrelated follow-up tasks

### 4. Cost Management

Use session mode for:
- Exploratory commands
- Quick questions
- Independent tasks

Use normal for:
  - Complex multi-step tasks
  - When needing full context
  - Collaborative sessions

---

## Memory Mode Details by Provider

### With Anthropic Claude

**Recommended:** normal
- Claude's context window: 200K tokens
- No need for compression with shorter conversations
- Native tool use fully supported

### With OpenAI GPT

**Recommended:** hierarchy (for long tasks)
- GPT context: 128K tokens (GPT-4)
- Compress history to stay under limits
- Perfect for ~100K+ token conversations

### With Google Gemini

**Recommended:** normal or hierarchy
- Gemini context: 1M tokens
- Can handle long conversations
- Good cost/benefit with normal mode

### With Ollama (Local)

**Recommended:** session or hierarchy
- Local inference doesn't cost API money
- Focus on speed rather than cost
- Session good for isolated tasks

---

## Troubleshooting

### "Context window exceeded" Error

**Solution:** Switch to hierarchy mode
```bash
ryft> /memory-mode hierarchy
```

### "Lost important context in hierarchy mode"

**Solution:** Increase recent messages kept
```bash
export RYFT_RECENT_MESSAGES=30
ryft
```

### High token costs

**Solutions:**
1. Use session mode for independent tasks
2. Switch to hierarchy for long conversations
3. Clear old sessions: `ryft --clear-history`

---

## See Also

- [Token Management Guide](./token-management.md) - Monitor usage
- [Configuration Guide](../getting-started/configuration.md) - Set defaults
- [Cost Tracking](./token-management.md) - Understand costs by model

# Token Management Guide

Understanding and optimizing token usage in Ryft.

## What are Tokens?

Tokens are units of text that LLM APIs charge for. Every word, number, and symbol counts toward your usage.

- **Input tokens**: Text you send to the model
- **Output tokens**: Text the model generates back

Most providers charge for both input and output.

**Token costs vary by provider and model:**
- OpenAI GPT-4o: $0.005 per 1K input, $0.015 per 1K output
- Anthropic Claude 3.5: Similar or lower costs
- Google Gemini: Free tier available
- Ollama: No API cost (runs locally)

## Token Budget in Ryft

### Default Budget

- **4,096 tokens per session** (configurable)
- Includes: prompts, responses, tools, history

### Budget Warning Points

- **70%**: Single warning "Token usage getting high"
- **90%**: Repeated warnings "Nearing token limit"
- **100%+**: No hard limit, responses may shorten

## Checking Token Usage

### Quick Check

```bash
ryft> /tokens

🟢 45/4096 tokens (1%)
```

### Detailed Breakdown

```bash
ryft> /tokens detailed

Token Budget Breakdown:
  System prompt:  150 tokens
  Mode skills:    200 tokens
  Tool schemas:   100 tokens
  Messages:       300 tokens
  ───────────────────────────
  Total used:     750 / 4096 (18%)
  Remaining:      3,346 tokens
```

### View Token History

```bash
ryft logs view general | grep -i token
```

## Reducing Token Usage

### Strategy 1: Use Fewer Modes

Active modes consume tokens:

```bash
# Today: High usage (all modes active)
/mode coder,browser-surff,debugger

# Better: Just what you need
/mode coder

# Check savings
/tokens
```

**Savings:**
```
Before: 450 tokens (all modes)
After:  150 tokens (coder only)
Savings: 300 tokens (67% reduction)
```

### Strategy 2: Simplify Context

Provide less background:

✅ Good:
```bash
ryft> Fix this bug
# Provide code, minimal explanation
```

❌ Inefficient:
```bash
ryft> I've been working on this project
# Long story about the project
# Here's the background...
# Then the actual code...
```

### Strategy 3: Use Clear Commands

Clear requests use fewer tokens:

✅ Efficient:
```bash
ryft> Generate tests for this function
```

❌ Less efficient:
```bash
ryft> Can you maybe write some tests?
# I'm not sure if you can do this
# But if you could, could you write tests?
```

### Strategy 4: Avoid Repetition

Don't repeat context:

✅ Good:
```bash
ryft> Analyze this code
<code>

ryft> Now add error handling  # Model remembers code
```

❌ Wasteful:
```bash
ryft> Analyze this code
<code>

ryft> Take this same code and add error handling
<code again>
```

### Strategy 5: Reset When Needed

Use `/compact` to save tokens:

```bash
/tokens
# Shows: 3500/4096 (85%, high)

/compact
# Resets conversation after summary

/tokens  
# Shows: 200/4096 (5%, reset!)
```

## Token Calculation

What costs tokens?

```
Included in cost:
✓ Your messages
✓ Model responses  
✓ System prompt
✓ Tool descriptions (in prompt)
✓ Conversation history
✓ Skill instructions

NOT included:
✗ Command formatting
✗ Terminal display
✗ File reads (for display only)
✗ Browser screenshots
```

## Budget Optimization

### For Short Sessions

Use default 4,096 tokens:

```bash
# Typical usage: 30-40 tokens per message
# That's ~100 messages before warning
# Good for daily use
```

### For Long Sessions

Increase budget:

```bash
# Not directly supported yet
# Instead: use /compact to reset
```

### For Batch Operations

Script with resets:

```bash
# Pseudocode
for file in *.ts; do
  ryft> Analyze $file
  ryft> /compact
done
```

## Common Scenarios

### Scenario 1: Analyzing Large Projects

**Problem:** High token count from large project

**Solution:**
```bash
1. /mode coder              # Use one mode
2. Analyze one file at a time
3. Use /compact between files

/tokens
/compact
```

### Scenario 2: Long Conversations

**Problem:** Tokens grow with each message

**Solution:**
```bash
ryft> /tokens
# Check usage

# If high:
ryft> Summarize what we've done and save to memory
ryft> /compact

# Continue fresh
```

### Scenario 3: Browser + Coder

**Problem:** Both modes use tokens

**Solution:**
```bash
# Use modes separately
/mode coder
# Do analysis

/compact

/mode browser-surff  
# Do browser tasks

/compact
```

## Token-Conscious Workflows

### Workflow 1: Efficient Code Review

```bash
1. /mode coder
2. Upload small file
3. Ask specific questions
4. /compact between files
5. Status: Low token usage
```

### Workflow 2: Project Documentation

```bash
1. /mode coder
2. Ask: "Document this module"
3. AI uses file tools (minimal tokens)
4. Get documentation
5. /compact
6. Next module
```

### Workflow 3: Quick Tasks

```bash
1. Ask question
2. Get answer
3. /compact
4. Next task

# Each task fresh, low overhead
```

## Advanced: Statistics

### Token Usage by Operation

Typical costs:

```
User message (short):       ~50 tokens
User message (with code):   ~150 tokens
Model response (short):     ~100 tokens
Model response (long):      ~500 tokens
File analysis (one file):   ~200 tokens
Full project doc:           ~1000 tokens
```

### Example Session

```
Start:            0 / 4096
Ask question:     50 / 4096
Response:         150 / 4096
Ask follow-up:    200 / 4096
Response:         350 / 4096
Ask to code:      400 / 4096
Response:         900 / 4096  ← Warning (90%)

Compact:          150 / 4096  ← Reset!
```

## Cost Estimation

### Rough Pricing

At current OpenAI rates (~$0.0015 per 1K input, $0.006 per 1K output):

```
4,096 token session:
- Input: ~2000 tokens = $0.003
- Output: ~2000 tokens = $0.012
- Total: ~$0.015 per session

Daily (10 sessions): ~$0.15
Monthly: ~$4.50
```

Depends on exact model and usage pattern.

## Settings

### View Token Settings

```bash
/config view
# Check: showTokens, model, etc.
```

### Show Token Count Always

```bash
/config set showTokens true

# Then tokens display in prompt:
ryft [gpt-4o] (150 tokens)>
```

### Change Model (Affects Tokens)

```bash
/model gpt-4o         # Cheaper, faster
/model gpt-4-turbo    # More powerful, more tokens
```

## Tips & Tricks

### 1. Batch Similar Tasks

```
GOOD: Analyze 3 similar files sequentially
BAD: Analyze 3 different file types

# Similar tasks = better context reuse
```

### 2. Ask for Summaries

```bash
ryft> Summarize what we've discussed (briefly)
# Model creates concise summary
# Reset with compact
```

### 3. Use Voice Prompts

```bash
# Shorter voice → fewer tokens
# "Fix that bug" vs "I'd like you to please help me look at that bug..."
```

### 4. Monitor Regularly

```bash
# Check frequently
/tokens

# Use reset before hitting limits
/compact
```

## See Also

- [Modes Documentation](../modes/README.md) - Mode token costs
- [Token Architecture](../architecture/README.md) - How tokens counted
- [Troubleshooting](./README.md) - Token issues

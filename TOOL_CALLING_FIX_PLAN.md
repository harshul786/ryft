# Tool Calling Architecture Fix Plan

## Problem Summary

The model is outputting JSON tool invocations like:

```json
{ "name": "list_skills", "arguments": {} }
```

Instead of proper XML format or structured tool calls. This happens because:

1. **OpenAI API's function calling is NOT being used properly**
   - We pass `tools` parameter but the model isn't trained to use it
   - We only have tool descriptions in system prompt text
   - Model doesn't know about structured function calling format

2. **Streaming response isn't handling `tool_calls`**
   - We only parse `delta.content` (text)
   - Missing `delta.tool_calls` parsing (structured tool invocation)

3. **Tool responses not added back to conversation**
   - No proper `tool_result` message blocks
   - Model doesn't see what the tool output
   - Model thinks tools aren't really being executed

---

## Comparison with Claude-CLI

### Claude-CLI (Working Reference)

```
User Message
    ↓
API with tools parameter (activates function calling)
    ↓
API Returns: message.content[] with {type: 'tool_use', id, name, input}
    ↓
Validate input via Zod schema
    ↓
Execute tool
    ↓
Create tool_result message block
    ↓
Add to conversation history
    ↓
Next API call includes tool results
```

### Ryft (Current - Broken)

```
User Message
    ↓
API with tools parameter (ignored by model)
    ↓
Stream text content only
    ↓
Regex parse tool invocations (fails - model outputting different format)
    ↓
Execute tool
    ↓
Append text result (no proper message block)
    ↓
Next API call missing tool_result block
```

---

## Architecture Differences

| Component             | Claude-CLI                   | Ryft Current         | Ryft Should Be               |
| --------------------- | ---------------------------- | -------------------- | ---------------------------- |
| **Tool Format**       | `ToolUseBlock` from API      | Regex from text      | `ToolUseBlock` from API      |
| **Streaming**         | `delta.tool_calls`           | `delta.content` only | `delta.tool_calls`           |
| **Extraction**        | Native API objects           | Regex patterns       | Native API objects           |
| **Results**           | `tool_result` message blocks | Text concatenation   | `tool_result` message blocks |
| **Conversation Flow** | Tool results in history      | Tool results as text | Tool results in history      |
| **Model Training**    | Function calling mode        | Text parsing mode    | Function calling mode        |

---

## Implementation Plan

### Phase 1: Fix Streaming Response Handling

**File**: `src/runtime/openaiClient.ts`

**Current Issue**: Only capturing `delta.content`, ignoring `delta.tool_calls`

**Changes**:

1. Track `tool_calls` separately from text content
2. Parse streaming tool_calls into ToolUseBlock format
3. Return structured tool calls alongside text
4. Handle both formats (text + tool_calls in same response)

**Expected Result**:

```typescript
return {
  usage,
  text: assistantText,
  toolCalls: [
    { id: "1", name: "list_skills", input: {} },
    { id: "2", name: "invoke_skill", input: { skill: "edit" } },
  ],
};
```

### Phase 2: Update Tool Extraction

**File**: `src/mcp/tool-dispatcher.ts`

**Current Issue**: Regex-based extraction doesn't match actual model output format

**Changes**:

1. Update `extractToolUsesFromResponse()` to handle structured tool_calls first
2. Keep XML regex as fallback for system prompt format
3. Add JSON format parsing as secondary fallback
4. Log what format was extracted (debugging)

**Expected Result**: Properly extract whatever format the model outputs

### Phase 3: Create Tool Result Messages

**File**: `src/runtime/session.ts` + `src/screens/REPL.tsx`

**Current Issue**: Tool results not added back to conversation as proper message blocks

**Changes**:

1. Add `appendToolResults(results: ToolResult[])` method to session
2. Create message block with `type: 'tool_result'` for each result
3. Add as user message with tool_result content blocks
4. Proper message format: `{ role: 'user', content: [{ type: 'tool_result', tool_use_id, content, is_error }] }`

**Expected Result**: Model sees tool execution results in conversation history

### Phase 4: Integration in REPL

**File**: `src/screens/REPL.tsx`

**Current Flow**:

```
1. Stream response (gets text)
2. Extract tool_use from text
3. Execute tools
4. Format results as text + append to message
5. No proper tool_result blocks
```

**New Flow**:

```
1. Stream response (gets text + tool_calls)
2. Extract tool_use from tool_calls (primary) or text (fallback)
3. Execute tools
4. Create proper tool_result message blocks
5. Add to session.history
6. Display results in REPL
```

---

## Files to Change

1. **`src/runtime/openaiClient.ts`** - Streaming response handling
   - Handle `delta.tool_calls`
   - Return ToolUseBlock format

2. **`src/mcp/tool-dispatcher.ts`** - Extraction logic
   - Update to handle structured tool_calls
   - Improve extraction reliability

3. **`src/runtime/session.ts`** - Tool result messages
   - Add `appendToolResults()` method
   - Ensure proper message format

4. **`src/screens/REPL.tsx`** - Integration
   - Use new tool_calls from response
   - Create proper tool_result blocks
   - Add to conversation history

5. **`src/types.ts`** - Type definitions
   - Add `toolCalls` field to streaming result
   - Add `ToolResult` type if missing

---

## Why This Matters

**Current State**: Model is confused about tool format

- Outputs JSON instead of XML
- Doesn't see tool results
- Can't iterate on tool outputs
- Tool system appears broken to the model

**After Fix**: Model understands tools clearly

- Uses proper function calling format
- Sees tool results in conversation
- Can use output as input to next tool
- Tool ecosystem becomes functional

---

## Testing Strategy

1. **Test Response Parsing**: Verify tool_calls extracted from API
2. **Test Extraction**: Confirm regex fallback works if needed
3. **Test Message Format**: Verify tool_result blocks created correctly
4. **Test REPL Flow**: Run interactive mode and verify model sees results
5. **Test with Different Models**: gemma-lite, gpt-4, etc.

---

## Success Criteria

✅ Model outputs proper tool invocations (XML or function calls)
✅ Tool execution extracts invocations correctly
✅ Tool results added back to conversation
✅ Model can iterate on tool outputs
✅ REPL shows tool execution and results
✅ Full conversation history includes tool_result blocks

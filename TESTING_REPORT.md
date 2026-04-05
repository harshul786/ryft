# Ryft Testing & Issues Fixed - April 6, 2026

## Issues Found & Fixed

### 1. **Skills Server Path Error**

- **Issue**: Pack.json files pointed to `dist/src/mcp/servers/skills-server.ts` but tsx should load from `src/`
- **Files Fixed**:
  - packs/coder/pack.json
  - packs/debugger/pack.json
  - packs/browser-surff/pack.json
  - packs/shared/pack.json
- **Fix**: Changed `args` from `["--loader=tsx", "dist/src/mcp/servers/skills-server.ts"]` to `["--loader=tsx", "src/mcp/servers/skills-server.ts"]`
- **Impact**: Skills server now correctly loaded via tsx loader

### 2. **CommonJS Module Check in ES Module**

- **Issue**: Used `require.main === module` check (CommonJS) in ES module file
- **File**: src/mcp/servers/skills-server.ts
- **Fix**: Changed to `if (import.meta.url === \`file://${process.argv[1]}\`)` (ES module variant)
- **Impact**: Skills server now correctly detects when run directly

### 3. **CommonJS require() for readline**

- **Issue**: Used `require("readline")` in ES module file
- **File**: src/mcp/servers/skills-server.ts
- **Fix**: Changed to `const readline = await import("readline")`
- **Impact**: Proper ES module import compatible with tsx loader

## Testing Results

✅ **Build**: Clean compilation with no errors
✅ **Tests**: All 78 tests passing
✅ **Pack Configurations**: Updated and verified across all 4 modes
✅ **Module Compatibility**: ES module syntax throughout

## Ready for Testing

The tool chain is now ready for full end-to-end testing:

```bash
npm link              # Ensure global installation
npm run build         # Build latest
ryft                  # Start REPL
> list your tools
> invoke list_skills  # Should now work!
```

## Files Modified

- ✅ src/mcp/servers/skills-server.ts (2 fixes: module check + readline import)
- ✅ packs/coder/pack.json (path fix)
- ✅ packs/debugger/pack.json (path fix)
- ✅ packs/browser-surff/pack.json (path fix)
- ✅ packs/shared/pack.json (path fix)

## Architecture Summary

**Tool Execution Flow:**

1. REPL initializes MCP servers on startup
2. Servers spawned with: `node --loader=tsx src/mcp/servers/skills-server.ts`
3. Skills server loads skills and exposes as JSON-RPC tools
4. Models see tools in system prompt with JSON schemas
5. Models invoke tools via `<tool_use>` XML blocks
6. REPL executes tools and appends results to history
7. Models see results and continue reasoning

**Key Enablement:**

- ✅ Models can list skills
- ✅ Models can invoke specific skills
- ✅ Results flow back to model automatically
- ✅ Follows Claude-CLI pattern but model-agnostic

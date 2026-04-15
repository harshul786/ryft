import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { resolveModes } from "../src/modes/catalog.ts";
import { defaultMemoryMode, resolveMemoryMode } from "../src/memory/catalog.ts";
import {
  defaultModelOption,
  formatModelPicker,
  listModelOptions,
  resolveModelOption,
} from "../src/models/catalog.ts";
import { buildDevToolsUrl } from "../src/browser/controller.ts";
import { formatBrowserTabs } from "../src/browser/common.ts";
import { getBrowserMcpServerDescription } from "../src/browser/mcp.ts";
import { compactSession } from "../src/commands/compact.ts";
import { promptWithSession } from "../src/runtime/promptBuilder.ts";
import { createSession } from "../src/runtime/session.ts";
import { openProxyServer } from "../src/runtime/proxyServer.ts";
import {
  buildRequestBody,
  resolveRouteForModel,
} from "../src/runtime/router.ts";
import { applyTokenCap } from "../src/runtime/tokenBudget.ts";
import { loadMemoryContent, recordMemoryTurn } from "../src/memory/store.ts";
import { loadSkillsForModes } from "../src/skills/loader.ts";

test("resolves default mode", () => {
  assert.equal(resolveModes()[0]?.name, "coder");
});

test("supports multi-mode selection", () => {
  const modes = resolveModes(["coder", "debugger"]);
  assert.deepEqual(
    modes.map((mode) => mode.name),
    ["coder", "debugger"],
  );
});

test("resolves memory modes", () => {
  assert.equal(defaultMemoryMode().name, "normal");
  assert.equal(resolveMemoryMode("session").name, "session");
});

test("caps prompt size roughly", () => {
  const capped = applyTokenCap(
    "one two three four five six seven eight nine ten eleven twelve",
    3,
  );
  assert.ok(capped.length > 0);
});

test("loads directory-backed skills", async () => {
  const skills = await loadSkillsForModes(
    resolveModes(["coder", "browser-surff"]),
  );
  assert.ok(skills.some((skill) => skill.name === "edit"));
  assert.ok(skills.some((skill) => skill.name === "browser"));
});

test("resolves model options and formats grouped picker output", () => {
  assert.equal(resolveModelOption("gpt-4.1-mini")?.id, "gpt-4.1-mini");
  assert.equal(resolveModelOption("2")?.id, "gpt-4.1-mini");
  assert.equal(resolveModelOption("does-not-exist"), null);
  const picker = formatModelPicker(defaultModelOption().id);
  assert.match(picker, /OpenAI/);
  assert.match(picker, /Local Proxy/);
});

test("routes proxy requests to the model target and preserves streaming responses", async () => {
  let upstreamBody = "";
  const upstream = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    upstreamBody = Buffer.concat(chunks).toString("utf8");
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n');
  });

  await new Promise<void>((resolve) => upstream.listen(0, () => resolve()));
  const upstreamPort = (upstream.address() as import("node:net").AddressInfo)
    .port;
  const proxy = await openProxyServer({
    port: 0,
    proxyConfig: {
      targets: {
        default: {
          name: "default",
          baseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
        },
        OpenAI: {
          name: "OpenAI",
          baseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
        },
        "Local Proxy": {
          name: "Local Proxy",
          baseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
        },
      },
    },
  });

  const response = await fetch(`${proxy.url}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "local/gpt-4.1-mini",
      messages: [{ role: "user", content: "hello" }],
      stream: true,
    }),
  });

  const text = await response.text();
  await proxy.close();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));

  assert.equal(response.status, 200);
  assert.match(text, /ok/);
  assert.match(upstreamBody, /"model":"local\/gpt-4.1-mini"/);
});

test("builds a routed request body with the selected model", () => {
  const route = resolveRouteForModel("local/gpt-4.1-mini", listModelOptions(), {
    default: {
      name: "default",
      baseUrl: "https://example.com/v1",
    },
    "Local Proxy": {
      name: "Local Proxy",
      baseUrl: "https://local.example/v1",
    },
  });

  const body = buildRequestBody({ model: "anything", messages: [] }, route);

  assert.match(body, /"model":"local\/gpt-4.1-mini"/);
  assert.equal(route.target.baseUrl, "https://local.example/v1");
});

test("formats browser tab details and DevTools URLs", () => {
  const tabs = formatBrowserTabs([
    {
      id: "tab-1",
      title: "Example",
      url: "https://example.com",
      type: "page",
    },
  ]);
  assert.match(tabs, /Example/);
  assert.match(
    buildDevToolsUrl(9222, "tab-1"),
    /devtools:\/\/devtools\/bundled\/inspector\.html/,
  );
  assert.match(getBrowserMcpServerDescription(null), /browser-surff/);
});

test("adds browser-surff instructions to the system prompt", async () => {
  const session = createSession({
    modes: resolveModes(["browser-surff"]),
    memoryMode: "hierarchy",
    model: defaultModelOption(),
    proxyUrl: null,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
  });
  const prompt = await promptWithSession(session, "inspect the page");
  assert.equal(prompt[0]?.role, "system");
  assert.match(prompt[0]?.content ?? "", /tab context/i);
  assert.match(prompt[0]?.content ?? "", /browser session/i);
});

test("persists normal memory and keeps session memory in-process", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "ryft-memory-"));
  const tempHome = path.join(tempRoot, "home");
  const tempWorkspace = path.join(tempRoot, "workspace");
  await import("node:fs/promises").then((fs) =>
    Promise.all([
      fs.mkdir(tempHome, { recursive: true }),
      fs.mkdir(tempWorkspace, { recursive: true }),
    ]),
  );

  const nextSessionState = await recordMemoryTurn(
    "normal",
    { cwd: tempWorkspace, homeDir: tempHome },
    "remember this",
    "noted",
  );

  assert.match(nextSessionState, /remember this/);
  const memoryPath = path.join(tempHome, ".ryft", "memory", "normal");
  const files = await import("node:fs/promises").then((fs) =>
    fs.readdir(memoryPath),
  );
  assert.equal(files.length, 1);
  const fileContent = await readFile(path.join(memoryPath, files[0]!), "utf8");
  assert.match(fileContent, /remember this/);
  assert.match(
    await loadMemoryContent("normal", {
      cwd: tempWorkspace,
      homeDir: tempHome,
    }),
    /remember this/,
  );
  assert.match(
    await loadMemoryContent("normal", {
      cwd: tempWorkspace,
      homeDir: tempHome,
    }),
    /Recent Notes/,
  );

  const firstSession = createSession({
    modes: resolveModes(["coder"]),
    memoryMode: "normal",
    model: defaultModelOption(),
    cwd: tempWorkspace,
    homeDir: tempHome,
    proxyUrl: null,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
  });
  const firstPrompt = await promptWithSession(firstSession, "inspect this");
  assert.match(firstPrompt[0]?.content ?? "", /remember this/);

  const secondSession = createSession({
    modes: resolveModes(["coder"]),
    memoryMode: "normal",
    model: defaultModelOption(),
    cwd: tempWorkspace,
    homeDir: tempHome,
    proxyUrl: null,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
  });
  const secondPrompt = await promptWithSession(secondSession, "next run");
  assert.match(secondPrompt[0]?.content ?? "", /remember this/);

  const hierarchyWrite = await recordMemoryTurn(
    "hierarchy",
    { cwd: tempWorkspace, homeDir: tempHome },
    "tree note",
    "hierarchy reply",
  );
  assert.match(hierarchyWrite, /tree note/);
  const hierarchyPath = path.join(tempWorkspace, "hierarchy.md");
  const hierarchyFile = await readFile(hierarchyPath, "utf8");
  assert.match(hierarchyFile, /# Hierarchy/);
  assert.match(hierarchyFile, /## Tree/);
  assert.match(hierarchyFile, /tree note/);
  assert.match(
    await loadMemoryContent("hierarchy", {
      cwd: tempWorkspace,
      homeDir: tempHome,
    }),
    /tree note/,
  );

  const hierarchySession = createSession({
    modes: resolveModes(["browser-surff"]),
    memoryMode: "hierarchy",
    model: defaultModelOption(),
    cwd: tempWorkspace,
    homeDir: tempHome,
    proxyUrl: null,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
  });
  const hierarchyPrompt = await promptWithSession(
    hierarchySession,
    "open the workspace",
  );
  assert.match(hierarchyPrompt[0]?.content ?? "", /tree note/);

  const sessionSnapshot = await recordMemoryTurn(
    "session",
    { sessionSnapshot: "" },
    "session note",
    "session reply",
  );
  assert.match(sessionSnapshot, /session note/);
  const inMemorySession = createSession({
    modes: resolveModes(["coder"]),
    memoryMode: "session",
    model: defaultModelOption(),
    cwd: tempWorkspace,
    homeDir: tempHome,
    proxyUrl: null,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
  });
  inMemorySession.setMemoryState(sessionSnapshot);
  inMemorySession.appendUser("first");
  inMemorySession.appendAssistant("second");
  inMemorySession.appendUser("third");
  inMemorySession.appendAssistant("fourth");
  inMemorySession.appendUser("fifth");
  inMemorySession.appendAssistant("sixth");
  inMemorySession.appendUser("seventh");
  inMemorySession.appendAssistant("eighth");
  const inMemoryPrompt = await promptWithSession(inMemorySession, "follow up");
  assert.match(inMemoryPrompt[0]?.content ?? "", /session note/);

  const compactSummary = await compactSession(inMemorySession, {
    keepRecentTurns: 4,
    summarizer: async () => "local summary",
  });
  assert.equal(compactSummary, "local summary");
  assert.equal(inMemorySession.history.length, 5);
  assert.equal(inMemorySession.history[0]?.role, "system");
  assert.match(inMemorySession.history[0]?.content ?? "", /local summary/);
  assert.match(inMemorySession.history[1]?.content ?? "", /fifth/);
  assert.match(inMemorySession.history[4]?.content ?? "", /eighth|follow up/);
  assert.match(inMemorySession.memoryState.snapshot, /local summary/);

  await rm(tempRoot, { recursive: true, force: true });
});

test("compacts history by calling the model and preserving the tail", async () => {
  let capturedBody = "";
  const upstream = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    capturedBody = Buffer.concat(chunks).toString("utf8");
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      'data: {"choices":[{"delta":{"content":"# Summary\\n- preserved"}}]}\n\ndata: [DONE]\n\n',
    );
  });

  await new Promise<void>((resolve) => upstream.listen(0, () => resolve()));
  const upstreamPort = (upstream.address() as import("node:net").AddressInfo)
    .port;

  const tempRoot = await mkdtemp(path.join(tmpdir(), "ryft-compact-"));
  const tempHome = path.join(tempRoot, "home");
  const tempWorkspace = path.join(tempRoot, "workspace");
  await import("node:fs/promises").then((fs) =>
    Promise.all([
      fs.mkdir(tempHome, { recursive: true }),
      fs.mkdir(tempWorkspace, { recursive: true }),
    ]),
  );

  const session = createSession({
    modes: resolveModes(["coder"]),
    memoryMode: "session",
    model: defaultModelOption(),
    cwd: tempWorkspace,
    homeDir: tempHome,
    proxyUrl: null,
    baseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
    apiKey: "",
  });
  session.appendUser("one");
  session.appendAssistant("two");
  session.appendUser("three");
  session.appendAssistant("four");
  session.appendUser("five");

  const summary = await compactSession(session, { keepRecentTurns: 2 });
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
  await rm(tempRoot, { recursive: true, force: true });

  assert.match(summary, /# Summary/);
  assert.equal(session.history.length, 3);
  assert.equal(session.history[0]?.role, "system");
  assert.match(session.history[0]?.content ?? "", /# Summary/);
  assert.match(session.history[1]?.content ?? "", /four/);
  assert.match(session.history[2]?.content ?? "", /five/);
  assert.match(capturedBody, /"model":"gpt-4\.1"/);
  assert.match(capturedBody, /Ryft Compaction Prompt/);
  assert.match(capturedBody, /Reduce token usage aggressively/);
  assert.match(capturedBody, /one/);
  assert.match(capturedBody, /three/);
});

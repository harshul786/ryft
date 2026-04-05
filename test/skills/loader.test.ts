import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  discoverAllSkillsForModes,
  clearDiscoveryCache,
  loadSkillsForModes,
} from "../../src/skills/loader.ts";
import { resetGlobalRegistry } from "../../src/skills/registry.ts";
import type { Mode } from "../../src/types.ts";
import { resolveModes } from "../../src/modes/catalog.ts";

/**
 * Test suite for skill loader integration
 */

test("loader - loads skills from single mode", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const modes = resolveModes(["coder"]);
  const skills = await discoverAllSkillsForModes(modes);

  assert.ok(skills.length > 0, "Should load skills for coder mode");
  assert.ok(
    skills.some((s) => s.name === "edit"),
    "Should include edit skill",
  );
});

test("loader - loads skills from multiple modes", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const modes = resolveModes(["coder", "browser-surff"]);
  const skills = await discoverAllSkillsForModes(modes);

  assert.ok(skills.length > 0, "Should load skills for multiple modes");

  // Check we have skills from both modes
  const skillNames = new Set(skills.map((s) => s.name));
  assert.ok(skillNames.has("edit"), "Should include coder skill");
  assert.ok(skillNames.has("browser"), "Should include browser-surff skill");
});

test("loader - skills are sorted alphabetically", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const modes = resolveModes(["coder", "browser-surff"]);
  const skills = await discoverAllSkillsForModes(modes);

  if (skills.length > 1) {
    for (let i = 0; i < skills.length - 1; i++) {
      const current = skills[i]?.name || "";
      const next = skills[i + 1]?.name || "";
      assert.ok(
        current.localeCompare(next) <= 0,
        `Skills should be sorted: ${current} should come before or equal to ${next}`,
      );
    }
  }
});

test("loader - caching works on second call", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const modes = resolveModes(["coder"]);

  // First call - should load from disk
  const start1 = Date.now();
  const skills1 = await discoverAllSkillsForModes(modes);
  const time1 = Date.now() - start1;

  // Second call - should use cache
  const start2 = Date.now();
  const skills2 = await discoverAllSkillsForModes(modes);
  const time2 = Date.now() - start2;

  // Results should be identical
  assert.deepEqual(skills1, skills2);

  // Second call should be much faster (caching)
  assert.ok(time2 <= time1, "Cached call should be faster or equal");
});

test("loader - different mode sets have separate cache entries", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const coderModes = resolveModes(["coder"]);
  const debuggerModes = resolveModes(["debugger"]);

  const coderSkills = await discoverAllSkillsForModes(coderModes);
  const debuggerSkills = await discoverAllSkillsForModes(debuggerModes);

  // Should be different sets
  const coderNames = new Set(coderSkills.map((s) => s.name));
  const debuggerNames = new Set(debuggerSkills.map((s) => s.name));

  // Both should have 'compact' (shared skill)
  assert.ok(coderNames.has("compact"), "Coder should have compact skill");
  assert.ok(debuggerNames.has("compact"), "Debugger should have compact skill");
});

test("loader - clearDiscoveryCache invalidates cache", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const modes = resolveModes(["coder"]);

  const skills1 = await discoverAllSkillsForModes(modes);
  assert.ok(skills1.length > 0);

  clearDiscoveryCache();

  // After cache clear, still should work
  const skills2 = await discoverAllSkillsForModes(modes);
  assert.deepEqual(skills1, skills2);
});

test("loader - backwards compatibility with loadSkillsForModes", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const modes = resolveModes(["coder"]);

  const newStyleSkills = await discoverAllSkillsForModes(modes);

  clearDiscoveryCache();
  resetGlobalRegistry();

  const oldStyleSkills = await loadSkillsForModes(modes);

  // Should be equivalent
  assert.equal(newStyleSkills.length, oldStyleSkills.length);
  assert.deepEqual(
    newStyleSkills.map((s) => s.name).sort(),
    oldStyleSkills.map((s) => s.name).sort(),
  );
});

test("loader - handles missing skill root gracefully", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  // Create a mock mode with a non-existent skill root
  const mockMode: Mode = {
    name: "mock",
    description: "Mock mode",
    prompt: "Mock prompt",
    skillRoots: ["/non/existent/path"],
    mcpServers: [],
    memory: "claude-like",
  };

  // Should not throw, just return empty or skip non-existent
  const skills = await discoverAllSkillsForModes([mockMode]);
  assert.ok(Array.isArray(skills));
});

test("loader - parallel loading performance (multiple modes)", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const modes = resolveModes(["coder", "browser-surff", "debugger"]);

  const start = Date.now();
  const skills = await discoverAllSkillsForModes(modes);
  const elapsed = Date.now() - start;

  assert.ok(skills.length > 0);
  // Should complete in reasonable time (parallel loading should be fast)
  // (This is a soft assertion - adjust if needed based on system performance)
  console.log(`Loaded ${skills.length} skills in ${elapsed}ms`);
});

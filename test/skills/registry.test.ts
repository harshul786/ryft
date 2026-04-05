import assert from "node:assert/strict";
import test from "node:test";
import {
  SkillRegistry,
  resetGlobalRegistry,
  getGlobalSkillRegistry,
} from "../../src/skills/registry.ts";
import type { Skill } from "../../src/types.ts";

/**
 * Test suite for SkillRegistry
 */

test("SkillRegistry - basic registration", async () => {
  const registry = new SkillRegistry();

  const skill: Skill = {
    name: "test-skill",
    description: "A test skill",
    file: "/tmp/test.md",
  };

  await registry.register(skill, "project");

  const retrieved = registry.get("test-skill");
  assert.deepEqual(retrieved, skill);
});

test("SkillRegistry - get non-existent skill returns undefined", () => {
  const registry = new SkillRegistry();

  const retrieved = registry.get("non-existent");
  assert.equal(retrieved, undefined);
});

test("SkillRegistry - getAll returns all skills sorted by name", async () => {
  const registry = new SkillRegistry();

  const skills: Skill[] = [
    { name: "zebra", description: "Last", file: "/tmp/z.md" },
    { name: "alpha", description: "First", file: "/tmp/a.md" },
    { name: "beta", description: "Second", file: "/tmp/b.md" },
  ];

  for (const skill of skills) {
    await registry.register(skill, "project");
  }

  const all = registry.getAll();

  assert.equal(all.length, 3);
  assert.equal(all[0]?.name, "alpha");
  assert.equal(all[1]?.name, "beta");
  assert.equal(all[2]?.name, "zebra");
});

test("SkillRegistry - clear removes all skills", async () => {
  const registry = new SkillRegistry();

  const skill: Skill = {
    name: "test-skill",
    description: "A test skill",
    file: "/tmp/test.md",
  };

  await registry.register(skill, "project");
  assert.equal(registry.size(), 1);

  registry.clear();
  assert.equal(registry.size(), 0);
  assert.equal(registry.get("test-skill"), undefined);
});

test("SkillRegistry - size() returns correct count", async () => {
  const registry = new SkillRegistry();

  assert.equal(registry.size(), 0);

  await registry.register(
    { name: "skill1", description: "D1", file: "/tmp/1.md" },
    "project",
  );
  assert.equal(registry.size(), 1);

  await registry.register(
    { name: "skill2", description: "D2", file: "/tmp/2.md" },
    "user",
  );
  assert.equal(registry.size(), 2);
});

test("SkillRegistry - getBySource filters by source", async () => {
  const registry = new SkillRegistry();

  await registry.register(
    { name: "project-skill", description: "P", file: "/tmp/p.md" },
    "project",
  );
  await registry.register(
    { name: "user-skill", description: "U", file: "/tmp/u.md" },
    "user",
  );
  await registry.register(
    { name: "bundled-skill", description: "B", file: "/tmp/b.md" },
    "bundled",
  );

  const projectSkills = registry.getBySource("project");
  assert.equal(projectSkills.length, 1);
  assert.equal(projectSkills[0]?.name, "project-skill");

  const userSkills = registry.getBySource("user");
  assert.equal(userSkills.length, 1);
  assert.equal(userSkills[0]?.name, "user-skill");

  const bundledSkills = registry.getBySource("bundled");
  assert.equal(bundledSkills.length, 1);
  assert.equal(bundledSkills[0]?.name, "bundled-skill");
});

test("SkillRegistry - skills without file path use name+source as key", async () => {
  const registry = new SkillRegistry();

  const skill: Skill = {
    name: "dynamic-skill",
    description: "A skill without a file",
  };

  await registry.register(skill, "bundled");

  const retrieved = registry.get("dynamic-skill");
  assert.deepEqual(retrieved, skill);
});

test("SkillRegistry - later registration overrides earlier for same file", async () => {
  const registry = new SkillRegistry();

  const skill1: Skill = {
    name: "skill-v1",
    description: "Version 1",
    file: "/tmp/skill.md",
  };

  const skill2: Skill = {
    name: "skill-v2",
    description: "Version 2",
    file: "/tmp/skill.md",
  };

  await registry.register(skill1, "project");
  await registry.register(skill2, "user");

  // Later registration should win
  const retrieved = registry.get("skill-v2");
  assert.deepEqual(retrieved, skill2);

  // Old name should not exist
  assert.equal(registry.get("skill-v1"), undefined);
});

test("SkillRegistry - onLoad callback is called on emitLoad", (t, done) => {
  const registry = new SkillRegistry();
  let callbackCalled = false;
  let callbackSkills: Skill[] = [];

  registry.onLoad((skills) => {
    callbackCalled = true;
    callbackSkills = skills;
  });

  registry
    .register(
      { name: "test", description: "Test", file: "/tmp/test.md" },
      "project",
    )
    .then(() => {
      registry.emitLoad();

      assert.equal(callbackCalled, true);
      assert.equal(callbackSkills.length, 1);
      assert.equal(callbackSkills[0]?.name, "test");
      done?.();
    });
});

test("SkillRegistry - global singleton getInstance works", () => {
  resetGlobalRegistry();

  const reg1 = getGlobalSkillRegistry();
  const reg2 = getGlobalSkillRegistry();

  // Should be same instance
  assert.equal(reg1, reg2);
});

test("SkillRegistry - resetGlobalRegistry clears everything", async () => {
  resetGlobalRegistry();

  const registry = getGlobalSkillRegistry();
  await registry.register(
    { name: "test", description: "Test", file: "/tmp/test.md" },
    "project",
  );
  assert.equal(registry.size(), 1);

  resetGlobalRegistry();

  const newRegistry = getGlobalSkillRegistry();
  assert.equal(newRegistry.size(), 0);
});

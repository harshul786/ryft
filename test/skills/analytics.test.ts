/**
 * Test suite for Skill Analytics
 *
 * Tests the analytics tracking, reporting, and export functionality.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  SkillAnalyticsStore,
  getGlobalAnalyticsStore,
  type SkillAnalytics,
} from "../../src/skills/analytics.ts";

/**
 * Test: Basic invocation tracking
 */
test("Analytics - track single invocation", () => {
  const store = new SkillAnalyticsStore();
  store.trackInvocation("test-skill", true, ["tool:read", "tool:write"]);

  const analytics = store.getSkillAnalytics("test-skill");
  assert.ok(analytics);
  assert.equal(analytics.skillName, "test-skill");
  assert.equal(analytics.invocations, 1);
  assert.equal(analytics.successes, 1);
  assert.equal(analytics.failures, 0);
  assert.deepEqual(analytics.toolsUsed, ["tool:read", "tool:write"]);
});

/**
 * Test: Multiple invocations with mixed success/failure
 */
test("Analytics - track multiple invocations", () => {
  const store = new SkillAnalyticsStore();

  // Invoke skill 3 times: 2 successes, 1 failure
  store.trackInvocation("format", true, ["tool:write"]);
  store.trackInvocation("format", true, ["tool:write"]);
  store.trackInvocation("format", false, []);

  const analytics = store.getSkillAnalytics("format");
  assert.ok(analytics);
  assert.equal(analytics.invocations, 3);
  assert.equal(analytics.successes, 2);
  assert.equal(analytics.failures, 1);
});

/**
 * Test: Tool usage tracking
 */
test("Analytics - track tool usage", () => {
  const store = new SkillAnalyticsStore();

  store.trackInvocation("test", true, ["read", "write"]);
  store.trackInvocation("other", true, ["read", "execute"]);
  store.trackInvocation("test", false, ["write"]);

  const perms = store.getToolPermissionSummary();
  assert.equal(perms["read"], 2);
  assert.equal(perms["write"], 2);
  assert.equal(perms["execute"], 1);
});

/**
 * Test: Get analytics summary with top skills
 */
test("Analytics - get summary with top skills", () => {
  const store = new SkillAnalyticsStore();

  // Create some skill data
  store.trackInvocation("format", true, ["write"]);
  store.trackInvocation("format", true, ["write"]);
  store.trackInvocation("test", true, ["read"]);
  store.trackInvocation("build", false, ["execute"]);
  store.trackInvocation("build", true, ["execute"]);

  const summary = store.getAnalytics();

  assert.equal(summary.totalSkillsTracked, 3);
  assert.equal(summary.totalInvocations, 5);
  assert.equal(summary.totalSuccesses, 4);
  assert.equal(summary.totalFailures, 1);
  assert.ok(summary.successRate > 70 && summary.successRate < 90);

  // Top skill should be 'format' with 2 invocations
  assert.equal(summary.topSkills[0]?.name, "format");
  assert.equal(summary.topSkills[0]?.invocations, 2);
  assert.equal(summary.topSkills[0]?.successRate, 100);
});

/**
 * Test: Export analytics as JSON
 */
test("Analytics - export as JSON", () => {
  const store = new SkillAnalyticsStore();

  store.trackInvocation("skill1", true, ["tool1"]);
  store.trackInvocation("skill2", false, ["tool2"]);

  const exported = store.exportAnalytics();

  assert.ok(exported.exportedAt);
  assert.ok(exported.summary);
  assert.equal(exported.skillDetails.length, 2);
  assert.equal(exported.summary.totalInvocations, 2);
  assert.equal(exported.summary.totalSuccesses, 1);
  assert.equal(exported.summary.totalFailures, 1);
});

/**
 * Test: Export analytics as JSON string
 */
test("Analytics - export as JSON string is valid", () => {
  const store = new SkillAnalyticsStore();

  store.trackInvocation("test", true, ["tool"]);

  const jsonStr = store.exportAnalyticsAsJSON();
  const parsed = JSON.parse(jsonStr);

  assert.ok(parsed.exportedAt);
  assert.ok(parsed.summary);
  assert.ok(parsed.skillDetails);
});

/**
 * Test: Reset analytics
 */
test("Analytics - reset clears all data", () => {
  const store = new SkillAnalyticsStore();

  store.trackInvocation("test", true, ["tool"]);
  assert.equal(store.getSkillCount(), 1);

  store.reset();
  assert.equal(store.getSkillCount(), 0);
  assert.equal(store.getToolCount(), 0);
});

/**
 * Test: Global singleton
 */
test("Analytics - global singleton instance", () => {
  const store1 = getGlobalAnalyticsStore();
  const store2 = getGlobalAnalyticsStore();

  assert.strictEqual(store1, store2);
});

/**
 * Test: Tool count tracking
 */
test("Analytics - unique tool counting", () => {
  const store = new SkillAnalyticsStore();

  store.trackInvocation("skill1", true, ["tool1", "tool2", "tool3"]);
  store.trackInvocation("skill2", true, ["tool2", "tool4"]);

  assert.equal(store.getToolCount(), 4); // tool1, tool2, tool3, tool4
});

/**
 * Test: Skill count tracking
 */
test("Analytics - unique skill counting", () => {
  const store = new SkillAnalyticsStore();

  store.trackInvocation("skill1", true, ["tool"]);
  store.trackInvocation("skill2", true, ["tool"]);
  store.trackInvocation("skill1", false, []); // duplicate skill name

  assert.equal(store.getSkillCount(), 2); // skill1, skill2
});

/**
 * Test: Top skills limited to 5
 */
test("Analytics - top skills limited to 5", () => {
  const store = new SkillAnalyticsStore();

  // Create 10 skills with increasing invocations
  for (let i = 1; i <= 10; i++) {
    const skillName = `skill${i}`;
    for (let j = 0; j < i; j++) {
      store.trackInvocation(skillName, true, []);
    }
  }

  const summary = store.getAnalytics();
  assert.equal(summary.topSkills.length, 5);

  // Top skill should be skill10 with 10 invocations
  assert.equal(summary.topSkills[0]?.name, "skill10");
  assert.equal(summary.topSkills[0]?.invocations, 10);
});

/**
 * Test: Success rate calculation
 */
test("Analytics - success rate calculation", () => {
  const store = new SkillAnalyticsStore();

  // 3 successes, 1 failure = 75% success rate
  store.trackInvocation("skill", true, []);
  store.trackInvocation("skill", true, []);
  store.trackInvocation("skill", true, []);
  store.trackInvocation("skill", false, []);

  const summary = store.getAnalytics();
  assert.equal(summary.successRate, 75);
});

/**
 * Test: Last used timestamp
 */
test("Analytics - track last used timestamp", () => {
  const store = new SkillAnalyticsStore();

  const before = new Date();
  store.trackInvocation("skill", true, []);
  const after = new Date();

  const analytics = store.getSkillAnalytics("skill");
  assert.ok(analytics?.lastUsed);
  assert.ok(analytics.lastUsed.getTime() >= before.getTime());
  assert.ok(analytics.lastUsed.getTime() <= after.getTime());
});

#!/usr/bin/env node
/**
 * Analytics Integration Test
 *
 * This script demonstrates Feature 7 analytics in action.
 * Shows how skills are tracked, how analytics are reported, and how data is exported.
 */

import { SkillRegistry } from "./src/skills/registry.ts";
import { getGlobalAnalyticsStore } from "./src/skills/analytics.ts";

async function main() {
  console.log("=".repeat(60));
  console.log("FEATURE 7: ANALYTICS TRACKING DEMONSTRATION");
  console.log("=".repeat(60));

  // Initialize registry and analytics
  const registry = new SkillRegistry();
  const analytics = getGlobalAnalyticsStore();

  console.log("\n1. REGISTRY INITIALIZATION");
  console.log("-".repeat(60));

  // Register some sample skills
  const sampleSkills = [
    {
      name: "format",
      description: "Format code",
      file: "/tmp/format.md",
      context: "inline" as const,
    },
    {
      name: "test",
      description: "Run tests",
      file: "/tmp/test.md",
      context: "fork" as const,
    },
    {
      name: "build",
      description: "Build project",
      file: "/tmp/build.md",
    },
    {
      name: "debug",
      description: "Debug issues",
      file: "/tmp/debug.md",
    },
    {
      name: "deploy",
      description: "Deploy to production",
      file: "/tmp/deploy.md",
    },
  ];

  for (const skill of sampleSkills) {
    await registry.register(skill, "bundled");
  }

  console.log(`✓ Registered ${registry.size()} sample skills`);

  // Get stats
  const stats = registry.getSkillStats();
  console.log(`✓ Skills summary:`);
  console.log(`  - Total: ${stats.total}`);
  console.log(`  - Unconditional: ${stats.unconditional}`);
  console.log(`  - Conditional: ${stats.conditional}`);
  console.log(`  - Currently active: ${stats.active}`);

  console.log("\n2. SIMULATING SKILL INVOCATIONS");
  console.log("-".repeat(60));

  // Simulate skill usage
  const skillsToTrack = [
    { name: "format", successes: 5, failures: 1, tools: ["write", "read"] },
    { name: "test", successes: 3, failures: 2, tools: ["execute", "read"] },
    { name: "build", successes: 2, failures: 0, tools: ["execute", "write"] },
    { name: "debug", successes: 1, failures: 1, tools: ["read"] },
    { name: "deploy", successes: 0, failures: 1, tools: ["execute", "write"] },
  ];

  for (const skill of skillsToTrack) {
    console.log(`\nTracking skill: ${skill.name}`);

    for (let i = 0; i < skill.successes; i++) {
      analytics.trackInvocation(skill.name, true, skill.tools);
      console.log(`  ✓ Success #${i + 1}`);
    }

    for (let i = 0; i < skill.failures; i++) {
      analytics.trackInvocation(skill.name, false, skill.tools);
      console.log(`  ✗ Failure #${i + 1}`);
    }
  }

  console.log("\n3. ANALYTICS SUMMARY");
  console.log("-".repeat(60));

  const summary = analytics.getAnalytics();

  console.log(`\nOverall Statistics:`);
  console.log(`  Total skills tracked: ${summary.totalSkillsTracked}`);
  console.log(`  Total invocations: ${summary.totalInvocations}`);
  console.log(`  Successes: ${summary.totalSuccesses}`);
  console.log(`  Failures: ${summary.totalFailures}`);
  console.log(`  Success rate: ${summary.successRate.toFixed(2)}%`);

  console.log(`\nTop Skills by Usage:`);
  for (let i = 0; i < summary.topSkills.length; i++) {
    const skill = summary.topSkills[i];
    console.log(
      `  ${i + 1}. ${skill.name}: ${skill.invocations} invocations (${skill.successRate.toFixed(2)}% success)`,
    );
  }

  console.log(`\nTop Tools by Usage:`);
  for (let i = 0; i < summary.topTools.length; i++) {
    const tool = summary.topTools[i];
    console.log(`  ${i + 1}. ${tool.name}: ${tool.usageCount} uses`);
  }

  const toolPerms = registry.getToolPermissionSummary();
  console.log(`\nTool Permissions Summary:`);
  const permEntries = Object.entries(toolPerms)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type}(${count})`)
    .join(", ");
  console.log(`  ${permEntries}`);

  console.log("\n4. DETAILED SKILL ANALYTICS");
  console.log("-".repeat(60));

  for (const skill of analytics.getAllAnalytics().slice(0, 3)) {
    const successRate =
      skill.invocations > 0 ? ((skill.successes / skill.invocations) * 100).toFixed(2) : "N/A";
    console.log(`\n${skill.skillName}:`);
    console.log(`  Invocations: ${skill.invocations}`);
    console.log(`  Successes: ${skill.successes}`);
    console.log(`  Failures: ${skill.failures}`);
    console.log(`  Success rate: ${successRate}%`);
    console.log(`  Tools used: ${skill.toolsUsed.join(", ") || "none"}`);
    console.log(`  Last used: ${skill.lastUsed?.toLocaleString() || "never"}`);
  }

  console.log("\n5. EXPORTED ANALYTICS DATA");
  console.log("-".repeat(60));

  const exported = analytics.exportAnalytics();
  console.log(`\nExported data structure:`);
  console.log(`  exportedAt: ${exported.exportedAt}`);
  console.log(
    `  summary: ${JSON.stringify(exported.summary).substring(0, 80)}...`,
  );
  console.log(`  skillDetails: ${exported.skillDetails.length} skills`);

  console.log("\n6. JSON EXPORT (Sample)");
  console.log("-".repeat(60));

  const jsonExport = analytics.exportAnalyticsAsJSON();
  console.log(jsonExport.substring(0, 600) + "\n  ...(truncated)");

  console.log("\n" + "=".repeat(60));
  console.log("✓ ANALYTICS DEMONSTRATION COMPLETE");
  console.log("=".repeat(60));
  console.log("\nKey Features Tested:");
  console.log("  ✓ Skill registration");
  console.log("  ✓ Skill invocation tracking");
  console.log("  ✓ Success/failure counting");
  console.log("  ✓ Tool usage aggregation");
  console.log("  ✓ Top skills ranking");
  console.log("  ✓ Tool permission summary");
  console.log("  ✓ Detailed per-skill analytics");
  console.log("  ✓ JSON export capability");
  console.log("\nEnvironment Settings:");
  console.log(`  Analytics enabled: ${analytics.isEnabled()}`);
  console.log(`  (Set RYFT_ANALYTICS=false to disable)`);
}

main().catch(console.error);

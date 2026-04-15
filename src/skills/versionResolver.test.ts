/**
 * Feature 8: Skill Versioning & Dependencies - Test Suite
 *
 * Tests for semantic versioning, dependency resolution, and conflict detection
 */

import {
  parseVersion,
  satisfiesDependency,
  compareVersions,
  resolveDependencies,
  detectVersionConflicts,
  formatVersion,
} from "./versionResolver.ts";
import type { Skill } from "./types.ts";

// Test helper
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

// ─────── Test Suite ───────────────────────────────────────────────────────

console.log("=== Feature 8: Skill Versioning & Dependencies Tests ===\n");

// Test 1: Parse semantic versions
console.log("Test 1: Parse semantic versions");
const v1 = parseVersion("1.0.0");
assert(
  v1.major === 1 && v1.minor === 0 && v1.patch === 0,
  "Parse 1.0.0 correctly",
);

const v2 = parseVersion("2.1.5-alpha.1+build.123");
assert(
  v2.major === 2 &&
    v2.minor === 1 &&
    v2.patch === 5 &&
    v2.prerelease === "alpha.1" &&
    v2.metadata === "build.123",
  "Parse prerelease and metadata",
);

try {
  parseVersion("invalid");
  assert(false, "Should reject invalid versions");
} catch {
  assert(true, "Reject invalid version format");
}

console.log("");

// Test 2: Compare versions
console.log("Test 2: Compare versions");
assert(
  compareVersions(parseVersion("1.0.0"), parseVersion("2.0.0")) === -1,
  "1.0.0 < 2.0.0",
);
assert(
  compareVersions(parseVersion("2.0.0"), parseVersion("1.0.0")) === 1,
  "2.0.0 > 1.0.0",
);
assert(
  compareVersions(parseVersion("1.0.0"), parseVersion("1.0.0")) === 0,
  "1.0.0 === 1.0.0",
);
assert(
  compareVersions(parseVersion("1.0.0-alpha"), parseVersion("1.0.0")) === -1,
  "Prerelease < release",
);

console.log("");

// Test 3: Semver range matching - Caret (^)
console.log("Test 3: Semver range matching - Caret (^)");
assert(satisfiesDependency("1.2.3", "^1.0.0"), "1.2.3 satisfies ^1.0.0");
assert(satisfiesDependency("1.5.0", "^1.0.0"), "1.5.0 satisfies ^1.0.0");
assert(
  !satisfiesDependency("2.0.0", "^1.0.0"),
  "2.0.0 does NOT satisfy ^1.0.0",
);
assert(satisfiesDependency("0.2.3", "^0.2.0"), "0.2.3 satisfies ^0.2.0");
assert(
  !satisfiesDependency("0.3.0", "^0.2.0"),
  "0.3.0 does NOT satisfy ^0.2.0",
);

console.log("");

// Test 4: Semver range matching - Tilde (~)
console.log("Test 4: Semver range matching - Tilde (~)");
assert(satisfiesDependency("1.2.3", "~1.2.0"), "1.2.3 satisfies ~1.2.0");
assert(satisfiesDependency("1.2.5", "~1.2.0"), "1.2.5 satisfies ~1.2.0");
assert(
  !satisfiesDependency("1.3.0", "~1.2.0"),
  "1.3.0 does NOT satisfy ~1.2.0",
);

console.log("");

// Test 5: Semver range matching - Comparison operators
console.log("Test 5: Semver range matching - Comparison operators");
assert(satisfiesDependency("2.0.0", ">=1.0.0"), "2.0.0 satisfies >=1.0.0");
assert(satisfiesDependency("1.0.0", ">=1.0.0"), "1.0.0 satisfies >=1.0.0");
assert(
  !satisfiesDependency("0.9.0", ">=1.0.0"),
  "0.9.0 does NOT satisfy >=1.0.0",
);
assert(satisfiesDependency("1.5.0", ">1.0.0"), "1.5.0 satisfies >1.0.0");
assert(
  !satisfiesDependency("1.0.0", ">1.0.0"),
  "1.0.0 does NOT satisfy >1.0.0",
);

console.log("");

// Test 6: Exact version matching
console.log("Test 6: Exact version matching");
assert(satisfiesDependency("1.2.3", "1.2.3"), "1.2.3 matches 1.2.3 exactly");
assert(!satisfiesDependency("1.2.4", "1.2.3"), "1.2.4 does NOT match 1.2.3");

console.log("");

// Test 7: Resolve dependencies
console.log("Test 7: Resolve dependencies");
const skillRegistry = new Map<string, Skill>([
  [
    "formatter",
    { name: "formatter", description: "Code formatter", version: "2.1.0" },
  ],
  ["linter", { name: "linter", description: "Linter", version: "1.5.0" }],
]);

const skillWithDeps: Skill = {
  name: "advanced-format",
  description: "Advanced formatter",
  version: "1.0.0",
  dependencies: {
    formatter: "^2.0.0",
    linter: "~1.5",
  },
};

const resolved = resolveDependencies(skillWithDeps, skillRegistry);
assert(resolved.length === 2, "Resolved 2 dependencies");
assert(resolved[0].isSatisfied === true, "formatter dependency is satisfied");
assert(resolved[1].isSatisfied === true, "linter dependency is satisfied");

console.log("");

// Test 8: Detect missing dependencies
console.log("Test 8: Detect missing dependencies");
const skillWithMissing: Skill = {
  name: "complex-skill",
  description: "Complex skill",
  version: "1.0.0",
  dependencies: {
    missing: "^1.0.0",
  },
};

const resolvedMissing = resolveDependencies(skillWithMissing, skillRegistry);
assert(resolvedMissing[0].isSatisfied === false, "Missing dependency detected");
assert(
  resolvedMissing[0].conflictReason?.includes("not found"),
  "Conflict reason mentions missing skill",
);

console.log("");

// Test 9: Detect version conflicts
console.log("Test 9: Detect version conflicts");
const conflictRegistry = new Map<string, Skill>([
  [
    "formatter",
    { name: "formatter", description: "Formatter", version: "1.5.0" },
  ],
  [
    "strict-format",
    {
      name: "strict-format",
      description: "Strict formatter",
      version: "1.0.0",
      dependencies: { formatter: "^2.0.0" },
    },
  ],
]);

const conflicts = detectVersionConflicts(conflictRegistry);
assert(conflicts.length > 0, "Detected version conflicts");
assert(
  conflicts[0].skillName === "formatter",
  "Conflict identified for formatter",
);
assert(
  conflicts[0].conflictingDependents.some(
    (d) => d.skillName === "strict-format",
  ),
  "Conflict shows dependent skill",
);

console.log("");

// Test 10: Format version for display
console.log("Test 10: Format version for display");
const fmtVersion = formatVersion(parseVersion("1.2.3-alpha+build"));
assert(fmtVersion === "1.2.3-alpha+build", "Format version correctly");

console.log("");

// ─────── Summary ───────────────────────────────────────────────────────

console.log("=== All Tests Passed ✓ ===\n");
console.log("Summary:");
console.log("  • Semantic version parsing: ✓");
console.log("  • Version comparison: ✓");
console.log("  • Caret range matching (^): ✓");
console.log("  • Tilde range matching (~): ✓");
console.log("  • Comparison operator ranges: ✓");
console.log("  • Exact version matching: ✓");
console.log("  • Dependency resolution: ✓");
console.log("  • Missing dependency detection: ✓");
console.log("  • Version conflict detection: ✓");
console.log("  • Version formatting: ✓");
console.log("");
console.log("Feature 8 implementation is COMPLETE and TESTED ✓");

import assert from "node:assert/strict";
import test from "node:test";
import { resolveModes } from "../../src/modes/catalog.ts";
import {
  getModeSkills,
  getSkillMetadata,
  getSkillRequiredTools,
  clearSkillsDbCache,
  getSkillsDbErrors,
  getAllSkillsAcrossModes,
  getModesContainingSkill,
  getAllSkillMetadata,
  getAllSkillsRequiringTool,
  validateSkillDefinition,
  validateSkillsDatabase,
  getSkillsRequiringPermission,
  isSkillDisabledInMode,
  disableSkill,
  enableSkill,
  getDisabledSkillsForMode,
  getSkillsState,
  resetSkillsState,
  getSkillsDatabaseVersion,
  getAvailableSchemaVersions,
  resolveSkillPath,
  getModuleToolPolicy,
  isSkillToolCompatibleWithMode,
  filterSkillsByToolPolicy,
} from "../../src/modes/skill-merger.ts";
import { resetGlobalRegistry } from "../../src/skills/registry.ts";
import { clearDiscoveryCache } from "../../src/skills/loader.ts";
import type { Skill } from "../../src/types.ts";

/**
 * Test suite for mode-aware skill filtering
 */

test("mode-skills - getModeSkills loads skills for coder mode", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const coderMode = resolveModes(["coder"])[0];
  assert.ok(coderMode);

  const skills = await getModeSkills(coderMode);

  assert.ok(skills.length > 0, "Should load skills for coder mode");
  assert.ok(
    skills.some((s) => s.name === "edit"),
    "Should include edit skill",
  );
  assert.ok(
    skills.some((s) => s.name === "compact"),
    "Should include shared compact skill",
  );
});

test("mode-skills - getModeSkills loads skills for browser-surff mode", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const browserMode = resolveModes(["browser-surff"])[0];
  assert.ok(browserMode);

  const skills = await getModeSkills(browserMode);

  assert.ok(skills.length > 0, "Should load skills for browser-surff mode");
  assert.ok(
    skills.some((s) => s.name === "browser"),
    "Should include browser skill",
  );
  assert.ok(
    skills.some((s) => s.name === "compact"),
    "Should include shared compact skill",
  );
});

test("mode-skills - getModeSkills loads skills for debugger mode", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const debuggerMode = resolveModes(["debugger"])[0];
  assert.ok(debuggerMode);

  const skills = await getModeSkills(debuggerMode);

  assert.ok(skills.length > 0, "Should load skills for debugger mode");
  assert.ok(
    skills.some((s) => s.name === "troubleshoot"),
    "Should include troubleshoot skill",
  );
  assert.ok(
    skills.some((s) => s.name === "compact"),
    "Should include shared compact skill",
  );
});

test("mode-skills - skills are sorted alphabetically by mode", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const modes = resolveModes(["coder", "debugger"]);

  for (const mode of modes) {
    const skills = await getModeSkills(mode);

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
  }
});

test("mode-skills - database getSkillMetadata returns correct data", () => {
  const metadata = getSkillMetadata("edit");
  assert.ok(metadata, "Should find edit skill in database");
  assert.equal(metadata?.id, 2, "edit skill should have numeric ID 2");
  assert.equal(metadata?.name, "edit", 'edit skill should have name "edit"');
  assert.deepEqual(metadata?.requiredTools, ["editor"]);
  assert.ok(metadata?.modes.includes("coder"));
  assert.ok(!metadata?.modes.includes("debugger"));
});

test("mode-skills - database getSkillRequiredTools returns tool requirements", () => {
  const editTools = getSkillRequiredTools("edit");
  assert.deepEqual(editTools, ["editor"], "edit should require editor");

  const browserTools = getSkillRequiredTools("browser");
  assert.deepEqual(
    browserTools,
    ["browser"],
    "browser should require browser tool",
  );

  const troubleshootTools = getSkillRequiredTools("troubleshoot");
  assert.deepEqual(
    troubleshootTools,
    ["logs", "bash"],
    "troubleshoot should require logs and bash",
  );

  const compactTools = getSkillRequiredTools("compact");
  assert.deepEqual(compactTools, [], "compact should not require any tools");
});

test("mode-skills - database skill modes are correctly set", () => {
  const editModes = getSkillMetadata("edit")?.modes;
  assert.deepEqual(editModes, ["coder"], "edit only available in coder");

  const browserModes = getSkillMetadata("browser")?.modes;
  assert.deepEqual(
    browserModes,
    ["browser-surff"],
    "browser only available in browser-surff",
  );

  const troubleshootModes = getSkillMetadata("troubleshoot")?.modes;
  assert.deepEqual(
    troubleshootModes,
    ["debugger"],
    "troubleshoot only available in debugger",
  );

  const compactModes = getSkillMetadata("compact")?.modes;
  assert.deepEqual(
    compactModes,
    ["coder", "browser-surff", "debugger"],
    "compact available in all modes",
  );
});

test("mode-skills - coder and debugger modes have different skills", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const coderMode = resolveModes(["coder"])[0];
  const debuggerMode = resolveModes(["debugger"])[0];

  const coderSkills = await getModeSkills(coderMode);
  const debuggerSkills = await getModeSkills(debuggerMode);

  const coderNames = new Set(coderSkills.map((s) => s.name));
  const debuggerNames = new Set(debuggerSkills.map((s) => s.name));

  // There should be some overlap (shared skills)
  assert.ok(coderNames.has("compact"), "Coder should have compact");
  assert.ok(debuggerNames.has("compact"), "Debugger should have compact");

  // But also differences
  assert.ok(coderNames.has("edit"), "Coder should have edit");
  assert.ok(!debuggerNames.has("edit"), "Debugger should not have edit");

  assert.ok(
    debuggerNames.has("troubleshoot"),
    "Debugger should have troubleshoot",
  );
  assert.ok(
    !coderNames.has("troubleshoot"),
    "Coder should not have troubleshoot",
  );
});

test("mode-skills - all modes can load skills without errors", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();

  const modes = resolveModes();

  for (const mode of modes) {
    try {
      const skills = await getModeSkills(mode);
      assert.ok(
        Array.isArray(skills),
        `Mode ${mode.name} should return array of skills`,
      );
    } catch (error) {
      assert.fail(`Mode ${mode.name} should not throw: ${error}`);
    }
  }
});

// GAP FIX TESTS: #2, #3, #4, #5, #9, #10, #11

test("GAP FIX #1/#8 - clearSkillsDbCache invalidates cache", async () => {
  resetGlobalRegistry();
  clearDiscoveryCache();
  clearSkillsDbCache();

  const mode = resolveModes(["coder"])[0];
  const skills1 = await getModeSkills(mode);
  assert.ok(skills1.length > 0, "Should load skills");

  clearSkillsDbCache();

  const skills2 = await getModeSkills(mode);
  assert.ok(skills2.length > 0, "Should reload skills after cache clear");
  assert.deepEqual(
    skills1.length,
    skills2.length,
    "Should have same skill count",
  );
});

test("GAP FIX #2 - getAllSkillsAcrossModes returns all unique skills", () => {
  clearSkillsDbCache();

  const allSkills = getAllSkillsAcrossModes();
  const skillNames = allSkills.map((s) => s.name);

  assert.ok(skillNames.includes("edit"), "Should include edit skill");
  assert.ok(skillNames.includes("browser"), "Should include browser skill");
  assert.ok(
    skillNames.includes("troubleshoot"),
    "Should include troubleshoot skill",
  );
  assert.ok(skillNames.includes("compact"), "Should include compact skill");

  // Should be sorted
  for (let i = 0; i < skillNames.length - 1; i++) {
    assert.ok(
      skillNames[i].localeCompare(skillNames[i + 1]) <= 0,
      `Skills should be sorted: ${skillNames[i]} <= ${skillNames[i + 1]}`,
    );
  }
});

test("GAP FIX #3 - getSkillsRequiringPermission filters by permission", () => {
  clearSkillsDbCache();

  const permissionSkills = getSkillsRequiringPermission();

  // Current DB has no permission-required skills, but function should work
  assert.ok(Array.isArray(permissionSkills), "Should return array");
});

test("GAP FIX #3 - getSkillsRequiringPermission filters by mode", () => {
  clearSkillsDbCache();

  const coderPermissions = getSkillsRequiringPermission("coder");
  assert.ok(
    Array.isArray(coderPermissions),
    "Should return array for coder mode",
  );
});

test("GAP FIX #5 - getSkillsDbErrors returns validation errors", () => {
  clearSkillsDbCache();

  // Load skills which may generate errors
  const errors = getSkillsDbErrors();
  assert.ok(Array.isArray(errors), "Should return error array");
});

test("GAP FIX #9 - getModesContainingSkill returns all modes for skill", () => {
  clearSkillsDbCache();

  const editModes = getModesContainingSkill("edit");
  assert.deepEqual(editModes, ["coder"], "edit should be in coder only");

  const compactModes = getModesContainingSkill("compact");
  assert.deepEqual(
    compactModes.sort(),
    ["browser-surff", "coder", "debugger"].sort(),
    "compact should be in all modes",
  );

  const nonExistentModes = getModesContainingSkill("nonexistent");
  assert.deepEqual(
    nonExistentModes,
    [],
    "nonexistent skill should have no modes",
  );
});

test("GAP FIX #10 - getAllSkillMetadata returns all skills with metadata", () => {
  clearSkillsDbCache();

  const metadata = getAllSkillMetadata();
  const names = metadata.map((s) => s.name);

  assert.ok(metadata.length >= 4, "Should have at least 4 skills");
  assert.ok(names.includes("edit"), "Should include edit");
  assert.ok(
    metadata.every((s) => s.name && s.modes && s.requiredTools),
    "All should have required fields",
  );
});

test("GAP FIX #10 - getAllSkillsRequiringTool returns skills needing tool", () => {
  clearSkillsDbCache();

  const editorSkills = getAllSkillsRequiringTool("editor");
  const editorSkillNames = editorSkills.map((s) => s.name);

  assert.ok(
    editorSkillNames.includes("edit"),
    "edit skill requires editor tool",
  );

  const browserSkills = getAllSkillsRequiringTool("browser");
  const browserSkillNames = browserSkills.map((s) => s.name);

  assert.ok(
    browserSkillNames.includes("browser"),
    "browser skill requires browser tool",
  );

  const noSkills = getAllSkillsRequiringTool("nonexistent");
  assert.deepEqual(noSkills, [], "nonexistent tool should have no skills");
});

test("GAP FIX #11 - validateSkillDefinition detects invalid skills", () => {
  clearSkillsDbCache();

  const validSkill = getSkillMetadata("edit");
  assert.ok(validSkill, "Should find valid skill");

  const validation = validateSkillDefinition(validSkill!);
  assert.ok(validation.valid, "edit skill should be valid");
  assert.deepEqual(validation.errors, [], "Should have no errors");
});

test("GAP FIX #11 - validateSkillDefinition catches missing fields", () => {
  const invalidSkill = {
    id: 999, // Invalid: very high numeric ID
    name: "", // Invalid: empty
    path: "", // Invalid: empty
    description: "",
    modes: [], // Invalid: empty array
    requiredTools: [],
    requiresPermission: false,
  } as any; // Cast to any to bypass type checking for test purpose

  const validation = validateSkillDefinition(invalidSkill);
  assert.ok(!validation.valid, "Should be invalid");
  assert.ok(validation.errors.length > 0, "Should have errors");
});

test("GAP FIX #11 - validateSkillsDatabase checks entire DB", () => {
  clearSkillsDbCache();

  const validation = validateSkillsDatabase();
  assert.ok(
    validation.valid || validation.errors.length > 0,
    "Should have validation result",
  );
  assert.ok(Array.isArray(validation.errors), "Should return errors array");
});

// GAP FIX #6: Runtime enable/disable with persistence

test("GAP FIX #6 - isSkillDisabledInMode checks disable state", () => {
  resetSkillsState();
  clearSkillsDbCache();

  const isDisabled = isSkillDisabledInMode("edit", "coder");
  assert.ok(!isDisabled, "edit should not be disabled in coder initially");
});

test("GAP FIX #6 - disableSkill marks skill as disabled", () => {
  resetSkillsState();
  clearSkillsDbCache();

  const state = disableSkill("edit", "coder");

  assert.ok(state.disabledSkills["edit"], "edit should have disabled entry");
  assert.ok(
    state.disabledSkills["edit"].modes.includes("coder"),
    "edit should be disabled in coder",
  );
  assert.ok(
    isSkillDisabledInMode("edit", "coder"),
    "Verification: edit should be disabled",
  );
});

test("GAP FIX #6 - disableSkill with multiple modes", () => {
  resetSkillsState();
  clearSkillsDbCache();

  const state = disableSkill("compact", ["coder", "debugger"]);

  assert.ok(
    state.disabledSkills["compact"].modes.includes("coder"),
    "compact disabled in coder",
  );
  assert.ok(
    state.disabledSkills["compact"].modes.includes("debugger"),
    "compact disabled in debugger",
  );
  assert.ok(
    !state.disabledSkills["compact"].modes.includes("browser-surff"),
    "compact not disabled in browser-surff",
  );
});

test("GAP FIX #6 - enableSkill removes skill from disabled", () => {
  resetSkillsState();
  clearSkillsDbCache();

  disableSkill("edit", "coder");
  const state = enableSkill("edit", "coder");

  assert.ok(
    !isSkillDisabledInMode("edit", "coder"),
    "edit should be enabled after enableSkill",
  );
  assert.ok(
    !state.disabledSkills["edit"],
    "edit should be removed from disabled state",
  );
});

test("GAP FIX #6 - getModeSkills respects disabled state", async () => {
  resetSkillsState();
  resetGlobalRegistry();
  clearDiscoveryCache();
  clearSkillsDbCache();

  const coderMode = resolveModes(["coder"])[0];

  // Get skills normally
  const skillsBefore = await getModeSkills(coderMode);
  const hasEditBefore = skillsBefore.some((s) => s.name === "edit");
  assert.ok(hasEditBefore, "edit should be in coder mode initially");

  // Disable edit skill
  disableSkill("edit", "coder");
  clearSkillsDbCache();

  // Get skills again - edit should be missing now
  const skillsAfter = await getModeSkills(coderMode);
  const hasEditAfter = skillsAfter.some((s) => s.name === "edit");
  assert.ok(!hasEditAfter, "edit should not be in coder mode after disable");
});

test("GAP FIX #6 - getDisabledSkillsForMode returns all disabled", () => {
  resetSkillsState();
  clearSkillsDbCache();

  disableSkill("edit", "coder");
  disableSkill("compact", "coder");

  const disabled = getDisabledSkillsForMode("coder");
  assert.deepEqual(
    disabled.sort(),
    ["compact", "edit"].sort(),
    "Should return all disabled skills for coder",
  );
});

test("GAP FIX #6 - getSkillsState returns current state", () => {
  resetSkillsState();
  clearSkillsDbCache();

  disableSkill("edit", "coder");
  const state = getSkillsState();

  assert.ok(state.disabledSkills["edit"], "State should contain disabled edit");
  assert.equal(state.version, "1.0.0", "State should have version");
});

test("GAP FIX #6 - resetSkillsState clears all disabled skills", () => {
  resetSkillsState();

  disableSkill("edit", "coder");
  disableSkill("browser", "browser-surff");

  let state = getSkillsState();
  assert.deepEqual(
    Object.keys(state.disabledSkills).length > 0,
    true,
    "Should have disabled skills",
  );

  resetSkillsState();

  state = getSkillsState();
  assert.deepEqual(
    state.disabledSkills,
    {},
    "disabledSkills should be empty after reset",
  );
});

// GAP FIX #12: Database versioning and migrations

test("GAP FIX #12 - getSkillsDatabaseVersion returns current version", () => {
  clearSkillsDbCache();

  const version = getSkillsDatabaseVersion();
  assert.ok(typeof version === "string", "Should return version string");
  assert.match(version, /^\d+\.\d+\.\d+$/, "Version should be semver");
});

test("GAP FIX #12 - getAvailableSchemaVersions lists all versions", () => {
  const versions = getAvailableSchemaVersions();

  assert.ok(versions["1.0.0"], "Should have 1.0.0");
  assert.ok(versions["1.1.0"], "Should have 1.1.0");
  assert.ok(
    Object.keys(versions).every((v) => /^\d+\.\d+\.\d+$/.test(v)),
    "All should be semver",
  );
});

// GAP FIX #7: Path abstraction

test("GAP FIX #7 - resolveSkillPath uses mapping for known skills", () => {
  const editPath = resolveSkillPath("edit");

  assert.ok(
    editPath.includes("packs/coder/skills/edit"),
    "Should resolve edit path",
  );
  assert.ok(editPath.includes("SKILL.md"), "Should include SKILL.md filename");
});

test("GAP FIX #7 - resolveSkillPath uses fallback for unknown skills", () => {
  const customPath = resolveSkillPath("unknown", "custom/path/SKILL.md");

  assert.ok(
    customPath.includes("custom/path/SKILL.md"),
    "Should use fallback path",
  );
});

test("GAP FIX #7 - resolveSkillPath returns empty string for unmapped skill", () => {
  const path = resolveSkillPath("unmapped-skill");

  assert.equal(
    path,
    "",
    "Should return empty string for unmapped skill without fallback",
  );
});

import { describe, it, afterEach } from "node:test";
import * as assert from "node:assert";
import { matchesPattern, matchesPatternsMultiple, getMatchingPatternSets } from "../src/skills/pathActivator.ts";
import { 
  ConditionalSkillRegistry,
  getGlobalConditionalSkillRegistry,
  resetGlobalConditionalRegistry,
} from "../src/skills/conditionalSkillRegistry.ts";
import type { Skill } from "../src/skills/types.ts";

describe("Path Activator", () => {
  describe("matchesPattern", () => {
    it("should match exact filenames", () => {
      assert.strictEqual(matchesPattern("Makefile", ["Makefile"]), true);
      assert.strictEqual(matchesPattern("Dockerfile", ["Makefile"]), false);
    });

    it("should match glob patterns", () => {
      assert.strictEqual(matchesPattern("test.py", ["*.py"]), true);
      assert.strictEqual(matchesPattern("src/test.py", ["*.py"]), true);
      assert.strictEqual(matchesPattern("test.ts", ["*.py"]), false);
    });

    it("should match nested patterns with wildcards", () => {
      assert.strictEqual(matchesPattern("src/main.ts", ["src/**/*.ts"]), true);
      assert.strictEqual(matchesPattern("src/components/Button.tsx", ["src/**/*.ts", "src/**/*.tsx"]), true);
      assert.strictEqual(matchesPattern("test/main.ts", ["src/**/*.ts"]), false);
    });

    it("should handle multiple patterns (OR logic)", () => {
      const patterns = ["*.py", "*.java", "Makefile"];
      assert.strictEqual(matchesPattern("script.py", patterns), true);
      assert.strictEqual(matchesPattern("Main.java", patterns), true);
      assert.strictEqual(matchesPattern("Makefile", patterns), true);
      assert.strictEqual(matchesPattern("README.md", patterns), false);
    });

    it("should return false for empty patterns", () => {
      assert.strictEqual(matchesPattern("Makefile", []), false);
      assert.strictEqual(matchesPattern("Makefile", [""] ), false);
    });

    it("should normalize paths starting with /", () => {
      assert.strictEqual(matchesPattern("/Makefile", ["Makefile"]), true);
      assert.strictEqual(matchesPattern("/src/main.ts", ["src/**/*.ts"]), true);
    });
  });

  describe("matchesPatternsMultiple", () => {
    it("should check multiple files efficiently", () => {
      const files = ["Makefile", "src/main.ts", "README.md", "test.py"];
      const patterns = ["Makefile", "*.py", "src/**/*.ts"];
      const results = matchesPatternsMultiple(files, patterns);
      
      assert.deepStrictEqual(results, [true, true, false, true]);
    });

    it("should return all false for empty patterns", () => {
      const files = ["file1", "file2", "file3"];
      const results = matchesPatternsMultiple(files, []);
      
      assert.strictEqual(results.every((r) => !r), true);
    });
  });

  describe("getMatchingPatternSets", () => {
    it("should return matching skill IDs", () => {
      const patterns = new Map([
        ["python-linter", ["*.py"]],
        ["typescript-check", ["*.ts", "*.tsx"]],
        ["makefile-help", ["Makefile"]],
      ]);
      
      assert.deepStrictEqual(
        getMatchingPatternSets("src/app.ts", patterns),
        ["typescript-check"]
      );
      
      assert.deepStrictEqual(
        getMatchingPatternSets("Makefile", patterns),
        ["makefile-help"]
      );
      
      assert.deepStrictEqual(
        getMatchingPatternSets("script.py", patterns),
        ["python-linter"]
      );
    });

    it("should return multiple matches", () => {
      const patterns = new Map([
        ["all-files", ["*"]],
        ["config-files", ["*.json"]],
      ]);
      
      const matches = getMatchingPatternSets("config.json", patterns);
      assert.strictEqual(matches.includes("all-files"), true);
      assert.strictEqual(matches.includes("config-files"), true);
    });
  });
});

describe("Conditional Skill Registry", () => {
  afterEach(() => {
    resetGlobalConditionalRegistry();
  });

  describe("registration and categorization", () => {
    it("should separate unconditional and conditional skills", () => {
      const registry = new ConditionalSkillRegistry();

      const unconditionalSkill: Skill = {
        name: "general",
        description: "General skill",
      };

      const conditionalSkill: Skill = {
        name: "python-linter",
        description: "Python linter",
        paths: ["*.py"],
      };

      registry.register(unconditionalSkill);
      registry.register(conditionalSkill);

      const unconditional = registry.getUnconditionalSkills();
      const conditional = registry.getConditionalSkills();

      assert.strictEqual(unconditional.length, 1);
      assert.strictEqual(conditional.length, 1);
      assert.strictEqual(unconditional[0]!.name, "general");
      assert.strictEqual(conditional[0]!.name, "python-linter");
    });
  });

  describe("activation", () => {
    it("should activate skills for matching paths", () => {
      const registry = new ConditionalSkillRegistry();

      const makefileSkill: Skill = {
        name: "makefile-help",
        description: "Makefile helper",
        paths: ["Makefile", "makefile"],
      };

      const pythonSkill: Skill = {
        name: "python-linter",
        description: "Python linter",
        paths: ["*.py"],
      };

      registry.register(makefileSkill);
      registry.register(pythonSkill);

      // Check initial state
      let active = registry.getActiveSkills();
      assert.strictEqual(active.length, 0, "No skills should be active initially");

      // Activate for Makefile
      registry.activateSkillsForFile("Makefile");
      active = registry.getActiveSkills();
      const activeNames = active.map((s) => s.name);
      assert.strictEqual(activeNames.includes("makefile-help"), true);
      assert.strictEqual(activeNames.includes("python-linter"), false);

      // Activate for Python file
      registry.activateSkillsForFile("script.py");
      active = registry.getActiveSkills();
      const newActiveNames = active.map((s) => s.name);
      assert.strictEqual(newActiveNames.includes("makefile-help"), true);
      assert.strictEqual(newActiveNames.includes("python-linter"), true);
    });

    it("should persist activation across file changes", () => {
      const registry = new ConditionalSkillRegistry();

      const makefileSkill: Skill = {
        name: "makefile-help",
        description: "Makefile helper",
        paths: ["Makefile"],
      };

      const pythonSkill: Skill = {
        name: "python-linter",
        description: "Python linter",
        paths: ["*.py"],
      };

      registry.register(makefileSkill);
      registry.register(pythonSkill);

      // Activate both skills
      registry.activateSkillsForFile("Makefile");
      registry.activateSkillsForFile("script.py");

      let active = registry.getActiveSkills();
      assert.strictEqual(active.length, 2);

      // Switch to a different file that doesn't match anything
      registry.activateSkillsForFile("README.md");

      // Skills should still be active
      active = registry.getActiveSkills();
      const activeNames = active.map((s) => s.name);
      assert.strictEqual(activeNames.includes("makefile-help"), true);
      assert.strictEqual(activeNames.includes("python-linter"), true);
    });
  });

  describe("statistics", () => {
    it("should report correct statistics", () => {
      const registry = new ConditionalSkillRegistry();

      const unconditionalSkills: Skill[] = [
        { name: "general", description: "General" },
        { name: "editor", description: "Editor" },
      ];

      const conditionalSkills: Skill[] = [
        { name: "python-linter", description: "Python", paths: ["*.py"] },
        { name: "ts-check", description: "TypeScript", paths: ["*.ts"] },
        { name: "makefile", description: "Makefile", paths: ["Makefile"] },
      ];

      for (const skill of unconditionalSkills) {
        registry.register(skill);
      }
      for (const skill of conditionalSkills) {
        registry.register(skill);
      }

      const stats = registry.getStats();
      assert.strictEqual(stats.total, 5);
      assert.strictEqual(stats.unconditional, 2);
      assert.strictEqual(stats.conditional, 3);
      assert.strictEqual(stats.active, 2); // Only unconditional are active initially

      // Activate some conditional skills
      registry.activateSkillsForFile("script.py");
      const updatedStats = registry.getStats();
      assert.strictEqual(updatedStats.active, 3); // 2 unconditional + 1 conditional
    });

    it("should report stats in expected format", () => {
      const registry = new ConditionalSkillRegistry();

      for (let i = 0; i < 10; i++) {
        registry.register({
          name: `unconditional-${i}`,
          description: "Unconditional",
        });
      }

      for (let i = 0; i < 20; i++) {
        registry.register({
          name: `conditional-${i}`,
          description: "Conditional",
          paths: ["*.py"],
        });
      }

      const stats = registry.getStats();
      const formatted = `${stats.total} total (${stats.unconditional} unconditional, ${stats.conditional} conditional) | ${stats.active} currently active`;
      assert.strictEqual(
        formatted,
        "30 total (10 unconditional, 20 conditional) | 10 currently active"
      );
    });
  });

  describe("query operations", () => {
    it("should query activation without activating", () => {
      const registry = new ConditionalSkillRegistry();

      registry.register({
        name: "makefile-help",
        description: "Makefile helper",
        paths: ["Makefile"],
      });

      registry.register({
        name: "python-linter",
        description: "Python linter",
        paths: ["*.py"],
      });

      // Query without activating
      const matches = registry.queryActivation("script.py");
      assert.deepStrictEqual(matches, ["python-linter"]);

      // Check that nothing was actually activated
      const active = registry.getActiveSkills();
      assert.strictEqual(active.length, 0);

      // Now activate and check
      registry.activateSkillsForFile("script.py");
      const now_active = registry.getActiveSkills();
      assert.strictEqual(now_active.length, 1);
    });

    it("should check if skill is active", () => {
      const registry = new ConditionalSkillRegistry();

      const unconditional = { name: "general", description: "General" };
      const conditional = {
        name: "python-linter",
        description: "Python",
        paths: ["*.py"],
      };

      registry.register(unconditional);
      registry.register(conditional);

      // Unconditional is always active
      assert.strictEqual(registry.isActive("general"), true);

      // Conditional is not active yet
      assert.strictEqual(registry.isActive("python-linter"), false);

      // Activate and check
      registry.activateSkillsForFile("script.py");
      assert.strictEqual(registry.isActive("python-linter"), true);

      // Non-existent skill
      assert.strictEqual(registry.isActive("non-existent"), false);
    });
  });

  describe("global singleton", () => {
    afterEach(() => {
      resetGlobalConditionalRegistry();
    });

    it("should provide global singleton instance", () => {
      const registry1 = getGlobalConditionalSkillRegistry();
      const registry2 = getGlobalConditionalSkillRegistry();

      assert.strictEqual(registry1, registry2);
    });

    it("should reset activation state", () => {
      const registry = getGlobalConditionalSkillRegistry();

      registry.register({
        name: "skill1",
        description: "Skill 1",
        paths: ["*.py"],
      });

      registry.activateSkillsForFile("script.py");
      assert.strictEqual(registry.getActiveSkills().length, 1);

      // Active conditional checks the activation set
      assert.strictEqual(registry.getActiveConditionalCount(), 1);

      registry.resetActivation();
      
      // After reset, activation is cleared
      const stats = registry.getStats();
      assert.strictEqual(stats.conditional, 1, "Skill should still be registered");
      assert.strictEqual(stats.active, 0, "No skills should be active after reset");
      assert.strictEqual(registry.getActiveConditionalCount(), 0);
    });
  });
});

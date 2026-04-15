/**
 * Skill Versioning & Dependency Resolver
 *
 * Implements semantic versioning (semver) parsing and dependency resolution,
 * including version range matching and conflict detection.
 *
 * **Semver Ranges Supported:**
 * - `1.0.0` - Exact version match
 * - `^1.0.0` - Caret: compatible with version (allows minor/patch updates)
 * - `~2.1.0` - Tilde: approximately equivalent version (allows patch updates)
 * - `>=1.0.0`, `>1.0.0` - Greater than / greater than or equal
 * - `<=1.0.0`, `<1.0.0` - Less than / less than or equal
 */

import type { Skill } from "./types.ts";

/**
 * Parsed semantic version
 */
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  /** Pre-release identifier (e.g., "alpha.1" in "1.0.0-alpha.1") */
  prerelease?: string;
  /** Build metadata (not considered in version precedence) */
  metadata?: string;
}

/**
 * Dependency resolution result
 */
export interface ResolvedDependency {
  skillName: string;
  requiredVersion: string;
  actualVersion?: string;
  isSatisfied: boolean;
  skill?: Skill;
  conflictReason?: string;
}

/**
 * Version conflict information
 */
export interface VersionConflict {
  skillName: string;
  version: string;
  conflictingDependents: Array<{
    skillName: string;
    requiredVersion: string;
  }>;
  message: string;
}

/**
 * Parse semantic version string into structured format
 *
 * **Examples:**
 * - "1.0.0" → { major: 1, minor: 0, patch: 0 }
 * - "1.2.3-alpha.1+build.123" → { major: 1, minor: 2, patch: 3, prerelease: 'alpha.1', metadata: 'build.123' }
 *
 * @param versionStr - Version string to parse
 * @returns Parsed SemanticVersion object
 * @throws Error if version string is invalid
 */
export function parseVersion(versionStr: string): SemanticVersion {
  const trimmed = versionStr.trim();

  // Extract metadata (after +)
  let metadata: string | undefined;
  const metadataIdx = trimmed.indexOf("+");
  const versionPart =
    metadataIdx !== -1 ? trimmed.slice(0, metadataIdx) : trimmed;
  if (metadataIdx !== -1) {
    metadata = trimmed.slice(metadataIdx + 1);
  }

  // Extract prerelease (after -)
  let prerelease: string | undefined;
  const prereleaseIdx = versionPart.indexOf("-");
  const numberPart =
    prereleaseIdx !== -1 ? versionPart.slice(0, prereleaseIdx) : versionPart;
  if (prereleaseIdx !== -1) {
    prerelease = versionPart.slice(prereleaseIdx + 1);
  }

  // Parse major.minor.patch
  const parts = numberPart.split(".");
  if (parts.length < 2 || parts.length > 3) {
    throw new Error(
      `Invalid semantic version: "${versionStr}". Expected format: major.minor[.patch][-prerelease][+metadata]`,
    );
  }

  const major = parseInt(parts[0] || "0", 10);
  const minor = parseInt(parts[1] || "0", 10);
  const patch = parseInt(parts[2] || "0", 10);

  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    throw new Error(
      `Invalid semantic version: "${versionStr}". Version numbers must be integers.`,
    );
  }

  return { major, minor, patch, prerelease, metadata };
}

/**
 * Compare two semantic versions
 *
 * Returns:
 * - -1 if version1 < version2
 * - 0 if version1 === version2
 * - 1 if version1 > version2
 *
 * Prerelease versions have lower precedence (e.g., 1.0.0-alpha < 1.0.0).
 *
 * @param version1 - First version to compare
 * @param version2 - Second version to compare
 * @returns Comparison result: -1, 0, or 1
 */
export function compareVersions(
  version1: SemanticVersion,
  version2: SemanticVersion,
): -1 | 0 | 1 {
  // Compare major.minor.patch
  if (version1.major !== version2.major) {
    return version1.major < version2.major ? -1 : 1;
  }
  if (version1.minor !== version2.minor) {
    return version1.minor < version2.minor ? -1 : 1;
  }
  if (version1.patch !== version2.patch) {
    return version1.patch < version2.patch ? -1 : 1;
  }

  // Versions with prerelease < versions without prerelease
  const has1 = version1.prerelease !== undefined;
  const has2 = version2.prerelease !== undefined;

  if (has1 !== has2) {
    return has1 ? -1 : 1;
  }

  // Compare prerelease versions lexicographically
  if (has1 && has2) {
    return version1.prerelease! < version2.prerelease! ? -1 : 1;
  }

  return 0;
}

/**
 * Check if actual version satisfies required version range
 *
 * **Range formats:**
 * - `^1.0.0` - Caret: allows changes that do not modify left-most non-zero digit
 *   - `^1.2.3` matches `>=1.2.3 <2.0.0`
 *   - `^0.2.3` matches `>=0.2.3 <0.3.0`
 *   - `^0.0.3` matches `>=0.0.3 <0.0.4`
 * - `~1.2.3` - Tilde: allows patch-level changes
 *   - `~1.2.3` matches `>=1.2.3 <1.3.0`
 * - `1.2.3` - Exact match
 * - `>=1.0.0`, `>1.0.0` - Greater than / greater than or equal
 * - `<=1.0.0`, `<1.0.0` - Less than / less than or equal
 *
 * @param actual - The actual version to check
 * @param required - The required version range
 * @returns true if actual version satisfies the range
 * @throws Error if version strings are invalid
 */
export function satisfiesDependency(actual: string, required: string): boolean {
  const actualVersion = parseVersion(actual);
  const trimmedRequired = required.trim();

  // Caret range: freezes left-most non-zero digit
  // ^1.2.3 → >=1.2.3 <2.0.0
  // ^0.2.3 → >=0.2.3 <0.3.0
  // ^0.0.3 → >=0.0.3 <0.0.4
  if (trimmedRequired.startsWith("^")) {
    const baseVersion = parseVersion(trimmedRequired.slice(1));
    const comparison = compareVersions(actualVersion, baseVersion);

    if (comparison < 0) return false; // actual < base

    // If actual > base, check if left-most non-zero digit is the same
    if (comparison === 1) {
      if (baseVersion.major !== 0) {
        // Major is non-zero: allow changes in minor/patch
        return actualVersion.major === baseVersion.major;
      } else if (baseVersion.minor !== 0) {
        // Major is 0, minor is non-zero: allow changes in patch only
        return (
          actualVersion.major === 0 && actualVersion.minor === baseVersion.minor
        );
      } else {
        // Major and minor are both 0: allow changes in... nothing (frozen at patch)
        return (
          actualVersion.major === 0 &&
          actualVersion.minor === 0 &&
          actualVersion.patch === baseVersion.patch
        );
      }
    }
    return true; // actual === base
  }

  // Tilde range: ~1.2.3 → >=1.2.3 <1.3.0
  if (trimmedRequired.startsWith("~")) {
    const baseVersion = parseVersion(trimmedRequired.slice(1));
    const comparison = compareVersions(actualVersion, baseVersion);

    if (comparison < 0) return false; // actual < base
    if (comparison === 1) {
      // actual > base, check if major.minor are the same
      return (
        actualVersion.major === baseVersion.major &&
        actualVersion.minor === baseVersion.minor
      );
    }
    return true; // actual === base
  }

  // >= range: >=1.2.3
  if (trimmedRequired.startsWith(">=")) {
    const baseVersion = parseVersion(trimmedRequired.slice(2));
    return compareVersions(actualVersion, baseVersion) >= 0;
  }

  // > range: >1.2.3
  if (trimmedRequired.startsWith(">")) {
    const baseVersion = parseVersion(trimmedRequired.slice(1));
    return compareVersions(actualVersion, baseVersion) > 0;
  }

  // <= range: <=1.2.3
  if (trimmedRequired.startsWith("<=")) {
    const baseVersion = parseVersion(trimmedRequired.slice(2));
    return compareVersions(actualVersion, baseVersion) <= 0;
  }

  // < range: <1.2.3
  if (trimmedRequired.startsWith("<")) {
    const baseVersion = parseVersion(trimmedRequired.slice(1));
    return compareVersions(actualVersion, baseVersion) < 0;
  }

  // Exact version match
  const requiredVersion = parseVersion(trimmedRequired);
  return compareVersions(actualVersion, requiredVersion) === 0;
}

/**
 * Resolve dependencies for a skill
 *
 * Looks up dependent skills in registry and checks if versions match.
 *
 * @param skill - Skill to resolve dependencies for
 * @param registry - Map of skill name to skill object
 * @returns Array of resolved dependencies with satisfaction status
 */
export function resolveDependencies(
  skill: Skill,
  registry: Map<string, Skill>,
): ResolvedDependency[] {
  if (!skill.dependencies) {
    return [];
  }

  const resolved: ResolvedDependency[] = [];

  for (const [depName, requiredVersion] of Object.entries(skill.dependencies)) {
    const depSkill = registry.get(depName);

    if (!depSkill) {
      resolved.push({
        skillName: depName,
        requiredVersion,
        isSatisfied: false,
        conflictReason: `Dependency skill "${depName}" not found in registry`,
      });
      continue;
    }

    const actualVersion = depSkill.version || "0.0.0";

    let isSatisfied = false;
    let conflictReason: string | undefined;

    try {
      isSatisfied = satisfiesDependency(actualVersion, requiredVersion);
      if (!isSatisfied) {
        conflictReason = `Version mismatch: required "${requiredVersion}", found "${actualVersion}"`;
      }
    } catch (error) {
      isSatisfied = false;
      conflictReason =
        error instanceof Error ? error.message : "Version parsing error";
    }

    resolved.push({
      skillName: depName,
      requiredVersion,
      actualVersion,
      isSatisfied,
      skill: depSkill,
      conflictReason,
    });
  }

  return resolved;
}

/**
 * Detect version conflicts in skill registry
 *
 * A conflict occurs when a skill depends on a version that's not available
 * or doesn't match the required range.
 *
 * @param registry - Map of skill name to skill object
 * @returns Array of detected conflicts
 */
export function detectVersionConflicts(
  registry: Map<string, Skill>,
): VersionConflict[] {
  const conflicts: VersionConflict[] = [];
  const processedSkills = new Set<string>();

  for (const [skillName, skill] of registry) {
    if (processedSkills.has(skillName)) {
      continue;
    }
    processedSkills.add(skillName);

    const resolvedDeps = resolveDependencies(skill, registry);
    const unsatisfiedDeps = resolvedDeps.filter((dep) => !dep.isSatisfied);

    if (unsatisfiedDeps.length > 0) {
      // Register a conflict for each unsatisfied dependency
      for (const unsatisfied of unsatisfiedDeps) {
        conflicts.push({
          skillName: unsatisfied.skillName,
          version: unsatisfied.actualVersion || "unknown",
          conflictingDependents: [
            {
              skillName,
              requiredVersion: unsatisfied.requiredVersion,
            },
          ],
          message: unsatisfied.conflictReason || "Dependency not satisfied",
        });
      }
    }
  }

  // Merge conflicts for the same skill
  const mergedConflicts = new Map<string, VersionConflict>();
  for (const conflict of conflicts) {
    const key = conflict.skillName;
    if (mergedConflicts.has(key)) {
      const existing = mergedConflicts.get(key)!;
      existing.conflictingDependents.push(...conflict.conflictingDependents);
    } else {
      mergedConflicts.set(key, { ...conflict });
    }
  }

  return Array.from(mergedConflicts.values());
}

/**
 * Format version for display
 *
 * @param version - Parsed semantic version
 * @returns Formatted version string
 */
export function formatVersion(version: SemanticVersion): string {
  let result = `${version.major}.${version.minor}.${version.patch}`;
  if (version.prerelease) {
    result += `-${version.prerelease}`;
  }
  if (version.metadata) {
    result += `+${version.metadata}`;
  }
  return result;
}

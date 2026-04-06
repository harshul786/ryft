import { gte as semverGte } from 'semver'
/** Wraps semver.gte — returns true if a >= b */
export function gte(a: string, b: string): boolean {
  return semverGte(a, b)
}

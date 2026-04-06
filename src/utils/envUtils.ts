/** Stub for claude-cli utils/envUtils */
export function isEnvTruthy(val: string | undefined): boolean {
  return val === "1" || val === "true" || val === "yes";
}

/** Stub for claude-cli utils/execFileNoThrow */
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function execFileNoThrow(
  file: string,
  args: string[],
  options?: { input?: string; timeout?: number; useCwd?: boolean },
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const result = await execFileAsync(file, args, {
      timeout: options?.timeout,
      input: options?.input,
    } as any);
    return {
      stdout: result.stdout as unknown as string,
      stderr: result.stderr as unknown as string,
      code: 0,
    };
  } catch (err: any) {
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      code: err.code ?? 1,
    };
  }
}

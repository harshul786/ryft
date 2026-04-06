import wrapAnsiNpm from "wrap-ansi";

type WrapAnsiOptions = {
  hard?: boolean;
  wordWrap?: boolean;
  trim?: boolean;
};

const wrapAnsiBun:
  | ((input: string, columns: number, options?: WrapAnsiOptions) => string)
  | null = null;

const wrapAnsi: (
  input: string,
  columns: number,
  options?: WrapAnsiOptions,
) => string = wrapAnsiBun ?? wrapAnsiNpm;

export { wrapAnsi };

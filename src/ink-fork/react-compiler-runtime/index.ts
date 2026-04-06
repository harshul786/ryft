// Stub for react/compiler-runtime — used by React Compiler compiled output.
// In non-Bun builds we fall back to a simple caching implementation.
export function c(size: number): Array<any> {
  return new Array(size).fill(Symbol("uninitialised"));
}

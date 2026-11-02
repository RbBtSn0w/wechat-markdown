/** JavaScript services may reject with values other than Error instances. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

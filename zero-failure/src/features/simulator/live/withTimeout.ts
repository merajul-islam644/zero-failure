// Race a promise against a deadline. The Blocks SDK takes no AbortSignal, so
// a hung call cannot be cancelled — the loser keeps running in the background
// and its eventual result (or rejection) is discarded.

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label = "operation"): Promise<T> {
  // A late rejection after the deadline would otherwise surface as an
  // unhandled rejection — swallow it; the race has already moved on.
  promise.catch(() => {});

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${timeoutMs} ms`)), timeoutMs);
  });

  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

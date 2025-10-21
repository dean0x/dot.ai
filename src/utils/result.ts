/**
 * Result type for explicit error handling
 * 
 * Replaces throw/catch with explicit Ok/Err returns.
 * Enables type-safe error handling and composition.
 */

export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Success variant
 */
export class Ok<T> {
  readonly ok = true as const;
  readonly error = undefined;

  constructor(readonly value: T) {}

  /**
   * Transform the success value
   */
  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Ok(fn(this.value));
  }

  /**
   * Chain another Result-returning operation
   */
  andThen<U, E>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  /**
   * Do nothing on Ok (used for error mapping)
   */
  mapErr<F>(_fn: (error: never) => F): Result<T, F> {
    return this as any;
  }

  /**
   * Unwrap the value (throws if Err)
   */
  unwrap(): T {
    return this.value;
  }

  /**
   * Unwrap or return default
   */
  unwrapOr(_defaultValue: T): T {
    return this.value;
  }

  /**
   * Match on Result
   */
  match<U>(handlers: { ok: (value: T) => U; err: (error: never) => U }): U {
    return handlers.ok(this.value);
  }
}

/**
 * Error variant
 */
export class Err<E> {
  readonly ok = false as const;
  readonly value = undefined;

  constructor(readonly error: E) {}

  /**
   * Do nothing on Err
   */
  map<U>(_fn: (value: never) => U): Result<U, E> {
    return this as any;
  }

  /**
   * Do nothing on Err
   */
  andThen<U, F>(_fn: (value: never) => Result<U, F>): Result<U, E> {
    return this as any;
  }

  /**
   * Transform the error
   */
  mapErr<F>(fn: (error: E) => F): Result<never, F> {
    return new Err(fn(this.error));
  }

  /**
   * Unwrap the value (throws if Err)
   */
  unwrap(): never {
    throw new Error(`Called unwrap() on Err: ${this.error}`);
  }

  /**
   * Unwrap or return default
   */
  unwrapOr<T>(defaultValue: T): T {
    return defaultValue;
  }

  /**
   * Match on Result
   */
  match<U>(handlers: { ok: (value: never) => U; err: (error: E) => U }): U {
    return handlers.err(this.error);
  }
}

/**
 * Type guard to check if Result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Type guard to check if Result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/**
 * Combine multiple Results into one
 * Returns Ok with array of values if all are Ok
 * Returns first Err if any are Err
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }
  return new Ok(values);
}

/**
 * Wrap a function that might throw into a Result
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  onError?: (error: unknown) => E
): Result<T, E> {
  try {
    return new Ok(fn());
  } catch (error) {
    const err = onError ? onError(error) : (error as E);
    return new Err(err);
  }
}

/**
 * Async version of tryCatch
 */
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
  onError?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return new Ok(value);
  } catch (error) {
    const err = onError ? onError(error) : (error as E);
    return new Err(err);
  }
}

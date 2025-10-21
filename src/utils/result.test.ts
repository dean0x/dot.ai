import { describe, it, expect } from 'vitest';
import { Ok, Err, isOk, isErr, all, tryCatch, tryCatchAsync, type Result } from './result';

describe('Result Type', () => {
  describe('Ok', () => {
    it('creates Ok with value', () => {
      const result = new Ok(42);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
      expect(result.error).toBeUndefined();
    });

    it('maps value', () => {
      const result = new Ok(10).map(x => x * 2);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(20);
      }
    });

    it('chains operations with andThen', () => {
      const divide = (x: number): Result<number, string> =>
        x === 0 ? new Err('Division by zero') : new Ok(100 / x);

      const result = new Ok(10).andThen(divide);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(10);
      }
    });

    it('unwraps value', () => {
      const result = new Ok(42);
      expect(result.unwrap()).toBe(42);
    });

    it('returns value with unwrapOr', () => {
      const result = new Ok(42);
      expect(result.unwrapOr(0)).toBe(42);
    });

    it('matches with ok handler', () => {
      const result = new Ok(42);
      const output = result.match({
        ok: (v) => `Value: ${v}`,
        err: (e) => `Error: ${e}`,
      });
      expect(output).toBe('Value: 42');
    });
  });

  describe('Err', () => {
    it('creates Err with error', () => {
      const result = new Err('Something went wrong');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Something went wrong');
      expect(result.value).toBeUndefined();
    });

    it('does not map value', () => {
      const result = new Err<string>('error').map(x => x * 2);
      expect(isErr(result)).toBe(true);
    });

    it('does not chain operations', () => {
      const result = new Err<string>('error').andThen((x: number) => new Ok(x * 2));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('error');
      }
    });

    it('maps error', () => {
      const result = new Err('error').mapErr(e => `Wrapped: ${e}`);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('Wrapped: error');
      }
    });

    it('throws on unwrap', () => {
      const result = new Err('error');
      expect(() => result.unwrap()).toThrow();
    });

    it('returns default with unwrapOr', () => {
      const result: Result<number, string> = new Err('error');
      expect(result.unwrapOr(0)).toBe(0);
    });

    it('matches with err handler', () => {
      const result = new Err('Something failed');
      const output = result.match({
        ok: (v) => `Value: ${v}`,
        err: (e) => `Error: ${e}`,
      });
      expect(output).toBe('Error: Something failed');
    });
  });

  describe('Type Guards', () => {
    it('isOk returns true for Ok', () => {
      const result: Result<number, string> = new Ok(42);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // TypeScript should know this is Ok<number>
        expect(result.value).toBe(42);
      }
    });

    it('isErr returns true for Err', () => {
      const result: Result<number, string> = new Err('error');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        // TypeScript should know this is Err<string>
        expect(result.error).toBe('error');
      }
    });
  });

  describe('all', () => {
    it('returns Ok with all values when all Ok', () => {
      const results = [new Ok(1), new Ok(2), new Ok(3)];
      const combined = all(results);
      expect(isOk(combined)).toBe(true);
      if (isOk(combined)) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it('returns first Err when any Err', () => {
      const results = [new Ok(1), new Err('error'), new Ok(3)];
      const combined = all(results);
      expect(isErr(combined)).toBe(true);
      if (isErr(combined)) {
        expect(combined.error).toBe('error');
      }
    });
  });

  describe('tryCatch', () => {
    it('catches exceptions and returns Err', () => {
      const result = tryCatch(() => {
        throw new Error('Something failed');
      });
      expect(isErr(result)).toBe(true);
    });

    it('returns Ok for successful execution', () => {
      const result = tryCatch(() => 42);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('uses custom error mapper', () => {
      const result = tryCatch(
        () => {
          throw new Error('Original error');
        },
        (e) => `Wrapped: ${e}`
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toContain('Wrapped:');
      }
    });
  });

  describe('tryCatchAsync', () => {
    it('catches async exceptions and returns Err', async () => {
      const result = await tryCatchAsync(async () => {
        throw new Error('Async failed');
      });
      expect(isErr(result)).toBe(true);
    });

    it('returns Ok for successful async execution', async () => {
      const result = await tryCatchAsync(async () => 42);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });
  });

  describe('Composition', () => {
    it('chains multiple operations', () => {
      const double = (x: number) => new Ok(x * 2);
      const toString = (x: number) => new Ok(x.toString());

      const result = new Ok(5)
        .andThen(double)
        .andThen(toString);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('10');
      }
    });

    it('short-circuits on first error', () => {
      const double = (x: number) => new Ok(x * 2);
      const fail = (_x: number): Result<number, string> => new Err('Failed');
      const toString = (x: number) => new Ok(x.toString());

      const result = new Ok(5)
        .andThen(double)
        .andThen(fail);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('Failed');
      }

      // Verify toString is never called (error short-circuits)
      const resultWithToString = result.andThen(toString);
      expect(isErr(resultWithToString)).toBe(true);
    });
  });
});

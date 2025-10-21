/**
 * Real hash computation using crypto
 */

import { createHash } from 'crypto';
import { Hasher } from './interfaces';

export class CryptoHasher implements Hasher {
  hash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}

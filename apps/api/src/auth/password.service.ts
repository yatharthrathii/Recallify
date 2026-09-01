import { Injectable } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';

/**
 * Password hashing with argon2id.
 *
 * bcrypt only costs an attacker CPU time. Argon2id is deliberately
 * memory-hungry as well, and memory is the scarce resource on the GPUs that
 * make bulk cracking cheap -- so the same budget buys far fewer guesses.
 *
 * These parameters follow the current OWASP guidance: 19 MiB of memory, two
 * passes, one lane.
 */
const OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain, OPTIONS);
  }

  /**
   * Returns false rather than throwing on a malformed stored hash, so a
   * corrupted row is a failed sign-in rather than a 500 that tells an attacker
   * they found something interesting.
   */
  async verify(storedHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(storedHash, plain, OPTIONS);
    } catch {
      return false;
    }
  }
}

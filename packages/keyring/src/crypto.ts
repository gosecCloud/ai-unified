/**
 * Cryptographic operations using XChaCha20-Poly1305 AEAD (equivalent security to AES-256-GCM)
 */

// @ts-ignore - No types available for sodium-native
import sodium from 'sodium-native';
import { encryptionError } from '@aiu/core';

const NONCE_LENGTH = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
const KEY_LENGTH = sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES;

/**
 * Generate a new encryption key
 */
export function generateKey(): Buffer {
  const key = Buffer.allocUnsafe(KEY_LENGTH);
  sodium.crypto_aead_xchacha20poly1305_ietf_keygen(key);
  return key;
}

/**
 * Encrypt plaintext with associated data
 */
export function encrypt(plaintext: string, key: Buffer, associatedData?: string): string {
  try {
    if (key.length !== KEY_LENGTH) {
      throw new Error(`Key must be ${KEY_LENGTH} bytes`);
    }

    const plaintextBuf = Buffer.from(plaintext, 'utf8');
    const nonce = Buffer.allocUnsafe(NONCE_LENGTH);
    sodium.randombytes_buf(nonce);

    const ciphertext = Buffer.allocUnsafe(
      plaintextBuf.length + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES
    );

    const ad = associatedData ? Buffer.from(associatedData, 'utf8') : null;

    sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      ciphertext,
      plaintextBuf,
      ad,
      null,
      nonce,
      key
    );

    // Combine nonce + ciphertext and encode as base64
    const combined = Buffer.concat([nonce, ciphertext]);
    return combined.toString('base64');
  } catch (error) {
    throw encryptionError('Failed to encrypt data', error as Error);
  }
}

/**
 * Decrypt ciphertext with associated data
 */
export function decrypt(ciphertext: string, key: Buffer, associatedData?: string): string {
  try {
    if (key.length !== KEY_LENGTH) {
      throw new Error(`Key must be ${KEY_LENGTH} bytes`);
    }

    const combined = Buffer.from(ciphertext, 'base64');

    if (combined.length < NONCE_LENGTH) {
      throw new Error('Invalid ciphertext: too short');
    }

    const nonce = combined.subarray(0, NONCE_LENGTH);
    const ciphertextBuf = combined.subarray(NONCE_LENGTH);

    const plaintext = Buffer.allocUnsafe(
      ciphertextBuf.length - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES
    );

    const ad = associatedData ? Buffer.from(associatedData, 'utf8') : null;

    const result = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      plaintext,
      null,
      ciphertextBuf,
      ad,
      nonce,
      key
    );

    if (!result) {
      throw new Error('Decryption failed: invalid ciphertext or key');
    }

    return plaintext.toString('utf8');
  } catch (error) {
    throw encryptionError('Failed to decrypt data', error as Error);
  }
}

/**
 * Derive a key from a password using Argon2id
 */
export function deriveKeyFromPassword(password: string, salt?: Buffer): { key: Buffer; salt: Buffer } {
  try {
    const actualSalt = salt || Buffer.allocUnsafe(sodium.crypto_pwhash_SALTBYTES);
    if (!salt) {
      sodium.randombytes_buf(actualSalt);
    }

    const key = Buffer.allocUnsafe(KEY_LENGTH);

    sodium.crypto_pwhash(
      key,
      Buffer.from(password, 'utf8'),
      actualSalt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    return { key, salt: actualSalt };
  } catch (error) {
    throw encryptionError('Failed to derive key from password', error as Error);
  }
}

/**
 * Securely compare two strings in constant time
 */
export function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  if (bufA.length !== bufB.length) {
    return false;
  }

  return sodium.sodium_memcmp(bufA, bufB);
}

/**
 * Securely zero out a buffer
 */
export function secureZero(buffer: Buffer): void {
  sodium.sodium_memzero(buffer);
}

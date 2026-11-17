import crypto from 'node:crypto';

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const SCRYPT_COST = 16384; // N = 2^14
const SCRYPT_BLOCK_SIZE = 8; // r
const SCRYPT_PARALLELIZATION = 1; // p

function deriveKey(
  password: string,
  salt: string,
  cost: number,
  blockSize: number,
  parallelization: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: cost, r: blockSize, p: parallelization },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

/**
 * Gera um hash seguro da senha usando scrypt com salt criptográfico aleatório.
 * Formato armazenado: scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = await deriveKey(
    password,
    salt,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
  );

  return [
    'scrypt',
    String(SCRYPT_COST),
    String(SCRYPT_BLOCK_SIZE),
    String(SCRYPT_PARALLELIZATION),
    salt,
    derivedKey.toString('hex'),
  ].join('$');
}

/**
 * Compara a senha em texto puro com o hash armazenado usando comparação em tempo constante.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);
  const salt = parts[4];
  const expectedHex = parts[5];

  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelization) ||
    !salt ||
    !expectedHex
  ) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedHex, 'hex');
  const derivedBuffer = await deriveKey(password, salt, cost, blockSize, parallelization);

  if (derivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedBuffer, expectedBuffer);
}

import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// Comparação "falsa" para equalizar o tempo de resposta quando o e-mail não
// existe (evita enumeração de contas por timing).
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(plain: string) {
  dummyHash ??= bcrypt.hash("umbra-timing-equalizer", ROUNDS);
  await bcrypt.compare(plain, await dummyHash);
}

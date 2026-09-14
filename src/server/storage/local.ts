import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ObjectRange, StorageProvider } from "./types";

/**
 * Armazenamento em disco FORA da pasta pública. Nenhum arquivo é acessível
 * diretamente por URL: tudo passa por /api/media/*, que verifica autorização.
 */
export class LocalStorage implements StorageProvider {
  readonly name = "local" as const;
  private base: string;

  constructor(dir: string) {
    this.base = path.resolve(process.cwd(), dir);
  }

  private resolve(key: string) {
    const full = path.resolve(this.base, key);
    if (!full.startsWith(this.base + path.sep)) throw new Error("Chave de armazenamento inválida");
    return full;
  }

  async putFile(key: string, filePath: string) {
    const dest = this.resolve(key);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fsp.rename(filePath, dest);
    } catch {
      await fsp.copyFile(filePath, dest); // rename falha entre discos diferentes
      await fsp.unlink(filePath).catch(() => {});
    }
  }

  async putBuffer(key: string, data: Buffer) {
    const dest = this.resolve(key);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, data);
  }

  async delete(key: string) {
    await fsp.unlink(this.resolve(key)).catch(() => {});
  }

  async size(key: string) {
    return (await fsp.stat(this.resolve(key))).size;
  }

  async read(key: string, range?: ObjectRange) {
    const full = this.resolve(key);
    const size = (await fsp.stat(full)).size;
    const start = range?.start ?? 0;
    const end = Math.min(range?.end ?? size - 1, size - 1);
    const nodeStream = fs.createReadStream(full, { start, end });
    return { body: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, size, start, end };
  }

  async presignedUrl() {
    return null;
  }

  publicUrl() {
    return null;
  }

  async createDirectUpload() {
    return null; // upload em streaming pela própria aplicação
  }
}

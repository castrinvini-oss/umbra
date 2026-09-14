export type ObjectRange = { start: number; end: number };

export type ObjectStream = {
  body: ReadableStream<Uint8Array>;
  size: number; // tamanho total do objeto
  start: number;
  end: number;
};

export type DirectUpload = {
  /** URL para o navegador enviar o arquivo diretamente ao storage (PUT). */
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

/**
 * Contrato de armazenamento. Para adicionar um provedor (GCS, Azure Blob...),
 * implemente esta interface e registre-o em storage/index.ts.
 */
export interface StorageProvider {
  readonly name: "local" | "s3" | "supabase";
  /** Envia um arquivo do disco (usado após o upload em streaming ser validado). */
  putFile(key: string, filePath: string, contentType: string): Promise<void>;
  putBuffer(key: string, data: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Leitura com suporte a Range (streaming de vídeo, inspeção dos primeiros bytes). */
  read(key: string, range?: ObjectRange): Promise<ObjectStream>;
  size(key: string): Promise<number>;
  /** URL temporária direta do provedor. Local retorna null → servido pela app. */
  presignedUrl(key: string, ttlSeconds: number, contentType: string): Promise<string | null>;
  /** URL pública via CDN, apenas para chaves públicas (public/ e blur/). */
  publicUrl(key: string): string | null;
  /**
   * Upload direto do navegador ao storage (sem passar pela função serverless,
   * que na Vercel limita o corpo a 4,5 MB). null = usar o upload via servidor.
   */
  createDirectUpload(key: string, contentType: string): Promise<DirectUpload | null>;
}

/** Chaves com prefixo public/ ou blur/ podem ser servidas publicamente. */
export const isPublicKey = (key: string) => key.startsWith("public/") || key.startsWith("blur/");

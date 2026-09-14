import fs from "node:fs";
import fsp from "node:fs/promises";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isPublicKey, type DirectUpload, type ObjectRange, type StorageProvider } from "./types";

type S3Config = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicCdnUrl: string;
};

/**
 * Compatível com AWS S3, Cloudflare R2, Backblaze B2, Wasabi e MinIO.
 * O bucket deve ser PRIVADO. Mídia premium é entregue por URL pré-assinada
 * gerada somente após canAccessContent().
 */
export class S3Storage implements StorageProvider {
  readonly name = "s3" as const;
  private client: S3Client;

  constructor(private cfg: S3Config) {
    if (!cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
      throw new Error("Configure S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY para usar STORAGE_DRIVER=s3");
    }
    this.client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }

  async putFile(key: string, filePath: string, contentType: string) {
    const { size } = await fsp.stat(filePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: fs.createReadStream(filePath),
        ContentLength: size,
        ContentType: contentType,
      }),
    );
    await fsp.unlink(filePath).catch(() => {});
  }

  async putBuffer(key: string, data: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: data, ContentType: contentType }));
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key })).catch(() => {});
  }

  async size(key: string) {
    const head = await this.client.send(new HeadObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
    return head.ContentLength ?? 0;
  }

  async read(key: string, range?: ObjectRange) {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }),
    );
    const total = res.ContentRange ? Number(res.ContentRange.split("/")[1]) : (res.ContentLength ?? 0);
    const start = range?.start ?? 0;
    const end = start + (res.ContentLength ?? total) - 1;
    return { body: res.Body!.transformToWebStream() as ReadableStream<Uint8Array>, size: total, start, end };
  }

  async presignedUrl(key: string, ttlSeconds: number, contentType: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key, ResponseContentType: contentType }),
      { expiresIn: ttlSeconds },
    );
  }

  publicUrl(key: string) {
    return this.cfg.publicCdnUrl && isPublicKey(key) ? `${this.cfg.publicCdnUrl}/${key}` : null;
  }

  async createDirectUpload(key: string, contentType: string): Promise<DirectUpload> {
    const url = await getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, ContentType: contentType }), {
      expiresIn: 2 * 3600,
    });
    return { url, method: "PUT", headers: { "content-type": contentType } };
  }
}

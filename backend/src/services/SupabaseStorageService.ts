import crypto from 'crypto';
import { throwError } from '@utils/helpers';

function requiredEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim() || fallback;
  if (!value) {
    throwError('STORAGE_CONFIG_ERROR', `${name} nao configurado`, 500);
    throw new Error(`${name} nao configurado`);
  }
  return value;
}

function encodeS3PathPart(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hashHex(value: crypto.BinaryLike) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key: crypto.BinaryLike, value: string) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function s3SigningKey(secret: string, dateStamp: string, region: string) {
  const dateKey = hmac(`AWS4${secret}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}

type UploadOptions = {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
};

export async function uploadToSupabaseStorage({ bucket, key, body, contentType }: UploadOptions) {
  const supabaseUrl = requiredEnv('SUPABASE_URL', 'https://kabftbmncilygvpcyazc.supabase.co').replace(/\/+$/, '');
  const accessKeyId = requiredEnv('SUPABASE_S3_ACCESS_KEY_ID');
  const secretAccessKey = requiredEnv('SUPABASE_S3_SECRET_ACCESS_KEY');
  const region = requiredEnv('SUPABASE_S3_REGION', 'us-east-1');
  const endpoint = new URL(supabaseUrl);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hashHex(body);
  const canonicalUri = `/storage/v1/s3/${encodeS3PathPart(bucket)}/${key
    .split('/')
    .map(encodeS3PathPart)
    .join('/')}`;
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${endpoint.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n');
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', canonicalUri, '', `${canonicalHeaders}\n`, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hashHex(canonicalRequest)].join('\n');
  const signature = crypto
    .createHmac('sha256', s3SigningKey(secretAccessKey, dateStamp, region))
    .update(stringToSign)
    .digest('hex');

  const response = await fetch(`${supabaseUrl}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body,
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    throwError('STORAGE_UPLOAD_ERROR', `Upload falhou: HTTP ${response.status} ${responseBody}`, 500);
  }

  return `${supabaseUrl}/storage/v1/object/public/${encodeS3PathPart(bucket)}/${key
    .split('/')
    .map(encodeS3PathPart)
    .join('/')}`;
}

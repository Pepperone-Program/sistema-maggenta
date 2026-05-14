import { Request, Response, NextFunction } from 'express';

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'https://site-peppeerone.vercel.app',
  'https://sistema-pepperone.vercel.app',
];

export function allowedCorsOrigins() {
  const envOrigins = [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));
}

export const corsMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  const origin = _req.headers.origin;
  const allowedOrigins = allowedCorsOrigins();

  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (_req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
};

export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });

  next();
};

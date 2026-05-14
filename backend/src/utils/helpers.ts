import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type { AuthPayload } from '@/types/usuario';
import type { SignOptions } from 'jsonwebtoken';
export { comparePassword, hashPassword } from './password';

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';

export const generateToken = (payload: AuthPayload): string => {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRE as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const generateNonExpiringToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, JWT_SECRET);
};

export const verifyToken = (token: string): AuthPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const generateUUID = (): string => {
  return uuidv4();
};

export const formatDate = (date?: Date): string => {
  return (date || new Date()).toISOString().split('T')[0];
};

export const formatDateTime = (date?: Date): string => {
  const d = date || new Date();
  return d.toISOString().replace('T', ' ').substring(0, 19);
};

export const parseQueryString = (input: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const params = new URLSearchParams(input);
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

export const throwError = (
  code: string,
  message: string,
  statusCode: number = 400
): never => {
  const error = new Error(message) as any;
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

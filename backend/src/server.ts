import './module-alias';
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from '@routes/index';
import { allowedCorsOrigins, corsMiddleware, securityHeaders, requestLogger } from '@middleware/common';
import { errorHandler, notFoundHandler } from '@middleware/error';
import { closeDatabasePool, testDatabaseConnection } from '@database/connection';

dotenv.config();

const app: Express = express();

// Middleware de segurança
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins().includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origem nao permitida pelo CORS'));
  },
  credentials: true,
}));

// Middleware de headers customizados
app.use(corsMiddleware);
app.use(securityHeaders);

// Middleware para parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logger
app.use(requestLogger);

// Rotas
app.use(routes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

const bootstrap = async (): Promise<void> => {
  try {
    await testDatabaseConnection();
  } catch (error) {
    console.warn(
      'Database startup check failed; server will keep running and retry on requests:',
      error instanceof Error ? error.message : String(error)
    );
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} signal received: closing HTTP server`);
    server.close(async () => {
      console.log('HTTP server closed');
      await closeDatabasePool();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

bootstrap().catch((error) => {
  console.error('❌ Falha ao iniciar servidor:', error.message);
  process.exit(1);
});

export default app;

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index';
import { requestLogger } from './middleware/requestLogger.middleware';
import { generalLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import { mountRoutes } from './routes/index';

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Cookie parser
app.use(cookieParser());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// General rate limiter
app.use(generalLimiter);

// Mount all routes
mountRoutes(app);

// 404 handler for unmatched routes
app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    code: 'NOT_FOUND',
  });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;

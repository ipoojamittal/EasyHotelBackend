
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import mongoose from 'mongoose';

const handleDevelopmentError = (err: Error | AppError, res: Response) => {
    const statusCode = err instanceof AppError ? err.statusCode : 500;
res.status(statusCode).json({
        status: err instanceof AppError && statusCode < 500 ? 'fail' : 'error', // 'fail' for operational client errors (4xx), 'error' for server errors (500+)
        message: err.message,
        error: err,
        stack: err.stack,
    });
};

const handleProductionError = (err: Error | AppError, res: Response) => {
    // --- Handle Specific Known Error Types ---

    if (err instanceof mongoose.Error.CastError) {
        const message = `Invalid ${err.path}: ${err.value}.`;
        return res.status(400).json({ // 400 Bad Request
            status: 'fail',
            message: message,
        });
    }

    if ((err as any).code === 11000) {
        const value = (err.message.match(/(["'])(\\?.)*?\1/) || [])[0];
        const message = `Duplicate field value: ${value}. Please use another value!`;
        return res.status(409).json({ // 409 Conflict
            status: 'fail',
            message: message,
        });
    }

      if (err instanceof mongoose.Error.ValidationError) {
        const errors = Object.values(err.errors).map(el => el.message);
        const message = `Invalid input data. ${errors.join('. ')}`;
        return res.status(400).json({
            status: 'fail',
            message: message,
        });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ status: 'fail', message: 'Invalid token. Please log in again.' });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ status: 'fail', message: 'Your token has expired. Please log in again.' });
    }


     if (err instanceof AppError && err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.statusCode < 500 ? 'fail' : 'error',
            message: err.message,
        });
    }

    console.error(' UNEXPECTED ERROR:', err);

    return res.status(500).json({
        status: 'error',
        message: 'Something went very wrong! Please try again later.', // Generic message
    });
};

const globalErrorHandler = (err: Error | AppError, req: Request, res: Response, next: NextFunction) => {
    (err as any).statusCode = (err as any).statusCode || 500;
    (err as any).status = (err as any).status || 'error';
    if (process.env.NODE_ENV === 'development') {
        handleDevelopmentError(err, res);
    } else if (process.env.NODE_ENV === 'production') {
         handleProductionError(err, res); // Pass the original error
    } else {
        handleProductionError(err, res);
    }
};

export default globalErrorHandler;

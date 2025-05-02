

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}

export class NotFoundError extends AppError {

    constructor(message = 'Resource not found') {

        super(message, 404);
    }
}

export class ConflictError extends AppError {

    constructor(message = 'Resource conflict') {
        super(message, 409);
    }
}


export class UnauthorizedError extends AppError {

    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}

export class BadRequestError extends AppError {

    constructor(message = 'Bad Request') {
        super(message, 400);
    }
}


export class ForbiddenError extends AppError {

    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}


export class ValidationError extends AppError {
    public readonly errors: any;

    constructor(message = 'Validation Failed', errors: any) {
        super(message, 400);
        this.errors = errors;
        }
}

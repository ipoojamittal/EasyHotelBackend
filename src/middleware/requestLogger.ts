// src/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import http from 'http'; // Import the 'http' module for status codes text

// ANSI Color Codes for terminal output
const colors = {
    reset: "\x1b[0m",
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    brightBlack: "\x1b[90m",
    brightRed: "\x1b[91m",
    brightGreen: "\x1b[92m",
    brightYellow: "\x1b[93m",
    brightBlue: "\x1b[94m",
    brightMagenta: "\x1b[95m",
    brightCyan: "\x1b[96m",
    brightWhite: "\x1b[97m",
};

/**
 * Gets a color based on the HTTP method.
 */
const getMethodColor = (method: string): string => {
    switch (method.toUpperCase()) {
        case 'GET':
            return colors.brightGreen;
        case 'POST':
            return colors.brightYellow;
        case 'PUT':
        case 'PATCH':
            return colors.brightBlue;
        case 'DELETE':
            return colors.brightRed;
        default:
            return colors.brightCyan;
    }
};

/**
 * Gets a color based on the HTTP status code range.
 */
const getStatusColor = (statusCode: number): string => {
    if (statusCode >= 500) return colors.brightRed;
    if (statusCode >= 400) return colors.brightYellow;
    if (statusCode >= 300) return colors.brightCyan;
    if (statusCode >= 200) return colors.brightGreen;
    return colors.reset;
};

/**
 * Gets the standard HTTP status text for a given code.
 */
const getStatusText = (statusCode: number): string => {
    // Use Node's built-in http.STATUS_CODES for standard messages
    return http.STATUS_CODES[statusCode] || 'Unknown Status';
};


/**
 * Logs incoming requests and their processing time with color coding.
 */
const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime();
    const { method, url, ip } = req;

    const methodColor = getMethodColor(method);
    const coloredMethod = `${methodColor}${method}${colors.reset}`;

    // Log when the response finishes sending
    res.on('finish', () => {
        const durationInMilliseconds = getDurationInMilliseconds(start);
        const { statusCode } = res;
        const statusColor = getStatusColor(statusCode);
        const statusText = getStatusText(statusCode); // Get the status text

        // Combine status code and text, applying the color
        const coloredStatus = `${statusColor}${statusCode} ${statusText}${colors.reset}`;

        // Log format: METHOD URL StatusCode StatusText Duration ms - IP Address (with colors)
        console.log(`${coloredMethod} ${url} ${coloredStatus} ${durationInMilliseconds.toLocaleString()} ms - ${ip}`);
    });

    // Log when the connection is closed prematurely
    res.on('close', () => {
        if (!res.writableEnded) {
            const durationInMilliseconds = getDurationInMilliseconds(start);
            // Keep CLOSED status distinct, maybe magenta
            const closedStatus = `${colors.brightMagenta}CLOSED${colors.reset}`;
            console.log(`${coloredMethod} ${url} ${closedStatus} ${durationInMilliseconds.toLocaleString()} ms - ${ip}`);
        }
    });

    next();
};

/**
 * Calculates the duration in milliseconds from a high-resolution start time.
 */
const getDurationInMilliseconds = (start: [number, number]): number => {
    const NS_PER_SEC = 1e9;
    const NS_TO_MS = 1e6;
    const diff = process.hrtime(start);
    return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS;
};

export default requestLogger;

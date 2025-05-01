import { Request, Response, NextFunction } from 'express';
import { Role, IUser } from '../models/User'; // Adjust path if necessary

export const checkRole = (allowedRoles: Role[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user as IUser; // Cast to IUser for type safety
        if (!user || !user.role) {
            return res.status(403).json({ message: 'Forbidden: User role information is missing or user not properly authenticated.' });
        }
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ message: `Forbidden: Access denied. Required roles: ${allowedRoles.join(', ')}.` });
        }
        next();
    };
};

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import dotenv from 'dotenv';
import User, { IUser } from '../models/User';

dotenv.config();

// Fail fast if JWT_SECRET is missing — never fall back to an insecure default.
const jwtSecret = process.env.JWT_SECRET || (() => {
    throw new Error('FATAL: JWT_SECRET is not defined in environment variables.');
})();

passport.use(new LocalStrategy(
    {
        usernameField: 'email',
        passwordField: 'password'
    },
    async (email, password, done) => {
        try {
            // Exclude soft-deleted users from logging in.
            const user: IUser | null = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
            if (!user) {
                return done(null, false, { message: 'Incorrect username or password.' });
            }
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return done(null, false, { message: 'Incorrect username or password.' });
            }
            return done(null, user);
        } catch (err) {
            console.error('config/passport.ts: Error in LocalStrategy:', err);
            return done(err);
        }
    }
));

const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtSecret,
};

passport.use(new JwtStrategy(jwtOptions,
    async (jwt_payload, done) => {
        try {
            // Exclude soft-deleted users from authenticating via JWT.
            const user: IUser | null = await User.findOne({ _id: jwt_payload.id, isDeleted: false });

            if (user) {
                return done(null, user);
            } else {
                return done(null, false);
            }
        } catch (err) {
            console.error('config/passport.ts: Error in JwtStrategy:', err);
            return done(err, false);
        }
    }
));

// --- Session Serialization/Deserialization --- (REMOVED SECTION)
// Why Removed: These functions (`passport.serializeUser`, `passport.deserializeUser`) are necessary ONLY for session-based authentication (where user ID is stored in a server-side session). With stateless JWTs, the user is identified and loaded from the DB on each request via the JWT strategy, making sessions and serialization redundant.
// What if not Removed: They would be unused code. If sessions were accidentally enabled elsewhere in Express, they might interfere or cause unexpected behavior.

// --- Password Hashing Helper --- (REMOVED SECTION)
// Why Removed: Password hashing is handled by the Mongoose `pre-save` hook in the User model, and password comparison is handled by the `comparePassword` method on the User model. This encapsulates the logic correctly within the model.
// What if not Removed: It would represent unused code or a duplication of logic already present (and better placed) in the User model.
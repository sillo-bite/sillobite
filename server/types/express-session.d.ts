import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string | number;
      role?: string;
      [key: string]: unknown;
    };
    googleUser?: {
      id: string;
      email: string;
      name: string;
      picture?: string;
      emailVerified?: boolean;
    };
  }
}

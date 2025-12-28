import 'express-session';

declare module 'express-session' {
  interface SessionData {
    googleUser?: {
      id: string;
      email: string;
      name: string;
      picture?: string;
      emailVerified?: boolean;
    };
  }
}

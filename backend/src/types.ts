export interface Env {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_WEB_API_KEY: string;
  ADMIN_FIREBASE_UID?: string;
  ALLOWED_ORIGINS: string;
  BUSINESS_TIMEZONE?: string;
}
export interface Identity {
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
}
export interface Actor extends Identity {
  admin: boolean;
  status: string;
  version: number;
}
export type Row = Record<string, any>;

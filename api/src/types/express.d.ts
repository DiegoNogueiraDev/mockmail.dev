// express.d.ts
import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

declare global {
  namespace Express {
    interface Request {
      user?:
        | {
            id: string;
            email?: string;
            iat?: number;
            exp?: number;
          }
        | JwtPayload;
    }
  }
}

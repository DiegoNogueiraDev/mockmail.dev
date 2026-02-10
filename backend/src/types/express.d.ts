// express.d.ts
import { Request } from "express";
import { IUser } from "../models/User";

export interface AuthenticatedRequest extends Request {
  user?: IUser | Record<string, any>;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser | Record<string, any>;
    }
  }
}

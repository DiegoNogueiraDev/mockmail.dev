import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  getProfile,
  updateProfile,
  changePassword,
  getPasswordRequirements,
} from "../controllers/profile.controller";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get password requirements (before profile routes, no auth needed display requirements)
router.get("/password-requirements", getPasswordRequirements);

// Get current user profile with stats
router.get("/", getProfile);

// Update profile (name)
router.put("/", updateProfile);

// Change password
router.post("/change-password", changePassword);

export default router;

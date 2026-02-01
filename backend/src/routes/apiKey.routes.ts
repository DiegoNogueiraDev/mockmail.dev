import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  listApiKeys,
  getApiKey,
  createApiKeyHandler,
  updateApiKeyHandler,
  revokeApiKeyHandler,
  deleteApiKeyHandler,
  getAvailablePermissions,
} from "../controllers/apiKey.controller";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get available permissions (before /:id routes)
router.get("/permissions", getAvailablePermissions);

// List all API keys
router.get("/", listApiKeys);

// Get single API key
router.get("/:id", getApiKey);

// Create API key
router.post("/", createApiKeyHandler);

// Update API key
router.put("/:id", updateApiKeyHandler);

// Revoke API key (soft delete)
router.post("/:id/revoke", revokeApiKeyHandler);

// Delete API key (permanent)
router.delete("/:id", deleteApiKeyHandler);

export default router;

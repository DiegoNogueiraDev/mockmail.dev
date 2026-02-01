import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  listWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  regenerateSecret,
  getDeliveries,
  getAvailableEvents,
} from "../controllers/webhook.controller";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get available events (before /:id routes)
router.get("/events", getAvailableEvents);

// List all webhooks
router.get("/", listWebhooks);

// Get single webhook
router.get("/:id", getWebhook);

// Create webhook
router.post("/", createWebhook);

// Update webhook
router.put("/:id", updateWebhook);

// Delete webhook
router.delete("/:id", deleteWebhook);

// Test webhook
router.post("/:id/test", testWebhook);

// Regenerate secret
router.post("/:id/regenerate-secret", regenerateSecret);

// Get delivery history
router.get("/:id/deliveries", getDeliveries);

export default router;

import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { strictLimiter } from "../middlewares/rateLimiter";
import {
  listWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  regenerateSecret,
  getDeliveries,
  retryDelivery,
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

// Create webhook (rate limited)
router.post("/", strictLimiter, createWebhook);

// Update webhook (rate limited)
router.put("/:id", strictLimiter, updateWebhook);

// Delete webhook (rate limited)
router.delete("/:id", strictLimiter, deleteWebhook);

// Test webhook (rate limited)
router.post("/:id/test", strictLimiter, testWebhook);

// Regenerate secret (rate limited)
router.post("/:id/regenerate-secret", strictLimiter, regenerateSecret);

// Get delivery history
router.get("/:id/deliveries", getDeliveries);

// Retry a failed delivery
router.post("/:id/deliveries/:deliveryId/retry", strictLimiter, retryDelivery);

export default router;

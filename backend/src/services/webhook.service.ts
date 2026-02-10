import crypto from "crypto";
import Webhook, { IWebhook, WebhookEvent, WebhookStatus } from "../models/Webhook";
import WebhookDelivery from "../models/WebhookDelivery";
import logger from "../utils/logger";

import dns from "dns/promises";
import net from "net";

/**
 * Blocked IP ranges for SSRF protection.
 * Validates resolved IPs at delivery time to prevent DNS rebinding attacks.
 */
const BLOCKED_IP_PATTERNS = [
  /^127\./,                    // Loopback IPv4
  /^10\./,                     // Private Class A
  /^172\.(1[6-9]|2\d|3[01])\./, // Private Class B
  /^192\.168\./,               // Private Class C
  /^169\.254\./,               // Link-local / Cloud metadata
  /^0\./,                      // Current network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Carrier-grade NAT
  /^198\.1[89]\./,             // Benchmarking
  /^::1$/,                     // Loopback IPv6
  /^fc00:/i,                   // Unique local IPv6
  /^fe80:/i,                   // Link-local IPv6
  /^::ffff:(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/,
];

const isBlockedIP = (ip: string): boolean => {
  return BLOCKED_IP_PATTERNS.some(pattern => pattern.test(ip));
};

/**
 * Resolves hostname to IPs and validates none are internal/blocked.
 * Prevents DNS rebinding attacks by checking at delivery time.
 */
const validateWebhookURL = async (webhookUrl: string): Promise<void> => {
  const url = new URL(webhookUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, ""); // Strip IPv6 brackets

  // Direct IP check
  if (net.isIP(hostname)) {
    if (isBlockedIP(hostname)) {
      throw new Error(`Webhook URL resolves to blocked IP: ${hostname}`);
    }
    return;
  }

  // Resolve DNS and check all IPs
  const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
  const addresses6 = await dns.resolve6(hostname).catch(() => [] as string[]);
  const allAddresses = [...addresses, ...addresses6];

  if (allAddresses.length === 0) {
    throw new Error(`Webhook URL hostname could not be resolved: ${hostname}`);
  }

  for (const ip of allAddresses) {
    if (isBlockedIP(ip)) {
      throw new Error(`Webhook URL resolves to blocked IP: ${ip}`);
    }
  }
};

const WEBHOOK_TIMEOUT = 10000; // 10 seconds
const MAX_RETRY_DELAY = 60000; // 1 minute max delay between retries

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
export const generateSignature = (payload: string, secret: string): string => {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
};

/**
 * Generate a secure random secret for new webhooks
 */
export const generateWebhookSecret = (): string => {
  return `whsec_${crypto.randomBytes(32).toString("hex")}`;
};

/**
 * Trigger webhooks for a specific event
 */
export const triggerWebhooks = async (
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> => {
  try {
    // Find all active webhooks for this user that listen to this event
    const webhooks = await Webhook.find({
      userId,
      status: WebhookStatus.ACTIVE,
      events: event,
    });

    if (webhooks.length === 0) {
      return;
    }

    logger.info(`Triggering ${webhooks.length} webhooks for event: ${event}`);

    // Fire all webhooks in parallel (don't wait for response)
    await Promise.allSettled(
      webhooks.map((webhook) => deliverWebhook(webhook, event, data))
    );
  } catch (error) {
    logger.error("Error triggering webhooks:", error);
  }
};

/**
 * Deliver a single webhook
 */
export const deliverWebhook = async (
  webhook: IWebhook,
  event: WebhookEvent,
  data: Record<string, unknown>,
  attempt = 1
): Promise<boolean> => {
  const startTime = Date.now();
  const timestamp = Math.floor(Date.now() / 1000);

  const payload = {
    id: crypto.randomUUID(),
    event,
    timestamp,
    data,
  };

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(`${timestamp}.${payloadString}`, webhook.secret);

  try {
    // SSRF protection: validate resolved IPs at delivery time (prevents DNS rebinding)
    await validateWebhookURL(webhook.url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);

    // Sanitize user-provided headers: block sensitive ones
    const BLOCKED_HEADERS = new Set([
      "authorization", "cookie", "set-cookie", "host",
      "x-forwarded-for", "x-real-ip", "proxy-authorization",
      "x-internal-token",
    ]);
    const safeHeaders: Record<string, string> = {};
    if (webhook.headers) {
      for (const [key, value] of Object.entries(webhook.headers)) {
        if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
          safeHeaders[key] = value;
        } else {
          logger.warn(`Webhook ${webhook.name}: blocked sensitive header "${key}"`);
        }
      }
    }

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MockMail-Signature": `t=${timestamp},v1=${signature}`,
        "X-MockMail-Event": event,
        "X-MockMail-Delivery-Id": payload.id,
        "User-Agent": "MockMail-Webhook/1.0",
        ...safeHeaders,
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;
    const responseBody = await response.text().catch(() => "");

    // Record delivery
    await WebhookDelivery.create({
      webhookId: webhook._id,
      event,
      payload,
      responseCode: response.status,
      responseBody: responseBody.slice(0, 10000),
      duration,
      success: response.ok,
      attempts: attempt,
    });

    // Update webhook status
    if (response.ok) {
      await Webhook.updateOne(
        { _id: webhook._id },
        {
          $set: {
            lastTriggeredAt: new Date(),
            lastError: null,
          },
        }
      );
      logger.info(`Webhook delivered successfully: ${webhook.name} (${duration}ms)`);
      return true;
    } else {
      const errorMsg = `HTTP ${response.status}: ${responseBody.slice(0, 200)}`;
      await handleWebhookFailure(webhook, errorMsg, attempt);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    // Record failed delivery
    await WebhookDelivery.create({
      webhookId: webhook._id,
      event,
      payload,
      duration,
      success: false,
      attempts: attempt,
      error: errorMsg,
    });

    await handleWebhookFailure(webhook, errorMsg, attempt);

    // Retry with exponential backoff (skip retry for SSRF blocks)
    if (attempt < webhook.retryCount && !errorMsg.includes("blocked IP")) {
      const delay = Math.min(Math.pow(2, attempt) * 1000, MAX_RETRY_DELAY);
      logger.info(`Retrying webhook ${webhook.name} in ${delay}ms (attempt ${attempt + 1}/${webhook.retryCount})`);

      setTimeout(() => {
        deliverWebhook(webhook, event, data, attempt + 1).catch((retryErr) => {
          logger.error(`Webhook retry failed for ${webhook.name}: ${retryErr instanceof Error ? retryErr.message : retryErr}`);
        });
      }, delay);
    }

    return false;
  }
};;

/**
 * Handle webhook delivery failure
 */
const handleWebhookFailure = async (
  webhook: IWebhook,
  errorMsg: string,
  attempt: number
): Promise<void> => {
  const updateData: Record<string, unknown> = {
    lastError: errorMsg,
    lastTriggeredAt: new Date(),
  };

  // After max retries, mark as failed
  if (attempt >= webhook.retryCount) {
    // Check if this is the 3rd consecutive failure
    const recentFailures = await WebhookDelivery.countDocuments({
      webhookId: webhook._id,
      success: false,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24h
    });

    if (recentFailures >= 3) {
      updateData.status = WebhookStatus.FAILED;
      logger.warn(`Webhook ${webhook.name} marked as FAILED after ${recentFailures} consecutive failures`);
    }
  }

  await Webhook.updateOne({ _id: webhook._id }, { $set: updateData });
};

/**
 * Test a webhook by sending a test payload
 */
export const testWebhook = async (webhookId: string): Promise<{
  success: boolean;
  responseCode?: number;
  duration?: number;
  error?: string;
}> => {
  const webhook = await Webhook.findById(webhookId);
  if (!webhook) {
    throw new Error("Webhook not found");
  }

  const startTime = Date.now();
  const timestamp = Math.floor(Date.now() / 1000);

  const payload = {
    id: crypto.randomUUID(),
    event: "test",
    timestamp,
    data: {
      message: "This is a test webhook from MockMail.dev",
      timestamp: new Date().toISOString(),
    },
  };

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(`${timestamp}.${payloadString}`, webhook.secret);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MockMail-Signature": `t=${timestamp},v1=${signature}`,
        "X-MockMail-Event": "test",
        "X-MockMail-Delivery-Id": payload.id,
        "User-Agent": "MockMail-Webhook/1.0",
        ...(webhook.headers || {}),
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      success: response.ok,
      responseCode: response.status,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get webhook delivery statistics
 */
export const getWebhookStats = async (webhookId: string): Promise<{
  total: number;
  successful: number;
  failed: number;
  avgDuration: number;
}> => {
  const stats = await WebhookDelivery.aggregate([
    { $match: { webhookId: webhookId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        successful: { $sum: { $cond: ["$success", 1, 0] } },
        failed: { $sum: { $cond: ["$success", 0, 1] } },
        avgDuration: { $avg: "$duration" },
      },
    },
  ]);

  if (stats.length === 0) {
    return { total: 0, successful: 0, failed: 0, avgDuration: 0 };
  }

  return {
    total: stats[0].total,
    successful: stats[0].successful,
    failed: stats[0].failed,
    avgDuration: Math.round(stats[0].avgDuration || 0),
  };
};

import { Router } from "express";
import {
  listBoxes,
  getBox,
  createBox,
  deleteBox,
  clearBox,
  getBoxEmails,
} from "../controllers/emailBox.controller";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validateRequest } from "../middlewares/validateRequest";
import Joi from "joi";
import logger from "../utils/logger";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/** @route GET /boxes
 *  @desc List all email boxes for the authenticated user
 *  @access Private
 */
router.get("/", async (req, res, next) => {
  try {
    logger.info("ROUTE-EMAILBOX - GET /boxes - Listing boxes");
    await listBoxes(req, res);
  } catch (error) {
    logger.error(`ROUTE-EMAILBOX - GET /boxes - Error: ${(error as Error).message}`);
    next(error);
  }
});

/** @route GET /boxes/:id
 *  @desc Get a single email box by ID
 *  @access Private
 */
router.get("/:id", async (req, res, next) => {
  try {
    logger.info(`ROUTE-EMAILBOX - GET /boxes/${req.params.id} - Getting box`);
    await getBox(req, res);
  } catch (error) {
    logger.error(`ROUTE-EMAILBOX - GET /boxes/:id - Error: ${(error as Error).message}`);
    next(error);
  }
});

/** @route POST /boxes
 *  @desc Create a new email box
 *  @access Private
 */
const createBoxSchema = Joi.object({
  address: Joi.string().email().optional(),
  domain: Joi.string().optional().default('mockmail.dev'),
  customName: Joi.string().max(20).pattern(/^[a-zA-Z0-9._-]+$/).optional(),
});

router.post(
  "/",
  validateRequest(createBoxSchema),
  async (req, res, next) => {
    try {
      logger.info("ROUTE-EMAILBOX - POST /boxes - Creating box");
      await createBox(req, res);
    } catch (error) {
      logger.error(`ROUTE-EMAILBOX - POST /boxes - Error: ${(error as Error).message}`);
      next(error);
    }
  }
);

/** @route DELETE /boxes/:id
 *  @desc Delete an email box and all its emails
 *  @access Private
 */
router.delete("/:id", async (req, res, next) => {
  try {
    logger.info(`ROUTE-EMAILBOX - DELETE /boxes/${req.params.id} - Deleting box`);
    await deleteBox(req, res);
  } catch (error) {
    logger.error(`ROUTE-EMAILBOX - DELETE /boxes/:id - Error: ${(error as Error).message}`);
    next(error);
  }
});

/** @route POST /boxes/:id/clear
 *  @desc Clear all emails from a box
 *  @access Private
 */
router.post("/:id/clear", async (req, res, next) => {
  try {
    logger.info(`ROUTE-EMAILBOX - POST /boxes/${req.params.id}/clear - Clearing box`);
    await clearBox(req, res);
  } catch (error) {
    logger.error(`ROUTE-EMAILBOX - POST /boxes/:id/clear - Error: ${(error as Error).message}`);
    next(error);
  }
});

/** @route GET /boxes/:id/emails
 *  @desc Get emails for a specific box
 *  @access Private
 */
router.get("/:id/emails", async (req, res, next) => {
  try {
    logger.info(`ROUTE-EMAILBOX - GET /boxes/${req.params.id}/emails - Getting emails`);
    await getBoxEmails(req, res);
  } catch (error) {
    logger.error(`ROUTE-EMAILBOX - GET /boxes/:id/emails - Error: ${(error as Error).message}`);
    next(error);
  }
});

export default router;

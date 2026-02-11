import { Request, Response } from "express";
import ForwardRule from "../models/ForwardRule";
import EmailBox from "../models/EmailBox";
import logger from "../utils/logger";

export const listForwardRules = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;
    const { boxId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // Verify box ownership
    const box = await EmailBox.findOne({ _id: boxId, userId }).lean();
    if (!box) {
      return res.status(404).json({ success: false, message: "Box not found" });
    }

    const rules = await ForwardRule.find({ emailBoxId: boxId, userId }).sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      data: rules.map(r => ({
        id: r._id,
        forwardTo: r.forwardTo,
        active: r.active,
        filterFrom: r.filterFrom,
        filterSubject: r.filterSubject,
        forwardCount: r.forwardCount,
        lastForwardedAt: r.lastForwardedAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    logger.error(`FORWARD-RULE - Error listing rules: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createForwardRule = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;
    const { boxId } = req.params;
    const { forwardTo, filterFrom, filterSubject } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    if (!forwardTo || typeof forwardTo !== "string") {
      return res.status(400).json({ success: false, message: "forwardTo is required" });
    }

    if (forwardTo.toLowerCase().endsWith("@mockmail.dev")) {
      return res.status(400).json({ success: false, message: "Cannot forward to @mockmail.dev" });
    }

    // Verify box ownership
    const box = await EmailBox.findOne({ _id: boxId, userId }).lean();
    if (!box) {
      return res.status(404).json({ success: false, message: "Box not found" });
    }

    // Limits: max 3 per box, max 10 per user
    const boxCount = await ForwardRule.countDocuments({ emailBoxId: boxId });
    if (boxCount >= 3) {
      return res.status(400).json({ success: false, message: "Max 3 rules per box" });
    }
    const userCount = await ForwardRule.countDocuments({ userId });
    if (userCount >= 10) {
      return res.status(400).json({ success: false, message: "Max 10 rules per user" });
    }

    const rule = await ForwardRule.create({
      userId,
      emailBoxId: boxId,
      forwardTo,
      filterFrom: filterFrom || undefined,
      filterSubject: filterSubject || undefined,
    });

    logger.info(`FORWARD-RULE - Created rule ${rule._id} for box ${boxId}`);
    res.status(201).json({
      success: true,
      data: {
        id: rule._id,
        forwardTo: rule.forwardTo,
        active: rule.active,
        filterFrom: rule.filterFrom,
        filterSubject: rule.filterSubject,
      },
    });
  } catch (error) {
    logger.error(`FORWARD-RULE - Error creating rule: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateForwardRule = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;
    const { id } = req.params;
    const { active, forwardTo, filterFrom, filterSubject } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const rule = await ForwardRule.findOne({ _id: id, userId });
    if (!rule) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    if (forwardTo !== undefined) {
      if (forwardTo.toLowerCase().endsWith("@mockmail.dev")) {
        return res.status(400).json({ success: false, message: "Cannot forward to @mockmail.dev" });
      }
      rule.forwardTo = forwardTo;
    }
    if (active !== undefined) rule.active = active;
    if (filterFrom !== undefined) rule.filterFrom = filterFrom || undefined;
    if (filterSubject !== undefined) rule.filterSubject = filterSubject || undefined;

    await rule.save();

    logger.info(`FORWARD-RULE - Updated rule ${id}`);
    res.json({ success: true, data: { id: rule._id, active: rule.active, forwardTo: rule.forwardTo } });
  } catch (error) {
    logger.error(`FORWARD-RULE - Error updating rule: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteForwardRule = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const result = await ForwardRule.deleteOne({ _id: id, userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    logger.info(`FORWARD-RULE - Deleted rule ${id}`);
    res.json({ success: true, message: "Rule deleted" });
  } catch (error) {
    logger.error(`FORWARD-RULE - Error deleting rule: ${(error as Error).message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

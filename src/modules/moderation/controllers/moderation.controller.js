import * as moderationService from "../services/moderation.service.js";

export const getModerationAlerts = async (req, res, next) => {
  try {
    const result = await moderationService.getModerationAlerts(req.user, req.query);

    res.status(200).json({
      success: true,
      message: "Moderation alerts fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getModerationAlertById = async (req, res, next) => {
  try {
    const result = await moderationService.getModerationAlertById(req.user, req.params.alertId);

    res.status(200).json({
      success: true,
      message: "Moderation alert fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const markAlertReviewed = async (req, res, next) => {
  try {
    const result = await moderationService.markAlertReviewed(req.user, req.params.alertId, req.body?.note);

    res.status(200).json({
      success: true,
      message: "Moderation alert marked as reviewed",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const approveAlertPost = async (req, res, next) => {
  try {
    const result = await moderationService.approveAlertPost(req.user, req.params.alertId, req.body?.note);

    res.status(200).json({
      success: true,
      message: "Post approved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const keepAlertPostSuspended = async (req, res, next) => {
  try {
    const result = await moderationService.keepAlertPostSuspended(req.user, req.params.alertId, req.body?.note);

    res.status(200).json({
      success: true,
      message: "Post kept suspended successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAlertPost = async (req, res, next) => {
  try {
    const result = await moderationService.deleteAlertPost(req.user, req.params.alertId, req.body?.note);

    res.status(200).json({
      success: true,
      message: "Post deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const warnAlertUser = async (req, res, next) => {
  try {
    const result = await moderationService.warnAlertUser(req.user, req.params.alertId, req.body?.note);

    res.status(200).json({
      success: true,
      message: "User warning recorded successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const suspendAlertUser = async (req, res, next) => {
  try {
    const result = await moderationService.suspendAlertUser(req.user, req.params.alertId, req.body?.note);

    res.status(200).json({
      success: true,
      message: "User suspended successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

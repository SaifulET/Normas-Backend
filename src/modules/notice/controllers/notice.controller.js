import * as noticeService from "../services/notice.service.js";

export const createNotice = async (req, res, next) => {
  try {
    const result = await noticeService.createNotice(req.user, req.body);

    res.status(202).json({
      success: true,
      message: "Notice accepted for publication",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSuperadminNotices = async (req, res, next) => {
  try {
    const result = await noticeService.getSuperadminNotices(req.query);

    res.status(200).json({
      success: true,
      message: "Notices fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadNoticeImage = async (req, res, next) => {
  try {
    res.status(201).json({
      success: true,
      message: "Notice image uploaded successfully",
      data: req.uploadedNoticeImage,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNoticeImage = async (req, res, next) => {
  try {
    const result = await noticeService.deleteUploadedNoticeImage(req.body.key);

    res.status(200).json({
      success: true,
      message: "Notice image deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSuperadminNoticeById = async (req, res, next) => {
  try {
    const result = await noticeService.getSuperadminNoticeById(req.params.noticeId);

    res.status(200).json({
      success: true,
      message: "Notice fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateNotice = async (req, res, next) => {
  try {
    const result = await noticeService.updateNotice(req.params.noticeId, req.body);

    res.status(200).json({
      success: true,
      message: "Notice updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const archiveNotice = async (req, res, next) => {
  try {
    const result = await noticeService.archiveNotice(req.params.noticeId);

    res.status(200).json({
      success: true,
      message: "Notice archived successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotice = async (req, res, next) => {
  try {
    const result = await noticeService.deleteNotice(req.params.noticeId);

    res.status(200).json({
      success: true,
      message: "Notice deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const retryFailedNoticeEmails = async (req, res, next) => {
  try {
    const result = await noticeService.retryFailedNoticeEmails(req.params.noticeId);

    res.status(202).json({
      success: true,
      message: "Failed notice emails queued for retry",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getRoleNotices = async (req, res, next) => {
  try {
    const result = await noticeService.getRoleNotices(req.user, req.query);

    res.status(200).json({
      success: true,
      message: "Notices fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getRoleNoticeById = async (req, res, next) => {
  try {
    const result = await noticeService.getRoleNoticeById(req.user, req.params.noticeId);

    res.status(200).json({
      success: true,
      message: "Notice fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const markRoleNoticeAsRead = async (req, res, next) => {
  try {
    const result = await noticeService.markRoleNoticeAsRead(req.user, req.params.noticeId);

    res.status(200).json({
      success: true,
      message: "Notice marked as read successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

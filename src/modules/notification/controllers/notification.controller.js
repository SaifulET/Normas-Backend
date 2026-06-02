import * as notificationService from "../services/notification.service.js";

export const getNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.getNotifications(req.user, req.query);

    res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: result.data,
      pagination: result.pagination,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadCount(req.user);

    res.status(200).json({
      success: true,
      message: "Unread notification count fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markNotificationAsRead(
      req.user,
      req.params.notificationId
    );

    res.status(200).json({
      success: true,
      message: "Notification marked as read successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllNotificationsAsRead(req.user);

    res.status(200).json({
      success: true,
      message: "Notifications marked as read successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

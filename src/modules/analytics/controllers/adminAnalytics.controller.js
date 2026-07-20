import * as adminAnalyticsService from "../services/adminAnalytics.service.js";

export const getAdminDashboardAnalytics = async (req, res, next) => {
  try {
    const result = await adminAnalyticsService.getAdminDashboardAnalytics(req.query);

    res.status(200).json({
      success: true,
      message: "Admin dashboard analytics fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

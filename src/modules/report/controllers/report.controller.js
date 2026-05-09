import * as reportService from "../services/report.service.js";

export const createReport = async (req, res, next) => {
  try {
    const result = await reportService.createReport(req.user, req.body);

    res.status(201).json({
      success: true,
      message: "Report created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllReports = async (_req, res, next) => {
  try {
    const result = await reportService.getAllReports();

    res.status(200).json({
      success: true,
      message: "Reports fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getReportById = async (req, res, next) => {
  try {
    const result = await reportService.getReportById(req.params.reportId);

    res.status(200).json({
      success: true,
      message: "Report fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateReportStatus = async (req, res, next) => {
  try {
    const result = await reportService.updateReportStatus(req.params.reportId, req.body.status);

    res.status(200).json({
      success: true,
      message: "Report status updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteReport = async (req, res, next) => {
  try {
    const result = await reportService.deleteReport(req.params.reportId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

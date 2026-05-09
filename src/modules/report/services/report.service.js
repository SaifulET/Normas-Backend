import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import List from "../../list/models/list.model.js";
import Report, { reportStatuses } from "../models/report.model.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const getUserOrThrow = async (userId) => {
  if (!isValidObjectId(userId)) {
    throw new AppError("Invalid userId", 400);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

const getListOrThrow = async (listId) => {
  if (!isValidObjectId(listId)) {
    throw new AppError("Invalid listId", 400);
  }

  const list = await List.findById(listId);

  if (!list) {
    throw new AppError("List not found", 404);
  }

  return list;
};

const getReportOrThrow = async (reportId) => {
  if (!isValidObjectId(reportId)) {
    throw new AppError("Invalid reportId", 400);
  }

  const report = await Report.findById(reportId);

  if (!report) {
    throw new AppError("Report not found", 404);
  }

  return report;
};

const populateReport = (query) =>
  query
    .populate("user", "name email role")
    .populate("list", "title country stage sector fundingTarget status bannerImage user createdAt updatedAt");

const normalizeDescription = (description) => {
  if (typeof description !== "string" || !description.trim()) {
    throw new AppError("description is required", 400);
  }

  const trimmedDescription = description.trim();

  if (trimmedDescription.length > 250) {
    throw new AppError("description must not exceed 250 characters", 400);
  }

  return trimmedDescription;
};

export const createReport = async (authUser, payload) => {
  await getUserOrThrow(authUser.userId);
  await getListOrThrow(payload.listId);

  const createdReport = await Report.create({
    list: payload.listId,
    user: authUser.userId,
    description: normalizeDescription(payload.description),
    status: "pending",
  });

  return populateReport(Report.findById(createdReport._id));
};

export const getAllReports = async () => {
  return populateReport(Report.find()).sort({ createdAt: -1 });
};

export const getReportById = async (reportId) => {
  const report = await getReportOrThrow(reportId);

  return populateReport(Report.findById(report._id));
};

export const updateReportStatus = async (reportId, status) => {
  const report = await getReportOrThrow(reportId);

  if (!reportStatuses.includes(status)) {
    throw new AppError("status must be pending, dismiss, or solved", 400);
  }

  report.status = status;
  await report.save();

  return populateReport(Report.findById(report._id));
};

export const deleteReport = async (reportId) => {
  const report = await getReportOrThrow(reportId);

  await Report.findByIdAndDelete(reportId);

  return {
    id: report._id,
    message: "Report deleted successfully",
  };
};

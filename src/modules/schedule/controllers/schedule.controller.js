import * as scheduleService from "../services/schedule.service.js";

export const createSchedule = async (req, res, next) => {
  try {
    const result = await scheduleService.createSchedule(req.user, req.body);

    res.status(201).json({
      success: true,
      message: "Schedule created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSchedules = async (req, res, next) => {
  try {
    const result = await scheduleService.getSchedules(req.user, req.query);

    res.status(200).json({
      success: true,
      message: "Schedules fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getScheduleById = async (req, res, next) => {
  try {
    const result = await scheduleService.getScheduleById(req.user, req.params.scheduleId);

    res.status(200).json({
      success: true,
      message: "Schedule fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSchedule = async (req, res, next) => {
  try {
    const result = await scheduleService.updateSchedule(
      req.user,
      req.params.scheduleId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Schedule updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSchedule = async (req, res, next) => {
  try {
    const result = await scheduleService.deleteSchedule(req.user, req.params.scheduleId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

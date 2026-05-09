import * as investmentConversationService from "../services/investmentConversation.service.js";

export const createOrGetConversation = async (req, res, next) => {
  try {
    const result = await investmentConversationService.createOrGetConversation(req.user, req.body);

    res.status(201).json({
      success: true,
      message: result.created
        ? "Investment conversation created successfully"
        : "Investment conversation fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyConversations = async (req, res, next) => {
  try {
    const result = await investmentConversationService.getMyConversations(req.user);

    res.status(200).json({
      success: true,
      message: "Investment conversations fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationById = async (req, res, next) => {
  try {
    const result = await investmentConversationService.getConversationById(
      req.user,
      req.params.conversationId
    );

    res.status(200).json({
      success: true,
      message: "Investment conversation fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const markConversationAsSeen = async (req, res, next) => {
  try {
    const result = await investmentConversationService.markConversationAsSeen(
      req.user,
      req.params.conversationId
    );

    res.status(200).json({
      success: true,
      message: "Conversation messages marked as seen successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createConversationMessage = async (req, res, next) => {
  try {
    const result = await investmentConversationService.createConversationMessage(
      req.user,
      req.params.conversationId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Conversation message sent successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createMeetingRequest = async (req, res, next) => {
  try {
    const result = await investmentConversationService.createMeetingRequest(
      req.user,
      req.params.conversationId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Meeting request created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationMeetingRequests = async (req, res, next) => {
  try {
    const filters = {
      ...req.query,
      ...req.body,
    };
    const result = await investmentConversationService.getConversationMeetingRequests(
      req.user,
      req.params.conversationId,
      filters
    );

    res.status(200).json({
      success: true,
      message: "Conversation meeting requests fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMeetingRequests = async (req, res, next) => {
  try {
    const filters = {
      ...req.query,
      ...req.body,
    };
    const result = await investmentConversationService.getMeetingRequests(req.user, filters);

    res.status(200).json({
      success: true,
      message: "Meeting requests fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMeetingRequestById = async (req, res, next) => {
  try {
    const result = await investmentConversationService.getMeetingRequestById(
      req.user,
      req.params.meetingRequestId
    );

    res.status(200).json({
      success: true,
      message: "Meeting request fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMeetingRequestStatus = async (req, res, next) => {
  try {
    const result = await investmentConversationService.updateMeetingRequestStatus(
      req.user,
      req.params.meetingRequestId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Meeting request status updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMySchedules = async (req, res, next) => {
  try {
    const filters = {
      ...req.query,
      ...req.body,
    };
    const result = await investmentConversationService.getMySchedules(req.user, filters);

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
    const result = await investmentConversationService.getScheduleById(
      req.user,
      req.params.meetingRequestId
    );

    res.status(200).json({
      success: true,
      message: "Schedule fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

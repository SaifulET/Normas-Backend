import * as investmentConversationService from "../services/investmentConversation.service.js";

const emitInvestmentEvent = (req, conversationId, eventName, payload) => {
  req.app
    .get("io")
    ?.to(investmentConversationService.buildSocketRoomName(conversationId))
    .emit(eventName, payload);
};

const emitInvestmentMessageToRoom = async (req, conversationId, messageId) => {
  const io = req.app.get("io");

  if (!io) {
    return;
  }

  const room = investmentConversationService.buildSocketRoomName(conversationId);
  const sockets = await io.in(room).fetchSockets();

  await Promise.all(
    sockets.map(async (socket) => {
      const authUser = socket.data.investmentAuthUser;

      if (!authUser) {
        return;
      }

      const payload = await investmentConversationService.buildMessageEventPayloadForViewer(
        authUser,
        conversationId,
        messageId
      );

      socket.emit("investment:message", payload);
    })
  );
};

const emitInvestmentSeenToRoom = async (req, conversationId, seenMessageIds) => {
  const io = req.app.get("io");

  if (!io) {
    return;
  }

  const room = investmentConversationService.buildSocketRoomName(conversationId);
  const sockets = await io.in(room).fetchSockets();

  await Promise.all(
    sockets.map(async (socket) => {
      const authUser = socket.data.investmentAuthUser;

      if (!authUser) {
        return;
      }

      const payload = await investmentConversationService.buildSeenEventPayloadForViewer(
        authUser,
        conversationId,
        seenMessageIds
      );

      socket.emit("investment:messages-seen", payload);
    })
  );
};

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
    const result = await investmentConversationService.getMyConversations(req.user, req.query);

    res.status(200).json({
      success: true,
      message: "Investment conversations fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyConversationInbox = async (req, res, next) => {
  try {
    const result = await investmentConversationService.getMyConversationInbox(req.user, req.query);

    res.status(200).json({
      success: true,
      message: "Conversation inbox fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationRequests = async (req, res, next) => {
  try {
    const result = await investmentConversationService.getConversationRequests(req.user);

    res.status(200).json({
      success: true,
      message: "Conversation requests fetched successfully",
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

    if (result.seenMessageIds.length > 0) {
      await emitInvestmentSeenToRoom(req, req.params.conversationId, result.seenMessageIds);
    }

    res.status(200).json({
      success: true,
      message: "Investment conversation fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationMessages = async (req, res, next) => {
  try {
    const result = await investmentConversationService.getConversationMessages(
      req.user,
      req.params.conversationId,
      req.query
    );

    res.status(200).json({
      success: true,
      message: "Conversation messages fetched successfully",
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

    if (result.seenMessageIds.length > 0) {
      await emitInvestmentSeenToRoom(req, req.params.conversationId, result.seenMessageIds);
    }

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

    await emitInvestmentMessageToRoom(req, req.params.conversationId, result.messageId);

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

    emitInvestmentEvent(req, req.params.conversationId, "investment:meeting-request", {
      conversationId: req.params.conversationId,
      meetingRequest: result,
    });

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

    const conversationId = result.conversation.toString();

    emitInvestmentEvent(req, conversationId, "investment:meeting-request-updated", {
      conversationId,
      meetingRequest: result,
    });

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

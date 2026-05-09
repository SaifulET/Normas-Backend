import * as supportService from "../services/support.service.js";

export const createSupportConversation = async (req, res, next) => {
  try {
    const authUser = req.user || null;
    const result = await supportService.createSupportConversation(authUser, req.body);

    res.status(201).json({
      success: true,
      message: "Support conversation created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllSupportConversations = async (req, res, next) => {
  try {
    const result = await supportService.getAllSupportConversations(req.query);

    res.status(200).json({
      success: true,
      message: "Support conversations fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMySupportConversations = async (req, res, next) => {
  try {
    const result = await supportService.getMySupportConversations(req.user);

    res.status(200).json({
      success: true,
      message: "User support conversations fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMySupportConversationById = async (req, res, next) => {
  try {
    const result = await supportService.getMySupportConversationById(
      req.user,
      req.params.conversationId
    );

    if (result.seenMessageIds.length > 0) {
      req.app.get("io")?.to(`support:${req.params.conversationId}`).emit("support:messages-seen", {
        conversationId: req.params.conversationId,
        seenMessageIds: result.seenMessageIds,
        conversation: result,
      });
    }

    res.status(200).json({
      success: true,
      message: "User support conversation fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSupportConversationById = async (req, res, next) => {
  try {
    const result = await supportService.getSupportConversationById(req.user, req.params.conversationId);

    if (result.seenMessageIds.length > 0) {
      req.app.get("io")?.to(`support:${req.params.conversationId}`).emit("support:messages-seen", {
        conversationId: req.params.conversationId,
        seenMessageIds: result.seenMessageIds,
        conversation: result,
      });
    }

    res.status(200).json({
      success: true,
      message: "Support conversation fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const markSupportConversationAsSeen = async (req, res, next) => {
  try {
    const actor = {
      senderType: req.user.role === "superadmin" ? "superadmin" : "user",
      senderUser: req.user.userId,
      senderName: req.user.name,
      senderEmail: req.user.email,
      role: req.user.role,
    };

    const result = await supportService.markSupportConversationAsSeen({
      conversationId: req.params.conversationId,
      actor,
    });

    if (result.seenMessageIds.length > 0) {
      req.app.get("io")?.to(result.room).emit("support:messages-seen", {
        conversationId: req.params.conversationId,
        seenMessageIds: result.seenMessageIds,
        conversation: result.conversation,
      });
    }

    res.status(200).json({
      success: true,
      message: "Support messages marked as seen successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSupportConversationStatus = async (req, res, next) => {
  try {
    const result = await supportService.updateSupportConversationStatus(
      req.params.conversationId,
      req.body.status
    );

    res.status(200).json({
      success: true,
      message: "Support conversation status updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSupportConversation = async (req, res, next) => {
  try {
    const result = await supportService.deleteSupportConversation(req.params.conversationId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createSupportMessage = async (req, res, next) => {
  try {
    const actor = {
      senderType: req.user.role === "superadmin" ? "superadmin" : "user",
      senderUser: req.user.userId,
      senderName: req.user.name,
      senderEmail: req.user.email,
    };

    const result = await supportService.createSupportMessage({
      conversationId: req.params.conversationId,
      actor,
      message: req.body.message,
    });

    req.app.get("io")?.to(result.room).emit("support:message", {
      conversationId: req.params.conversationId,
      message: result.message,
      conversation: result.conversation,
    });

    res.status(201).json({
      success: true,
      message: "Support message sent successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

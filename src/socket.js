import { Server } from "socket.io";
import AppError from "./utils/appError.js";
import {
  buildSocketRoomName,
  createSupportMessage,
  markSupportConversationAsSeen,
  verifySocketIdentity,
} from "./modules/support/services/support.service.js";

export const createSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("support:join", async (payload = {}, callback = () => {}) => {
      try {
        const { conversationId, token, guestAccessToken } = payload;
        const { actor } = await verifySocketIdentity({
          conversationId,
          token,
          guestToken: guestAccessToken,
        });

        socket.data.actor = actor;
        socket.data.conversationId = conversationId;
        socket.join(buildSocketRoomName(conversationId));

        const seenResult = await markSupportConversationAsSeen({
          conversationId,
          actor,
        });

        if (seenResult.seenMessageIds.length > 0) {
          io.to(seenResult.room).emit("support:messages-seen", {
            conversationId,
            seenMessageIds: seenResult.seenMessageIds,
            conversation: seenResult.conversation,
          });
        }

        callback({
          success: true,
          conversationId,
          seenMessageIds: seenResult.seenMessageIds,
        });
      } catch (error) {
        const appError = error instanceof AppError ? error : new AppError("Socket join failed", 500);
        callback({
          success: false,
          message: appError.message,
        });
      }
    });

    socket.on("support:send-message", async (payload = {}, callback = () => {}) => {
      try {
        const { conversationId, message } = payload;

        if (!socket.data.actor || socket.data.conversationId !== conversationId) {
          throw new AppError("Join the conversation room before sending messages", 403);
        }

        const result = await createSupportMessage({
          conversationId,
          actor: socket.data.actor,
          message,
        });

        io.to(result.room).emit("support:message", {
          conversationId,
          message: result.message,
          conversation: result.conversation,
        });

        callback({
          success: true,
          data: result,
        });
      } catch (error) {
        const appError = error instanceof AppError ? error : new AppError("Socket message failed", 500);
        callback({
          success: false,
          message: appError.message,
        });
      }
    });

    socket.on("support:mark-seen", async (payload = {}, callback = () => {}) => {
      try {
        const { conversationId } = payload;

        if (!socket.data.actor || socket.data.conversationId !== conversationId) {
          throw new AppError("Join the conversation room before marking messages as seen", 403);
        }

        const result = await markSupportConversationAsSeen({
          conversationId,
          actor: socket.data.actor,
        });

        if (result.seenMessageIds.length > 0) {
          io.to(result.room).emit("support:messages-seen", {
            conversationId,
            seenMessageIds: result.seenMessageIds,
            conversation: result.conversation,
          });
        }

        callback({
          success: true,
          data: result,
        });
      } catch (error) {
        const appError = error instanceof AppError ? error : new AppError("Socket seen update failed", 500);
        callback({
          success: false,
          message: appError.message,
        });
      }
    });
  });

  return io;
};

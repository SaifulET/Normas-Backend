import { Server } from "socket.io";
import AppError from "./utils/appError.js";
import {
  buildSocketRoomName,
  createSupportMessage,
  markSupportConversationAsSeen,
  verifySocketIdentity,
} from "./modules/support/services/support.service.js";
import * as investmentConversationService from "./modules/investment-conversations/services/investmentConversation.service.js";
import {
  buildNotificationRoomName,
  getUnreadCount,
  verifyNotificationSocketIdentity,
} from "./modules/notification/services/notification.service.js";

const getSocketToken = (socket, payload = {}) =>
  payload.token || socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");

const emitInvestmentMessageToRoom = async (io, room, conversationId, messageId) => {
  const sockets = await io.in(room).fetchSockets();

  await Promise.all(
    sockets.map(async (roomSocket) => {
      const authUser = roomSocket.data.investmentAuthUser;

      if (!authUser) {
        return;
      }

      const payload = await investmentConversationService.buildMessageEventPayloadForViewer(
        authUser,
        conversationId,
        messageId
      );

      roomSocket.emit("investment:message", payload);
    })
  );
};

const emitInvestmentSeenToRoom = async (io, room, conversationId, seenMessageIds) => {
  const sockets = await io.in(room).fetchSockets();

  await Promise.all(
    sockets.map(async (roomSocket) => {
      const authUser = roomSocket.data.investmentAuthUser;

      if (!authUser) {
        return;
      }

      const payload = await investmentConversationService.buildSeenEventPayloadForViewer(
        authUser,
        conversationId,
        seenMessageIds
      );

      roomSocket.emit("investment:messages-seen", payload);
    })
  );
};

export const createSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("notification:join", async (payload = {}, callback = () => {}) => {
      try {
        const { authUser } = await verifyNotificationSocketIdentity({
          token: getSocketToken(socket, payload),
        });

        socket.data.notificationAuthUser = authUser;
        socket.join(buildNotificationRoomName(authUser.userId));

        const unreadResult = await getUnreadCount(authUser);

        callback({
          success: true,
          unreadCount: unreadResult.unreadCount,
        });
      } catch (error) {
        const appError = error instanceof AppError
          ? error
          : new AppError("Notification socket join failed", 500);
        callback({
          success: false,
          message: appError.message,
        });
      }
    });

    socket.on("investment:join", async (payload = {}, callback = () => {}) => {
      try {
        const { conversationId } = payload;
        const { authUser } = await investmentConversationService.verifySocketIdentity({
          conversationId,
          token: getSocketToken(socket, payload),
        });

        socket.data.investmentAuthUser = authUser;
        socket.data.investmentConversationId = conversationId;
        socket.join(investmentConversationService.buildSocketRoomName(conversationId));

        const seenResult = await investmentConversationService.markConversationAsSeen(
          authUser,
          conversationId
        );

        if (seenResult.seenMessageIds.length > 0) {
          await emitInvestmentSeenToRoom(
            io,
            investmentConversationService.buildSocketRoomName(conversationId),
            conversationId,
            seenResult.seenMessageIds
          );
        }

        callback({
          success: true,
          conversationId,
          seenMessageIds: seenResult.seenMessageIds,
        });
      } catch (error) {
        const appError = error instanceof AppError ? error : new AppError("Investment socket join failed", 500);
        callback({
          success: false,
          message: appError.message,
        });
      }
    });

    socket.on("investment:send-message", async (payload = {}, callback = () => {}) => {
      try {
        const { conversationId, message } = payload;

        if (
          !socket.data.investmentAuthUser ||
          socket.data.investmentConversationId !== conversationId
        ) {
          throw new AppError("Join the investment conversation room before sending messages", 403);
        }

        const result = await investmentConversationService.createConversationMessage(
          socket.data.investmentAuthUser,
          conversationId,
          { message }
        );

        await emitInvestmentMessageToRoom(io, result.room, conversationId, result.messageId);

        callback({
          success: true,
          data: result,
        });
      } catch (error) {
        const appError = error instanceof AppError
          ? error
          : new AppError("Investment socket message failed", 500);
        callback({
          success: false,
          message: appError.message,
        });
      }
    });

    socket.on("investment:mark-seen", async (payload = {}, callback = () => {}) => {
      try {
        const { conversationId } = payload;

        if (
          !socket.data.investmentAuthUser ||
          socket.data.investmentConversationId !== conversationId
        ) {
          throw new AppError("Join the investment conversation room before marking messages as seen", 403);
        }

        const result = await investmentConversationService.markConversationAsSeen(
          socket.data.investmentAuthUser,
          conversationId
        );

        if (result.seenMessageIds.length > 0) {
          await emitInvestmentSeenToRoom(
            io,
            investmentConversationService.buildSocketRoomName(conversationId),
            conversationId,
            result.seenMessageIds
          );
        }

        callback({
          success: true,
          data: result,
        });
      } catch (error) {
        const appError = error instanceof AppError
          ? error
          : new AppError("Investment socket seen update failed", 500);
        callback({
          success: false,
          message: appError.message,
        });
      }
    });

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

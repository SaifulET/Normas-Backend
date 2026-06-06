import dotenv from "dotenv";
import http from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import { createSocketServer } from "./socket.js";
import {
  setNotificationSocketServer,
  startScheduleNotificationWorker,
} from "./modules/notification/services/notification.service.js";

dotenv.config();

const PORT = process.env.PORT || 5001;

const getStartupErrorMessage = (error) => {
  if (error?.code === "EADDRINUSE") {
    return `Port ${PORT} is already in use. Stop the existing server on that port, or set PORT to a different value in .env.`;
  }

  return error?.message || "Unknown startup error";
};

const listen = (server) =>
  new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off("listening", handleListening);
      reject(error);
    };

    const handleListening = () => {
      server.off("error", handleError);
      console.log(`Server running on port ${PORT}`);
      resolve();
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(PORT);
  });

const handleRequest = async (req, res) => {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error("Failed to connect to database:", error.message);

    return res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
};

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);
  const io = createSocketServer(server);
  setNotificationSocketServer(io);
  app.set("io", io);

  await listen(server);
  startScheduleNotificationWorker();
};

if (!process.env.VERCEL) {
  startServer().catch((error) => {
    console.error("Failed to start server:", getStartupErrorMessage(error));
    process.exit(1);
  });
}

export default handleRequest;

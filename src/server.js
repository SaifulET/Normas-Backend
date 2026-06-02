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

const PORT = process.env.PORT || 5000;

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
  startScheduleNotificationWorker();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

if (!process.env.VERCEL) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
}

export default handleRequest;

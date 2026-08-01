import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import { drainNoticeEmailQueue } from "../modules/notice/services/notice.service.js";

dotenv.config();

const run = async () => {
  await connectDB();
  const result = await drainNoticeEmailQueue();
  console.log("Notice email queue drain complete:", JSON.stringify(result));
};

run()
  .catch((error) => {
    console.error("Notice email queue drain failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

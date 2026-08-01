import dotenv from "dotenv";
import connectDB from "../config/db.js";
import { recoverNoticeDispatches } from "../modules/notice/services/notice.service.js";

dotenv.config();

const run = async () => {
  await connectDB();
  const result = await recoverNoticeDispatches();
  console.log("Notice dispatch recovery complete:", JSON.stringify(result));
};

run()
  .catch((error) => {
    console.error("Notice dispatch recovery failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { default: mongoose } = await import("mongoose");
    await mongoose.disconnect();
  });

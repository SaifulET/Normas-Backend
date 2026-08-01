import dotenv from "dotenv";
import connectDB from "../config/db.js";
import { startNoticeEmailWorker } from "../modules/notice/services/notice.service.js";

dotenv.config();

const run = async () => {
  await connectDB();
  console.log("Notice email worker started");
  await startNoticeEmailWorker();
};

run().catch((error) => {
  console.error("Notice email worker failed:", error.message);
  process.exit(1);
});

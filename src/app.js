import express from "express";
import cors from "cors";
import "dotenv/config";
import authRoutes from "./modules/auth/routes/auth.routes.js";
import kycRoutes from "./modules/kyc/routes/kyc.routes.js";
import listRoutes from "./modules/list/routes/list.routes.js";
import legalContentRoutes from "./modules/legal-content/routes/legalContent.routes.js";
import faqRoutes from "./modules/faq/routes/faq.routes.js";
import pricingRoutes from "./modules/pricing/routes/pricing.routes.js";
import * as pricingController from "./modules/pricing/controllers/pricing.controller.js";
import reportRoutes from "./modules/report/routes/report.routes.js";
import supportRoutes from "./modules/support/routes/support.routes.js";
import investmentConversationRoutes from "./modules/investment-conversations/routes/investmentConversation.routes.js";
import { optionalAuthenticate } from "./middlewares/optionalAuth.middleware.js";

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://early-n.vercel.app"
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.post(
  "/api/v1/pricing/webhook",
  express.raw({ type: "application/json" }),
  pricingController.handleStripeWebhook
);
app.use(express.json({ limit: "20mb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/kyc", kycRoutes);
app.use("/api/v1/lists", listRoutes);
app.use("/api/v1/legal-contents", legalContentRoutes);
app.use("/api/v1/faqs", faqRoutes);
app.use("/api/v1/pricing", pricingRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/support", optionalAuthenticate, supportRoutes);
app.use("/api/v1/investment-conversations", investmentConversationRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
  });
});

export default app;

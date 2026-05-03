import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/routes/auth.routes.js";
import kycRoutes from "./modules/kyc/routes/kyc.routes.js";
import listRoutes from "./modules/list/routes/list.routes.js";
import legalContentRoutes from "./modules/legal-content/routes/legalContent.routes.js";
import faqRoutes from "./modules/faq/routes/faq.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

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

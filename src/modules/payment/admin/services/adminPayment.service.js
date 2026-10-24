import mongoose from "mongoose";
import AppError from "../../../../utils/appError.js";
import User from "../../../auth/models/user.model.js";
import SubscriptionInvoice from "../../../pricing/models/subscriptionInvoice.model.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeText = (value) => String(value || "").trim();

const escapeRegex = (value) => normalizeText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = ({ page = 1, limit = 8 } = {}) => {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number(limit) || 8, 1), 100);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const serializeAdminPayment = (invoice) => {
  const user = invoice.user && typeof invoice.user === "object" ? invoice.user : null;

  return {
    id: invoice._id.toString(),
    invoiceNumber: invoice.invoiceNumber || invoice.stripeInvoiceId || "",
    productType: invoice.planTitle || invoice.planType || "Subscription",
    planType: invoice.planType || "",
    planTitle: invoice.planTitle || "",
    amount: invoice.amountPaid || invoice.total || 0,
    currency: invoice.currency || "usd",
    status: invoice.status || "pending",
    paymentDate: invoice.paidAt || invoice.createdAt,
    hostedInvoiceUrl: invoice.hostedInvoiceUrl || "",
    invoicePdfUrl: invoice.invoicePdfUrl || "",
    taxAmount: invoice.taxAmount || 0,
    subtotal: invoice.subtotal || 0,
    total: invoice.total || invoice.amountPaid || 0,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    user: user
      ? {
          id: user._id.toString(),
          name: user.name || "",
          email: user.email || "",
          role: user.role || "",
        }
      : null,
  };
};

const getPaymentOrThrow = async (paymentId) => {
  if (!isValidObjectId(paymentId)) {
    throw new AppError("Invalid paymentId", 400);
  }

  const invoice = await SubscriptionInvoice.findById(paymentId).populate("user", "name email role");

  if (!invoice) {
    throw new AppError("Payment record not found", 404);
  }

  return invoice;
};

export const getAdminPayments = async (query = {}) => {
  const { page, limit } = parsePagination(query);
  const search = normalizeText(query.search);
  const filters = {};

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    const matchingUsers = await User.find({
      $or: [{ name: searchRegex }, { email: searchRegex }],
    }).select("_id");

    filters.$or = [
      { invoiceNumber: searchRegex },
      { stripeInvoiceId: searchRegex },
      { planTitle: searchRegex },
      { planType: searchRegex },
      { user: { $in: matchingUsers.map((user) => user._id) } },
    ];
  }

  const [invoices, total] = await Promise.all([
    SubscriptionInvoice.find(filters)
      .populate("user", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    SubscriptionInvoice.countDocuments(filters),
  ]);

  return {
    payments: invoices.map(serializeAdminPayment),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getAdminPaymentById = async (paymentId) => {
  const invoice = await getPaymentOrThrow(paymentId);
  return serializeAdminPayment(invoice);
};

export const deleteAdminPayment = async (paymentId) => {
  const invoice = await getPaymentOrThrow(paymentId);

  await SubscriptionInvoice.findByIdAndDelete(invoice._id);

  return {
    id: invoice._id.toString(),
    message: "Payment record deleted successfully",
  };
};

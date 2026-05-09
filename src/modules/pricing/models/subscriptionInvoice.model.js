import mongoose from "mongoose";

export const invoiceStatuses = [
  "draft",
  "open",
  "paid",
  "uncollectible",
  "void",
  "pending",
  "failed",
];

const invoiceLineSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      trim: true,
      lowercase: true,
      default: "usd",
    },
    periodStart: {
      type: Date,
      default: null,
    },
    periodEnd: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const subscriptionInvoiceSchema = new mongoose.Schema(
  {
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSubscription",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      trim: true,
      default: "",
    },
    stripeSubscriptionId: {
      type: String,
      trim: true,
      default: "",
    },
    stripeInvoiceId: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    stripePaymentIntentId: {
      type: String,
      trim: true,
      default: "",
    },
    invoiceNumber: {
      type: String,
      trim: true,
      default: "",
    },
    hostedInvoiceUrl: {
      type: String,
      trim: true,
      default: "",
    },
    invoicePdfUrl: {
      type: String,
      trim: true,
      default: "",
    },
    currency: {
      type: String,
      trim: true,
      lowercase: true,
      default: "usd",
    },
    status: {
      type: String,
      enum: invoiceStatuses,
      default: "pending",
      index: true,
    },
    amountDue: {
      type: Number,
      default: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    billingReason: {
      type: String,
      trim: true,
      default: "",
    },
    planType: {
      type: String,
      trim: true,
      default: "",
    },
    planTitle: {
      type: String,
      trim: true,
      default: "",
    },
    subscriptionTopic: {
      type: String,
      trim: true,
      default: "",
    },
    lines: {
      type: [invoiceLineSchema],
      default: [],
    },
    rawInvoice: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

subscriptionInvoiceSchema.index({ user: 1, createdAt: -1 });

const SubscriptionInvoice = mongoose.model("SubscriptionInvoice", subscriptionInvoiceSchema);

export default SubscriptionInvoice;

import mongoose from "mongoose";
import { billingCycles, pricingPlanTiers, pricingAudienceRoles } from "./pricing.model.js";

export const stripeSubscriptionStatuses = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
];

export const localSubscriptionStatuses = [
  "pending",
  "active",
  "cancel_at_period_end",
  "canceled",
  "suspended",
  "past_due",
  "incomplete",
  "unpaid",
];

const billingAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      default: "",
    },
    line1: {
      type: String,
      trim: true,
      default: "",
    },
    line2: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    postalCode: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const subscriptionAmountSnapshotSchema = new mongoose.Schema(
  {
    currency: {
      type: String,
      trim: true,
      lowercase: true,
      default: "usd",
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: pricingAudienceRoles,
      required: true,
    },
    pricing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pricing",
      default: null,
    },
    planType: {
      type: String,
      required: true,
      trim: true,
    },
    planTier: {
      type: String,
      enum: pricingPlanTiers,
      required: true,
    },
    planTitle: {
      type: String,
      required: true,
      trim: true,
    },
    billingCycle: {
      type: String,
      enum: billingCycles,
      required: true,
    },
    subscriptionTopic: {
      type: String,
      trim: true,
      default: "",
    },
    featureSnapshot: {
      type: [String],
      default: [],
    },
    topicSnapshot: {
      type: [String],
      default: [],
    },
    stripeCustomerId: {
      type: String,
      trim: true,
      required: true,
    },
    stripeProductId: {
      type: String,
      trim: true,
      required: true,
    },
    stripePriceId: {
      type: String,
      trim: true,
      required: true,
    },
    stripeSubscriptionId: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    stripePaymentMethodId: {
      type: String,
      trim: true,
      default: "",
    },
    stripeLatestInvoiceId: {
      type: String,
      trim: true,
      default: "",
    },
    stripeStatus: {
      type: String,
      enum: stripeSubscriptionStatuses,
      default: "incomplete",
    },
    localStatus: {
      type: String,
      enum: localSubscriptionStatuses,
      default: "pending",
      index: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    currentPeriodStart: {
      type: Date,
      default: null,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
    nextBillingDate: {
      type: Date,
      default: null,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
    billingAddress: {
      type: billingAddressSchema,
      default: () => ({}),
    },
    amountSnapshot: {
      type: subscriptionAmountSnapshotSchema,
      default: () => ({}),
    },
    latestInvoiceSummary: {
      invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubscriptionInvoice",
        default: null,
      },
      stripeInvoiceId: {
        type: String,
        trim: true,
        default: "",
      },
      invoiceNumber: {
        type: String,
        trim: true,
        default: "",
      },
      status: {
        type: String,
        trim: true,
        default: "",
      },
      amountPaid: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        trim: true,
        lowercase: true,
        default: "usd",
      },
      paidAt: {
        type: Date,
        default: null,
      },
    },
    lastWebhookEvent: {
      type: String,
      trim: true,
      default: "",
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

subscriptionSchema.index({ user: 1, localStatus: 1, createdAt: -1 });

const UserSubscription = mongoose.model("UserSubscription", subscriptionSchema);

export default UserSubscription;

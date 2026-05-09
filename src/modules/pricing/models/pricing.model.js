import mongoose from "mongoose";

export const pricingPlanTypes = [
  "investor-basic",
  "investor-pro",
  "investee-basic",
  "investee-pro",
];

export const pricingAudienceRoles = ["investor", "investee"];
export const pricingPlanTiers = ["basic", "pro"];
export const billingCycles = ["monthly", "annual"];

const pricingPlanSchema = new mongoose.Schema(
  {
    planType: {
      type: String,
      enum: pricingPlanTypes,
      required: true,
      trim: true,
    },
    audienceRole: {
      type: String,
      enum: pricingAudienceRoles,
      required: true,
    },
    tier: {
      type: String,
      enum: pricingPlanTiers,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
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
    pricePerMonth: {
      type: Number,
      required: true,
      min: 0,
    },
    discountMonthly: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    discountAnnually: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    monthlyPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    annualPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    features: {
      type: [String],
      default: [],
    },
    subscriptionTopics: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    stripeProductId: {
      type: String,
      trim: true,
      default: "",
    },
    stripeMonthlyPriceId: {
      type: String,
      trim: true,
      default: "",
    },
    stripeAnnualPriceId: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);

const pricingSchema = new mongoose.Schema(
  {
    plans: {
      type: [pricingPlanSchema],
      required: true,
      validate: {
        validator(plans) {
          return Array.isArray(plans) && plans.length === pricingPlanTypes.length;
        },
        message: "plans must contain all supported pricing plans",
      },
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastModifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Pricing = mongoose.model("Pricing", pricingSchema);

export default Pricing;

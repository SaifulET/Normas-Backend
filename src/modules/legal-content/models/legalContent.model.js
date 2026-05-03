import mongoose from "mongoose";

const legalContentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["terms-and-conditions", "privacy-policy"],
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    content: {
      type: String,
      default: "",
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

const LegalContent = mongoose.model("LegalContent", legalContentSchema);

export default LegalContent;

import mongoose from "mongoose";

const savedListSchema = new mongoose.Schema(
  {
    investor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    list: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "List",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

savedListSchema.index({ investor: 1, list: 1 }, { unique: true });
savedListSchema.index({ investor: 1, createdAt: -1 });

const SavedList = mongoose.model("SavedList", savedListSchema);

export default SavedList;

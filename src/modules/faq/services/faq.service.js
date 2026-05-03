import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import Faq from "../models/faq.model.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const getFaqOrThrow = async (faqId) => {
  if (!isValidObjectId(faqId)) {
    throw new AppError("Invalid faqId", 400);
  }

  const faq = await Faq.findById(faqId);

  if (!faq) {
    throw new AppError("FAQ not found", 404);
  }

  return faq;
};

export const createFaq = async (payload) => {
  const faq = await Faq.create({
    question: payload.question || "",
    answer: payload.answer || "",
  });

  return Faq.findById(faq._id);
};

export const updateFaq = async (faqId, payload) => {
  const faq = await getFaqOrThrow(faqId);

  if (typeof payload.question !== "undefined") {
    faq.question = payload.question;
  }

  if (typeof payload.answer !== "undefined") {
    faq.answer = payload.answer;
  }

  await faq.save();

  return Faq.findById(faq._id);
};

export const getAllFaqs = async () => {
  return Faq.find().sort({ createdAt: -1 });
};

export const getFaqById = async (faqId) => {
  const faq = await getFaqOrThrow(faqId);
  return Faq.findById(faq._id);
};

export const deleteFaq = async (faqId) => {
  const faq = await getFaqOrThrow(faqId);

  await Faq.findByIdAndDelete(faqId);

  return {
    id: faq._id,
    message: "FAQ deleted successfully",
  };
};

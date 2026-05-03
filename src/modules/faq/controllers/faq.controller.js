import * as faqService from "../services/faq.service.js";

export const createFaq = async (req, res, next) => {
  try {
    const result = await faqService.createFaq(req.body);

    res.status(201).json({
      success: true,
      message: "FAQ created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateFaq = async (req, res, next) => {
  try {
    const result = await faqService.updateFaq(req.params.faqId, req.body);

    res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllFaqs = async (_req, res, next) => {
  try {
    const result = await faqService.getAllFaqs();

    res.status(200).json({
      success: true,
      message: "FAQs fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getFaqById = async (req, res, next) => {
  try {
    const result = await faqService.getFaqById(req.params.faqId);

    res.status(200).json({
      success: true,
      message: "FAQ fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFaq = async (req, res, next) => {
  try {
    const result = await faqService.deleteFaq(req.params.faqId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

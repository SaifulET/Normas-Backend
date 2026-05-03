import * as legalContentService from "../services/legalContent.service.js";

export const createLegalContent = async (req, res, next) => {
  try {
    const result = await legalContentService.createLegalContent(req.user, req.body);

    res.status(201).json({
      success: true,
      message: "Legal content created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateLegalContent = async (req, res, next) => {
  try {
    const result = await legalContentService.updateLegalContent(
      req.user,
      req.params.contentId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Legal content updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllLegalContents = async (_req, res, next) => {
  try {
    const result = await legalContentService.getAllLegalContents();

    res.status(200).json({
      success: true,
      message: "Legal contents fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getLegalContentById = async (req, res, next) => {
  try {
    const result = await legalContentService.getLegalContentById(req.params.contentId);

    res.status(200).json({
      success: true,
      message: "Legal content fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getLegalContentByType = async (req, res, next) => {
  try {
    const result = await legalContentService.getLegalContentByType(req.params.type);

    res.status(200).json({
      success: true,
      message: "Legal content fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLegalContent = async (req, res, next) => {
  try {
    const result = await legalContentService.deleteLegalContent(req.params.contentId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

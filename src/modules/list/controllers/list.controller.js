import * as listService from "../services/list.service.js";

export const createList = async (req, res, next) => {
  try {
    const result = await listService.createList(req.user, req.body);

    res.status(201).json({
      success: true,
      message: "List created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateList = async (req, res, next) => {
  try {
    const result = await listService.updateList(req.user, req.params.listId, req.body);

    res.status(200).json({
      success: true,
      message: "List updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllLists = async (_req, res, next) => {
  try {
    const result = await listService.getAllLists();

    res.status(200).json({
      success: true,
      message: "Lists fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getFilteredLists = async (req, res, next) => {
  try {
    const result = await listService.getFilteredLists(req.query);

    res.status(200).json({
      success: true,
      message: "Filtered lists fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSectorListCounts = async (req, res, next) => {
  try {
    const result = await listService.getSectorListCounts(req.query);

    res.status(200).json({
      success: true,
      message: "Sector list counts fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyLists = async (req, res, next) => {
  try {
    const result = await listService.getMyLists(req.user);

    res.status(200).json({
      success: true,
      message: "User lists fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getListById = async (req, res, next) => {
  try {
    const result = await listService.getListById(req.params.listId);

    res.status(200).json({
      success: true,
      message: "List fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateListViewCount = async (req, res, next) => {
  try {
    const result = await listService.updateListViewCount(req.params.listId, req.body);

    res.status(200).json({
      success: true,
      message: "List view count updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const changeListStatus = async (req, res, next) => {
  try {
   
    const result = await listService.changeListStatus(req.user, req.params.listId, req.body.status);

    res.status(200).json({
      success: true,
      message: "List status updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteList = async (req, res, next) => {
  try {
    const result = await listService.deleteList(req.user, req.params.listId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

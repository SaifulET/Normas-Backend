import * as blogService from "../services/blog.service.js";

export const uploadBlogImage = async (req, res, next) => {
  try {
    res.status(201).json({
      success: true,
      message: "Blog image uploaded successfully",
      data: req.uploadedBlogImage,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBlogImage = async (req, res, next) => {
  try {
    const result = await blogService.deleteUploadedBlogImage(req.body.key);

    res.status(200).json({
      success: true,
      message: "Blog image deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createBlog = async (req, res, next) => {
  try {
    const result = await blogService.createBlog(req.user, req.body);

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBlog = async (req, res, next) => {
  try {
    const result = await blogService.updateBlog(req.params.blogId, req.body);

    res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicBlogs = async (req, res, next) => {
  try {
    const result = await blogService.getPublicBlogs(req.query);

    res.status(200).json({
      success: true,
      message: "Blogs fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicBlogBySlug = async (req, res, next) => {
  try {
    const result = await blogService.getPublicBlogBySlug(req.params.slug);

    res.status(200).json({
      success: true,
      message: "Blog fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSuperadminBlogs = async (req, res, next) => {
  try {
    const result = await blogService.getSuperadminBlogs(req.query);

    res.status(200).json({
      success: true,
      message: "Blogs fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSuperadminBlogById = async (req, res, next) => {
  try {
    const result = await blogService.getSuperadminBlogById(req.params.blogId);

    res.status(200).json({
      success: true,
      message: "Blog fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBlog = async (req, res, next) => {
  try {
    const result = await blogService.deleteBlog(req.params.blogId);

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

import express from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  handleBlogCoverImageUpload,
  handleBlogInlineImageUpload,
} from "../../../middlewares/blogUpload.middleware.js";
import * as blogController from "../controllers/blog.controller.js";

export const publicBlogRouter = express.Router();
export const superadminBlogRouter = express.Router();

publicBlogRouter.get("/", blogController.getPublicBlogs);
publicBlogRouter.get("/:slug", blogController.getPublicBlogBySlug);

superadminBlogRouter.use(authenticate, authorize("superadmin"));
superadminBlogRouter.post("/images", handleBlogInlineImageUpload, blogController.uploadBlogImage);
superadminBlogRouter.delete("/images", blogController.deleteBlogImage);
superadminBlogRouter.post("/", handleBlogCoverImageUpload, blogController.createBlog);
superadminBlogRouter.get("/", blogController.getSuperadminBlogs);
superadminBlogRouter.get("/:blogId", blogController.getSuperadminBlogById);
superadminBlogRouter.patch("/:blogId", handleBlogCoverImageUpload, blogController.updateBlog);
superadminBlogRouter.delete("/:blogId", blogController.deleteBlog);

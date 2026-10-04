import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import Blog, { blogStatuses } from "../models/blog.model.js";
import { deleteBlogImageFromS3 } from "./blogStorage.service.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const sanitizeHtml = (html = "") =>
  String(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|iframe|object|embed|link|meta|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|link|meta|style)\b[^>]*\/?>/gi, "")
    .replace(/\s(?:on[a-z]+)\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, "");

const stripHtml = (html = "") => sanitizeHtml(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `blog-${Date.now()}`;

const createUniqueSlug = async (title, blogIdToIgnore) => {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let index = 1;

  while (await Blog.exists({ slug, ...(blogIdToIgnore ? { _id: { $ne: blogIdToIgnore } } : {}) })) {
    index += 1;
    slug = `${baseSlug}-${index}`;
  }

  return slug;
};

const extractBlogImageKeys = (html = "") => {
  const keys = new Set();
  const imageSourcePattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = imageSourcePattern.exec(html))) {
    const src = match[1] || "";

    try {
      const url = new URL(src);
      const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

      if (key.startsWith("blogs/")) {
        keys.add(key);
      }
    } catch {
      if (src.startsWith("blogs/")) {
        keys.add(src);
      }
    }
  }

  return keys;
};

const getBlogOrThrow = async (blogId) => {
  if (!isValidObjectId(blogId)) {
    throw new AppError("Invalid blogId", 400);
  }

  const blog = await Blog.findById(blogId);

  if (!blog) {
    throw new AppError("Blog not found", 404);
  }

  return blog;
};

export const createBlog = async (user, payload) => {
  const title = String(payload.title || "").trim();
  const description = sanitizeHtml(payload.description || "");
  const status = blogStatuses.includes(payload.status) ? payload.status : "published";

  if (!title || !stripHtml(description)) {
    throw new AppError("Title and description are required", 400);
  }

  const blog = await Blog.create({
    coverImage: payload.coverImage || null,
    createdBy: user.userId,
    description,
    publishedAt: status === "published" ? new Date() : null,
    slug: await createUniqueSlug(title),
    status,
    title,
  });

  return Blog.findById(blog._id).populate("createdBy", "name email role");
};

export const updateBlog = async (blogId, payload) => {
  const blog = await getBlogOrThrow(blogId);
  const previousDescription = blog.description || "";
  const previousCoverKey = blog.coverImage?.key;

  if (typeof payload.title !== "undefined") {
    const title = String(payload.title || "").trim();

    if (!title) {
      throw new AppError("Title is required", 400);
    }

    blog.title = title;
    blog.slug = await createUniqueSlug(title, blog._id);
  }

  if (typeof payload.description !== "undefined") {
    const description = sanitizeHtml(payload.description || "");

    if (!stripHtml(description)) {
      throw new AppError("Description is required", 400);
    }

    blog.description = description;
  }

  if (payload.coverImage) {
    blog.coverImage = payload.coverImage;
  }

  if (typeof payload.removeCoverImage !== "undefined" && String(payload.removeCoverImage) === "true") {
    blog.coverImage = null;
  }

  if (typeof payload.status !== "undefined") {
    if (!blogStatuses.includes(payload.status)) {
      throw new AppError("Invalid blog status", 400);
    }

    const wasPublished = blog.status === "published";
    blog.status = payload.status;

    if (!wasPublished && payload.status === "published") {
      blog.publishedAt = new Date();
    }
  }

  await blog.save();

  if (previousCoverKey && previousCoverKey !== blog.coverImage?.key) {
    await deleteBlogImageFromS3(previousCoverKey);
  }

  const previousKeys = extractBlogImageKeys(previousDescription);
  const nextKeys = extractBlogImageKeys(blog.description || "");
  await Promise.all([...previousKeys].filter((key) => !nextKeys.has(key)).map((key) => deleteBlogImageFromS3(key)));

  return Blog.findById(blog._id).populate("createdBy", "name email role");
};

export const getPublicBlogs = async (query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 50);
  const skip = (page - 1) * limit;
  const filter = { status: "published" };

  const [blogs, total] = await Promise.all([
    Blog.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit).populate("createdBy", "name email role"),
    Blog.countDocuments(filter),
  ]);

  return {
    blogs,
    pagination: {
      limit,
      page,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getPublicBlogBySlug = async (slug) => {
  const blog = await Blog.findOne({ slug, status: "published" }).populate("createdBy", "name email role");

  if (!blog) {
    throw new AppError("Blog not found", 404);
  }

  return blog;
};

export const getSuperadminBlogs = async (query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
  const skip = (page - 1) * limit;
  const filter = {};

  if (blogStatuses.includes(query.status)) {
    filter.status = query.status;
  }

  const [blogs, total] = await Promise.all([
    Blog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("createdBy", "name email role"),
    Blog.countDocuments(filter),
  ]);

  return {
    blogs,
    pagination: {
      limit,
      page,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getSuperadminBlogById = async (blogId) => {
  const blog = await getBlogOrThrow(blogId);
  return Blog.findById(blog._id).populate("createdBy", "name email role");
};

export const deleteUploadedBlogImage = async (key) => {
  await deleteBlogImageFromS3(key);
  return { key };
};

export const deleteBlog = async (blogId) => {
  const blog = await getBlogOrThrow(blogId);
  const keys = extractBlogImageKeys(blog.description || "");

  if (blog.coverImage?.key) {
    keys.add(blog.coverImage.key);
  }

  await Blog.findByIdAndDelete(blog._id);
  await Promise.all([...keys].map((key) => deleteBlogImageFromS3(key)));

  return { id: blog._id };
};

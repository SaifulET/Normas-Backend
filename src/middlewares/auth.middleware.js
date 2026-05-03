import jwt from "jsonwebtoken";
import User from "../modules/auth/models/user.model.js";
import AppError from "../utils/appError.js";

const getBearerToken = (authorization = "") => {
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError("Authorization token is missing or invalid", 401);
  }

  return token;
};

export const authenticate = async (req, _res, next) => {
  try {
    console.log("Authenticating user...");
    const token = getBearerToken(req.headers.authorization);
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new AppError("User not found", 401);
    }

    req.user = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error.name === "JsonWebTokenError" || error.name === "TokenExpiredError"
      ? new AppError("Invalid or expired access token", 401)
      : error);
  }
};

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError("Unauthorized", 401));
  }

  if (!roles.includes(req.user.role)) {
    console.log(`User role ${req.user.role} does not have permission to access this resource`);
    return next(new AppError("Forbidden: insufficient permissions", 403));
  }

  next();
};

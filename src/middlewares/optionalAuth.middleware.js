import jwt from "jsonwebtoken";
import User from "../modules/auth/models/user.model.js";

export const optionalAuthenticate = async (req, _res, next) => {
  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return next();
    }

    const token = authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return next();
    }

    req.user = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (_error) {
    next();
  }
};

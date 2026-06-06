import mongoose from "mongoose";
import AppError from "../../../utils/appError.js";
import User from "../../auth/models/user.model.js";
import Kyc from "../../kyc/models/kyc.model.js";
import List from "../../list/models/list.model.js";
import { serializeListForViewer } from "../../list/services/list.service.js";

const userRoles = ["investor", "investee"];
const accountStatuses = ["active", "inactive", "pending"];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeText = (value) => String(value || "").trim();

const escapeRegex = (value) => normalizeText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = ({ page = 1, limit = 20 } = {}) => {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  };
};

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) {
    return null;
  }

  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age;
};

const assertTargetUserId = (userId) => {
  if (!isValidObjectId(userId)) {
    throw new AppError("Invalid userId", 400);
  }
};

const buildUsersQuery = (query = {}) => {
  const filters = {
    role: {
      $in: userRoles,
    },
  };

  const role = normalizeText(query.role);

  if (role) {
    if (!userRoles.includes(role)) {
      throw new AppError("role must be investor or investee", 400);
    }

    filters.role = role;
  }

  const accountStatus = normalizeText(query.accountStatus || query.status);

  if (accountStatus) {
    if (!accountStatuses.includes(accountStatus)) {
      throw new AppError("accountStatus must be active, inactive, or pending", 400);
    }

    filters.accountStatus = accountStatus;
  }

  const search = normalizeText(query.search);

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");

    filters.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { mobile: searchRegex },
    ];
  }

  return filters;
};

const normalizeKycMap = (kycs) => {
  return new Map(kycs.map((kyc) => [kyc.user.toString(), kyc]));
};

const buildProfileImage = (user, kyc) =>
  normalizeText(user.profileImage) || normalizeText(kyc?.faceVerification?.facePhoto);

const buildAdminUserSummary = ({ user, kyc, pitchCount = 0 }) => ({
  id: user._id,
  profileImage: buildProfileImage(user, kyc),
  name: user.name,
  email: user.email,
  gmail: user.email,
  mobile: user.mobile || "",
  accountType: user.role,
  role: user.role,
  country: kyc?.personalIdentity?.countryOfResidence || "",
  joiningDate: user.createdAt,
  accountStatus: user.accountStatus || "pending",
  kycStatus: kyc?.status || "not_submitted",
  pitchCount,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const buildProfile = (user, kyc) => ({
  id: user._id,
  profileImage: buildProfileImage(user, kyc),
  name: user.name,
  email: user.email,
  gmail: user.email,
  mobile: user.mobile || "",
  accountType: user.role,
  role: user.role,
  country: kyc?.personalIdentity?.countryOfResidence || "",
  age: calculateAge(kyc?.personalIdentity?.dateOfBirth),
  joiningDate: user.createdAt,
  accountStatus: user.accountStatus || "pending",
  taxPercentage: user.taxPercentage,
  socialLinks: user.socialLinks || {},
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const buildProfileKyc = (user, kyc) => ({
  profileImage: buildProfileImage(user, kyc),
  status: kyc?.status || "not_submitted",
  accountType: user.role,
  role: user.role,
  name: user.name,
  kycId: kyc?._id || null,
  currentStep: kyc?.currentStep || null,
  submittedAt: kyc?.createdAt || null,
  updatedAt: kyc?.updatedAt || null,
});

const findTargetUser = async (userId) => {
  assertTargetUserId(userId);

  const user = await User.findOne({
    _id: userId,
    role: {
      $in: userRoles,
    },
  }).lean();

  if (!user) {
    throw new AppError("Investor or investee user not found", 404);
  }

  return user;
};

const getUserKyc = (userId) =>
  Kyc.findOne({ user: userId })
    .populate("approval.reviewedBy", "name email role")
    .lean();

const getUserPitches = (userId) =>
  List.find({ user: userId })
    .populate("user", "name email role profileImage accountStatus")
    .sort({ createdAt: -1 })
    .lean()
    .then((pitches) =>
      pitches.map((pitch) => serializeListForViewer(pitch, { role: "superadmin" }))
    );

export const getAdminUsers = async (query = {}) => {
  const filters = buildUsersQuery(query);
  const { page, limit } = parsePagination(query);

  const [users, total] = await Promise.all([
    User.find(filters)
      .select("name email mobile profileImage accountStatus role createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filters),
  ]);

  const userIds = users.map((user) => user._id);
  const [kycs, pitchCounts] = await Promise.all([
    Kyc.find({ user: { $in: userIds } })
      .select("user status personalIdentity.countryOfResidence faceVerification.facePhoto")
      .lean(),
    List.aggregate([
      {
        $match: {
          user: {
            $in: userIds,
          },
        },
      },
      {
        $group: {
          _id: "$user",
          count: {
            $sum: 1,
          },
        },
      },
    ]),
  ]);

  const kycByUser = normalizeKycMap(kycs);
  const pitchCountByUser = new Map(
    pitchCounts.map((item) => [item._id.toString(), item.count])
  );

  return {
    users: users.map((user) =>
      buildAdminUserSummary({
        user,
        kyc: kycByUser.get(user._id.toString()),
        pitchCount: pitchCountByUser.get(user._id.toString()) || 0,
      })
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getAdminUserDetails = async (userId) => {
  const user = await findTargetUser(userId);
  const [kyc, pitches] = await Promise.all([getUserKyc(user._id), getUserPitches(user._id)]);

  return {
    profile: buildProfile(user, kyc),
    profileKyc: buildProfileKyc(user, kyc),
    kyc,
    pitches,
    features: pitches,
  };
};

export const getAdminUserProfile = async (userId) => {
  const user = await findTargetUser(userId);
  const kyc = await getUserKyc(user._id);

  return {
    profile: buildProfile(user, kyc),
    profileKyc: buildProfileKyc(user, kyc),
  };
};

export const getAdminUserKyc = async (userId) => {
  const user = await findTargetUser(userId);
  const kyc = await getUserKyc(user._id);

  return {
    user: buildProfileKyc(user, kyc),
    kyc,
  };
};

export const getAdminUserPitches = async (userId) => {
  const user = await findTargetUser(userId);
  const [kyc, pitches] = await Promise.all([getUserKyc(user._id), getUserPitches(user._id)]);

  return {
    user: buildProfile(user, kyc),
    pitches,
    features: pitches,
  };
};

export const updateAdminUserAccountStatus = async (userId, accountStatus) => {
  assertTargetUserId(userId);

  const normalizedStatus = normalizeText(accountStatus);

  if (!accountStatuses.includes(normalizedStatus)) {
    throw new AppError("accountStatus must be active, inactive, or pending", 400);
  }

  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      role: {
        $in: userRoles,
      },
    },
    {
      accountStatus: normalizedStatus,
    },
    {
      new: true,
    }
  ).lean();

  if (!user) {
    throw new AppError("Investor or investee user not found", 404);
  }

  const kyc = await getUserKyc(user._id);

  return buildAdminUserSummary({
    user,
    kyc,
    pitchCount: await List.countDocuments({ user: user._id }),
  });
};

import mongoose from "mongoose";
import Kyc from "../models/kyc.model.js";
import User from "../../auth/models/user.model.js";
import AppError from "../../../utils/appError.js";
import { notifySuperadmins, notifyUsers } from "../../notification/services/notification.service.js";

const allowedApplicantRoles = ["investor", "investee"];
const allowedStatuses = ["draft", "pending", "approved", "rejected"];
const allowedSteps = [1, 2, 3, 4, 5, 6, 7, 8];
const allowedFieldStatuses = ["pending", "approved", "declined"];

const fieldLabels = {
  "applicantInfo.applicantType": "Applicant Type",
  "applicantInfo.email": "Email Address",
  "applicantInfo.phoneNumber": "Phone Number",
  "applicantInfo.country": "Country",
  "applicantInfo.residentialAddress": "Residential / Registered Address",
  "applicantInfo.identificationType": "ID Type",
  "personalIdentity.fullLegalName": "Full Legal Name",
  "personalIdentity.dateOfBirth": "Date of Birth",
  "personalIdentity.countryOfResidence": "Country of Residence",
  "personalIdentity.identificationType": "Identification Type",
  "personalIdentity.identityDocument": "Identity Document",
  "personalIdentity.nationality": "Nationality",
  "personalIdentity.sourceOfWealth": "Source of Wealth",
  "personalIdentity.sourceOfWealthExplanation": "Source of Wealth Explanation",
  "addressVerification.proofOfAddress": "Proof of Address",
  "addressVerification.utilityBill": "Utility Bill",
  "addressVerification.bankStatement": "Bank Statement",
  "faceVerification.facePhoto": "Photo for Verification",
  "faceVerification.verificationVideo": "Verification Video",
  "companyInformation.companyName": "Company Name",
  "companyInformation.registeredCompanyName": "Registered Company Name",
  "companyInformation.tradingName": "Trading Name",
  "companyInformation.registrationNumber": "Registration Number",
  "companyInformation.countryOfIncorporation": "Country of Incorporation",
  "companyInformation.website": "Website",
  "companyInformation.registeredAddress": "Registered Address",
  "companyInformation.operatingAddress": "Operating Address",
  "companyInformation.certificateOfIncorporation": "Certificate of Incorporation",
  "companyInformation.articlesOfAssociation": "Articles of Association",
  "companyInformation.directorsShareholdersRegister": "Register of Directors / Shareholders",
  "pepSanctions.isPep": "PEP Status",
  "pepSanctions.relatedToPep": "Related to a PEP",
  "pepSanctions.associatedWithPep": "Associated with a PEP",
  "pepSanctions.pepDetails": "PEP Details",
  "pepSanctions.subjectToSanction": "Sanction Status",
  "pepSanctions.sanctionDetails": "Sanction Details",
  "financialInformation.sourceOfFunds": "Source of Funds",
  "financialInformation.explanation": "Source of Funds Explanation",
  "investorProfile.investorClassification": "Investor Classification",
  "investorProfile.expectedAnnualInvestment": "Expected Annual Investment",
  "investorProfile.preferredSectors": "Preferred Sectors",
  "investorProfile.riskTolerance": "Risk Tolerance",
  "investorProfile.investmentHorizon": "Investment Horizon",
  "investorProfile.compliance.doAmlPolicy": "AML Policy",
  "investorProfile.compliance.contactInternalKyc": "Internal KYC",
  "investorProfile.compliance.ongoingLegalDispute": "Ongoing Legal Disputes",
  "investorProfile.compliance.additionalDetails": "Compliance Details",
  "investorProfile.bankDetails.bankName": "Bank Name",
  "investorProfile.bankDetails.accountName": "Account Name",
  "investorProfile.bankDetails.iban": "IBAN / Account Number",
  "investorProfile.bankDetails.swiftCode": "SWIFT / Sort Code",
  "investorProfile.confirmLawfulFunds": "Lawful Funds Confirmation",
  "sourceOfFunds.salarySlip": "Salary Slip",
  "sourceOfFunds.businessDocument": "Business Document",
  "sourceOfFunds.taxReturns": "Tax Returns",
  "additionalDocuments.sourceOfWealthEvidence": "Source of Wealth Evidence",
  "additionalDocuments.proofOfFunds": "Proof of Funds",
  "additionalDocuments.corporateStructureChart": "Corporate Structure Chart",
  "additionalDocuments.taxComplianceCertificate": "Tax Compliance Certificate",
  "additionalDocuments.otherSupportingDocuments": "Other Supporting Documents",
  "declarations.identityAcknowledgement": "Identity Verification Acknowledgement",
  "declarations.confirmAccuracy": "Information Accuracy",
  "declarations.consentOngoingMonitoring": "Data Processing Consent",
  "declarations.authorizeAdditionalDocuments": "Additional Document Authorization",
  "declarations.governanceAgreement": "Governance Agreement",
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const asObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const hasOwn = (source, key) => Object.prototype.hasOwnProperty.call(source || {}, key);

const getPathValue = (source, path) =>
  path.split(".").reduce((current, key) => {
    if (current === null || typeof current === "undefined") {
      return undefined;
    }

    return current[key];
  }, source);

const isReviewValuePresent = (value) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "boolean") {
    return true;
  }

  if (value instanceof Date) {
    return true;
  }

  return value !== null && typeof value !== "undefined" && String(value).trim() !== "";
};

const getReviewLabel = (path) => {
  if (fieldLabels[path]) {
    return fieldLabels[path];
  }

  const ownerMatch = path.match(/^beneficialOwners\.(\d+)\.(.+)$/);

  if (ownerMatch) {
    const ownerNumber = Number(ownerMatch[1]) + 1;
    const field = ownerMatch[2]
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (letter) => letter.toUpperCase());
    return `Owner ${ownerNumber} ${field}`;
  }

  return path.split(".").at(-1) || path;
};

const flattenReviewEntries = (value, prefix = "", includeEmpty = false) => {
  if (!includeEmpty && !isReviewValuePresent(value)) {
    return [];
  }

  if (value instanceof Date || Array.isArray(value) || typeof value !== "object") {
    return includeEmpty || isReviewValuePresent(value)
      ? [{ path: prefix, label: getReviewLabel(prefix), value }]
      : [];
  }

  return Object.entries(value).flatMap(([key, childValue]) =>
    flattenReviewEntries(childValue, prefix ? `${prefix}.${key}` : key, includeEmpty)
  );
};

const getPayloadReviewEntries = (payload, { includeEmpty = false } = {}) => {
  const sections = [
    "applicantInfo",
    "personalIdentity",
    "addressVerification",
    "companyInformation",
    "beneficialOwners",
    "pepSanctions",
    "financialInformation",
    "investorProfile",
    "faceVerification",
    "sourceOfFunds",
    "additionalDocuments",
    "declarations",
  ];

  return sections.flatMap((section) =>
    hasOwn(payload, section) ? flattenReviewEntries(payload[section], section, includeEmpty) : []
  );
};

const upsertFieldReview = (kyc, { path, label, value }, patch = {}) => {
  if (!path) {
    return;
  }

  const now = new Date();
  const reviews = Array.isArray(kyc.fieldReviews) ? [...kyc.fieldReviews] : [];
  const existingIndex = reviews.findIndex((review) => review.path === path);
  const nextReview = {
    path,
    label: label || getReviewLabel(path),
    value,
    status: "pending",
    declineReason: "",
    reviewedBy: null,
    reviewedAt: null,
    updatedAt: now,
    ...patch,
  };

  if (existingIndex >= 0) {
    const existing = typeof reviews[existingIndex].toObject === "function"
      ? reviews[existingIndex].toObject()
      : reviews[existingIndex];
    reviews[existingIndex] = {
      ...existing,
      ...nextReview,
    };
  } else {
    reviews.push(nextReview);
  }

  kyc.fieldReviews = reviews;
};

const syncReviewEntries = (kyc, entries, patch = {}) => {
  for (const entry of entries) {
    upsertFieldReview(kyc, entry, patch);
  }
};

const notifyKycUpdated = async ({ actor, kyc, paths }) => {
  if (!paths.length) {
    return [];
  }

  return notifySuperadmins({
    type: "kyc_field_updated",
    title: "KYC updated",
    message: `${actor.name || "A user"} updated ${paths.length} KYC field${paths.length === 1 ? "" : "s"}.`,
    referenceType: "kyc",
    referenceId: kyc._id,
    metadata: {
      kycId: kyc._id,
      userId: kyc.user,
      paths,
    },
  });
};

const notifyKycReviewed = async ({ authUser, kyc, path, status, declineReason }) => {
  const label = getReviewLabel(path);
  const reviewedText = status === "approved" ? "approved" : "declined";

  return notifyUsers([kyc.user], {
    type: "kyc_field_reviewed",
    title: `KYC ${reviewedText}`,
    message: `${label} was ${reviewedText} by superadmin.${declineReason ? ` Reason: ${declineReason}` : ""}`,
    referenceType: "kyc",
    referenceId: kyc._id,
    metadata: {
      kycId: kyc._id,
      path,
      status,
      declineReason,
      reviewedBy: authUser.userId,
    },
  });
};

const parseJsonValue = (value, fallback) => {
  if (typeof value !== "string") {
    return value ?? fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeStringArray = (value) => {
  const parsedValue = parseJsonValue(value, value);

  if (Array.isArray(parsedValue)) {
    return parsedValue.filter((item) => typeof item === "string");
  }

  if (typeof parsedValue === "string" && parsedValue.trim()) {
    return [parsedValue.trim()];
  }

  return [];
};

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return Boolean(value);
};

const normalizeBooleanObject = (source, booleanKeys) => {
  const normalized = { ...asObject(source) };

  for (const key of booleanKeys) {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      normalized[key] = normalizeBoolean(normalized[key]);
    }
  }

  return normalized;
};

const mergeSubdocument = (current, next) => ({
  ...(typeof current?.toObject === "function" ? current.toObject() : asObject(current)),
  ...asObject(next),
});

const validateCreatePayload = (payload) => {
  const { currentStep } = payload;

  if (currentStep && !allowedSteps.includes(Number(currentStep))) {
    throw new AppError("currentStep must be between 1 and 8", 400);
  }
};

const validateFileUrlsOnUpdate = (payload) => {
  const fileFields = [
    ["personalIdentity", "identityDocument"],
    ["addressVerification", "proofOfAddress"],
    ["addressVerification", "utilityBill"],
    ["addressVerification", "bankStatement"],
    ["faceVerification", "facePhoto"],
    ["faceVerification", "verificationVideo"],
    ["sourceOfFunds", "salarySlip"],
    ["sourceOfFunds", "businessDocument"],
    ["sourceOfFunds", "taxReturns"],
    ["companyInformation", "certificateOfIncorporation"],
    ["companyInformation", "articlesOfAssociation"],
    ["companyInformation", "directorsShareholdersRegister"],
    ["additionalDocuments", "sourceOfWealthEvidence"],
    ["additionalDocuments", "proofOfFunds"],
    ["additionalDocuments", "corporateStructureChart"],
    ["additionalDocuments", "taxComplianceCertificate"],
    ["additionalDocuments", "otherSupportingDocuments"],
  ];

  for (const [section, field] of fileFields) {
    if (
      Object.prototype.hasOwnProperty.call(payload?.[section] || {}, field) &&
      typeof payload[section][field] !== "string"
    ) {
      throw new AppError(`${section}.${field} must be a file URL`, 400);
    }
  }

  if (Array.isArray(payload.beneficialOwners)) {
    for (const owner of payload.beneficialOwners) {
      if (
        Object.prototype.hasOwnProperty.call(owner || {}, "idDocument") &&
        typeof owner.idDocument !== "string"
      ) {
        throw new AppError("beneficialOwners.idDocument must be a file URL", 400);
      }
    }
  }
};

const normalizeBeneficialOwners = (owners, ownerDocuments) => {
  const parsedOwners = parseJsonValue(owners, owners);
  const ownerList = Array.isArray(parsedOwners) ? parsedOwners : [];
  const documentMap = asObject(ownerDocuments);

  return ownerList.map((owner, index) => ({
    ...asObject(owner),
    ...(documentMap[index]?.idDocument ? { idDocument: documentMap[index].idDocument } : {}),
  }));
};

const normalizeKycPayload = (payload = {}) => {
  const normalized = {
    ...payload,
    applicantInfo: asObject(payload.applicantInfo),
    personalIdentity: asObject(payload.personalIdentity),
    addressVerification: asObject(payload.addressVerification),
    faceVerification: asObject(payload.faceVerification),
    sourceOfFunds: asObject(payload.sourceOfFunds),
    companyInformation: asObject(payload.companyInformation),
    additionalDocuments: asObject(payload.additionalDocuments),
  };

  if (normalized.addressVerification.proofOfAddress && !normalized.addressVerification.utilityBill) {
    normalized.addressVerification.utilityBill = normalized.addressVerification.proofOfAddress;
  }

  if (normalized.personalIdentity.sourceOfWealth) {
    normalized.personalIdentity.sourceOfWealth = normalizeStringArray(normalized.personalIdentity.sourceOfWealth);
  }

  normalized.beneficialOwners = normalizeBeneficialOwners(payload.beneficialOwners, payload.beneficialOwnerDocuments);

  normalized.pepSanctions = normalizeBooleanObject(payload.pepSanctions, [
    "isPep",
    "relatedToPep",
    "associatedWithPep",
    "subjectToSanction",
  ]);

  normalized.financialInformation = {
    ...asObject(payload.financialInformation),
    sourceOfFunds: normalizeStringArray(payload.financialInformation?.sourceOfFunds),
  };

  normalized.investorProfile = {
    ...asObject(payload.investorProfile),
    compliance: normalizeBooleanObject(payload.investorProfile?.compliance, [
      "doAmlPolicy",
      "contactInternalKyc",
      "ongoingLegalDispute",
    ]),
    bankDetails: asObject(payload.investorProfile?.bankDetails),
  };

  if (Object.prototype.hasOwnProperty.call(normalized.investorProfile, "confirmLawfulFunds")) {
    normalized.investorProfile.confirmLawfulFunds = normalizeBoolean(normalized.investorProfile.confirmLawfulFunds);
  }

  normalized.declarations = normalizeBooleanObject(payload.declarations, [
    "identityAcknowledgement",
    "confirmAccuracy",
    "consentOngoingMonitoring",
    "authorizeAdditionalDocuments",
    "governanceAgreement",
  ]);

  return normalized;
};

const validateNormalizedPayload = (payload) => {
  const currentStep = Number(payload.currentStep || 1);

  if (!allowedSteps.includes(currentStep)) {
    throw new AppError("currentStep must be between 1 and 8", 400);
  }

  validateFileUrlsOnUpdate(payload);

  if (currentStep >= 2) {
    const { applicantInfo, personalIdentity, faceVerification, addressVerification } = payload;

    if (
      !applicantInfo.email ||
      !applicantInfo.phoneNumber ||
      !applicantInfo.country ||
      !applicantInfo.residentialAddress ||
      !personalIdentity.identityDocument ||
      !addressVerification.proofOfAddress ||
      !faceVerification.facePhoto
    ) {
      throw new AppError("Applicant information is incomplete", 400);
    }
  }

  if (currentStep >= 5 && payload.financialInformation.sourceOfFunds.length === 0) {
    throw new AppError("At least one source of funds is required", 400);
  }

  if (currentStep >= 8) {
    const declarations = payload.declarations;
    const acceptedAllDeclarations =
      declarations.identityAcknowledgement &&
      declarations.confirmAccuracy &&
      declarations.consentOngoingMonitoring &&
      declarations.authorizeAdditionalDocuments &&
      declarations.governanceAgreement;

    if (!acceptedAllDeclarations) {
      throw new AppError("All declarations must be accepted", 400);
    }
  }
};

const getUserOrThrow = async (userId) => {
  if (!isValidObjectId(userId)) {
    throw new AppError("Invalid userId", 400);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

const buildUserDetailsResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  mobile: user.mobile,
  profileImage: user.profileImage,
  taxPercentage: user.taxPercentage,
  socialLinks: user.socialLinks || {},
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const createKyc = async (authUser, payload) => {
  const normalizedPayload = normalizeKycPayload(payload);
  validateCreatePayload(normalizedPayload);
  validateNormalizedPayload(normalizedPayload);

  const user = await getUserOrThrow(authUser.userId);

  if (!allowedApplicantRoles.includes(user.role)) {
    throw new AppError("KYC is only available for investor and investee users", 400);
  }

  const existingKyc = await Kyc.findOne({ user: user._id });

  if (existingKyc) {
    throw new AppError("KYC already exists for this user", 409);
  }

  const kyc = await Kyc.create({
    user: user._id,
    role: user.role,
    currentStep: normalizedPayload.currentStep || 1,
    status: Number(normalizedPayload.currentStep) >= 8 ? "pending" : "draft",
    applicantInfo: normalizedPayload.applicantInfo,
    personalIdentity: normalizedPayload.personalIdentity,
    addressVerification: normalizedPayload.addressVerification,
    companyInformation: normalizedPayload.companyInformation,
    beneficialOwners: normalizedPayload.beneficialOwners,
    pepSanctions: normalizedPayload.pepSanctions,
    financialInformation: normalizedPayload.financialInformation,
    investorProfile: normalizedPayload.investorProfile,
    faceVerification: normalizedPayload.faceVerification,
    sourceOfFunds: normalizedPayload.sourceOfFunds,
    additionalDocuments: normalizedPayload.additionalDocuments,
    declarations: normalizedPayload.declarations,
  });

  syncReviewEntries(kyc, getPayloadReviewEntries(normalizedPayload), {
    status: "pending",
    declineReason: "",
    reviewedBy: null,
    reviewedAt: null,
  });
  await kyc.save();

  return Kyc.findById(kyc._id)
    .populate("user", "name email role")
    .populate("fieldReviews.reviewedBy", "name email role");
};

export const getAllKyc = async () => {
  return Kyc.find()
    .populate("user", "name email role")
    .populate("approval.reviewedBy", "name email role")
    .populate("fieldReviews.reviewedBy", "name email role")
    .sort({ createdAt: -1 });
};

export const getKycById = async (authUser, kycId) => {
  if (!isValidObjectId(kycId)) {
    throw new AppError("Invalid kycId", 400);
  }

  const kyc = await Kyc.findById(kycId)
    .populate("user", "name email role")
    .populate("approval.reviewedBy", "name email role")
    .populate("fieldReviews.reviewedBy", "name email role");

  if (!kyc) {
    throw new AppError("KYC not found", 404);
  }

  if (authUser.role !== "superadmin" && kyc.user._id.toString() !== authUser.userId) {
    throw new AppError("Forbidden: you can only access your own KYC", 403);
  }

  return kyc;
};

export const getMyKyc = async (authUser) => {
  await getUserOrThrow(authUser.userId);

  const kyc = await Kyc.findOne({ user: authUser.userId })
    .populate("user", "name email role")
    .populate("approval.reviewedBy", "name email role")
    .populate("fieldReviews.reviewedBy", "name email role");

  if (!kyc) {
    throw new AppError("KYC not found for this user", 404);
  }

  return kyc;
};

export const getMyDetailsWithKyc = async (authUser) => {
  const user = await getUserOrThrow(authUser.userId);

  const kyc = await Kyc.find({ user: authUser.userId })
    .populate("approval.reviewedBy", "name email role")
    .populate("fieldReviews.reviewedBy", "name email role")
    .sort({ createdAt: -1 });

  return {
    user: buildUserDetailsResponse(user),
    kyc,
  };
};

export const updateKyc = async (authUser, kycId, payload) => {
  if (!isValidObjectId(kycId)) {
    throw new AppError("Invalid kycId", 400);
  }

  const normalizedPayload = normalizeKycPayload(payload);
  validateNormalizedPayload(normalizedPayload);

  const kyc = await Kyc.findById(kycId);

  if (!kyc) {
    throw new AppError("KYC not found", 404);
  }

  const isOwner = kyc.user.toString() === authUser.userId;
  const isSuperadmin = authUser.role === "superadmin";

  if (!isOwner && !isSuperadmin) {
    throw new AppError("Forbidden: you can only update your own KYC", 403);
  }

  if (normalizedPayload.currentStep) {
    if (!allowedSteps.includes(Number(normalizedPayload.currentStep))) {
      throw new AppError("currentStep must be between 1 and 8", 400);
    }
    kyc.currentStep = Number(normalizedPayload.currentStep);
  }

  if (normalizedPayload.status) {
    if (!isSuperadmin) {
      throw new AppError("Only superadmin can update KYC status", 403);
    }

    if (!allowedStatuses.includes(normalizedPayload.status)) {
      throw new AppError("Invalid status", 400);
    }
    kyc.status = normalizedPayload.status;
  } else if (isOwner && hasOwn(normalizedPayload, "currentStep")) {
    kyc.status = Number(normalizedPayload.currentStep) >= 8 ? "pending" : "draft";
  }

  if (hasOwn(payload, "applicantInfo")) {
    kyc.applicantInfo = mergeSubdocument(kyc.applicantInfo, normalizedPayload.applicantInfo);
  }

  if (hasOwn(payload, "personalIdentity")) {
    kyc.personalIdentity = mergeSubdocument(kyc.personalIdentity, normalizedPayload.personalIdentity);
  }

  if (hasOwn(payload, "addressVerification")) {
    kyc.addressVerification = mergeSubdocument(kyc.addressVerification, normalizedPayload.addressVerification);
  }

  if (hasOwn(payload, "companyInformation")) {
    kyc.companyInformation = mergeSubdocument(kyc.companyInformation, normalizedPayload.companyInformation);
  }

  if (hasOwn(payload, "beneficialOwners") || hasOwn(payload, "beneficialOwnerDocuments")) {
    kyc.beneficialOwners = normalizedPayload.beneficialOwners;
  }

  if (hasOwn(payload, "pepSanctions")) {
    kyc.pepSanctions = mergeSubdocument(kyc.pepSanctions, normalizedPayload.pepSanctions);
  }

  if (hasOwn(payload, "financialInformation")) {
    kyc.financialInformation = mergeSubdocument(kyc.financialInformation, normalizedPayload.financialInformation);
  }

  if (hasOwn(payload, "investorProfile")) {
    kyc.investorProfile = {
      ...mergeSubdocument(kyc.investorProfile, normalizedPayload.investorProfile),
      compliance: mergeSubdocument(kyc.investorProfile?.compliance, normalizedPayload.investorProfile.compliance),
      bankDetails: mergeSubdocument(kyc.investorProfile?.bankDetails, normalizedPayload.investorProfile.bankDetails),
    };
  }

  if (hasOwn(payload, "faceVerification")) {
    kyc.faceVerification = mergeSubdocument(kyc.faceVerification, normalizedPayload.faceVerification);
  }

  if (hasOwn(payload, "sourceOfFunds")) {
    kyc.sourceOfFunds = mergeSubdocument(kyc.sourceOfFunds, normalizedPayload.sourceOfFunds);
  }

  if (hasOwn(payload, "additionalDocuments")) {
    kyc.additionalDocuments = mergeSubdocument(kyc.additionalDocuments, normalizedPayload.additionalDocuments);
  }

  if (hasOwn(payload, "declarations")) {
    kyc.declarations = mergeSubdocument(kyc.declarations, normalizedPayload.declarations);
  }

  const changedReviewEntries = isOwner ? getPayloadReviewEntries(normalizedPayload, { includeEmpty: true }) : [];

  if (changedReviewEntries.length) {
    syncReviewEntries(kyc, changedReviewEntries, {
      status: "pending",
      declineReason: "",
      reviewedBy: null,
      reviewedAt: null,
    });
  }

  if (normalizedPayload.approval) {
    if (!isSuperadmin) {
      throw new AppError("Only superadmin can review KYC", 403);
    }

    const { rejectionReason } = normalizedPayload.approval;

    kyc.approval.reviewedBy = authUser.userId;
    kyc.approval.reviewedAt = new Date();

    if (typeof rejectionReason !== "undefined") {
      kyc.approval.rejectionReason = rejectionReason || null;
    }
  }

  await kyc.save();

  if (changedReviewEntries.length) {
    await notifyKycUpdated({
      actor: authUser,
      kyc,
      paths: changedReviewEntries.map((entry) => entry.path),
    });
  }

  return Kyc.findById(kyc._id)
    .populate("user", "name email role")
    .populate("approval.reviewedBy", "name email role")
    .populate("fieldReviews.reviewedBy", "name email role");
};

export const reviewKycField = async (authUser, kycId, payload = {}) => {
  if (authUser.role !== "superadmin") {
    throw new AppError("Forbidden: only superadmin can review KYC fields", 403);
  }

  if (!isValidObjectId(kycId)) {
    throw new AppError("Invalid kycId", 400);
  }

  const path = String(payload.path || "").trim();
  const status = String(payload.status || "").trim().toLowerCase();
  const declineReason = String(payload.declineReason || payload.reason || "").trim();

  if (!path) {
    throw new AppError("path is required", 400);
  }

  if (!allowedFieldStatuses.includes(status) || status === "pending") {
    throw new AppError("status must be approved or declined", 400);
  }

  const kyc = await Kyc.findById(kycId);

  if (!kyc) {
    throw new AppError("KYC not found", 404);
  }

  const value = getPathValue(kyc.toObject(), path);

  if (!isReviewValuePresent(value)) {
    throw new AppError("KYC field was not found or is empty", 404);
  }

  upsertFieldReview(
    kyc,
    {
      path,
      label: getReviewLabel(path),
      value,
    },
    {
      status,
      declineReason: status === "declined" ? declineReason : "",
      reviewedBy: authUser.userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    }
  );

  await kyc.save();
  await notifyKycReviewed({
    authUser,
    kyc,
    path,
    status,
    declineReason: status === "declined" ? declineReason : "",
  });

  return Kyc.findById(kyc._id)
    .populate("user", "name email role")
    .populate("approval.reviewedBy", "name email role")
    .populate("fieldReviews.reviewedBy", "name email role");
};

export const deleteKyc = async (kycId) => {
  if (!isValidObjectId(kycId)) {
    throw new AppError("Invalid kycId", 400);
  }

  const kyc = await Kyc.findByIdAndDelete(kycId);

  if (!kyc) {
    throw new AppError("KYC not found", 404);
  }

  return {
    id: kyc._id,
    message: "KYC deleted successfully",
  };
};

export const deleteKycByUser = async (authUser, kycId) => {
  if (!isValidObjectId(kycId)) {
    throw new AppError("Invalid kycId", 400);
  }

  const kyc = await Kyc.findById(kycId);

  if (!kyc) {
    throw new AppError("KYC not found", 404);
  }

  const isOwner = kyc.user.toString() === authUser.userId;
  const isSuperadmin = authUser.role === "superadmin";

  if (!isOwner && !isSuperadmin) {
    throw new AppError("Forbidden: you can only delete your own KYC", 403);
  }

  await Kyc.findByIdAndDelete(kycId);

  return {
    id: kyc._id,
    message: "KYC deleted successfully",
  };
};

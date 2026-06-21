import mongoose from "mongoose";

const kycFieldStatuses = ["pending", "approved", "declined"];

const kycFieldReviewSchema = new mongoose.Schema(
  {
    path: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
      default: "",
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: kycFieldStatuses,
      default: "pending",
    },
    declineReason: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const kycSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    
      unique: true,
    },
    role: {
      type: String,
      enum: ["investor", "investee"],
     
    },
    currentStep: {
      type: Number,
      enum: [1, 2, 3, 4, 5, 6, 7, 8],
      default: 1,
    },
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "pending",
    },
    personalIdentity: {
      fullLegalName: {
        type: String,
      
        trim: true,
      },
      dateOfBirth: {
        type: Date,
     
      },
      countryOfResidence: {
        type: String,
      
        trim: true,
      },
      identificationType: {
        type: String,
       
        trim: true,
      },
      identityDocument: {
        type: String,
        
        trim: true,
      },
      nationality: {
        type: String,
        trim: true,
      },
      sourceOfWealth: {
        type: [String],
        default: [],
      },
      sourceOfWealthExplanation: {
        type: String,
        trim: true,
      },
    },
    applicantInfo: {
      applicantType: {
        type: String,
        enum: ["individual", "company"],
        default: "individual",
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      phoneNumber: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
      },
      residentialAddress: {
        type: String,
        trim: true,
      },
      identificationType: {
        type: String,
        trim: true,
      },
    },
    addressVerification: {
      proofOfAddress: {
        type: String,
        trim: true,
      },
      utilityBill: {
        type: String,
        trim: true,
      },
      bankStatement: {
        type: String,
        trim: true,
      },
    },
    companyInformation: {
      companyName: {
        type: String,
        trim: true,
      },
      registeredCompanyName: {
        type: String,
        trim: true,
      },
      tradingName: {
        type: String,
        trim: true,
      },
      registrationNumber: {
        type: String,
        trim: true,
      },
      countryOfIncorporation: {
        type: String,
        trim: true,
      },
      website: {
        type: String,
        trim: true,
      },
      registeredAddress: {
        type: String,
        trim: true,
      },
      operatingAddress: {
        type: String,
        trim: true,
      },
      certificateOfIncorporation: {
        type: String,
        trim: true,
      },
      articlesOfAssociation: {
        type: String,
        trim: true,
      },
      directorsShareholdersRegister: {
        type: String,
        trim: true,
      },
    },
    beneficialOwners: [
      {
        fullLegalName: {
          type: String,
          trim: true,
        },
        ownershipPercentage: {
          type: String,
          trim: true,
        },
        nationality: {
          type: String,
          trim: true,
        },
        sourceOfWealth: {
          type: String,
          trim: true,
        },
        sourceOfFunds: {
          type: String,
          trim: true,
        },
        idDocument: {
          type: String,
          trim: true,
        },
      },
    ],
    pepSanctions: {
      isPep: {
        type: Boolean,
        default: false,
      },
      relatedToPep: {
        type: Boolean,
        default: false,
      },
      associatedWithPep: {
        type: Boolean,
        default: false,
      },
      pepDetails: {
        type: String,
        trim: true,
      },
      associatedWithPepDetails: {
        type: String,
        trim: true,
      },
      subjectToSanction: {
        type: Boolean,
        default: false,
      },
      sanctionDetails: {
        type: String,
        trim: true,
      },
    },
    financialInformation: {
      sourceOfFunds: {
        type: [String],
        default: [],
      },
      explanation: {
        type: String,
        trim: true,
      },
    },
    investorProfile: {
      investorClassification: {
        type: String,
        trim: true,
      },
      expectedAnnualInvestment: {
        type: String,
        trim: true,
      },
      preferredSectors: {
        type: String,
        trim: true,
      },
      riskTolerance: {
        type: String,
        trim: true,
      },
      investmentHorizon: {
        type: String,
        trim: true,
      },
      compliance: {
        doAmlPolicy: {
          type: Boolean,
          default: false,
        },
        contactInternalKyc: {
          type: Boolean,
          default: false,
        },
        ongoingLegalDispute: {
          type: Boolean,
          default: false,
        },
        additionalDetails: {
          type: String,
          trim: true,
        },
      },
      bankDetails: {
        bankName: {
          type: String,
          trim: true,
        },
        accountName: {
          type: String,
          trim: true,
        },
        iban: {
          type: String,
          trim: true,
        },
        swiftCode: {
          type: String,
          trim: true,
        },
      },
      confirmLawfulFunds: {
        type: Boolean,
        default: false,
      },
    },
    faceVerification: {
      facePhoto: {
        type: String,
       
        trim: true,
      },
      verificationVideo: {
        type: String,
        
        trim: true,
      },
    },
    sourceOfFunds: {
      salarySlip: {
        type: String,
        
        trim: true,
      },
      businessDocument: {
        type: String,
        
        trim: true,
      },
      taxReturns: {
        type: String,
        
        trim: true,
      },
    },
    additionalDocuments: {
      sourceOfWealthEvidence: {
        type: String,
        trim: true,
      },
      proofOfFunds: {
        type: String,
        trim: true,
      },
      corporateStructureChart: {
        type: String,
        trim: true,
      },
      taxComplianceCertificate: {
        type: String,
        trim: true,
      },
      otherSupportingDocuments: {
        type: String,
        trim: true,
      },
    },
    declarations: {
      identityAcknowledgement: {
        type: Boolean,
        default: false,
      },
      confirmAccuracy: {
        type: Boolean,
        default: false,
      },
      consentOngoingMonitoring: {
        type: Boolean,
        default: false,
      },
      authorizeAdditionalDocuments: {
        type: Boolean,
        default: false,
      },
      governanceAgreement: {
        type: Boolean,
        default: false,
      },
    },
    fieldReviews: {
      type: [kycFieldReviewSchema],
      default: [],
    },
    approval: {
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      rejectionReason: {
        type: String,
        trim: true,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

const Kyc = mongoose.model("Kyc", kycSchema);

export default Kyc;

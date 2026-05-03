import mongoose from "mongoose";

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
      enum: [1, 2, 3, 4],
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
    },
    addressVerification: {
      utilityBill: {
        type: String,
        trim: true,
      },
      bankStatement: {
        type: String,
        trim: true,
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

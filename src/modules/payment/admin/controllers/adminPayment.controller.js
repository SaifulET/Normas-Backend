import * as adminPaymentService from "../services/adminPayment.service.js";

export const getAdminPayments = async (req, res, next) => {
  try {
    const result = await adminPaymentService.getAdminPayments(req.query);

    res.status(200).json({
      success: true,
      message: "Payments fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminPaymentById = async (req, res, next) => {
  try {
    const result = await adminPaymentService.getAdminPaymentById(req.params.paymentId);

    res.status(200).json({
      success: true,
      message: "Payment fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminPayment = async (req, res, next) => {
  try {
    const result = await adminPaymentService.deleteAdminPayment(req.params.paymentId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

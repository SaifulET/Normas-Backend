import * as blockedIpService from "../services/blockedIp.service.js";

export const getBlockedIps = async (req, res, next) => {
  try {
    const result = await blockedIpService.getBlockedIps(req.query);

    res.status(200).json({
      success: true,
      message: "Blocked IPs fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const unblockIp = async (req, res, next) => {
  try {
    const result = await blockedIpService.unblockIp(req.params.blockedIpId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

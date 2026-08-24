const defaultSenderName = "Early-N";
const defaultSenderEmail = "info@early-n.com";

export const escapeEmailHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getConfiguredEmail = (...values) => values.map((value) => value?.trim()).find(Boolean) || "";

const quoteSenderName = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export const getEmailSenderAddress = () =>
  getConfiguredEmail(process.env.EMAIL_FROM_ADDRESS, process.env.AWS_SES_FROM_EMAIL) || defaultSenderEmail;

export const getEmailSenderName = () => getConfiguredEmail(process.env.EMAIL_FROM_NAME) || defaultSenderName;

export const getEmailFromHeader = () => `"${quoteSenderName(getEmailSenderName())}" <${getEmailSenderAddress()}>`;

export const getEmailReplyTo = () => getConfiguredEmail(process.env.EMAIL_REPLY_TO, process.env.EMAIL_FROM_ADDRESS);

export const getSmtpEnvelopeFrom = () => getConfiguredEmail(process.env.EMAIL_ENVELOPE_FROM, process.env.SMTP_USER);

const buildBrandHeader = () => {
  const logoUrl = getConfiguredEmail(process.env.EMAIL_LOGO_URL);

  if (logoUrl) {
    return `
      <img src="${escapeEmailHtml(logoUrl)}" alt="${escapeEmailHtml(getEmailSenderName())}" width="132" style="display:block;border:0;outline:none;text-decoration:none;max-width:132px;height:auto;" />
    `;
  }

  return `
    <div style="font-size:22px;line-height:1;font-weight:800;color:#17213F;letter-spacing:0;">
      ${escapeEmailHtml(getEmailSenderName())}
    </div>
  `;
};

const getCompanyName = () => getConfiguredEmail(process.env.EMAIL_COMPANY_NAME) || "Early-N Digital Ltd";

const getCompanyRegistrationNumber = () => getConfiguredEmail(process.env.EMAIL_COMPANY_REG_NO) || "17332643";

const formatWebsiteDisplay = (value) =>
  String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "");

const getLetterheadWebsiteDisplay = () =>
  formatWebsiteDisplay(
    getConfiguredEmail(process.env.EMAIL_LETTERHEAD_WEBSITE_DISPLAY, process.env.EMAIL_LETTERHEAD_WEBSITE)
  ) || "www.early-n.com";

const getLetterheadWebsiteUrl = () => getConfiguredEmail(process.env.EMAIL_LETTERHEAD_WEBSITE_URL) || "https://early-n.com";

const getLetterheadPhone = () => getConfiguredEmail(process.env.EMAIL_LETTERHEAD_PHONE) || "+44 7479350592";

const getLetterheadAddress = () =>
  getConfiguredEmail(process.env.EMAIL_LETTERHEAD_ADDRESS) || "71-75 Shelton Street, Covent Garden, London, WC2H 9JQ";

const getSignatureName = () => getConfiguredEmail(process.env.EMAIL_SIGNATURE_NAME) || "Norman Muchanyuka";

const getSignatureTitle = () => getConfiguredEmail(process.env.EMAIL_SIGNATURE_TITLE) || "Founder/ Director";

const buildSignatureLogo = () => {
  const signatureLogoUrl = getConfiguredEmail(process.env.EMAIL_SIGNATURE_LOGO_URL);

  if (!signatureLogoUrl) {
    return "";
  }

  return `
    <img src="${escapeEmailHtml(signatureLogoUrl)}" alt="${escapeEmailHtml(getEmailSenderName())}" width="104" style="display:block;width:104px;max-width:104px;height:auto;border:0;outline:none;text-decoration:none;margin:22px 0 0 0;" />
  `;
};

const buildLetterheadSection = () => `
  <tr>
    <td style="padding:0 32px 30px 32px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;background:#FFFFFF;border:1px solid #E3E8F0;">
        <tr>
          <td width="45%" valign="top" style="background:#0D1B2A;padding:20px 18px 58px 18px;color:#FFFFFF;">
            <div style="font-size:26px;line-height:1.1;font-weight:800;color:#FFFFFF;">Early-N <span style="color:#08C8F6;">Digital</span></div>
            <div style="font-size:15px;line-height:1.4;font-weight:700;color:#08C8F6;margin-top:4px;">Ltd</div>
            <div style="font-size:12px;line-height:1.5;font-style:italic;color:#08C8F6;margin-top:10px;">Innovating the Digital Future</div>
          </td>
          <td width="55%" valign="top" style="background:#2378E7;padding:25px 22px 58px 22px;color:#FFFFFF;text-align:right;">
            <div style="font-size:16px;line-height:1.2;font-weight:800;letter-spacing:8px;color:#FFFFFF;">DIGITAL</div>
            <div style="font-size:12px;line-height:1.4;font-weight:700;letter-spacing:8px;color:#08C8F6;margin-top:18px;">SOLUTIONS &amp; UBUNTU</div>
            <div style="font-size:10px;line-height:1.6;letter-spacing:5px;color:#FFFFFF;margin-top:10px;">Ethical Investment Exchange<br />Platform</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="height:4px;background:#08C8F6;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td colspan="2" style="background:#F3F6FA;padding:14px 12px 62px 12px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
              <tr>
                <td width="22%" valign="top" style="font-size:11px;line-height:1.35;color:#52627A;padding-right:8px;"><span style="color:#2378E7;font-weight:700;">T</span>&nbsp; ${escapeEmailHtml(getLetterheadPhone())}</td>
                <td width="24%" valign="top" style="font-size:11px;line-height:1.35;color:#52627A;padding-right:8px;"><span style="color:#2378E7;font-weight:700;">E</span>&nbsp; ${escapeEmailHtml(getEmailSenderAddress())}</td>
                <td width="22%" valign="top" style="font-size:11px;line-height:1.35;color:#52627A;padding-right:8px;"><span style="color:#2378E7;font-weight:700;">W</span>&nbsp; <a href="${escapeEmailHtml(getLetterheadWebsiteUrl())}" style="color:#52627A;text-decoration:none;white-space:nowrap;">${escapeEmailHtml(getLetterheadWebsiteDisplay())}</a></td>
                <td width="32%" valign="top" style="font-size:11px;line-height:1.35;color:#52627A;"><span style="color:#2378E7;font-weight:700;">A</span>&nbsp; ${escapeEmailHtml(getLetterheadAddress())}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:86px 24px 0 24px;background:#FFFFFF;">
            <div style="font-size:12px;line-height:1.6;color:#17213F;">Yours sincerely,</div>
            <div style="font-size:13px;line-height:1.4;font-weight:800;color:#17213F;margin-top:54px;">${escapeEmailHtml(getSignatureName())}</div>
            <div style="font-size:12px;line-height:1.4;color:#52627A;">${escapeEmailHtml(getSignatureTitle())}</div>
            <div style="font-size:12px;line-height:1.4;color:#2378E7;margin-top:28px;">${escapeEmailHtml(getCompanyName())}</div>
            ${buildSignatureLogo()}
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:52px 24px 0 24px;background:#FFFFFF;">
            <div style="height:3px;background:#08C8F6;font-size:0;line-height:0;">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:26px 24px 24px 24px;background:#FFFFFF;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;background:#0D1B2A;">
              <tr>
                <td style="padding:14px 18px;font-size:10px;line-height:1.4;color:#FFFFFF;font-weight:700;">${escapeEmailHtml(getCompanyName())} <span style="color:#08C8F6;">|</span> <span style="color:#08C8F6;">Reg. No. ${escapeEmailHtml(getCompanyRegistrationNumber())}</span></td>
                <td align="right" style="padding:14px 18px;font-size:10px;line-height:1.4;color:#667085;">Confidential&nbsp;&nbsp;|&nbsp;&nbsp;Page 1 of 1</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;

export const wrapBrandedEmail = ({ title, previewText = "", bodyHtml }) => `
  <!doctype html>
  <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeEmailHtml(title)}</title>
    </head>
    <body style="margin:0;padding:0;background:#F4F7FB;font-family:Arial,Helvetica,sans-serif;color:#1E2746;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        ${escapeEmailHtml(previewText)}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#F4F7FB;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:640px;background:#FFFFFF;border:1px solid #DEE5F0;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="height:6px;background:#243B5A;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:30px 32px 12px 32px;">
                  ${buildBrandHeader()}
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 28px 32px;">
                  ${bodyHtml}
                </td>
              </tr>
              ${buildLetterheadSection()}
            </table>
            <div style="max-width:640px;margin:16px auto 0 auto;font-size:12px;line-height:1.5;color:#667085;text-align:center;">
              This email was sent by ${escapeEmailHtml(getEmailSenderName())}.
            </div>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;

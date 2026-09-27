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

const getCompanyName = () => getConfiguredEmail(process.env.EMAIL_COMPANY_NAME) || "Early-N Digital Ltd";

const getCompanyRegistrationNumber = () =>
  getConfiguredEmail(process.env.EMAIL_COMPANY_REGISTRATION_NUMBER) || "Reg. No. 17332643";

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
    <img src="${escapeEmailHtml(signatureLogoUrl)}" alt="${escapeEmailHtml(getEmailSenderName())}" width="82" style="display:block;width:82px;max-width:82px;height:auto;border:0;outline:none;text-decoration:none;margin:24px 0 0 0;" />
  `;
};

const lucideIconUrl = (name) => `https://cdn.jsdelivr.net/npm/lucide-static@0.468.0/icons/${name}.svg`;

const lucideIcon = (name, fallback) => `
  <img src="${lucideIconUrl(name)}" width="12" height="12" alt="${fallback}" style="display:inline-block;width:12px;height:12px;border:0;outline:none;text-decoration:none;vertical-align:-2px;margin-right:4px;" />
`;

const mobileIcon = lucideIcon("smartphone", "&#9742;");
const mailIcon = lucideIcon("mail", "&#9993;");
const globeIcon = lucideIcon("globe", "&#9711;");
const addressIcon = lucideIcon("map-pin", "&#9679;");

const buildContactLink = ({ href, icon, label, width }) => `
  <td width="${escapeEmailHtml(width)}" valign="top" style="font-size:12px;line-height:1.35;color:#0058FF;padding:0 14px 10px 0;white-space:normal;word-break:normal;overflow-wrap:normal;">
    <a href="${escapeEmailHtml(href)}" style="color:#0058FF;text-decoration:none;">
      ${icon}${escapeEmailHtml(label)}
    </a>
  </td>
`;

const buildAddressLink = () => `
  <td colspan="3" valign="top" style="font-size:12px;line-height:1.35;color:#17213F;padding:0 14px 0 0;white-space:normal;word-break:normal;overflow-wrap:normal;">
    <a href="${escapeEmailHtml(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getLetterheadAddress())}`
    )}" style="color:#17213F;text-decoration:none;">
      ${addressIcon}${escapeEmailHtml(getLetterheadAddress())}
    </a>
  </td>
`;

const buildBusinessCard = () => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin-top:36px;background:#FFFFFF;">
    <tr>
      <td width="46%" valign="top" style="background:#0D1B2A;padding:25px 20px 26px 20px;color:#FFFFFF;">
        <div style="font-size:20px;line-height:1.05;font-weight:800;color:#FFFFFF;">Early-N <span style="color:#08C8F6;">Digital</span></div>
        <div style="font-size:12px;line-height:1.2;font-weight:700;color:#FFFFFF;text-transform:uppercase;">Ltd</div>
        <div style="font-size:11px;line-height:1.4;font-style:italic;color:#FFFFFF;margin-top:13px;">Innovating the Digital Future</div>
      </td>
      <td width="54%" valign="top" style="background:#2378E7;padding:25px 24px 26px 20px;color:#FFFFFF;text-align:right;">
        <div style="font-size:16px;line-height:1.1;font-weight:800;letter-spacing:6px;color:#FFFFFF;">DIGITAL</div>
        <div style="font-size:10px;line-height:1.35;font-weight:700;letter-spacing:4px;color:#D7F7FF;margin-top:18px;">SOLUTIONS &amp; UBUNTU</div>
        <div style="font-size:12px;line-height:1.45;font-weight:700;color:#FFFFFF;margin-top:4px;">Ethical Investment Exchange Platform</div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="height:4px;background:#08C8F6;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
  </table>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;background:#FFFFFF;">
    <tr>
      <td style="padding:24px 40px 0 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;table-layout:fixed;">
          <tr>
            ${buildContactLink({
              href: `tel:${getLetterheadPhone().replace(/\s+/g, "")}`,
              icon: mobileIcon,
              label: getLetterheadPhone(),
              width: "28%",
            })}
            ${buildContactLink({
              href: `mailto:${getEmailSenderAddress()}`,
              icon: mailIcon,
              label: getEmailSenderAddress(),
              width: "36%",
            })}
            ${buildContactLink({
              href: getLetterheadWebsiteUrl(),
              icon: globeIcon,
              label: getLetterheadWebsiteDisplay(),
              width: "36%",
            })}
          </tr>
          <tr>
            ${buildAddressLink()}
          </tr>
        </table>
      </td>
    </tr>
  </table>
`;

const buildEmailSignature = () => `
  <div style="font-size:14px;line-height:1.7;color:#000000;margin-top:34px;">Yours sincerely,</div>
  <div style="height:1px;background:#E5E7EB;font-size:0;line-height:0;margin:16px 0 18px 0;">&nbsp;</div>
  <div style="font-size:16px;line-height:1.35;font-weight:800;color:#00143A;">${escapeEmailHtml(getSignatureName())}</div>
  <div style="font-size:14px;line-height:1.35;color:#17213F;">${escapeEmailHtml(getSignatureTitle())}</div>
  <div style="font-size:14px;line-height:1.5;font-weight:700;color:#0058FF;margin-top:8px;">${escapeEmailHtml(getCompanyName())}</div>
  ${buildSignatureLogo()}
  <div style="font-size:11px;line-height:1.45;color:#7A8699;margin-top:14px;">${escapeEmailHtml(getCompanyRegistrationNumber())}</div>
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
          <td align="center" style="padding:0 16px 32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:636px;background:#FFFFFF;">
              <tr>
                <td style="background:#0D1B2A;padding:12px 36px;font-size:14px;line-height:1.2;color:#FFFFFF;">
                  <span style="color:#2B83FF;">Early-N</span> <span style="font-weight:800;color:#FFFFFF;">Digital Ltd</span>
                </td>
              </tr>
              <tr>
                <td style="padding:38px 40px 34px 40px;">
                  <div>${bodyHtml}</div>
                  ${buildEmailSignature()}
                  ${buildBusinessCard()}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;

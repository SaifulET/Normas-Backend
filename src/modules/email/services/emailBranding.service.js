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
      <img src="${escapeEmailHtml(logoUrl)}" alt="${escapeEmailHtml(getEmailSenderName())}" width="116" style="display:block;border:0;outline:none;text-decoration:none;max-width:116px;height:auto;" />
    `;
  }

  return `
    <div style="font-size:20px;line-height:1.2;font-weight:800;color:#17213F;letter-spacing:0;">
      ${escapeEmailHtml(getEmailSenderName())}
    </div>
  `;
};

const getCompanyName = () => getConfiguredEmail(process.env.EMAIL_COMPANY_NAME) || "Early-N Digital Ltd";

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

const buildContactLink = ({ href, icon, label }) => `
  <td valign="top" style="font-size:9px;line-height:1.25;color:#174985;padding:8px 4px;">
    <a href="${escapeEmailHtml(href)}" style="color:#174985;text-decoration:underline;">
      ${icon}${escapeEmailHtml(label)}
    </a>
  </td>
`;

const buildBusinessCard = () => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin-top:28px;border:1px solid #DDE5F0;background:#FFFFFF;">
    <tr>
      <td width="45%" valign="top" style="background:#0D1B2A;padding:17px 16px 30px 16px;color:#FFFFFF;">
        <div style="font-size:21px;line-height:1.05;font-weight:800;color:#FFFFFF;">Early-N <span style="color:#08C8F6;">Digital</span></div>
        <div style="font-size:13px;line-height:1.2;font-weight:700;color:#08C8F6;">Ltd</div>
        <div style="font-size:9px;line-height:1.4;font-style:italic;color:#08C8F6;margin-top:13px;">Innovating the Digital Future</div>
      </td>
      <td width="55%" valign="top" style="background:#2378E7;padding:19px 20px 30px 20px;color:#FFFFFF;text-align:right;">
        <div style="font-size:13px;line-height:1.1;font-weight:800;letter-spacing:7px;color:#FFFFFF;">DIGITAL</div>
        <div style="font-size:10px;line-height:1.35;font-weight:700;letter-spacing:6px;color:#08C8F6;margin-top:14px;">SOLUTIONS &amp;<br />UBUNTU</div>
        <div style="font-size:9px;line-height:1.55;font-weight:700;letter-spacing:3px;color:#FFFFFF;margin-top:8px;">Ethical Investment Exchange<br />Platform</div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="height:4px;background:#08C8F6;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr>
      <td colspan="2" style="background:#F3F6FA;padding:0 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
          <tr>
            ${buildContactLink({
              href: `tel:${getLetterheadPhone().replace(/\s+/g, "")}`,
              icon: mobileIcon,
              label: getLetterheadPhone(),
            })}
            ${buildContactLink({
              href: `mailto:${getEmailSenderAddress()}`,
              icon: mailIcon,
              label: getEmailSenderAddress(),
            })}
            ${buildContactLink({
              href: getLetterheadWebsiteUrl(),
              icon: globeIcon,
              label: getLetterheadWebsiteDisplay(),
            })}
            ${buildContactLink({
              href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getLetterheadAddress())}`,
              icon: addressIcon,
              label: getLetterheadAddress(),
            })}
          </tr>
        </table>
      </td>
    </tr>
  </table>
`;

const buildEmailSignature = () => `
  <div style="font-size:11px;line-height:1.7;color:#17213F;margin-top:56px;">Yours sincerely,</div>
  <div style="font-size:12px;line-height:1.4;font-weight:800;color:#17213F;margin-top:46px;">${escapeEmailHtml(getSignatureName())}</div>
  <div style="font-size:11px;line-height:1.5;color:#52627A;">${escapeEmailHtml(getSignatureTitle())}</div>
  <div style="font-size:11px;line-height:1.5;color:#2378E7;margin-top:22px;">${escapeEmailHtml(getCompanyName())}</div>
  ${buildSignatureLogo()}
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
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:510px;background:#FFFFFF;">
              <tr>
                <td style="height:4px;background:#17213F;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:22px 27px 40px 27px;">
                  <div style="margin-bottom:8px;">${buildBrandHeader()}</div>
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

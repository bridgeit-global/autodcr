import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

const FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || "";
const FROM_NAME = (process.env.EMAIL_FROM_NAME || "Draft Desk").trim() || "Draft Desk";

/** Nodemailer From: display name + mailbox (SMTP auth address unchanged). */
function formatFromHeader(): string {
  if (!FROM_ADDRESS) return FROM_NAME;
  const safeName = FROM_NAME.replace(/"/g, '\\"');
  return `"${safeName}" <${FROM_ADDRESS}>`;
}

export type NotificationType = "submitted" | "updated";

export type ApplicationStage =
  | "draft"
  | "saved"
  | "in_process"
  | "approved_verified"
  | "rejected";

type RecipientKind = "owner" | "consultant";

function resolveRecipientKind(role: string): RecipientKind {
  return role.trim().toLowerCase() === "owner" ? "owner" : "consultant";
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function getApplicationEmailContent(params: {
  stage: ApplicationStage;
  permissionType: string;
  projectTitle: string;
  recipientKind: RecipientKind;
}): {
  subject: string;
  heading: string;
  bodyText: string;
  helperText: string;
  ctaText: string;
  headerColor: string;
} {
  const { stage, permissionType, projectTitle, recipientKind } = params;
  const isOwner = recipientKind === "owner";

  if (stage === "draft") {
    if (isOwner) {
      return {
        subject: `New application created: ${permissionType} – ${projectTitle}`,
        heading: "New Application Created",
        bodyText: `A new <strong>${permissionType}</strong> application has been created for project <strong>${projectTitle}</strong>. It is currently saved as a draft.`,
        helperText: "Use the link below to open and review the application.",
        ctaText: "Open Application",
        headerColor: "#6b7280",
      };
    }
    return {
      subject: `New application assigned to you: ${permissionType} – ${projectTitle}`,
      heading: "New Application for Your Review",
      bodyText: `A new <strong>${permissionType}</strong> application has been created for project <strong>${projectTitle}</strong> and you have been listed as the appointed consultant.`,
      helperText: "Use the link below to open the application in the portal.",
      ctaText: "Open Application",
      headerColor: "#6b7280",
    };
  }

  if (stage === "saved") {
    if (isOwner) {
      return {
        subject: `Application saved: ${permissionType} – ${projectTitle}`,
        heading: "Application PDF Saved",
        bodyText: `Your <strong>${permissionType}</strong> application PDF for project <strong>${projectTitle}</strong> has been saved successfully. The application is now <strong>In Process</strong>.`,
        helperText: "You can open the application below to review or sign when you are ready.",
        ctaText: "View Application",
        headerColor: "#2563eb",
      };
    }
    return {
      subject: `Application saved – please review: ${permissionType} – ${projectTitle}`,
      heading: "Application Saved for Review",
      bodyText: `The <strong>${permissionType}</strong> application PDF for project <strong>${projectTitle}</strong> has been saved by the owner. The application is now <strong>In Process</strong>. Please review the application details.`,
      helperText: "Open the application below to review the saved document.",
      ctaText: "Open Application",
      headerColor: "#2563eb",
    };
  }

  if (stage === "in_process") {
    if (isOwner) {
      return {
        subject: `You signed successfully – awaiting consultant signature – ${projectTitle}`,
        heading: "Awaiting Consultant Signature",
        bodyText: `You have signed the <strong>${permissionType}</strong> for project <strong>${projectTitle}</strong>. The appointed consultant has been notified and their signature is now required.`,
        helperText: "You can track the application status using the link below.",
        ctaText: "View Application",
        headerColor: "#d97706",
      };
    }
    return {
      subject: `Action required: Please sign appointment letter – ${projectTitle}`,
      heading: "Your Signature Is Required",
      bodyText: `The owner has signed the <strong>${permissionType}</strong> for project <strong>${projectTitle}</strong>. <strong>Your signature is now required</strong> to complete this appointment letter.`,
      helperText: "Please log in, review the document, and sign the application using the link below.",
      ctaText: "Sign Application",
      headerColor: "#d97706",
    };
  }

  if (stage === "rejected") {
    if (isOwner) {
      return {
        subject: `Application rejected: ${permissionType} – ${projectTitle}`,
        heading: "Application Rejected",
        bodyText: `The <strong>${permissionType}</strong> application for project <strong>${projectTitle}</strong> has been <strong>rejected or cancelled</strong>.`,
        helperText: "You can view the application details using the link below.",
        ctaText: "View Application",
        headerColor: "#dc2626",
      };
    }
    return {
      subject: `Application rejected: ${permissionType} – ${projectTitle}`,
      heading: "Application Rejected",
      bodyText: `The <strong>${permissionType}</strong> application for project <strong>${projectTitle}</strong> has been <strong>rejected or cancelled</strong>.`,
      helperText: "You can view the application details using the link below.",
      ctaText: "View Application",
      headerColor: "#dc2626",
    };
  }

  return {
    subject: `Application approved – all signatures complete – ${projectTitle}`,
    heading: "Application Fully Approved",
    bodyText: `All required signatures for <strong>${permissionType}</strong> on project <strong>${projectTitle}</strong> have been completed. The application is now approved and verified.`,
    helperText: "Open the application below to view the signed document.",
    ctaText: "View Application",
    headerColor: "#059669",
  };
}

export function getApplicationNotificationCopy(params: {
  stage: ApplicationStage;
  permissionType: string;
  projectTitle: string;
  recipientRole?: string;
}): { title: string; body: string } {
  const content = getApplicationEmailContent({
    stage: params.stage,
    permissionType: params.permissionType,
    projectTitle: params.projectTitle,
    recipientKind: resolveRecipientKind(params.recipientRole || ""),
  });
  return {
    title: content.heading,
    body: stripHtml(content.bodyText),
  };
}

export async function sendApplicantNotificationEmail(params: {
  to: string;
  applicantName: string;
  role: string;
  projectTitle: string;
  projectUrl: string;
  type: NotificationType;
}): Promise<{ success: boolean; error?: string }> {
  const { to, applicantName, role, projectTitle, projectUrl, type } = params;

  const isUpdate = type === "updated";
  const subject = isUpdate
    ? `Project Updated: ${projectTitle}`
    : `You have been added to a project: ${projectTitle}`;

  const heading = isUpdate
    ? "Project Update Notification"
    : "Project Assignment Notification";

  const bodyText = isUpdate
    ? `We would like to inform you that the project <strong>${projectTitle}</strong> has been updated. Your role in this project is <strong>${role}</strong>.`
    : `We are pleased to inform you that you have been added to the project <strong>${projectTitle}</strong> as <strong>${role}</strong>.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#059669;padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                Dear ${applicantName},
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                ${bodyText}
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                Please review the project details at your earliest convenience.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#059669;border-radius:8px;">
                    <a href="${projectUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      View Project
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
                If you have any questions, please contact the project owner or administrator.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                This is an automated notification. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    await transporter.sendMail({
      from: formatFromHeader(),
      to,
      subject,
      html,
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    console.error(`[email] Failed to send to ${to}:`, message);
    return { success: false, error: message };
  }
}

export async function sendApplicationStatusEmail(params: {
  to: string;
  recipientName: string;
  projectTitle: string;
  permissionType: string;
  stage: ApplicationStage;
  projectUrl: string;
  recipientRole?: string;
}): Promise<{ success: boolean; error?: string }> {
  const {
    to,
    recipientName,
    projectTitle,
    permissionType,
    stage,
    projectUrl,
    recipientRole = "",
  } = params;

  const recipientKind = resolveRecipientKind(recipientRole);
  const { subject, heading, bodyText, helperText, ctaText, headerColor } =
    getApplicationEmailContent({
      stage,
      permissionType,
      projectTitle,
      recipientKind,
    });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:${headerColor};padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                Dear ${recipientName},
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                ${bodyText}
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                ${helperText}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:${headerColor};border-radius:8px;">
                    <a href="${projectUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
                If you have any questions, please contact the project owner or administrator.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                This is an automated notification. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    await transporter.sendMail({
      from: formatFromHeader(),
      to,
      subject,
      html,
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    console.error(`[email] Failed to send to ${to}:`, message);
    return { success: false, error: message };
  }
}

export async function sendUsernameRecoveryEmail(params: {
  to: string;
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, userId } = params;

  const subject = "Your Draft Desk User ID";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:#0a1628;padding:24px;">
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Username Recovery</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
                Your Draft Desk User ID is:
              </p>
              <p style="margin:0 0 20px;padding:12px 16px;background:#f1f5f9;border-radius:8px;font-size:18px;font-weight:700;color:#0a1628;letter-spacing:0.5px;">
                ${userId}
              </p>
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
                Use this User ID to sign in. If you did not request this, please contact support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    await transporter.sendMail({
      from: formatFromHeader(),
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    console.error(`[email] Failed to send username recovery to ${to}:`, message);
    return { success: false, error: message };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getHelpDeskInboxAddress(): string {
  return (
    process.env.HELP_DESK_EMAIL?.trim() ||
    process.env.EMAIL_FROM_ADDRESS?.trim() ||
    process.env.SMTP_USER?.trim() ||
    ""
  );
}

export async function sendHelpDeskEmail(params: {
  category: string;
  subject: string;
  message: string;
  senderName: string;
  senderEmail: string;
}): Promise<{ success: boolean; error?: string }> {
  const to = getHelpDeskInboxAddress();
  if (!to) {
    return { success: false, error: "Help desk inbox is not configured." };
  }

  const { category, subject, message, senderName, senderEmail } = params;
  const safeName = escapeHtml(senderName);
  const safeEmail = escapeHtml(senderEmail);
  const safeCategory = escapeHtml(category);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:#0a1628;padding:24px;">
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Help Desk message</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6;"><strong>From:</strong> ${safeName} (${safeEmail})</p>
              <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6;"><strong>Category:</strong> ${safeCategory}</p>
              <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;"><strong>Subject:</strong> ${safeSubject}</p>
              <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${safeMessage}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    await transporter.sendMail({
      from: formatFromHeader(),
      to,
      replyTo: senderEmail,
      subject: `[Help Desk] [${category}] ${subject}`,
      html,
    });
    return { success: true };
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : "Unknown email error";
    console.error("[email] Failed to send help desk message:", errMessage);
    return { success: false, error: errMessage };
  }
}

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
      from: FROM_ADDRESS,
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
      from: FROM_ADDRESS,
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

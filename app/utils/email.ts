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

export type ApplicationStage = "draft" | "in_process" | "approved_verified";

const STAGE_LABELS: Record<ApplicationStage, string> = {
  draft: "Draft",
  in_process: "In Process",
  approved_verified: "Approved / Verified",
};

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
}): Promise<{ success: boolean; error?: string }> {
  const { to, recipientName, projectTitle, permissionType, stage, projectUrl } =
    params;

  const stageLabel = STAGE_LABELS[stage] ?? stage;

  const subjectByStage: Record<ApplicationStage, string> = {
    draft: `New Application Created: ${permissionType} – ${projectTitle}`,
    in_process: `Application In Process: ${permissionType} – ${projectTitle}`,
    approved_verified: `Application Approved: ${permissionType} – ${projectTitle}`,
  };

  const bodyByStage: Record<ApplicationStage, string> = {
    draft: `A new application <strong>${permissionType}</strong> has been created for the project <strong>${projectTitle}</strong>. The application is currently in <strong>Draft</strong> status.`,
    in_process: `The application <strong>${permissionType}</strong> for the project <strong>${projectTitle}</strong> has been moved to <strong>In Process</strong>. The owner has signed the appointment letter and it is now awaiting the consultant's signature.`,
    approved_verified: `The application <strong>${permissionType}</strong> for the project <strong>${projectTitle}</strong> has been <strong>Approved / Verified</strong>. All required signatures have been completed.`,
  };

  const headerColorByStage: Record<ApplicationStage, string> = {
    draft: "#6b7280",
    in_process: "#d97706",
    approved_verified: "#059669",
  };

  const subject = subjectByStage[stage];
  const bodyText = bodyByStage[stage];
  const headerColor = headerColorByStage[stage];

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
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Application Status: ${stageLabel}</h1>
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
                Please log in to review the application details.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:${headerColor};border-radius:8px;">
                    <a href="${projectUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      View Application
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

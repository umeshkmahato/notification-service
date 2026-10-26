import nodemailer from 'nodemailer';

const resolveTransportConfig = () => {
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (smtpHost) {
    return {
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    };
  }

  return {
    service: 'gmail',
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  };
};

const transporter = nodemailer.createTransport(resolveTransportConfig());

const normalizeEmailPayload = (notification) => {
  const emailAddress = notification?.email || notification?.to || notification?.recipient || notification?.userEmail;
  const messageContent = notification?.message;

  let subject = 'Notification';
  let text = typeof messageContent === 'string' ? messageContent : 'You have a new notification';

  if (messageContent && typeof messageContent === 'object') {
    subject = messageContent.subject || subject;
    text = messageContent.body || messageContent.text || text;
  }

  return {
    emailAddress,
    subject,
    text,
  };
};

const sendEmail = async (notification) => {
  const { emailAddress, subject, text } = normalizeEmailPayload(notification);

  if (!emailAddress) {
    throw new Error('Missing email recipient');
  }

  try {
    console.log(`[emailService] Sending email to ${emailAddress} with subject: "${subject}"`);
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER || process.env.EMAIL_USER || 'notification-service@example.com',
      to: emailAddress,
      subject,
      text,
    });
    console.log(`[emailService] Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId, to: emailAddress };
  } catch (error) {
    console.error(`[emailService] Error sending email to ${emailAddress}:`, error);
    throw error;
  }
};

export { sendEmail };
export default { sendEmail };

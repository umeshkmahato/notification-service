import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

const normalizeSMSPayload = (notification) => {
  const to = notification?.phone || notification?.to || notification?.recipient;
  const message = typeof notification?.message === 'string'
    ? notification.message
    : notification?.message?.body || notification?.message?.text || 'You have a new notification';

  return { to, message };
};

const sendSMS = async (notification) => {
  const { to, message } = normalizeSMSPayload(notification);

  if (!client || !to || !phoneNumber) {
    throw new Error('Twilio is not configured or a recipient phone number is missing');
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: phoneNumber,
      to,
    });
    return { success: true, sid: result.sid, to };
  } catch (error) {
    console.error('[smsService] Failed to send SMS:', error);
    throw error;
  }
};

export { sendSMS };
export default { sendSMS };

export async function handler(event) {
  const email = event.request.userAttributes?.email || "";
  const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN || "cloudwrxs.com").toLowerCase();

  if (!email.toLowerCase().endsWith(`@${allowedDomain}`)) {
    throw new Error(`Only ${allowedDomain} users can access Campaign Command.`);
  }

  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  return event;
}

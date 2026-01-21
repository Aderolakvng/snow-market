const EMAILJS_PUBLIC_KEY = 'nGSIAFj1QP2mcZS5B';
const EMAILJS_SERVICE_ID = 'service_colbica';
const EMAILJS_TEMPLATE_ID = 'template_jrg5m47';

let emailJsInitialized = false;

function ensureEmailJs() {
  const ej = window.emailjs;
  if (!ej) {
    throw new Error('emailjs-not-loaded');
  }
  if (!emailJsInitialized) {
    ej.init({ publicKey: EMAILJS_PUBLIC_KEY });
    emailJsInitialized = true;
  }
  return ej;
}

export async function sendLoginOtpEmail(toEmail, otp) {
  const ej = ensureEmailJs();
  const email = String(toEmail || '').trim();
  const code = String(otp || '').trim();

  if (!email) throw new Error('missing-email');
  if (!code) throw new Error('missing-otp');

  // NOTE: Ensure your EmailJS template uses these variables.
  // Common choices: to_email, otp
  const templateParams = {
    to_email: email,
    otp: code
  };

  return ej.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
}

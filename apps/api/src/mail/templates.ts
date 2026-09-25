import type { MailMessage } from './mail.service';

/** The characters that would let a value break out of the HTML below. */
function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * The password reset email. Plain enough to survive any client: inline
 * styles, no images, the link written out in full under the button for the
 * clients that strip buttons. Colours are the brand palette from
 * @recallify/tokens, spelled out because there is no stylesheet in an inbox.
 */
export function passwordResetEmail(to: string, link: string, minutes: number): MailMessage {
  const safeLink = escape(link);
  const text = [
    'Someone asked to reset the password for your Recallify account.',
    '',
    `Open this link to choose a new password. It works for ${minutes} minutes and only once:`,
    link,
    '',
    'If that was not you, ignore this email. Your password has not changed and nothing else happens.',
    '',
    'Recallify',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#eee2dc;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#123c69;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <p style="margin:0 0 28px;font-size:20px;font-weight:700;letter-spacing:-0.02em;">Recallify</p>
    <div style="background:#f8f1ec;border:1px solid #ddcbc1;border-radius:12px;padding:28px;">
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;">Reset your password</h1>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:#55637f;">Someone asked to reset the password for the Recallify account at ${escape(to)}. The link below works for ${minutes} minutes and only once.</p>
      <p style="margin:0 0 24px;">
        <a href="${safeLink}" style="display:inline-block;background:#123c69;color:#eee2dc;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;">Choose a new password</a>
      </p>
      <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#55637f;">If the button does not work, open this address:</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${safeLink}" style="color:#ac3b61;">${safeLink}</a></p>
      <p style="margin:0;font-size:14px;line-height:1.55;color:#55637f;">If that was not you, ignore this email. Your password has not changed and nothing else happens.</p>
    </div>
  </div>
</body>
</html>`;

  return { to, subject: 'Reset your Recallify password', text, html };
}

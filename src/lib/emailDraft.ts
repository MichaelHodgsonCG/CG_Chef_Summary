// Build a ready-to-send email draft as a standard .eml (RFC 822/MIME) file:
// the report HTML as the message body and each chef summary PDF attached.
// No mail server or API key is involved — the file opens in the user's own
// mail app (Outlook/Apple Mail/Thunderbird) as a draft sent from their own
// address, so replies and threading behave like any other email they write.
// The X-Unsent header is what makes Outlook open it editable instead of as a
// received message.

export interface EmailAttachment {
  filename: string;
  base64: string; // raw base64, no data: prefix
}

const CRLF = '\r\n';

function base64OfUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// MIME base64 bodies must wrap at 76 characters.
function wrap76(b64: string): string {
  return b64.replace(/(.{76})/g, `$1${CRLF}`);
}

export function buildEmlBlob(
  subject: string,
  htmlBody: string,
  attachments: EmailAttachment[]
): Blob {
  const boundary = '----=_WeeklySummary_' + Date.now().toString(36);

  const parts: string[] = [];
  parts.push(
    `Subject: ${subject.replace(/[\r\n]+/g, ' ')}`,
    'X-Unsent: 1',
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(base64OfUtf8(htmlBody)),
  );

  for (const att of attachments) {
    const safeName = att.filename.replace(/["\r\n]/g, '');
    parts.push(
      `--${boundary}`,
      `Content-Type: application/pdf; name="${safeName}"`,
      `Content-Disposition: attachment; filename="${safeName}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(att.base64),
    );
  }

  parts.push(`--${boundary}--`, '');
  return new Blob([parts.join(CRLF)], { type: 'message/rfc822' });
}

export function downloadEml(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

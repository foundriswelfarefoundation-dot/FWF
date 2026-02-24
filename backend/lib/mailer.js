import nodemailer from 'nodemailer';

let cached = global._backendMailer;
if (!cached) cached = global._backendMailer = { transporter: null };

export function getTransporter() {
  if (cached.transporter) return cached.transporter;
  cached.transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return cached.transporter;
}

/**
 * Send 80G tax receipt email to donor.
 * @param {Object} params
 */
export async function send80GReceipt({ donationId, name, email, pan, address, amount, paymentId, date }) {
  const transporter = getTransporter();
  const formattedAmount = Number(amount).toLocaleString('en-IN');
  const formattedDate = new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: `FWF — 80G Tax Exemption Receipt #${donationId}`,
    html: `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;background:#fff">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#ff416c,#ff4f81);padding:30px 32px 24px;border-radius:12px 12px 0 0;text-align:center">
        <div style="font-size:36px;margin-bottom:8px">🏛️</div>
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">80G Tax Exemption Receipt</h1>
        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px">Foundation for Women's Future</p>
      </div>

      <!-- Receipt Box -->
      <div style="padding:32px;border-left:1px solid #f0e0e0;border-right:1px solid #f0e0e0">
        <p style="color:#374151;font-size:15px;margin-bottom:24px">
          Dear <strong>${name}</strong>,<br><br>
          Thank you for your generous contribution to Foundation for Women's Future (FWF).
          This is your official <strong>80G tax exemption receipt</strong> as per the Income Tax Act, 1961.
          Please retain this for your tax filing records.
        </p>

        <!-- Receipt Details Table -->
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
          <tr style="background:#fdf2f4">
            <td style="padding:12px 16px;color:#6b7280;font-weight:600;width:45%;border-bottom:1px solid #f3e5e8">Receipt No.</td>
            <td style="padding:12px 16px;color:#111827;font-weight:700;border-bottom:1px solid #f3e5e8">${donationId}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#6b7280;font-weight:600;border-bottom:1px solid #f3e5e8">Date</td>
            <td style="padding:12px 16px;color:#111827;border-bottom:1px solid #f3e5e8">${formattedDate}</td>
          </tr>
          <tr style="background:#fdf2f4">
            <td style="padding:12px 16px;color:#6b7280;font-weight:600;border-bottom:1px solid #f3e5e8">Donor Name</td>
            <td style="padding:12px 16px;color:#111827;font-weight:600;border-bottom:1px solid #f3e5e8">${name}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#6b7280;font-weight:600;border-bottom:1px solid #f3e5e8">PAN Number</td>
            <td style="padding:12px 16px;color:#111827;font-family:monospace;letter-spacing:2px;font-weight:600;border-bottom:1px solid #f3e5e8">${pan.toUpperCase()}</td>
          </tr>
          <tr style="background:#fdf2f4">
            <td style="padding:12px 16px;color:#6b7280;font-weight:600;border-bottom:1px solid #f3e5e8">Address</td>
            <td style="padding:12px 16px;color:#111827;border-bottom:1px solid #f3e5e8">${address}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#6b7280;font-weight:600;border-bottom:1px solid #f3e5e8">Mode of Payment</td>
            <td style="padding:12px 16px;color:#111827;border-bottom:1px solid #f3e5e8">Online (Razorpay)</td>
          </tr>
          <tr style="background:#fdf2f4">
            <td style="padding:12px 16px;color:#6b7280;font-weight:600;border-bottom:1px solid #f3e5e8">Transaction ID</td>
            <td style="padding:12px 16px;color:#111827;font-family:monospace;font-size:13px;border-bottom:1px solid #f3e5e8">${paymentId}</td>
          </tr>
          <tr style="background:linear-gradient(135deg,#fff0f3,#ffe5ec)">
            <td style="padding:14px 16px;color:#be123c;font-weight:700;font-size:16px">Donation Amount</td>
            <td style="padding:14px 16px;color:#be123c;font-weight:900;font-size:20px">₹${formattedAmount}</td>
          </tr>
        </table>

        <!-- 80G Declaration -->
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:18px 20px;margin-bottom:24px">
          <p style="color:#166534;font-size:13px;margin:0;line-height:1.6">
            <strong>📜 80G Declaration:</strong><br>
            This receipt certifies that the above donation has been received by <strong>Foundation for Women's Future</strong>
            and is eligible for tax deduction under Section 80G of the Income Tax Act, 1961.
            The organization is registered and approved for 80G exemption.
            Donors can claim <strong>50% deduction</strong> on the donated amount while computing taxable income.
          </p>
        </div>

        <!-- How to claim -->
        <div style="background:#f8faff;border:1px solid #dbe3f7;border-radius:10px;padding:16px 20px;margin-bottom:24px">
          <p style="color:#374151;font-size:13px;margin:0;line-height:1.6">
            <strong>💡 How to claim deduction:</strong><br>
            1. Keep this receipt safe for your records<br>
            2. Mention your PAN (${pan.toUpperCase()}) when filing your ITR<br>
            3. Declare this donation under "80G Donations" in your tax return<br>
            4. For any queries, email us at <a href="mailto:${process.env.SMTP_USER}" style="color:#ff416c">${process.env.SMTP_USER}</a>
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#fdf2f4;padding:20px 32px;border-radius:0 0 12px 12px;border:1px solid #f0e0e0;border-top:none;text-align:center">
        <p style="color:#9ca3af;font-size:12px;margin:0 0 4px">
          <strong style="color:#ff416c">Foundation for Women's Future (FWF)</strong>
        </p>
        <p style="color:#9ca3af;font-size:11px;margin:0">
          <a href="https://www.fwfindia.org" style="color:#ff416c;text-decoration:none">www.fwfindia.org</a>
          &nbsp;·&nbsp; This is a system-generated receipt. No signature required.
        </p>
      </div>
    </div>`
  });
}

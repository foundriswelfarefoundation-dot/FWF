import { connectDB } from "../lib/db.js";
import { getTransporter } from "../lib/mailer.js";
import PasswordReset from "../models/PasswordReset.js";
import { withSentry } from "../lib/sentry.js";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await connectDB();

    const { memberId } = req.body;
    if (!memberId) {
      return res.status(400).json({ error: "Member ID is required" });
    }

    // Call backend to get user email
    const backendUrl = process.env.BACKEND_URL || "https://fwf-production.up.railway.app";
    console.log(`[forgot-password] Looking up email for ${memberId} via ${backendUrl}`);
    
    const internalKey = process.env.INTERNAL_API_KEY || 'fwf-internal-secret-key-change-in-production';
    let response;
    try {
      response = await fetch(`${backendUrl}/api/auth/get-user-email`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-internal-api-key": internalKey
        },
        body: JSON.stringify({ memberId })
      });
    } catch (fetchErr) {
      console.error(`[forgot-password] Failed to reach backend at ${backendUrl}:`, fetchErr.message);
      return res.status(502).json({ error: "Could not connect to authentication server. Please try again later." });
    }

    if (!response.ok) {
      return res.status(404).json({ error: "Member ID not found" });
    }

    const { email } = await response.json();

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to database (expires in 15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await PasswordReset.create({
      memberId,
      email,
      otp,
      expiresAt,
      used: false
    });

    // Send OTP via email
    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: "Password Reset OTP - FWF",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Password Reset Request</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 40px 30px; border-radius: 0 0 12px 12px;">
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              Hello <strong>${memberId}</strong>,
            </p>
            
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              We received a request to reset your password. Use the OTP below to complete the process:
            </p>
            
            <div style="background: #ffffff; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px;">
              <div style="font-size: 14px; color: #666; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</div>
              <div style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px;">${otp}</div>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
              <p style="color: #856404; font-size: 14px; margin: 0;">
                <strong>⚠️ Important:</strong> This OTP will expire in 15 minutes. If you didn't request this, please ignore this email.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              Best regards,<br>
              <strong>Foundation for Women's Future Team</strong>
            </p>
          </div>
        </div>
      `
    });

    res.json({ 
      ok: true, 
      message: "OTP sent to your registered email",
      email: email.replace(/(.{2})(.*)(@.*)/, "$1***$3") // Mask email for security
    });

  } catch (error) {
    console.error("[forgot-password] Error:", error.message, error.stack);
    
    // Distinguish between different failure types
    if (error.message && (error.message.includes('SMTP') || error.message.includes('transport') || error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT'))) {
      return res.status(503).json({ error: "Email service temporarily unavailable. Please try again in a few minutes." });
    }
    
    res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
}

export default withSentry(handler);

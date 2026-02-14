import { connectDB } from "../lib/db.js";
import PasswordReset from "../models/PasswordReset.js";
import { withSentry } from "../lib/sentry.js";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await connectDB();

    const { memberId, otp, newPassword } = req.body;

    if (!memberId || !otp || !newPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Find valid OTP
    const resetRequest = await PasswordReset.findOne({
      memberId,
      otp,
      used: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!resetRequest) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Update password in backend SQLite database FIRST (before marking OTP as used)
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    console.log(`[reset-password] Updating password for ${memberId} via ${backendUrl}`);
    
    const internalKey = process.env.INTERNAL_API_KEY || 'fwf-internal-secret-key-change-in-production';
    let response;
    try {
      response = await fetch(`${backendUrl}/api/auth/update-password`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-internal-api-key": internalKey
        },
        body: JSON.stringify({ memberId, newPassword })
      });
    } catch (fetchErr) {
      console.error(`[reset-password] Failed to reach backend at ${backendUrl}:`, fetchErr.message);
      return res.status(502).json({ 
        error: "Could not connect to authentication server. Please try again later." 
      });
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`[reset-password] Backend returned ${response.status}:`, error);
      return res.status(400).json({ error: error.error || "Failed to update password" });
    }

    // Only mark OTP as used AFTER password is successfully updated
    resetRequest.used = true;
    await resetRequest.save();
    console.log(`[reset-password] Password updated successfully for ${memberId}`);

    res.json({ 
      ok: true, 
      message: "Password reset successful! You can now login with your new password." 
    });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
}

export default withSentry(handler);

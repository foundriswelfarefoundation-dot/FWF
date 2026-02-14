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

    // Mark OTP as used
    resetRequest.used = true;
    await resetRequest.save();

    // Update password in backend SQLite database
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    const response = await fetch(`${backendUrl}/api/auth/update-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, newPassword })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(400).json({ error: error.error || "Failed to update password" });
    }

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

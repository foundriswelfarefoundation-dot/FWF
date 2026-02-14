import { withSentry } from "../../lib/sentry.js";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Clear the token cookie
    res.setHeader('Set-Cookie', 'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure');
    res.json({ ok: true });

  } catch (error) {
    console.error("[auth/logout] Error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
}

export default withSentry(handler);

import { withSentry } from "../../lib/sentry.js";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { memberId, password } = req.body;
    
    if (!memberId || !password) {
      return res.status(400).json({ error: "Member ID and password are required" });
    }

    // Call Railway backend for validation
    const backendUrl = process.env.BACKEND_URL || "https://fwf-production.up.railway.app";
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, password })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // Extract token from Railway response cookies
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      // Forward the token cookie from Railway, but rewrite for Vercel domain
      const tokenMatch = cookies.match(/token=([^;]+)/);
      if (tokenMatch) {
        const token = tokenMatch[1];
        
        // Set cookie with proper settings for Vercel domain
        res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax; Secure`);
      }
    }

    res.json(data);

  } catch (error) {
    console.error("[auth/login] Error:", error);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
}

export default withSentry(handler);

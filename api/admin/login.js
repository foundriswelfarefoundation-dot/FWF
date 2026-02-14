import { withSentry } from "../../lib/sentry.js";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // Call Railway backend for validation
    const backendUrl = process.env.BACKEND_URL || "https://fwf-production.up.railway.app";
    const response = await fetch(`${backendUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // Extract token from Railway response cookies
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      const tokenMatch = cookies.match(/token=([^;]+)/);
      if (tokenMatch) {
        const token = tokenMatch[1];
        
        // Set cookie with proper settings for Vercel domain
        res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax; Secure`);
      }
    }

    res.json(data);

  } catch (error) {
    console.error("[admin/login] Error:", error);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
}

export default withSentry(handler);

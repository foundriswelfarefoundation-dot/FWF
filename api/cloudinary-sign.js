import crypto from "crypto";
import { withSentry } from "../lib/sentry.js";

/**
 * Cloudinary Server-Side Signing
 * --------------------------------
 * Generates a signed upload signature so the browser can upload
 * directly to Cloudinary without exposing CLOUDINARY_API_SECRET.
 *
 * Flow:
 *   1. Client calls POST /api/cloudinary-sign
 *   2. Server returns { signature, api_key, timestamp, cloud_name, folder }
 *   3. Client uploads directly to Cloudinary with those params + file
 *   4. Client receives secure_url — no base64, no Vercel size limit
 */
export default withSentry(async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // .trim() prevents signature mismatch from accidental whitespace/newlines in env vars
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey    = (process.env.CLOUDINARY_API_KEY    || "").trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ ok: false, error: "Cloudinary not configured" });
  }

  const folder    = "fwf-posts";
  const timestamp = Math.round(Date.now() / 1000);

  // Cloudinary signature spec: sort params alphabetically, join with &, append secret, SHA-1
  // folder < timestamp (alphabetical) → correct order
  const paramsToSign = "folder=" + folder + "&timestamp=" + timestamp;
  const signature    = crypto
    .createHash("sha1")
    .update(paramsToSign + apiSecret)
    .digest("hex");

  return res.status(200).json({
    ok: true,
    signature,
    api_key:    apiKey,
    timestamp,
    cloud_name: cloudName,
    folder,
  });
});

import { withSentry } from "../lib/sentry.js";

export default withSentry(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: "AI service not configured" });

  const { image } = req.body || {};
  if (!image) return res.status(400).json({ ok: false, error: "Image is required" });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: 'You are a product listing expert for an Indian marketplace. Analyze this product image and provide the following details in JSON format only (no markdown, no explanation, just pure JSON): {"title": "product name", "category": "best matching category from: clothing, beauty, food, handicrafts, jewelry, home, electronics, books, agriculture, other", "subcategory": "subcategory", "description": "detailed 2-3 line product description in English", "material": "material if visible", "color": "main colors", "condition": "new/used", "suggested_price": approximate price in INR, "tags": ["tag1","tag2","tag3"]}'
            },
            {
              type: "image_url",
              image_url: { url: image, detail: "low" }
            }
          ]
        }],
        max_tokens: 500
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(502).json({ ok: false, error: data.error.message || "AI analysis failed" });
    }

    return res.status(200).json({ ok: true, result: data.choices[0].message.content });

  } catch (err) {
    console.error("AI analyze error:", err);
    return res.status(500).json({ ok: false, error: "Failed to analyze image" });
  }
});

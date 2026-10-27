// Dima’AI: Gemini orqali rasm yaratish
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const { prompt, style, ratio, count } = req.body || {};
  if (typeof prompt !== "string" || prompt.trim().length < 3 || prompt.length > 1500)
    return res.status(400).json({ error: "bad request" });
  const key = process.env.GEMINI_KEY, model = process.env.IMAGE_MODEL;
  if (!key || !model) return res.status(503).json({ error: "not configured" });
  const n = Math.min(Math.max(parseInt(count) || 1, 1), 2);
  const text = `${prompt}. Style: ${String(style || "").slice(0, 30)}. Aspect ratio ${String(ratio || "1:1").slice(0, 5)}.`;
  const images = [];
  try {
    for (let i = 0; i < n; i++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } })
      });
      if (r.status === 429) return res.status(429).json({ error: "limit" });
      if (!r.ok) return res.status(502).json({ error: "provider" });
      const j = await r.json();
      const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
      const p = parts.find(x => x.inlineData);
      if (p) images.push(`data:${p.inlineData.mimeType};base64,${p.inlineData.data}`);
    }
    if (!images.length) return res.status(502).json({ error: "no image" });
    res.status(200).json({ images });
  } catch (e) { res.status(502).json({ error: "network" }); }
};

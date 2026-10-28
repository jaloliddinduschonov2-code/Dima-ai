module.exports = async (req, res) => {
  const id = process.env.CF_ACCOUNT_ID, token = process.env.CF_API_TOKEN;
  const url = `https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  const call = (text) => fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ prompt: text, steps: 4 })
  });
  if (req.method === "GET") {
    if (!id || !token) return res.status(200).json({ missing: [!id && "CF_ACCOUNT_ID", !token && "CF_API_TOKEN"].filter(Boolean) });
    try {
      const r = await call("a red apple");
      const t = await r.text();
      return res.status(200).json({ status: r.status, body: t.slice(0, 300) });
    } catch (e) { return res.status(200).json({ fetchError: String(e).slice(0, 200) }); }
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const { prompt, style, ratio, count } = req.body || {};
  if (typeof prompt !== "string" || prompt.trim().length < 3 || prompt.length > 1000)
    return res.status(400).json({ error: "bad request" });
  if (!id || !token) return res.status(503).json({ error: "not configured" });
  const n = Math.min(Math.max(parseInt(count) || 1, 1), 2);
  const text = `${prompt}. Style: ${String(style || "").slice(0, 30)}. Aspect ratio ${String(ratio || "1:1").slice(0, 5)}.`;
  const images = [];
  try {
    for (let i = 0; i < n; i++) {
      const r = await call(text);
      if (r.status === 429) return res.status(429).json({ error: "limit" });
      if (!r.ok) return res.status(502).json({ error: "provider", status: r.status });
      const j = await r.json();
      const b64 = j && j.result && j.result.image;
      if (b64) images.push("data:image/jpeg;base64," + b64);
    }
    if (!images.length) return res.status(502).json({ error: "no image" });
    res.status(200).json({ images });
  } catch (e) { res.status(502).json({ error: "network" }); }
};

const L = require("./_lib");
const ROLES = {
  AI1: "Sen universal yordamchisan: savollarga javob, tushuntirish, matn yozish, tarjima. Foydalanuvchi tilida, odatda o‘zbekcha javob ber.",
  AI2: "Sen mantiq, matematika va dasturlash bo‘yicha yordamchisan. Qadamma-qadam, aniq javob ber. Odatda o‘zbekcha.",
  AI3: "Sen tezkor yordamchisan: qisqa javoblar, g‘oyalar, matn tahriri. Odatda o‘zbekcha."
};
const IDS = { ai1: "AI1", ai2: "AI2", ai3: "AI3" };
const PREMIUM = ["AI2", "AI3"];
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const token = L.bearer(req);
  const u = await L.verify(token);
  if (u === "config") return res.status(503).json({ error: "not configured" });
  if (!u) return res.status(401).json({ error: "login required" });
  const { ai, message, history } = req.body || {}
  const hist = Array.isArray(history) ? history.slice(-10).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").map((m) => ({ role: m.role, content: m.content.slice(0, 3000) })) : [];
  const n = IDS[ai];
  if (!n || typeof message !== "string" || !message.trim() || message.length > 20000)
    return res.status(400).json({ error: "bad request" });
  const prem = await L.isPremium(req, token);
  if (PREMIUM.includes(n) && !prem) return res.status(403).json({ error: "premium" });
  const limit = (prem ? L.LIMITS.premium : L.LIMITS.free).chat;
  const count = await L.used(token, "chat");
  if (count === null) return res.status(503).json({ error: "usage table missing" });
  if (count >= limit) return res.status(429).json({ error: "daily", limit, used: count });
  const url = process.env[n + "_URL"], key = process.env[n + "_KEY"], model = process.env[n + "_MODEL"];
  if (!url || !key || !model) return res.status(503).json({ error: "not configured" });
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model, messages: [{ role: "system", content: ROLES[n] }, ...hist, { role: "user", content: message }] })
    });
    if (r.status === 429) return res.status(503).json({ error: "busy" });
    if (!r.ok) return res.status(502).json({ error: "provider" });
    const j = await r.json();
    const reply = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!reply) return res.status(502).json({ error: "empty" });
    await L.addUsage(token, "chat", 1);
    res.status(200).json({ reply });
  } catch (e) { res.status(502).json({ error: "network" }); }
};

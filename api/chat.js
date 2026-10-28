const ROLES = {
  AI1: "Sen universal yordamchisan: savollarga javob, tushuntirish, matn yozish, tarjima. Foydalanuvchi tilida, odatda o‘zbekcha javob ber.",
  AI2: "Sen mantiq, matematika va dasturlash bo‘yicha yordamchisan. Qadamma-qadam, aniq javob ber. Odatda o‘zbekcha.",
  AI3: "Sen tezkor yordamchisan: qisqa javoblar, g‘oyalar, matn tahriri. Odatda o‘zbekcha."
};
const IDS = { ai1: "AI1", ai2: "AI2", ai3: "AI3" };
const call = (url, key, body) => fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
  body: JSON.stringify(body)
});
module.exports = async (req, res) => {
  if (req.method === "GET") {
    const t = IDS[req.query && req.query.test];
    if (!t) return res.status(405).json({ error: "method" });
    const url = process.env[t + "_URL"], key = process.env[t + "_KEY"], model = process.env[t + "_MODEL"];
    const missing = [];
    if (!url) missing.push(t + "_URL");
    if (!key) missing.push(t + "_KEY");
    if (!model) missing.push(t + "_MODEL");
    if (missing.length) return res.status(200).json({ missing });
    try {
      const r = await call(url, key, { model, messages: [{ role: "user", content: "Salom" }] });
      const text = await r.text();
      return res.status(200).json({ status: r.status, model, body: text.slice(0, 400) });
    } catch (e) { return res.status(200).json({ fetchError: String(e).slice(0, 200) }); }
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const { ai, message } = req.body || {};
  const n = IDS[ai];
  if (!n || typeof message !== "string" || !message.trim() || message.length > 4000)
    return res.status(400).json({ error: "bad request" });
  const url = process.env[n + "_URL"], key = process.env[n + "_KEY"], model = process.env[n + "_MODEL"];
  if (!url || !key || !model) return res.status(503).json({ error: "not configured" });
  try {
    const r = await call(url, key, { model, messages: [{ role: "system", content: ROLES[n] }, { role: "user", content: message }] });
    if (r.status === 429) return res.status(429).json({ error: "limit" });
    if (!r.ok) return res.status(502).json({ error: "provider" });
    const j = await r.json();
    const reply = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!reply) return res.status(502).json({ error: "empty" });
    res.status(200).json({ reply });
  } catch (e) { res.status(502).json({ error: "network" }); }
};

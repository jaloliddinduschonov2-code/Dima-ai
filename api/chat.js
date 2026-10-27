// Dima’AI: 3 ta AI uchun bitta server funksiyasi (OpenAI-mos API lar)
const ROLES = {
  AI1: "Sen universal yordamchisan: savollarga javob, tushuntirish, matn yozish, tarjima. Foydalanuvchi tilida, odatda o‘zbekcha javob ber.",
  AI2: "Sen mantiq, matematika va dasturlash bo‘yicha yordamchisan. Qadamma-qadam, aniq javob ber. Odatda o‘zbekcha.",
  AI3: "Sen tezkor yordamchisan: qisqa javoblar, g‘oyalar, matn tahriri. Odatda o‘zbekcha."
};
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const { ai, message } = req.body || {};
  const n = { ai1: "AI1", ai2: "AI2", ai3: "AI3" }[ai];
  if (!n || typeof message !== "string" || !message.trim() || message.length > 4000)
    return res.status(400).json({ error: "bad request" });
  const url = process.env[n + "_URL"], key = process.env[n + "_KEY"], model = process.env[n + "_MODEL"];
  if (!url || !key || !model) return res.status(503).json({ error: "not configured" });
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model, messages: [{ role: "system", content: ROLES[n] }, { role: "user", content: message }] })
    });
    if (r.status === 429) return res.status(429).json({ error: "limit" });
    if (!r.ok) return res.status(502).json({ error: "provider" });
    const j = await r.json();
    const reply = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!reply) return res.status(502).json({ error: "empty" });
    res.status(200).json({ reply });
  } catch (e) { res.status(502).json({ error: "network" }); }
};

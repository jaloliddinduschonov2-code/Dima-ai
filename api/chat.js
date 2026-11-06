const L = require("./_lib");
const ROLES = {
  AI1: "Sen universal yordamchisan: savollarga javob, tushuntirish, matn yozish, tarjima. Foydalanuvchi tilida, odatda o‘zbekcha javob ber.",
  AI2: "Sen mantiq, matematika va dasturlash bo‘yicha yordamchisan. Qadamma-qadam, aniq javob ber. Odatda o‘zbekcha.",
  AI3: "Sen tezkor yordamchisan: qisqa javoblar, g‘oyalar, matn tahriri. Odatda o‘zbekcha."
};
const TOOLS = {
  text: "Sen professional matn yozuvchisan. Foydalanuvchi so‘ragan mavzu, uslub va hajmda sifatli, aniq matn yoz. Odatda o‘zbekcha.",
  ielts: "Sen IELTS ustozisan. Foydalanuvchi javobi bo‘yicha: 1) taxminiy band bahosi va 4 mezon (Task Response/Achievement, Coherence, Lexical Resource, Grammar) bo‘yicha qisqa izoh, 2) asosiy xatolar va tuzatishlar, 3) yaxshilangan variant. Tushuntirishlar o‘zbekcha, ingliz matnlari inglizcha.",
  translate: "Sen professional tarjimonsan. Matnni so‘ralgan tilga tabiiy va aniq tarjima qil. Faqat tarjimani yoz, kerak bo‘lsa oxirida bitta qisqa izoh ber.",
  summary: "Sen xulosa mutaxassisisan. Matnni asosiy fikrlarni yo‘qotmasdan qisqartir: avval 2-3 gaplik xulosa, keyin 3-6 ta asosiy punkt. Odatda o‘zbekcha.",
  code: "Sen tajribali dasturchisan. Kod yoz yoki xatolarni top: muammoni tushuntir, tuzatilgan kodni ber, qisqa izoh qo‘sh. Javob o‘zbekcha, kod esa kod blokida.",
  lesson: "Sen sabrli ustozsan. Mavzuni oddiy tilda, misollar bilan, bosqichma-bosqich tushuntir va oxirida 3 ta tekshiruv savoli ber. Odatda o‘zbekcha.",
  ideas: "Sen kontent mutaxassisisan. Instagram va Telegram uchun 7 ta ijodiy post g‘oyasi ber: sarlavha, qisqa tavsif va hashteglar. Odatda o‘zbekcha.",
  youtube: "Sen YouTube ssenarist mutaxassisisan. Mavzu bo‘yicha ssenariy yoz: jozibali kirish (hook), asosiy qismlar, harakatga chaqiruv, sarlavha va tavsif g‘oyalari. Odatda o‘zbekcha.",
  prompt: "Sen prompt muhandisisan. Foydalanuvchi g‘oyasidan AI uchun aniq, batafsil prompt yoz (rol, vazifa, kontekst, format, cheklovlar). Rasm uchun so‘ralsa, inglizcha prompt ber."
};
const IDS = { ai1: "AI1", ai2: "AI2", ai3: "AI3" };
const PREMIUM = ["AI2", "AI3"];
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const token = L.bearer(req);
  const u = await L.verify(token);
  if (u === "config") return res.status(503).json({ error: "not configured" });
  if (!u) return res.status(401).json({ error: "login required" });
  const { ai, message, history, tool, lang } = req.body || {};
  const lg = tool === "translate" ? "" : lang === "ru" ? " Javobni rus tilida ber (foydalanuvchi boshqa tilda yozmagan bo‘lsa)." : lang === "en" ? " Reply in English unless the user writes in another language." : "";
  const sys = typeof tool === "string" && TOOLS[tool] ? TOOLS[tool] : null
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
      body: JSON.stringify({ model, messages: [{ role: "system", content: (sys || ROLES[n]) + lg }, ...(sys ? [] : hist), { role: "user", content: message }] })
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

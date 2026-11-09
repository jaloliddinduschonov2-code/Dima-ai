const L = require("./_lib");
const ROLES = {
  AI1: "Sen universal yordamchisan: savollarga javob, tushuntirish, matn yozish, tarjima. Foydalanuvchi tilida, odatda o‘zbekcha javob ber.",
  AI2: "Sen mantiq, matematika va dasturlash bo‘yicha yordamchisan. Qadamma-qadam, aniq javob ber. Odatda o‘zbekcha.",
  AI3: "Sen tezkor yordamchisan: qisqa javoblar, g‘oyalar, matn tahriri. Odatda o‘zbekcha."
};
const TOOLS = {
  slides: "Sen talabalar uchun taqdimot tuzuvchi mutaxassissan. So‘rov asosida FAQAT bitta JSON obyekti qaytar: hech qanday izoh, kod bloki yoki markdown yozma. Format: {\"title\":\"...\",\"subtitle\":\"...\",\"slides\":[{\"title\":\"...\",\"bullets\":[\"...\"],\"notes\":\"...\"}]}. Qoidalar: slaydlar soni so‘ralganga aniq teng (sarlavha slaydi hisobga kirmaydi); har slaydda 3-5 ta qisqa band (har biri 15 so‘zdan oshmasin); 1-slayd reja, oxirgi slayd xulosa; matn so‘ralgan tilda va darajada; aniq bilmagan faktlarni to‘qima, umumiy yoz; notes: gapirish uchun 1-2 gap.",
  referat: "Sen talabalar uchun referat va loyiha ishi qoralamasini yozuvchi mutaxassissan. So‘rov asosida FAQAT bitta JSON obyekti qaytar: hech qanday izoh, kod bloki yoki markdown yozma. Format: {\"title\":\"...\",\"sections\":[{\"heading\":\"...\",\"paragraphs\":[\"...\"]}],\"references\":[\"...\"]}. Qoidalar: bo‘limlar: Kirish, 3-4 ta asosiy bo‘lim, Xulosa; har bo‘limda 2-4 abzats (har biri 4-6 gap); umumiy hajm so‘ralgan so‘z soniga yaqin; sarlavhalarda raqam yozma; adabiyotlar: faqat mavjudligiga ishonchli mashhur manbalar yoki umumiy tavsiya, to‘qima havola, muallif yoki yil yozma agar bilmasang; matn so‘ralgan tilda va darajada.",
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
  const { ai, message, history, tool, lang, stream, count: count0 } = req.body || {};
  const lg = ["translate", "slides", "referat"].includes(tool) ? "" : lang === "ru" ? " Javobni rus tilida ber (foydalanuvchi boshqa tilda yozmagan bo‘lsa)." : lang === "en" ? " Reply in English unless the user writes in another language." : "";
  const sys = typeof tool === "string" && TOOLS[tool] ? TOOLS[tool] : null
  const hist = Array.isArray(history) ? history.slice(-10).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").map((m) => ({ role: m.role, content: m.content.slice(0, 3000) })) : [];
  const n = IDS[ai];
  if (!n || typeof message !== "string" || !message.trim() || message.length > 20000)
    return res.status(400).json({ error: "bad request" });
  const prem = await L.isPremium(req, token);
  if (PREMIUM.includes(n) && !prem) return res.status(403).json({ error: "premium" });
  const isSlides = tool === "slides", isDoc = isSlides || tool === "referat";
  const kind = tool === "referat" ? "doc" : "chat";
  let cnt = 0;
  if (isSlides) {
    cnt = parseInt(count0);
    if (!(cnt >= 3 && cnt <= 20)) return res.status(400).json({ error: "bad count" });
    const bal = await L.credits(token, u.email);
    if (bal === null) return res.status(503).json({ error: "credits table missing" });
    if (bal < cnt) return res.status(402).json({ error: "credits", need: cnt, have: bal });
  } else {
    const limit = (prem ? L.LIMITS.premium : L.LIMITS.free)[kind];
    const used = await L.used(token, kind);
    if (used === null) return res.status(503).json({ error: "usage table missing" });
    if (used >= limit) return res.status(429).json({ error: "daily", limit, used });
  }
  const dk = isDoc && process.env.DOC_URL && process.env.DOC_KEY && process.env.DOC_MODEL;
  const url = dk ? process.env.DOC_URL : process.env[n + "_URL"];
  const key = dk ? process.env.DOC_KEY : process.env[n + "_KEY"];
  const model = dk ? process.env.DOC_MODEL : process.env[n + "_MODEL"];
  if (!url || !key || !model) return res.status(503).json({ error: "not configured" });
  const wantStream = stream === true && !sys;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model, stream: wantStream, messages: [{ role: "system", content: (sys || ROLES[n]) + lg }, ...(sys ? [] : hist), { role: "user", content: message }] })
    });
    if (r.status === 429) return res.status(503).json({ error: "busy" });
    if (!r.ok) return res.status(502).json({ error: "provider" });
    if (!wantStream) {
      const j = await r.json();
      const reply = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!reply) return res.status(502).json({ error: "empty" });
      if (isSlides) await L.useCredits(token, cnt);
      else await L.addUsage(token, kind, 1);
      return res.status(200).json({ reply });
    }
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "", started = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const ln of lines) {
        if (!ln.startsWith("data:")) continue;
        const d = ln.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        let j;
        try { j = JSON.parse(d); } catch (e) { continue; }
        const c = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (c) {
          if (!started) {
            started = true;
            res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" });
          }
          res.write(c);
        }
      }
    }
    if (!started) return res.status(502).json({ error: "empty" });
    await L.addUsage(token, kind, 1);
    res.end();
  } catch (e) {
    if (res.headersSent) return res.end();
    res.status(502).json({ error: "network" });
  }
};

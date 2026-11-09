const SB = () => process.env.SUPABASE_URL, AK = () => process.env.SUPABASE_ANON_KEY;
const LIMITS = { free: { chat: 20, image: 3, doc: 2 }, premium: { chat: 200, image: 30, doc: 20 } };
const today = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const bearer = (req) => {
  const h = String(req.headers.authorization || "");
  return h.startsWith("Bearer ") ? h.slice(7) : "";
};
const hdr = (t) => ({ apikey: AK(), Authorization: "Bearer " + t });
async function verify(token) {
  if (!token) return null;
  if (!SB() || !AK()) return "config";
  try {
    const r = await fetch(SB() + "/auth/v1/user", { headers: hdr(token) });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}
async function isPremium(req, token) {
  const codes = (process.env.PREMIUM_CODES || "").split(",").map((s) => s.trim()).filter(Boolean);
  const sent = String(req.headers["x-premium-code"] || "").trim();
  if (sent && codes.includes(sent)) return true;
  try {
    const r = await fetch(SB() + "/rest/v1/premium_users?select=until&until=gte." + today() + "&limit=1", { headers: hdr(token) });
    if (!r.ok) return false;
    const a = await r.json();
    return Array.isArray(a) && a.length > 0;
  } catch (e) { return false; }
}
async function used(token, kind) {
  try {
    const r = await fetch(SB() + "/rest/v1/usage?select=id&kind=eq." + kind + "&day=eq." + today() + "&limit=500", { headers: hdr(token) });
    if (!r.ok) return null;
    const a = await r.json();
    return Array.isArray(a) ? a.length : null;
  } catch (e) { return null; }
}
async function addUsage(token, kind, n) {
  const rows = Array.from({ length: n }, () => ({ kind, day: today() }));
  try {
    await fetch(SB() + "/rest/v1/usage", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json", Prefer: "return=minimal" }, hdr(token)),
      body: JSON.stringify(rows)
    });
  } catch (e) {}
}
async function credits(token, email) {
  try {
    const r = await fetch(SB() + "/rest/v1/slide_credits?select=balance&email=eq." + encodeURIComponent(String(email || "").toLowerCase()), { headers: hdr(token) });
    if (!r.ok) return null;
    const a = await r.json();
    return Array.isArray(a) && a[0] ? a[0].balance : 0;
  } catch (e) { return null; }
}
async function useCredits(token, n) {
  try {
    await fetch(SB() + "/rest/v1/rpc/use_slide_credits", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, hdr(token)),
      body: JSON.stringify({ p_n: n })
    });
  } catch (e) {}
}
module.exports = { LIMITS, today, bearer, verify, isPremium, used, addUsage, credits, useCredits };

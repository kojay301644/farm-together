// 開心農場儲值：接收金流付款通知、每分鐘補查超商代碼訂單。一律主動向金流平台查證後才入帳。
const BASE = "https://twpay-tw148.max-cloud.cc";
const URL0 = Deno.env.get("SUPABASE_URL")!;
const SKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KEY = Deno.env.get("TW148_KEY") || "";
const SN = (Deno.env.get("TW148_SN") || "").trim();
const H = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, "Content-Type": "application/json" };

async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${URL0}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(args) });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = t; }
  if (!r.ok) throw new Error((j && j.message) || t);
  return j;
}
async function rest(path: string) {
  const r = await fetch(`${URL0}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error("rest " + r.status);
  return await r.json();
}
async function query(id: string) {
  const f = new URLSearchParams({ OrderType: "recharge", TransactionCode: id });
  const r = await fetch(`${BASE}/api/order/query?sn=${encodeURIComponent(SN)}`, { method: "POST", headers: { Authorization: KEY, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: f });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { return null; }
  if (!j || !j.status || !j.data || Array.isArray(j.data)) return null;
  return j.data;
}
async function check(id: string) {
  if (!/^FB\d{10,20}$/.test(id)) return "bad id";
  const d = await query(id);
  if (!d) { await rpc("pay_set", { p_id: id, p_status: "wait" }); return "no data"; }
  const st = Number(d.Status);
  if (st === 3) {
    const amt = Number(d.RealTransactionAmount ?? d.TransactionAmount);
    const r = await rpc("pay_credit", { p_id: id, p_amt: Math.floor(amt), p_raw: d });
    return "credit " + JSON.stringify(r);
  }
  if (st === 4) { await rpc("pay_set", { p_id: id, p_status: "cancel" }); return "cancel"; }
  await rpc("pay_set", { p_id: id, p_status: "wait" });
  return "wait " + st;
}

Deno.serve(async (req) => {
  try {
    const sec = req.headers.get("x-pay-secret");
    if (sec) {
      const cfg = await rest("pay_cfg?k=eq.pay_secret&select=v");
      if (!cfg[0] || cfg[0].v !== sec) return new Response("forbidden", { status: 403 });
      if (!KEY || !SN) return Response.json({ ok: false, why: "not configured" });
      const b = await req.json().catch(() => ({}));
      let ids: string[] = [];
      if (b.one) ids = [String(b.one)];
      else {
        const rows = await rest("pay_orders?status=eq.wait&method=eq.cvs&select=id,created,last_check&order=created.asc&limit=60");
        const now = Date.now();
        ids = rows.filter((o: any) => {
          const age = now - Date.parse(o.created), lc = o.last_check ? now - Date.parse(o.last_check) : 1e12;
          return age < 40 * 60e3 ? lc > 45e3 : age < 6 * 3600e3 ? lc > 9.5 * 60e3 : lc > 59 * 60e3;
        }).map((o: any) => o.id);
      }
      const out: string[] = [];
      for (const id of ids) { try { out.push(id + ":" + await check(id)); } catch (e) { out.push(id + ":err " + (e as Error).message); } }
      return Response.json({ ok: true, out });
    }
    if (!KEY || !SN) return new Response("not configured", { status: 500 });
    let code = "";
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("json")) { const b = await req.json().catch(() => ({})); code = String(b.TransactionCode || ""); }
    else { const f = await req.formData().catch(() => null); code = String((f && f.get("TransactionCode")) || ""); }
    if (code) { try { await check(code); } catch (_) { /* 補查排程會再試 */ } }
    return new Response("OK");
  } catch (_e) {
    return new Response("error", { status: 500 });
  }
});

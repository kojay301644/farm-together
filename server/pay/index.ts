// 開心農場儲值：超商代碼（Type 3）。郵局轉帳不經金流，由 pay_post_new + post_notify 處理
const BASE = "https://twpay-tw148.max-cloud.cc";
const CB = "https://qnxnuyfvkrvhnaewvrik.supabase.co/functions/v1/paycb";
const URL0 = Deno.env.get("SUPABASE_URL")!;
const SKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KEY = Deno.env.get("TW148_KEY") || "";
const SN = (Deno.env.get("TW148_SN") || "").trim();
const H = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, "Content-Type": "application/json" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${URL0}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(args) });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = t; }
  if (!r.ok) throw new Error((j && j.message) || t);
  return j;
}
function mapErr(e: string) {
  if (/NoAccountsAvailable/i.test(e)) return "目前收款通道忙碌，請稍後再試或改用郵局轉帳";
  if (/OutOfTodayLimit|OutOfCreateOrdersLimit/i.test(e)) return "今天的收款額度已滿，請明天再試或改用郵局轉帳";
  if (/RepeatBlocked|DuplicatePending|AppDuplicatePending/i.test(e)) return "你還有未付款的訂單，請先完成付款或稍後再試";
  if (/BlackList/i.test(e)) return "無法建立付款，請聯絡客服";
  if (/Permission|not allowed/i.test(e)) return "金流設定有誤，請聯絡客服";
  if (/TransactionAmount/i.test(e)) return "這個金額目前無法使用超商代碼";
  return "建立付款失敗，請稍後再試（" + e.slice(0, 60) + "）";
}
const pick = (d: any, ks: string[]) => Object.fromEntries(ks.filter((k) => d[k] != null && d[k] !== "").map((k) => [k, d[k]]));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const u = await fetch(`${URL0}/auth/v1/user`, { headers: { apikey: SKEY, Authorization: req.headers.get("Authorization") || "" } });
    if (!u.ok) return json({ error: "請先登入" }, 401);
    const user = await u.json();
    if (!KEY || !SN) return json({ error: "超商代碼尚未開放，請先用郵局轉帳" }, 500);
    const b = await req.json().catch(() => ({}));
    const payer = String(b.payer || "").trim().slice(0, 32);
    let o: any;
    try { o = await rpc("pay_new", { p_uid: user.id, p_pkg: String(b.pkg || ""), p_method: "cvs", p_payer: payer || null }); }
    catch (e) { return json({ error: String((e as Error).message || e) }, 400); }
    const f = new URLSearchParams({ TransactionType: "3", TransactionAmount: String(o.nt), TransactionCode: o.id, Callback: CB, TransactionAccountName: payer });
    const r = await fetch(`${BASE}/api/order/recharge?sn=${encodeURIComponent(SN)}`, { method: "POST", headers: { Authorization: KEY, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: f });
    const txt = await r.text(); let j: any; try { j = JSON.parse(txt); } catch { j = { status: false, error: txt.slice(0, 200) }; }
    if (!r.ok || !j.status) {
      const err = String(j.error || j.message || ("HTTP " + r.status));
      await rpc("pay_set", { p_id: o.id, p_status: "fail", p_err: err.slice(0, 300) });
      return json({ error: mapErr(err), code: err.slice(0, 120), id: o.id }, 400);
    }
    const d = j.data || {};
    const info = pick(d, ["SerialNumber", "TransactionAmount", "BillAmount", "ExpireDate", "PaymentCode", "IbonCode", "ShortUrl", "PaymentUrl", "PaymentPageUrl", "PayUrl"]);
    await rpc("pay_set", { p_id: o.id, p_status: "wait", p_serial: d.SerialNumber || null, p_info: info });
    return json({ id: o.id, nt: o.nt, g: o.g, method: "cvs", info });
  } catch (e) {
    return json({ error: "系統忙碌，請稍後再試", detail: String((e as Error).message || e).slice(0, 200) }, 500);
  }
});

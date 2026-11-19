// ABOVE Values vote server — Cloudflare Worker + KV
// POST /vote  {id, demand?:1-10, pvalue?:number|null, stance?:"low"|"ok"|"high"}
// GET  /votes -> { "<item-id>": { votes:{n,sum}, pvotes:{n,median,low,ok,high} }, ... }
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...CORS } });
const MAX_PV = 400; // keep the last 400 value votes per item for the median

async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, "0")).join(""); }

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (req.method === "GET" && url.pathname === "/votes") {
      const agg = (await env.VOTES.get("agg", "json")) || {};
      return json(agg);
    }

    if (req.method === "POST" && url.pathname === "/vote") {
      let body; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
      const id = String(body.id || "").slice(0, 64);
      if (!/^[a-z0-9-]+$/.test(id)) return json({ error: "bad id" }, 400);
      const ip = req.headers.get("cf-connecting-ip") || "0";
      const day = new Date().toISOString().slice(0, 10);
      const voterKey = "v:" + id + ":" + (await sha(ip + env.SALT + day));
      const prev = (await env.VOTES.get(voterKey, "json")) || {};

      const item = (await env.VOTES.get("item:" + id, "json")) || { dn: 0, dsum: 0, pv: [], low: 0, ok: 0, high: 0 };
      const now = {};

      // demand 1-10: one vote per person per day; re-voting replaces
      if (body.demand !== undefined && body.demand !== null) {
        const d = Math.round(Number(body.demand));
        if (!(d >= 1 && d <= 10)) return json({ error: "demand must be 1-10" }, 400);
        if (prev.demand !== undefined) { item.dsum -= prev.demand; item.dn -= 1; }
        item.dsum += d; item.dn += 1; now.demand = d;
      }
      // value vote
      if (body.pvalue !== undefined && body.pvalue !== null) {
        const v = Math.round(Number(body.pvalue));
        if (!(v >= 0 && v <= 1e12)) return json({ error: "bad value" }, 400);
        if (prev.pvalue !== undefined) { const i = item.pv.indexOf(prev.pvalue); if (i >= 0) item.pv.splice(i, 1); }
        item.pv.push(v); if (item.pv.length > MAX_PV) item.pv.shift(); now.pvalue = v;
      }
      if (body.stance) {
        const s = String(body.stance); if (!["low", "ok", "high"].includes(s)) return json({ error: "bad stance" }, 400);
        if (prev.stance) item[prev.stance] = Math.max(0, item[prev.stance] - 1);
        item[s] += 1; now.stance = s;
      }
      if (!Object.keys(now).length) return json({ error: "nothing to record" }, 400);

      await env.VOTES.put("item:" + id, JSON.stringify(item));
      await env.VOTES.put(voterKey, JSON.stringify({ ...prev, ...now }), { expirationTtl: 60 * 60 * 36 });

      // update aggregate blob the site reads
      const agg = (await env.VOTES.get("agg", "json")) || {};
      const sorted = item.pv.slice().sort((a, b) => a - b);
      const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
      agg[id] = { votes: { n: item.dn, sum: item.dsum }, pvotes: { n: sorted.length, median, low: item.low, ok: item.ok, high: item.high } };
      await env.VOTES.put("agg", JSON.stringify(agg));
      return json({ ok: true, item: agg[id] });
    }
    return json({ error: "not found" }, 404);
  }
};

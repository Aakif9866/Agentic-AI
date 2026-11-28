"""HTTP wrapper + a one-page demo.

    uv run uvicorn api:app --reload
    curl -X POST localhost:8000/triage -H 'Content-Type: application/json' -d '{"ticket":"I forgot my password"}'
"""
import time
from collections import defaultdict, deque

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from triage import triage

app = FastAPI(title="SupportDesk Triage")

# ponytail: in-memory per-IP limit, per container. Good enough to stop one visitor
# burning the Groq key; move to Redis/Upstash if traffic ever spans many instances.
LIMIT_PER_HOUR = 20
_hits: dict[str, deque] = defaultdict(deque)


def allow(ip: str) -> bool:
    now, q = time.time(), _hits[ip]
    while q and q[0] < now - 3600:
        q.popleft()
    if len(q) >= LIMIT_PER_HOUR:
        return False
    q.append(now)
    return True


class TicketIn(BaseModel):
    ticket: str = Field(min_length=5, max_length=2000)


@app.post("/triage")
def triage_endpoint(body: TicketIn, request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0]
    if not allow(ip):
        raise HTTPException(429, f"Demo limit: {LIMIT_PER_HOUR} tickets per hour.")
    out = triage(body.ticket)
    return {k: out[k] for k in ("triage", "escalate", "reasons", "article_id", "draft")}


@app.get("/health")
def health():
    return {"ok": True}


PAGE = """<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>SupportDesk Triage</title>
<style>
:root{--bg:#faf8f5;--fg:#1d1b19;--mut:#6b655e;--card:#fff;--line:#e4dfd8;--acc:#7a4b2a;--esc:#b3261e;--ok:#2e7d32}
@media (prefers-color-scheme:dark){:root{--bg:#141210;--fg:#ece7e1;--mut:#a39b92;--card:#1e1b18;--line:#34302b;--acc:#d9a273;--esc:#f28b82;--ok:#81c995}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:32px 16px}h1{margin:0 0 4px;font-size:1.6rem}p{color:var(--mut);margin:0 0 20px}
textarea{width:100%;box-sizing:border-box;min-height:110px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--fg);font:inherit}
button{margin-top:10px;padding:10px 18px;border:0;border-radius:10px;background:var(--acc);color:var(--bg);font-weight:600;cursor:pointer}
button:disabled{opacity:.6}.chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.chips button{margin:0;background:var(--card);color:var(--fg);border:1px solid var(--line);font-weight:400;font-size:.85rem}
#out{margin-top:20px;padding:16px;border:1px solid var(--line);border-radius:10px;background:var(--card);white-space:pre-wrap;display:none}
.esc{color:var(--esc);font-weight:700}.ok{color:var(--ok);font-weight:700}
</style><main>
<h1>SupportDesk Triage</h1>
<p>Paste a customer ticket for Brewly (a fictional coffee subscription). The model labels it; code rules decide whether a human must take it; otherwise it drafts a reply from the help centre and checks it.</p>
<div class="chips"><button>I was charged twice this month</button><button>I want a refund, the beans were stale</button><button>Can you add dark mode?</button><button>App shows a blank screen, absolutely furious!!!</button></div>
<label for="t" style="position:absolute;left:-9999px">Ticket</label><textarea id="t" placeholder="Type a ticket..."></textarea>
<button id="go">Triage</button><div id="out" aria-live="polite"></div></main>
<script>
const t=document.getElementById('t'),out=document.getElementById('out'),go=document.getElementById('go');
document.querySelectorAll('.chips button').forEach(b=>b.onclick=()=>{t.value=b.textContent});
go.onclick=async()=>{go.disabled=true;out.style.display='block';out.textContent='Triaging...';
 try{const r=await fetch('/triage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:t.value})});
  const d=await r.json();if(!r.ok)throw new Error(d.detail?.[0]?.msg||d.detail||r.status);
  const tr=d.triage;out.innerHTML='';const h=document.createElement('div');
  h.className=d.escalate?'esc':'ok';h.textContent=d.escalate?'ESCALATE TO HUMAN: '+d.reasons.join(', '):'AUTO-REPLY ('+d.article_id+')';
  const m=document.createElement('div');m.textContent=`category: ${tr.category} · priority: ${tr.priority} · sentiment: ${tr.sentiment}`;
  out.append(h,m);if(d.draft){const p=document.createElement('div');p.style.marginTop='12px';p.textContent=d.draft;out.append(p)}
 }catch(e){out.textContent='Error: '+e.message}finally{go.disabled=false}};
</script></html>"""


@app.get("/", response_class=HTMLResponse)
def home():
    return PAGE

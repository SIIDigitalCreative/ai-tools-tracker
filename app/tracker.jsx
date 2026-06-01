"use client";
import { useState, useEffect, useRef } from "react";

// ── API ───────────────────────────────────────────────────────────────────────
const API = typeof window !== "undefined" ? window.location.origin : "";

async function loadFromRedis() {
  try {
    const r = await fetch(`${API}/api/tools`);
    const d = await r.json();
    return d.tools || [];
  } catch { return []; }
}

async function saveToRedis(tools) {
  try {
    await fetch(`${API}/api/tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tools }),
    });
  } catch {}
}

// ── AI Purpose Generator ──────────────────────────────────────────────────────
async function fetchPurpose(url, name) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 120,
        messages: [{
          role: "user",
          content: `What does the AI tool at "${url}" (named "${name}") do? Write ONE sentence max 100 characters describing its purpose for a marketing team. Be specific. Return ONLY the sentence, nothing else.`
        }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || "";
  } catch { return ""; }
}

// ── Categories ────────────────────────────────────────────────────────────────
const CATS = [
  { label:"Image Gen",    color:"#7c3aed", bg:"#f3eeff" },
  { label:"Video Gen",    color:"#db2777", bg:"#fce7f3" },
  { label:"Copywriting",  color:"#0284c7", bg:"#e0f2fe" },
  { label:"SEO",          color:"#059669", bg:"#d1fae5" },
  { label:"Analytics",    color:"#d97706", bg:"#fef3c7" },
  { label:"Design",       color:"#dc2626", bg:"#fee2e2" },
  { label:"Automation",   color:"#0891b2", bg:"#cffafe" },
  { label:"Social Media", color:"#7c3aed", bg:"#ede9fe" },
  { label:"Chat / LLM",   color:"#2563eb", bg:"#dbeafe" },
  { label:"Other",        color:"#6b7280", bg:"#f3f4f6" },
];
const catInfo = l => CATS.find(c => c.label === l) || CATS[CATS.length-1];
const makeId  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// ── Component ─────────────────────────────────────────────────────────────────
export default function AITracker() {
  const [tools,setTools]               = useState([]);
  const [adding,setAdding]             = useState(false);
  const [editId,setEditId]             = useState(null);
  const [syncStatus,setSyncStatus]     = useState("");
  const [form,setForm] = useState({ name:"",url:"",purpose:"",category:"Other",billing:"monthly",amount:"",currency:"PHP",notes:"" });
  const [fetchingPurpose,setFP]        = useState(false);
  const urlTimer = useRef(null);
  const saveTimer = useRef(null);

  // Load on mount
  useEffect(() => {
    loadFromRedis().then(t => setTools(t));
  }, []);

  // Debounced save to Redis
  const save = (updated) => {
    setTools(updated);
    setSyncStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveToRedis(updated);
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus(""), 2000);
    }, 600);
  };

  // Auto-fetch purpose when URL typed
  const handleUrl = (url) => {
    setForm(f => ({ ...f, url }));
    if (urlTimer.current) clearTimeout(urlTimer.current);
    if (url.length > 8) {
      urlTimer.current = setTimeout(async () => {
        setFP(true);
        const name = form.name || url.replace(/https?:\/\/(www\.)?/,"").split(".")[0];
        const p = await fetchPurpose(url, name);
        if (p) setForm(f => ({ ...f, purpose: p }));
        setFP(false);
      }, 900);
    }
  };

  const resetForm = () => {
    setForm({ name:"",url:"",purpose:"",category:"Other",billing:"monthly",amount:"",currency:"PHP",notes:"" });
    setAdding(false); setEditId(null);
  };

  const saveTool = () => {
    if (!form.name.trim() || !form.url.trim()) return;
    const updated = editId
      ? tools.map(t => t.id === editId ? { ...t, ...form } : t)
      : [...tools, { id: makeId(), ...form, addedAt: new Date().toISOString() }];
    save(updated);
    resetForm();
  };

  const deleteTool = (id) => save(tools.filter(t => t.id !== id));

  const startEdit = (t) => {
    setForm({ name:t.name, url:t.url, purpose:t.purpose, category:t.category,
              billing:t.billing, amount:t.amount, currency:t.currency, notes:t.notes||"" });
    setEditId(t.id); setAdding(true);
  };

  // Cost helpers
  const toMonthly = t => { const a = parseFloat(t.amount)||0; return t.billing==="annual" ? a/12 : t.billing==="monthly" ? a : 0; };
  const toAnnual  = t => { const a = parseFloat(t.amount)||0; return t.billing==="monthly" ? a*12 : t.billing==="annual" ? a : 0; };
  const totalMonthly = tools.reduce((s,t) => s + toMonthly(t), 0);
  const totalAnnual  = tools.reduce((s,t) => s + toAnnual(t),  0);

  const fmt = (n, cur) => {
    if (!n && n !== 0) return "—";
    const sym = cur==="PHP"?"₱":cur==="USD"?"$":cur==="EUR"?"€":cur+" ";
    return sym + n.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
  };

  // Category breakdown
  const byCat = {};
  tools.forEach(t => {
    if (!byCat[t.category]) byCat[t.category] = { monthly:0, count:0 };
    byCat[t.category].monthly += toMonthly(t);
    byCat[t.category].count++;
  });

  const inp = { width:"100%", border:"1.5px solid #e2e8f0", borderRadius:6, padding:"9px 12px", fontFamily:"'DM Sans',sans-serif", fontSize:13, outline:"none", color:"#0f172a", background:"#f8fafc" };
  const btnP = { padding:"10px 22px", background:"#7c3aed", color:"#fff", border:"none", borderRadius:7, fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:600, cursor:"pointer" };
  const btnS = { padding:"9px 16px", background:"none", border:"1.5px solid #e2e8f0", color:"#64748b", borderRadius:7, fontFamily:"'DM Sans',sans-serif", fontSize:13, cursor:"pointer" };
  const lbl  = { fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#64748b", display:"block", marginBottom:6 };

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:"#F4F6FA", minHeight:"100vh", color:"#0f172a", fontSize:14 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <div style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e293b 100%)", padding:"32px 36px 28px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:220, height:220, borderRadius:"50%", background:"rgba(139,92,246,0.12)" }}/>
        <div style={{ position:"absolute", bottom:-20, left:80, width:140, height:140, borderRadius:"50%", background:"rgba(6,182,212,0.08)" }}/>
        <div style={{ position:"relative" }}>
          <div style={{ fontSize:10, letterSpacing:"0.28em", textTransform:"uppercase", color:"#94a3b8", marginBottom:6 }}>Sunbeams Lifestyle · Internal Tools</div>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:28, fontWeight:700, color:"#f8fafc", marginBottom:4 }}>
            AI Tools <span style={{ color:"#a78bfa" }}>Tracker</span>
          </div>
          <div style={{ fontSize:13, color:"#64748b", marginBottom:24 }}>All AI subscriptions in one place — synced live</div>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
            {[
              { label:"Total Tools",   value:tools.length,             color:"#a78bfa" },
              { label:"Monthly Cost",  value:fmt(totalMonthly,"PHP"),  color:"#34d399" },
              { label:"Annual Cost",   value:fmt(totalAnnual, "PHP"),  color:"#fb923c" },
            ].map(s => (
              <div key={s.label} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 18px" }}>
                <div style={{ fontSize:18, fontWeight:700, color:s.color, fontFamily:"'Space Grotesk',sans-serif" }}>{s.value}</div>
                <div style={{ fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"#64748b", marginTop:2 }}>{s.label}</div>
              </div>
            ))}
            {syncStatus && (
              <div style={{ fontSize:11, color:syncStatus==="saved"?"#34d399":"#94a3b8", letterSpacing:"0.1em", marginLeft:8 }}>
                {syncStatus==="saving"?"Syncing…":"✓ Saved"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:960, margin:"0 auto", padding:"24px 20px 80px" }}>

        {/* Add button */}
        {!adding && (
          <button style={{ ...btnP, display:"flex", alignItems:"center", gap:8, marginBottom:22, boxShadow:"0 4px 14px rgba(124,58,237,0.28)" }}
            onClick={() => setAdding(true)}>
            <span style={{ fontSize:18, lineHeight:1 }}>+</span> Add AI Tool
          </button>
        )}

        {/* FORM */}
        {adding && (
          <div style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:12, padding:24, marginBottom:22, boxShadow:"0 4px 24px rgba(15,23,42,0.08)" }}>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:16, fontWeight:600, marginBottom:20 }}>
              {editId ? "Edit Tool" : "Add New AI Tool"}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
              <div>
                <label style={lbl}>Tool Name *</label>
                <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Claude, Midjourney"/>
              </div>
              <div>
                <label style={lbl}>Website URL *</label>
                <div style={{ position:"relative" }}>
                  <input style={inp} value={form.url} onChange={e=>handleUrl(e.target.value)} placeholder="https://claude.ai"/>
                  {fetchingPurpose && <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:10, color:"#7c3aed" }}>Fetching…</span>}
                </div>
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Purpose <span style={{ color:"#94a3b8", fontWeight:400, textTransform:"none", letterSpacing:0 }}>— auto-generated from URL</span></label>
              <textarea style={{ ...inp, resize:"vertical", background:form.purpose?"#f0fdf4":"#f8fafc" }} rows={2}
                value={form.purpose} onChange={e=>setForm(f=>({...f,purpose:e.target.value}))} placeholder="What does this tool do?"/>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 110px 130px", gap:14, marginBottom:14 }}>
              <div>
                <label style={lbl}>Category</label>
                <select style={inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {CATS.map(c => <option key={c.label}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Billing Cycle</label>
                <select style={inp} value={form.billing} onChange={e=>setForm(f=>({...f,billing:e.target.value}))}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual (yearly)</option>
                  <option value="credits">Credits / Pay-as-go</option>
                  <option value="free">Free</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Currency</label>
                <select style={inp} value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>
                  {["PHP","USD","EUR","GBP"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Amount</label>
                <input style={inp} type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00"/>
              </div>
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={lbl}>Notes</label>
              <input style={inp} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Account owner, plan name, login email…"/>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button style={btnP} onClick={saveTool}>{editId?"Save Changes":"Add Tool"}</button>
              <button style={btnS} onClick={resetForm}>Cancel</button>
            </div>
          </div>
        )}

        {/* TOOLS LIST */}
        {tools.length === 0 && !adding ? (
          <div style={{ textAlign:"center", padding:"70px 0", color:"#94a3b8" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🤖</div>
            <div style={{ fontSize:16, fontWeight:600, color:"#64748b", marginBottom:6 }}>No tools added yet</div>
            <div style={{ fontSize:13 }}>Click "Add AI Tool" to start tracking your subscriptions</div>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:28 }}>
              {tools.map(t => {
                const ci = catInfo(t.category);
                return (
                  <div key={t.id} style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:10, padding:"16px 18px", display:"flex", alignItems:"flex-start", gap:14 }}>
                    {/* Favicon */}
                    <div style={{ width:40, height:40, borderRadius:10, background:ci.bg, border:`1.5px solid ${ci.color}33`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" }}>
                      <img src={`https://www.google.com/s2/favicons?domain=${t.url}&sz=32`} alt="" width={20} height={20} style={{ borderRadius:3 }} onError={e=>{e.target.style.display="none";}}/>
                    </div>
                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3, flexWrap:"wrap" }}>
                        <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:15, fontWeight:600 }}>{t.name}</span>
                        <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", padding:"2px 8px", borderRadius:3, background:ci.bg, color:ci.color }}>{t.category}</span>
                        <a href={t.url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#94a3b8", textDecoration:"none" }}>↗ {t.url.replace(/https?:\/\/(www\.)?/,"")}</a>
                      </div>
                      {t.purpose && <div style={{ fontSize:12, color:"#475569", lineHeight:1.5, marginBottom:t.notes?4:0 }}>{t.purpose}</div>}
                      {t.notes && <div style={{ fontSize:11, color:"#94a3b8", fontStyle:"italic" }}>{t.notes}</div>}
                    </div>
                    {/* Cost */}
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      {t.billing==="free" ? (
                        <div style={{ fontSize:14, fontWeight:700, color:"#10b981" }}>Free</div>
                      ) : t.billing==="credits" ? (
                        <div style={{ fontSize:14, fontWeight:700, color:"#f59e0b" }}>Credits</div>
                      ) : (
                        <>
                          <div style={{ fontSize:16, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>{fmt(parseFloat(t.amount)||0, t.currency)}</div>
                          <div style={{ fontSize:10, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em" }}>per {t.billing==="monthly"?"month":"year"}</div>
                          <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>≈ {fmt(toMonthly(t),t.currency)}/mo · {fmt(toAnnual(t),t.currency)}/yr</div>
                        </>
                      )}
                      <div style={{ display:"flex", gap:6, justifyContent:"flex-end", marginTop:8 }}>
                        <button onClick={()=>startEdit(t)} style={{ fontSize:11, padding:"4px 10px", border:"1px solid #e2e8f0", borderRadius:5, background:"#f8fafc", color:"#64748b", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Edit</button>
                        <button onClick={()=>{if(confirm(`Delete ${t.name}?`))deleteTool(t.id);}} style={{ fontSize:11, padding:"4px 10px", border:"1px solid #fecdd3", borderRadius:5, background:"#fff1f2", color:"#e11d48", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* COST SUMMARY */}
            <div style={{ background:"#0f172a", borderRadius:12, padding:"24px 28px" }}>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:16, fontWeight:600, color:"#f8fafc", marginBottom:18 }}>💰 Cost Summary</div>

              {/* By category */}
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:22 }}>
                {Object.entries(byCat).sort((a,b)=>b[1].monthly-a[1].monthly).map(([cat,{monthly,count}]) => {
                  const ci = catInfo(cat);
                  const pct = totalMonthly > 0 ? (monthly/totalMonthly)*100 : 0;
                  return (
                    <div key={cat}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", padding:"2px 8px", borderRadius:3, background:ci.bg+"22", color:ci.color, border:`1px solid ${ci.color}44` }}>{cat}</span>
                          <span style={{ fontSize:11, color:"#475569" }}>{count} tool{count>1?"s":""}</span>
                        </div>
                        <span style={{ fontSize:13, fontWeight:600, color:"#f8fafc", fontFamily:"'Space Grotesk',sans-serif" }}>{fmt(monthly,"PHP")}/mo</span>
                      </div>
                      <div style={{ height:4, background:"#1e293b", borderRadius:2 }}>
                        <div style={{ height:4, borderRadius:2, background:ci.color, width:`${pct}%`, transition:"width 0.4s ease" }}/>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div style={{ borderTop:"1px solid #1e293b", paddingTop:18, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                {[
                  { label:"Total Tools",   value:tools.length,            color:"#a78bfa" },
                  { label:"Monthly Total", value:fmt(totalMonthly,"PHP"), color:"#34d399" },
                  { label:"Annual Total",  value:fmt(totalAnnual, "PHP"), color:"#fb923c" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign:"center" }}>
                    <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", color:"#475569", marginTop:3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
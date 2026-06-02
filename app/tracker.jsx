"use client";
import { useState, useEffect, useRef } from "react";

// ── API ───────────────────────────────────────────────────────────────────────
const API = typeof window !== "undefined" ? window.location.origin : "";

async function loadFromRedis() {
  try {
    const r = await fetch(`${API}/api/tools`);
    const d = await r.json();
    return d;
  } catch { return { tools:[], companyName:"" }; }
}

async function saveToRedis(tools, companyName) {
  try {
    await fetch(`${API}/api/tools`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ tools, companyName }),
    });
  } catch {}
}

// ── AI Purpose Generator ──────────────────────────────────────────────────────
async function fetchPurpose(url, name) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        model:"claude-sonnet-4-20250514", max_tokens:120,
        messages:[{ role:"user", content:`What does the AI tool at "${url}" (named "${name}") do? Write ONE sentence max 100 characters describing its purpose for a marketing team. Be specific. Return ONLY the sentence.` }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || "";
  } catch { return ""; }
}

// ── Config ────────────────────────────────────────────────────────────────────
const DEFAULT_CATS = ["Image Gen","Video Gen","Copywriting","SEO","Analytics","Design","Automation","Social Media","Chat / LLM","Other"];
const DEFAULT_STATUSES = ["Active","Inactive","Cancelled","Trial","Pending"];

const CAT_COLORS = {
  "Image Gen":    { color:"#F4442E", bg:"#fff0ee" },
  "Video Gen":    { color:"#db2777", bg:"#fce7f3" },
  "Copywriting":  { color:"#0284c7", bg:"#e0f2fe" },
  "SEO":          { color:"#059669", bg:"#d1fae5" },
  "Analytics":    { color:"#d97706", bg:"#fef3c7" },
  "Design":       { color:"#dc2626", bg:"#fee2e2" },
  "Automation":   { color:"#0891b2", bg:"#cffafe" },
  "Social Media": { color:"#FFB27D", bg:"#fff8f0" },
  "Chat / LLM":   { color:"#2563eb", bg:"#dbeafe" },
  "Other":        { color:"#6b7280", bg:"#f3f4f6" },
};
const STATUS_COLORS = {
  "Active":    { color:"#059669", bg:"#d1fae5" },
  "Inactive":  { color:"#6b7280", bg:"#f3f4f6" },
  "Cancelled": { color:"#dc2626", bg:"#fee2e2" },
  "Trial":     { color:"#d97706", bg:"#fef3c7" },
  "Pending":   { color:"#0284c7", bg:"#e0f2fe" },
};
const catColor  = l => CAT_COLORS[l]    || { color:"#6b7280", bg:"#f3f4f6" };
const statColor = s => STATUS_COLORS[s] || { color:"#6b7280", bg:"#f3f4f6" };
const makeId    = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const EMPTY_FORM = {
  name:"", url:"", purpose:"",
  categories:["Other"],   // array
  customCategory:"",
  billing:"monthly", amount:"", currency:"PHP",
  status:"Active",
  customStatus:"",
  endDate:"",
  notes:""
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AITracker() {
  const [tools,setTools]             = useState([]);
  const [companyName,setCompanyName] = useState("Sunbeams Lifestyle");
  const [editingName,setEditingName] = useState(false);
  const [adding,setAdding]           = useState(false);
  const [editId,setEditId]           = useState(null);
  const [syncStatus,setSyncStatus]   = useState("");
  const [form,setForm]               = useState(EMPTY_FORM);
  const [fetchingPurpose,setFP]      = useState(false);
  const [customCatInput,setCustomCatInput] = useState("");
  const [customStatInput,setCustomStatInput] = useState("");
  const urlTimer  = useRef(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    loadFromRedis().then(d => {
      if (d.tools) setTools(d.tools);
      if (d.companyName) setCompanyName(d.companyName);
    });
  }, []);

  const save = (updated, name) => {
    setTools(updated);
    setSyncStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveToRedis(updated, name !== undefined ? name : companyName);
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus(""), 2000);
    }, 600);
  };

  const saveName = (name) => {
    setSyncStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveToRedis(tools, name);
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus(""), 2000);
    }, 600);
  };

  const handleUrl = (url) => {
    setForm(f=>({...f,url}));
    if (urlTimer.current) clearTimeout(urlTimer.current);
    if (url.length > 8) {
      urlTimer.current = setTimeout(async () => {
        setFP(true);
        const name = form.name || url.replace(/https?:\/\/(www\.)?/,"").split(".")[0];
        const p = await fetchPurpose(url, name);
        if (p) setForm(f=>({...f,purpose:p}));
        setFP(false);
      }, 900);
    }
  };

  const toggleCategory = (cat) => {
    setForm(f => {
      const cats = f.categories.includes(cat)
        ? f.categories.filter(c=>c!==cat)
        : [...f.categories, cat];
      return {...f, categories: cats.length ? cats : ["Other"]};
    });
  };

  const addCustomCategory = () => {
    const val = customCatInput.trim();
    if (!val) return;
    setForm(f=>({...f, categories:[...f.categories.filter(c=>c!==val), val]}));
    setCustomCatInput("");
  };

  const addCustomStatus = () => {
    const val = customStatInput.trim();
    if (!val) return;
    setForm(f=>({...f, status:val}));
    setCustomStatInput("");
  };

  const resetForm = () => { setForm(EMPTY_FORM); setAdding(false); setEditId(null); setCustomCatInput(""); setCustomStatInput(""); };

  const saveTool = () => {
    if (!form.name.trim() || !form.url.trim()) return;
    const tool = { ...form };
    if (form.customCategory.trim()) {
      tool.categories = [...new Set([...form.categories, form.customCategory.trim()])];
    }
    if (form.customStatus.trim()) tool.status = form.customStatus.trim();
    delete tool.customCategory; delete tool.customStatus;
    const updated = editId
      ? tools.map(t=>t.id===editId?{...t,...tool}:t)
      : [...tools, {id:makeId(),...tool,addedAt:new Date().toISOString()}];
    save(updated);
    resetForm();
  };

  const deleteTool = (id) => save(tools.filter(t=>t.id!==id));

  const startEdit = (t) => {
    setForm({
      name:t.name, url:t.url, purpose:t.purpose,
      categories: t.categories || [t.category||"Other"],
      customCategory:"",
      billing:t.billing, amount:t.amount, currency:t.currency,
      status:t.status||"Active",
      customStatus:"",
      endDate:t.endDate||"",
      notes:t.notes||""
    });
    setEditId(t.id); setAdding(true);
  };

  // Cost helpers
  const toMonthly = t => { const a=parseFloat(t.amount)||0; return t.billing==="annual"?a/12:t.billing==="monthly"?a:0; };
  const toAnnual  = t => { const a=parseFloat(t.amount)||0; return t.billing==="monthly"?a*12:t.billing==="annual"?a:0; };
  const totalMonthly = tools.reduce((s,t)=>s+toMonthly(t),0);
  const totalAnnual  = tools.reduce((s,t)=>s+toAnnual(t),0);
  const fmt = (n,cur) => { const sym=cur==="PHP"?"₱":cur==="USD"?"$":cur==="EUR"?"€":cur+" "; return sym+(n||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2}); };

  const byCat = {};
  tools.forEach(t => {
    const cats = t.categories || [t.category||"Other"];
    cats.forEach(cat => {
      if (!byCat[cat]) byCat[cat]={monthly:0,count:0};
      byCat[cat].monthly += toMonthly(t)/cats.length;
      byCat[cat].count++;
    });
  });

  // ── Styles ────────────────────────────────────────────────────────────────
  const inp  = {width:"100%",border:"1.5px solid #e2e8f0",borderRadius:6,padding:"9px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",color:"#0f172a",background:"#f8fafc"};
  const lbl  = {fontSize:11,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"#64748b",display:"block",marginBottom:6};
  const btnP = {padding:"10px 22px",background:"linear-gradient(135deg,#F4442E,#FFB27D)",color:"#fff",border:"none",borderRadius:7,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,cursor:"pointer"};
  const btnS = {padding:"9px 16px",background:"none",border:"1.5px solid #e2e8f0",color:"#64748b",borderRadius:7,fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer"};

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#FFF5F2",minHeight:"100vh",color:"#0f172a",fontSize:14}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg,#F4442E 0%,#FFB27D 100%)",padding:"32px 36px 28px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:220,height:220,borderRadius:"50%",background:"rgba(255,255,255,0.12)"}}/>
        <div style={{position:"absolute",bottom:-20,left:80,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,0.08)"}}/>
        <div style={{position:"relative"}}>
          <div style={{fontSize:10,letterSpacing:"0.28em",textTransform:"uppercase",color:"rgba(255,255,255,0.9)",marginBottom:6}}>{companyName} · Internal Tools</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            {editingName ? (
              <input value={companyName} autoFocus onChange={e=>setCompanyName(e.target.value)}
                onBlur={()=>{setEditingName(false);saveName(companyName);}}
                onKeyDown={e=>{if(e.key==="Enter"){setEditingName(false);saveName(companyName);}}}
                style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:28,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.15)",border:"2px solid rgba(255,255,255,0.4)",borderRadius:6,padding:"2px 10px",outline:"none",minWidth:200}}/>
            ) : (
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:28,fontWeight:700,color:"#fff"}}>
                {companyName} <span style={{color:"rgba(255,255,255,0.75)",fontWeight:400}}>AI Tools</span> Tracker
              </div>
            )}
            <button onClick={()=>setEditingName(true)} style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:4,padding:"3px 10px",color:"#fff",fontSize:10,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✏ Edit</button>
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.9)",marginBottom:24}}>All AI subscriptions in one place — synced live</div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
            {[{label:"Total Tools",value:tools.length},{label:"Monthly Cost",value:fmt(totalMonthly,"PHP")},{label:"Annual Cost",value:fmt(totalAnnual,"PHP")}].map(s=>(
              <div key={s.label} style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,padding:"10px 18px"}}>
                <div style={{fontSize:18,fontWeight:700,color:"#fff",fontFamily:"'Space Grotesk',sans-serif"}}>{s.value}</div>
                <div style={{fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.8)",marginTop:2}}>{s.label}</div>
              </div>
            ))}
            {syncStatus && <div style={{fontSize:11,color:"rgba(255,255,255,0.9)",letterSpacing:"0.1em",marginLeft:4}}>{syncStatus==="saving"?"Syncing…":"✓ Saved"}</div>}
          </div>
        </div>
      </div>

      <div style={{maxWidth:960,margin:"0 auto",padding:"24px 20px 80px"}}>

        {/* Add button */}
        {!adding && (
          <div style={{display:"flex",justifyContent:"center",marginBottom:22}}>
            <button style={{...btnP,display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 14px rgba(244,68,46,0.35)"}} onClick={()=>setAdding(true)}>
              <span style={{fontSize:18,lineHeight:1}}>+</span> Add AI Tool
            </button>
          </div>
        )}

        {/* FORM */}
        {adding && (
          <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:24,marginBottom:22,boxShadow:"0 4px 24px rgba(15,23,42,0.08)"}}>
            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:600,marginBottom:20}}>{editId?"Edit Tool":"Add New AI Tool"}</div>

            {/* Name + URL */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
              <div>
                <label style={lbl}>Tool Name *</label>
                <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Claude, Midjourney"/>
              </div>
              <div>
                <label style={lbl}>Website URL *</label>
                <div style={{position:"relative"}}>
                  <input style={inp} value={form.url} onChange={e=>handleUrl(e.target.value)} placeholder="https://claude.ai"/>
                  {fetchingPurpose&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:10,color:"#F4442E"}}>Fetching…</span>}
                </div>
              </div>
            </div>

            {/* Purpose */}
            <div style={{marginBottom:14}}>
              <label style={lbl}>Purpose <span style={{color:"#94a3b8",fontWeight:400,textTransform:"none",letterSpacing:0}}>— auto-generated from URL</span></label>
              <textarea style={{...inp,resize:"vertical",background:form.purpose?"#f0fdf4":"#f8fafc"}} rows={2} value={form.purpose} onChange={e=>setForm(f=>({...f,purpose:e.target.value}))} placeholder="What does this tool do?"/>
            </div>

            {/* Categories — multi-select */}
            <div style={{marginBottom:14}}>
              <label style={lbl}>Categories <span style={{color:"#94a3b8",fontWeight:400,textTransform:"none",letterSpacing:0}}>— select multiple</span></label>
              <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:10}}>
                {DEFAULT_CATS.map(cat => {
                  const sel = form.categories.includes(cat);
                  const ci = catColor(cat);
                  return (
                    <button key={cat} onClick={()=>toggleCategory(cat)}
                      style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${sel?ci.color:"#e2e8f0"}`,background:sel?ci.bg:"#f8fafc",color:sel?ci.color:"#64748b",fontSize:12,fontWeight:sel?600:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s"}}>
                      {sel?"✓ ":""}{cat}
                    </button>
                  );
                })}
              </div>
              {/* Custom category */}
              <div style={{display:"flex",gap:8}}>
                <input style={{...inp,flex:1}} value={customCatInput} onChange={e=>setCustomCatInput(e.target.value)}
                  placeholder="Add custom category…" onKeyDown={e=>e.key==="Enter"&&addCustomCategory()}/>
                <button onClick={addCustomCategory} style={{...btnS,whiteSpace:"nowrap"}}>+ Add</button>
              </div>
              {/* Show custom categories */}
              {form.categories.filter(c=>!DEFAULT_CATS.includes(c)).map(c=>(
                <span key={c} style={{display:"inline-block",marginTop:6,marginRight:6,padding:"3px 10px",background:"#fff0ee",color:"#F4442E",border:"1px solid #F4442E44",borderRadius:20,fontSize:12}}>
                  {c} <button onClick={()=>toggleCategory(c)} style={{border:"none",background:"none",color:"#F4442E",cursor:"pointer",fontSize:11,padding:0,marginLeft:4}}>✕</button>
                </span>
              ))}
            </div>

            {/* Status */}
            <div style={{marginBottom:14}}>
              <label style={lbl}>Status</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:10}}>
                {DEFAULT_STATUSES.map(s=>{
                  const sel = form.status===s;
                  const sc = statColor(s);
                  return (
                    <button key={s} onClick={()=>setForm(f=>({...f,status:s}))}
                      style={{padding:"5px 14px",borderRadius:20,border:`1.5px solid ${sel?sc.color:"#e2e8f0"}`,background:sel?sc.bg:"#f8fafc",color:sel?sc.color:"#64748b",fontSize:12,fontWeight:sel?600:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s"}}>
                      {sel?"✓ ":""}{s}
                    </button>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:8}}>
                <input style={{...inp,flex:1}} value={customStatInput} onChange={e=>setCustomStatInput(e.target.value)}
                  placeholder="Add custom status…" onKeyDown={e=>e.key==="Enter"&&addCustomStatus()}/>
                <button onClick={addCustomStatus} style={{...btnS,whiteSpace:"nowrap"}}>+ Add</button>
              </div>
            </div>

            {/* Billing + Amount + Currency + End Date */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 100px 130px",gap:14,marginBottom:14}}>
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
                <label style={lbl}>Subscription Ends</label>
                <input type="date" style={inp} value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))}/>
              </div>
              <div>
                <label style={lbl}>Currency</label>
                <select style={inp} value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>
                  {["PHP","USD","EUR","GBP"].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Amount</label>
                <input type="number" style={inp} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00"/>
              </div>
            </div>

            {/* Notes */}
            <div style={{marginBottom:20}}>
              <label style={lbl}>Notes</label>
              <input style={inp} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Account owner, plan name, login email…"/>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button style={btnP} onClick={saveTool}>{editId?"Save Changes":"Add Tool"}</button>
              <button style={btnS} onClick={resetForm}>Cancel</button>
            </div>
          </div>
        )}

        {/* TOOLS LIST */}
        {tools.length===0&&!adding ? (
          <div style={{textAlign:"center",padding:"70px 0",color:"#94a3b8"}}>
            <div style={{fontSize:40,marginBottom:12}}>🤖</div>
            <div style={{fontSize:16,fontWeight:600,color:"#64748b",marginBottom:6}}>No tools added yet</div>
            <div style={{fontSize:13}}>Click "Add AI Tool" to start tracking your subscriptions</div>
          </div>
        ) : (
          <>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
              {tools.map(t=>{
                const cats = t.categories || [t.category||"Other"];
                const sc   = statColor(t.status||"Active");
                const daysLeft = t.endDate ? Math.ceil((new Date(t.endDate)-new Date())/(1000*60*60*24)) : null;
                return (
                  <div key={t.id} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"16px 18px",display:"flex",alignItems:"flex-start",gap:14}}>
                    {/* Favicon */}
                    <div style={{width:40,height:40,borderRadius:10,background:catColor(cats[0]).bg,border:`1.5px solid ${catColor(cats[0]).color}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
                      <img src={`https://www.google.com/s2/favicons?domain=${t.url}&sz=32`} alt="" width={20} height={20} style={{borderRadius:3}} onError={e=>{e.target.style.display="none";}}/>
                    </div>
                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,fontWeight:600}}>{t.name}</span>
                        {/* Status badge */}
                        <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",padding:"2px 8px",borderRadius:3,background:sc.bg,color:sc.color}}>{t.status||"Active"}</span>
                        {/* Category badges */}
                        {cats.map(cat=>(
                          <span key={cat} style={{fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",padding:"2px 8px",borderRadius:3,background:catColor(cat).bg,color:catColor(cat).color}}>{cat}</span>
                        ))}
                        <a href={t.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#94a3b8",textDecoration:"none"}}>↗ {t.url.replace(/https?:\/\/(www\.)?/,"")}</a>
                      </div>
                      {t.purpose&&<div style={{fontSize:12,color:"#475569",lineHeight:1.5,marginBottom:t.notes?3:0}}>{t.purpose}</div>}
                      {t.notes&&<div style={{fontSize:11,color:"#94a3b8",fontStyle:"italic",marginBottom:3}}>{t.notes}</div>}
                      {/* End date */}
                      {t.endDate&&(
                        <div style={{fontSize:11,color:daysLeft!==null&&daysLeft<=30?"#dc2626":"#64748b",marginTop:2}}>
                          📅 Ends {new Date(t.endDate).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}
                          {daysLeft!==null&&daysLeft>=0&&<span style={{marginLeft:6,fontWeight:600}}>{daysLeft<=30?`⚠ ${daysLeft} days left`:`(${daysLeft} days)`}</span>}
                          {daysLeft!==null&&daysLeft<0&&<span style={{marginLeft:6,color:"#dc2626",fontWeight:600}}>Expired</span>}
                        </div>
                      )}
                    </div>
                    {/* Cost */}
                    <div style={{textAlign:"right",flexShrink:0}}>
                      {t.billing==="free"?<div style={{fontSize:14,fontWeight:700,color:"#10b981"}}>Free</div>
                      :t.billing==="credits"?<div style={{fontSize:14,fontWeight:700,color:"#f59e0b"}}>Credits</div>
                      :<>
                        <div style={{fontSize:16,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif"}}>{fmt(parseFloat(t.amount)||0,t.currency)}</div>
                        <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.1em"}}>per {t.billing==="monthly"?"month":"year"}</div>
                        <div style={{fontSize:11,color:"#64748b",marginTop:2}}>≈ {fmt(toMonthly(t),t.currency)}/mo · {fmt(toAnnual(t),t.currency)}/yr</div>
                      </>}
                      <div style={{display:"flex",gap:6,justifyContent:"flex-end",marginTop:8}}>
                        <button onClick={()=>startEdit(t)} style={{fontSize:11,padding:"4px 10px",border:"1px solid #e2e8f0",borderRadius:5,background:"#f8fafc",color:"#64748b",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Edit</button>
                        <button onClick={()=>{if(confirm(`Delete ${t.name}?`))deleteTool(t.id);}} style={{fontSize:11,padding:"4px 10px",border:"1px solid #fecdd3",borderRadius:5,background:"#fff1f2",color:"#e11d48",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* COST SUMMARY */}
            <div style={{background:"linear-gradient(135deg,#F4442E 0%,#c73520 100%)",borderRadius:12,padding:"24px 28px"}}>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:600,color:"#fff",marginBottom:18}}>💰 Cost Summary</div>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:22}}>
                {Object.entries(byCat).sort((a,b)=>b[1].monthly-a[1].monthly).map(([cat,{monthly,count}])=>{
                  const pct = totalMonthly>0?(monthly/totalMonthly)*100:0;
                  const ci  = catColor(cat);
                  return (
                    <div key={cat}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",padding:"2px 8px",borderRadius:3,background:"rgba(255,255,255,0.2)",color:"#fff"}}>{cat}</span>
                          <span style={{fontSize:11,color:"rgba(255,255,255,0.75)"}}>{count} tool{count>1?"s":""}</span>
                        </div>
                        <span style={{fontSize:13,fontWeight:600,color:"#fff",fontFamily:"'Space Grotesk',sans-serif"}}>{fmt(monthly,"PHP")}/mo</span>
                      </div>
                      <div style={{height:4,background:"rgba(255,255,255,0.2)",borderRadius:2}}>
                        <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.8)",width:`${pct}%`,transition:"width 0.4s ease"}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{borderTop:"1px solid rgba(255,255,255,0.2)",paddingTop:18,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                {[{label:"Total Tools",value:tools.length},{label:"Monthly Total",value:fmt(totalMonthly,"PHP")},{label:"Annual Total",value:fmt(totalAnnual,"PHP")}].map(s=>(
                  <div key={s.label} style={{textAlign:"center"}}>
                    <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:700,color:"#fff"}}>{s.value}</div>
                    <div style={{fontSize:10,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(255,255,255,0.75)",marginTop:3}}>{s.label}</div>
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

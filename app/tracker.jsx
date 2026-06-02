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
  const [companyName,setCompanyName] = useState("");
  const [editingName,setEditingName] = useState(false);
  const [adding,setAdding]           = useState(false);
  const [inlineEditId,setInlineEditId] = useState(null);
  const [isAuthed,setIsAuthed]       = useState(false);
  const [showPwModal,setShowPwModal] = useState(false);
  const [pwInput,setPwInput]         = useState("");
  const [pwError,setPwError]         = useState(false);
  const [pwAction,setPwAction]       = useState(null); // "add" | "edit" | "delete"
  const [pendingAction,setPendingAction] = useState(null);
  const [editPassword]               = useState("sii2026");
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

  // Auth gate
  const requireAuth = (action, payload) => {
    if (isAuthed) {
      if (action === "add") setAdding(true);
      if (action === "edit") startEditDirect(payload);
      if (action === "delete") deleteTool(payload);
      return;
    }
    setPwAction(action);
    setPendingAction(payload);
    setPwInput("");
    setPwError(false);
    setShowPwModal(true);
  };

  const submitPassword = () => {
    if (pwInput === editPassword) {
      setIsAuthed(true);
      setShowPwModal(false);
      setPwInput("");
      setPwError(false);
      // Use setTimeout to ensure state updates before action
      setTimeout(() => {
        if (pwAction === "add") setAdding(true);
        if (pwAction === "edit" && pendingAction) startEditDirect(pendingAction);
        if (pwAction === "delete" && pendingAction) {
          if(confirm(`Delete this tool?`)) deleteTool(pendingAction);
        }
      }, 50);
    } else {
      setPwError(true);
      setPwInput("");
    }
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
    // Handle custom category
    const customCat = (form.customCategory||"").trim();
    if (customCat) {
      tool.categories = [...new Set([...(form.categories||[]), customCat])];
    }
    // Handle custom status
    const customStat = (form.customStatus||"").trim();
    if (customStat) tool.status = customStat;
    delete tool.customCategory;
    delete tool.customStatus;
    // Make sure categories is always an array
    if (!Array.isArray(tool.categories)) tool.categories = ["Other"];
    const updated = editId
      ? tools.map(t => t.id === editId ? { ...t, ...tool } : t)
      : [...tools, { id: makeId(), ...tool, addedAt: new Date().toISOString() }];
    save(updated);
    resetForm();
  };

  const deleteTool = (id) => save(tools.filter(t=>t.id!==id));

  const startEditDirect = (t) => {
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
    setEditId(t.id);
    setInlineEditId(t.id);
    setAdding(false);
  };

  // Cost helpers — always convert to PHP for totals
  const RATES = {PHP:1, USD:56, EUR:61, GBP:72};
  const toPHP = (amount, currency) => (parseFloat(amount)||0) * (RATES[currency]||1);
  const toMonthly = t => { const a=toPHP(t.amount,t.currency); return t.billing==="annual"?a/12:t.billing==="monthly"?a:0; };
  const toAnnual  = t => { const a=toPHP(t.amount,t.currency); return t.billing==="monthly"?a*12:t.billing==="annual"?a:0; };
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
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @media (max-width: 600px) {
          .tool-card { flex-wrap: wrap; }
          .tool-cost { width: 100%; text-align: left !important; margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 10px; }
          .tool-cost-btns { justify-content: flex-start !important; }
          .form-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg,#F4442E 0%,#FFB27D 100%)",padding:"28px 20px 24px",position:"relative",overflow:"hidden"}}>
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
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,maxWidth:480}}>
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

      <div style={{maxWidth:960,margin:"0 auto",padding:"20px 14px 80px"}}>

        {/* Add button */}
        {!adding && (
          <div style={{display:"flex",justifyContent:"center",marginBottom:22}}>
            <button style={{...btnP,display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 14px rgba(244,68,46,0.35)"}} onClick={()=>{
            if(isAuthed){setAdding(true);return;}
            setPwAction("add");
            setPendingAction(null);
            setPwInput("");
            setPwError(false);
            setShowPwModal(true);
          }}>
              <span style={{fontSize:18,lineHeight:1}}>+</span> Add AI Tool
            </button>
          </div>
        )}

        {/* FORM */}
        {adding && (
          <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:24,marginBottom:22,boxShadow:"0 4px 24px rgba(15,23,42,0.08)"}}>
            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:600,marginBottom:20}}>{editId?`✏ Editing: ${form.name}`:"Add New AI Tool"}</div>

            {/* Name + URL */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:14}}>
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
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:14,marginBottom:14}}>
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
                <select style={inp} value={form.currency} onChange={e=>{
                  const newCur = e.target.value;
                  const rates = {PHP:1,USD:56,EUR:61,GBP:72}; // approx rates
                  const amt = parseFloat(form.amount)||0;
                  if(amt>0 && form.currency!==newCur) {
                    const inPHP = amt * rates[form.currency];
                    const converted = (inPHP / rates[newCur]).toFixed(2);
                    setForm(f=>({...f,currency:newCur,amount:converted}));
                  } else {
                    setForm(f=>({...f,currency:newCur}));
                  }
                }}>
                  {["PHP","USD","EUR","GBP"].map(cur=><option key={cur}>{cur}</option>)}
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
                  <div key={t.id} className="tool-card" style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"14px 14px",display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                    {/* Favicon */}
                    <div style={{width:44,height:44,borderRadius:10,background:catColor(cats[0]).bg,border:`1.5px solid ${catColor(cats[0]).color}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden",position:"relative"}}>
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${t.url.replace(/https?:\/\/(www\.)?/,"")}&sz=64`}
                        alt=""
                        width={28} height={28}
                        style={{borderRadius:4,objectFit:"contain"}}
                        onError={e=>{e.target.style.display="none"; e.target.nextSibling.style.display="flex";}}
                      />
                      <span style={{display:"none",position:"absolute",inset:0,alignItems:"center",justifyContent:"center",fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700,color:catColor(cats[0]).color}}>
                        {t.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      {/* Row 1: name + status + url */}
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
                        <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,fontWeight:600}}>{t.name}</span>
                        <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",padding:"2px 8px",borderRadius:3,background:sc.bg,color:sc.color}}>{t.status||"Active"}</span>
                        <a href={t.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#94a3b8",textDecoration:"none"}}>↗ {t.url.replace(/https?:\/\/(www\.)?/,"")}</a>
                      </div>
                      {t.purpose&&<div style={{fontSize:12,color:"#475569",lineHeight:1.5,marginBottom:4}}>{t.purpose}</div>}
                      {/* Row 3: categories */}
                      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>
                        {cats.map(cat=>(
                          <span key={cat} style={{fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",padding:"2px 7px",borderRadius:3,background:catColor(cat).bg,color:catColor(cat).color}}>{cat}</span>
                        ))}
                      </div>
                      {t.notes&&<div style={{fontSize:11,color:"#94a3b8",fontStyle:"italic",marginBottom:3}}>{t.notes}</div>}
                      {/* End date */}
                      {t.endDate&&(
                        <div style={{fontSize:11,color:daysLeft!==null&&daysLeft<=30?"#dc2626":"#64748b",marginTop:2}}>
                          📅 Ends {new Date(t.endDate).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}
                          {daysLeft!==null&&daysLeft>=0&&<span style={{marginLeft:6,fontWeight:600}}>{daysLeft<=30?`⚠ ${daysLeft} ${daysLeft===1?"day":"days"} left`:`(${daysLeft} ${daysLeft===1?"day":"days"})`}</span>}
                          {daysLeft!==null&&daysLeft<0&&<span style={{marginLeft:6,color:"#dc2626",fontWeight:600}}>Expired</span>}
                        </div>
                      )}
                    </div>
                    {/* Cost */}
                    <div className="tool-cost" style={{textAlign:"right",flexShrink:0,minWidth:110}}>
                      {t.billing==="free"?<div style={{fontSize:14,fontWeight:700,color:"#10b981"}}>Free</div>
                      :t.billing==="credits"?<>
                          <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Credits</div>
                          {parseFloat(t.amount)>0&&<>
                            <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{fmt(parseFloat(t.amount),t.currency)}</div>
                            {t.currency!=="PHP"&&<div style={{fontSize:10,color:"#F4442E",fontWeight:500}}>≈ {fmt(toPHP(t.amount,t.currency),"PHP")} PHP</div>}
                          </>}
                          <div style={{fontSize:9,color:"#F4442E",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em"}}>PAY-AS-GO</div>
                        </>
                      :<>
                        <div style={{fontSize:16,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif"}}>{fmt(parseFloat(t.amount)||0,t.currency)}</div>
                        <div style={{fontSize:10,color:"#F4442E",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>PER {t.billing==="monthly"?"MONTH":"YEAR"}</div>
                        <div style={{fontSize:11,color:"#64748b",marginTop:2}}>≈ {fmt(toMonthly(t),t.currency)}/mo · {fmt(toAnnual(t),t.currency)}/yr</div>
                      </>}
                      <div className="tool-cost-btns" style={{display:"flex",gap:6,justifyContent:"flex-end",marginTop:8}}>
                        <button onClick={()=>requireAuth("edit",t)} style={{fontSize:11,padding:"4px 10px",border:"1px solid #e2e8f0",borderRadius:5,background:"#f8fafc",color:"#64748b",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Edit</button>
                        <button onClick={()=>requireAuth("delete",t.id)} style={{fontSize:11,padding:"4px 10px",border:"1px solid #fecdd3",borderRadius:5,background:"#fff1f2",color:"#e11d48",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Delete</button>
                      </div>
                    </div>

                    {/* INLINE EDIT FORM - reads directly from form state set by startEditDirect */}
                    {inlineEditId===t.id&&editId===t.id&&(
                      <div style={{marginTop:14,borderTop:"2px dashed #F4442E44",paddingTop:16}}>
                        <div style={{fontSize:12,fontWeight:700,color:"#F4442E",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>✏ Editing: {t.name}</div>

                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                          <div><label style={lbl}>Tool Name</label>
                            <input style={inp} defaultValue={t.name} id={`edit-name-${t.id}`}/>
                          </div>
                          <div><label style={lbl}>URL</label>
                            <input style={inp} defaultValue={t.url} id={`edit-url-${t.id}`}/>
                          </div>
                        </div>

                        <div style={{marginBottom:12}}>
                          <label style={lbl}>Purpose</label>
                          <textarea style={{...inp,resize:"vertical"}} rows={2} defaultValue={t.purpose||""} id={`edit-purpose-${t.id}`}/>
                        </div>

                        <div style={{marginBottom:12}}>
                          <label style={lbl}>Categories</label>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}} id={`cat-container-${t.id}`}>
                            {[...DEFAULT_CATS, ...(t.categories||[]).filter(c=>!DEFAULT_CATS.includes(c))].map(cat=>{
                              const cats2 = t.categories||[t.category||"Other"];
                              const sel = cats2.includes(cat);
                              const ci=catColor(cat);
                              return <button key={cat} type="button"
                                className={`cat-btn-${t.id}`}
                                data-cat={cat}
                                data-sel={sel?"1":"0"}
                                onClick={e=>{
                                  const btn=e.currentTarget;
                                  const isSel=btn.getAttribute("data-sel")==="1";
                                  btn.setAttribute("data-sel",isSel?"0":"1");
                                  btn.style.borderColor=isSel?"#e2e8f0":ci.color;
                                  btn.style.color=isSel?"#64748b":ci.color;
                                  btn.style.fontWeight=isSel?"400":"600";
                                  btn.style.background=isSel?"#f8fafc":ci.bg;
                                  btn.textContent=isSel?cat:`✓ ${cat}`;
                                }}
                                style={{padding:"4px 10px",borderRadius:20,border:`1.5px solid ${sel?ci.color:"#e2e8f0"}`,background:sel?ci.bg:"#f8fafc",color:sel?ci.color:"#64748b",fontSize:11,fontWeight:sel?600:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                                {sel?`✓ ${cat}`:cat}
                              </button>;
                            })}
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            <input id={`custom-cat-${t.id}`} style={{...inp,flex:1}} placeholder="Add custom category…"
                              onKeyDown={e=>{
                                if(e.key!=="Enter")return;
                                const val=e.target.value.trim();
                                if(!val)return;
                                const container=document.getElementById(`cat-container-${t.id}`);
                                if(container.querySelector(`[data-cat="${val}"]`))return;
                                const btn=document.createElement("button");
                                btn.className=`cat-btn-${t.id}`;
                                btn.setAttribute("data-cat",val);
                                btn.setAttribute("data-sel","1");
                                btn.textContent=val;
                                btn.style.cssText="padding:4px 10px;border-radius:20px;border:1.5px solid #F4442E;background:#fff0ee;color:#F4442E;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;margin:0;";
                                btn.onclick=()=>{const s=btn.getAttribute("data-sel")==="1";btn.setAttribute("data-sel",s?"0":"1");btn.style.background=s?"#f8fafc":"#fff0ee";btn.style.borderColor=s?"#e2e8f0":"#F4442E";btn.style.color=s?"#64748b":"#F4442E";btn.style.fontWeight=s?"400":"600";};
                                container.appendChild(btn);
                                e.target.value="";
                              }}/>
                            <button type="button" style={{...btnS,whiteSpace:"nowrap"}} onClick={()=>{
                              const input=document.getElementById(`custom-cat-${t.id}`);
                              const val=input?.value.trim();
                              if(!val)return;
                              const container=document.getElementById(`cat-container-${t.id}`);
                              if(container.querySelector(`[data-cat="${val}"]`))return;
                              const btn=document.createElement("button");
                              btn.className=`cat-btn-${t.id}`;
                              btn.setAttribute("data-cat",val);
                              btn.setAttribute("data-sel","1");
                              btn.textContent=val;
                              btn.style.cssText="padding:4px 10px;border-radius:20px;border:1.5px solid #F4442E;background:#fff0ee;color:#F4442E;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;margin:0;";
                              btn.onclick=()=>{const s=btn.getAttribute("data-sel")==="1";btn.setAttribute("data-sel",s?"0":"1");btn.style.background=s?"#f8fafc":"#fff0ee";btn.style.borderColor=s?"#e2e8f0":"#F4442E";btn.style.color=s?"#64748b":"#F4442E";btn.style.fontWeight=s?"400":"600";};
                              container.appendChild(btn);
                              input.value="";
                            }}>+ Add</button>
                          </div>
                        </div>

                        <div style={{marginBottom:12}}>
                          <label style={lbl}>Status</label>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}} id={`stat-container-${t.id}`}>
                            {[...DEFAULT_STATUSES, ...(!DEFAULT_STATUSES.includes(t.status||"Active")?[t.status||"Active"]:[])].map(s=>{
                              const sel=(t.status||"Active")===s;
                              const sc2=statColor(s);
                              return <button key={s} type="button"
                                data-status={s}
                                className={`stat-btn-${t.id}`}
                                data-sel={sel?"1":"0"}
                                onClick={e=>{
                                  document.querySelectorAll(`#stat-container-${t.id} button`).forEach(b=>{
                                    b.setAttribute("data-sel","0");
                                    b.style.background="#f8fafc";
                                    b.style.borderColor="#e2e8f0";
                                    b.style.color="#64748b";
                                    b.style.fontWeight="400";
                                    b.textContent=b.getAttribute("data-status");
                                  });
                                  e.currentTarget.setAttribute("data-sel","1");
                                  e.currentTarget.style.background=sc2.bg;
                                  e.currentTarget.style.borderColor=sc2.color;
                                  e.currentTarget.style.color=sc2.color;
                                  e.currentTarget.style.fontWeight="600";
                                  e.currentTarget.textContent=`✓ ${s}`;
                                }}
                                style={{padding:"4px 10px",borderRadius:20,border:`1.5px solid ${sel?sc2.color:"#e2e8f0"}`,background:sel?sc2.bg:"#f8fafc",color:sel?sc2.color:"#64748b",fontSize:11,fontWeight:sel?600:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{sel?`✓ ${s}`:s}</button>;
                            })}
                          </div>
                          {/* Custom status input */}
                          <div style={{display:"flex",gap:8}}>
                            <input id={`custom-stat-${t.id}`} style={{...inp,flex:1}} placeholder="Add custom status…"
                              onKeyDown={e=>{
                                if(e.key==="Enter"){
                                  const val=e.target.value.trim();
                                  if(!val)return;
                                  const sc2={color:"#6b7280",bg:"#f3f4f6"};
                                  const container=document.getElementById(`stat-container-${t.id}`);
                                  container.querySelectorAll("button").forEach(b=>{b.setAttribute("data-sel","0");b.style.background="#f8fafc";b.style.borderColor="#e2e8f0";b.style.color="#64748b";b.style.fontWeight="400";});
                                  const btn=document.createElement("button");
                                  btn.setAttribute("data-status",val);
                                  btn.setAttribute("data-sel","1");
                                  btn.textContent=val;
                                  btn.style.cssText=`padding:4px 10px;border-radius:20px;border:1.5px solid ${sc2.color};background:${sc2.bg};color:${sc2.color};font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;margin:0;`;
                                  btn.onclick=e2=>{container.querySelectorAll("button").forEach(b=>{b.setAttribute("data-sel","0");b.style.background="#f8fafc";b.style.borderColor="#e2e8f0";b.style.color="#64748b";b.style.fontWeight="400";});btn.setAttribute("data-sel","1");btn.style.background=sc2.bg;btn.style.borderColor=sc2.color;btn.style.color=sc2.color;btn.style.fontWeight="600";};
                                  container.appendChild(btn);
                                  e.target.value="";
                                }
                              }}/>
                            <button type="button" style={{...btnS,whiteSpace:"nowrap"}} onClick={()=>{
                              const input=document.getElementById(`custom-stat-${t.id}`);
                              const val=input.value.trim();
                              if(!val)return;
                              const sc2={color:"#6b7280",bg:"#f3f4f6"};
                              const container=document.getElementById(`stat-container-${t.id}`);
                              container.querySelectorAll("button").forEach(b=>{b.setAttribute("data-sel","0");b.style.background="#f8fafc";b.style.borderColor="#e2e8f0";b.style.color="#64748b";b.style.fontWeight="400";});
                              const btn=document.createElement("button");
                              btn.setAttribute("data-status",val);
                              btn.setAttribute("data-sel","1");
                              btn.textContent=val;
                              btn.style.cssText=`padding:4px 10px;border-radius:20px;border:1.5px solid ${sc2.color};background:${sc2.bg};color:${sc2.color};font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;margin:0;`;
                              btn.onclick=e2=>{container.querySelectorAll("button").forEach(b=>{b.setAttribute("data-sel","0");b.style.background="#f8fafc";b.style.borderColor="#e2e8f0";b.style.color="#64748b";b.style.fontWeight="400";});btn.setAttribute("data-sel","1");btn.style.background=sc2.bg;btn.style.borderColor=sc2.color;btn.style.color=sc2.color;btn.style.fontWeight="600";};
                              container.appendChild(btn);
                              input.value="";
                            }}>+ Add</button>
                          </div>
                        </div>

                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 90px 110px",gap:10,marginBottom:12}}>
                          <div><label style={lbl}>Billing</label>
                            <select style={inp} defaultValue={t.billing} id={`edit-billing-${t.id}`}>
                              <option value="monthly">Monthly</option>
                              <option value="annual">Annual</option>
                              <option value="credits">Credits / Pay-as-go</option>
                              <option value="free">Free</option>
                            </select>
                          </div>
                          <div><label style={lbl}>Ends</label>
                            <input type="date" style={inp} defaultValue={t.endDate||""} id={`edit-enddate-${t.id}`}/>
                          </div>
                          <div><label style={lbl}>Currency</label>
                            <select style={inp} defaultValue={t.currency||"PHP"} id={`edit-currency-${t.id}`}>
                              {["PHP","USD","EUR","GBP"].map(cc=><option key={cc}>{cc}</option>)}
                            </select>
                          </div>
                          <div><label style={lbl}>Amount</label>
                            <input type="number" style={inp} defaultValue={t.amount||""} id={`edit-amount-${t.id}`}/>
                          </div>
                        </div>

                        <div style={{marginBottom:16}}>
                          <label style={lbl}>Notes</label>
                          <input style={inp} defaultValue={t.notes||""} id={`edit-notes-${t.id}`}/>
                        </div>

                        <div style={{display:"flex",gap:8}}>
                          <button style={btnP} onClick={()=>{
                            // Read values directly from DOM
                            const getId = (field) => document.getElementById(`edit-${field}-${t.id}`)?.value||"";
                            const name = getId("name");
                            const url  = getId("url");
                            if(!name.trim()||!url.trim()) return;

                            // Get selected categories
                            const catBtns = document.querySelectorAll(`#cat-container-${t.id} button`);
                            const cats = Array.from(catBtns).filter(b=>b.getAttribute("data-sel")==="1").map(b=>b.getAttribute("data-cat"));

                            // Get selected status
                            const statBtn = document.querySelector(`.stat-btn-${t.id}[data-sel="1"]`);
                            const status = statBtn?.getAttribute("data-status")||t.status||"Active";

                            const updated = tools.map(x => x.id===t.id ? {
                              ...x,
                              name, url,
                              purpose: getId("purpose"),
                              categories: cats.length?cats:["Other"],
                              status,
                              billing: getId("billing"),
                              endDate: getId("enddate"),
                              currency: getId("currency"),
                              amount: getId("amount"),
                              notes: getId("notes"),
                            } : x);
                            save(updated);
                            setInlineEditId(null);
                            setEditId(null);
                          }}>Save Changes</button>
                          <button style={btnS} onClick={()=>{setInlineEditId(null);setEditId(null);}}>Cancel</button>
                        </div>
                      </div>
                    )}
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
              <div style={{borderTop:"1px solid rgba(255,255,255,0.2)",paddingTop:18,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
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

      {/* PASSWORD MODAL */}
      {showPwModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setShowPwModal(false)}>
          <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:32,maxWidth:380,width:"100%",boxShadow:"0 20px 60px rgba(15,23,42,0.2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:600,color:"#0f172a",marginBottom:4}}>🔒 Editor Access</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>
              {pwAction==="add"?"Enter password to add a new tool":pwAction==="edit"?"Enter password to edit this tool":"Enter password to delete this tool"}
            </div>
            <input
              type="password"
              autoFocus
              value={pwInput}
              onChange={e=>{setPwInput(e.target.value);setPwError(false);}}
              onKeyDown={e=>e.key==="Enter"&&submitPassword()}
              placeholder="Enter password"
              style={{width:"100%",border:`1.5px solid ${pwError?"#F4442E":"#e2e8f0"}`,borderRadius:6,padding:"11px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",background:pwError?"#fff5f2":"#f8fafc",color:"#0f172a",marginBottom:8}}
            />
            {pwError && <div style={{fontSize:12,color:"#F4442E",fontWeight:500,marginBottom:12}}>Incorrect password — try again.</div>}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
              <button onClick={()=>setShowPwModal(false)} style={{padding:"9px 18px",background:"none",border:"1.5px solid #e2e8f0",color:"#64748b",borderRadius:7,fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer"}}>Cancel</button>
              <button onClick={submitPassword} style={{padding:"9px 20px",background:"linear-gradient(135deg,#F4442E,#FFB27D)",color:"#fff",border:"none",borderRadius:7,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,cursor:"pointer"}}>Unlock</button>
            </div>
            {isAuthed && (
              <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid #e2e8f0",fontSize:12,color:"#94a3b8",textAlign:"center"}}>
                Session active — you won't be asked again until you refresh.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

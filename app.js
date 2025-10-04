/* Torn Targets UI — crisp fetch ring, hover states, rounded table */
const APP_VERSION = "2.6.1";
const STORE_KEY = "tornTargets.data.v2";
const KEY_KEY   = "tornTargets.apiKey.v1";
const ABOUT_TORN_ID = "3212954";

/* ---------- State ---------- */
const state = {
  apiKey: "",
  targets: [],
  results: {},
  settings: { concurrency: 2, throttleMs: 1500, useProxy: false, proxyUrl: "" },
  sort: { key: "id", dir: 1 },
  stop: false
};

/* ---------- Elements ---------- */
const $ = (s)=>document.querySelector(s);

const apiKeyEl=$("#apiKey"), rememberKeyEl=$("#rememberKey");
const concurrencyEl=$("#concurrency"), throttleEl=$("#throttleMs");
const useProxyEl=$("#useProxy"), proxyUrlEl=$("#proxyUrl");

const btnOpen=$("#btn-open"), btnSave=$("#btn-save");
const btnFetch=$("#btn-fetch"), btnStop=$("#btn-stop");
const btnResetCols=$("#btn-reset-cols");
const btnAbout=$("#btn-about");

const statusFilterEl=$("#statusFilter"), searchBoxEl=$("#searchBox");
const chipsWrap=$("#statusChips");

const emptyGlobal=$("#emptyGlobal"), tableWrap=$("#tableWrap"), tbody=$("#tbody"), grid=$("#grid");
const tableEmpty=$("#tableEmpty"), chkAll=$("#chk-all");

const progressWrap=$("#progressWrap"), progressBar=$("#progressBar"), progressText=$("#progressText");
const boardMeta=$("#boardMeta");

const ctaAdd=$("#cta-add"), ctaOpen=$("#cta-open");
const btnAddDialog=$("#btn-add-dialog"), btnBulk=$("#btn-bulk"), btnRemove=$("#btn-remove"), btnClear=$("#btn-clear");

const loadingOverlay=$("#loadingOverlay");

/* Modals */
const addDlgEl=$("#addDlg"); const addDlg = new bootstrap.Modal(addDlgEl);
const singleInput=$("#singleInput"), singleHint=$("#singleHint");
const bulkText=$("#bulkText"), bulkHint=$("#bulkHint"); const addConfirm=$("#addConfirm");

const bulkDlg = new bootstrap.Modal($("#bulkDlg"));

const fetchDlg   = new bootstrap.Modal($("#fetchDlg"));
const ringFg     = $("#ringFg"); const ringPct = $("#ringPct"); const ringSub = $("#ringSub");
$("#fetchCancel")?.addEventListener("click", ()=>{ state.stop=true; setStatus("Stopped by user.", false); fetchDlg.hide(); });

const aboutDlg = new bootstrap.Modal($("#aboutDlg"));
const aboutAvatar = $("#aboutAvatar"); const aboutVersion = $("#aboutVersion"); const aboutThemeLabel = $("#aboutThemeLabel"); const copyIdBtn = $("#copyIdBtn");

const keyInfoDlg = new bootstrap.Modal($("#apiKeyInfoDlg"));
const keyFocusBtn = $("#keyFocusBtn");

/* Offcanvas */
const offcanvasEl = document.getElementById("sidebarOffcanvas");

/* Status Bar */
const statusBarText = $("#statusText");
const statusBarSaved = $("#savedMeta");
const statusDot      = $("#statusDot");
function setStatus(msg, busy=false) {
  if (statusBarText) statusBarText.textContent = msg;
  if (statusDot) statusDot.style.background = busy ? "#60a5fa" : "#36d39f";
}

/* Theme */
const THEME_KEY="theme";
document.querySelectorAll(".theme-choice").forEach(btn=>{
  btn.addEventListener("click",()=>setTheme(btn.dataset.theme||"auto", true));
});
function setTheme(mode, persistChoice){
  const root = document.documentElement;
  if(mode==="auto"){
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-bs-theme", prefersDark ? "dark" : "light");
  } else {
    root.setAttribute("data-bs-theme", mode);
  }
  if(persistChoice) localStorage.setItem(THEME_KEY, mode);
}
function initTheme(){
  const mode = localStorage.getItem(THEME_KEY) || "dark";
  setTheme(mode, false);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ()=>{
    const m = localStorage.getItem("theme")||"auto";
    if(m==="auto") setTheme("auto", false);
  });
}

/* ---------- Utils ---------- */
const sleep =(ms)=>new Promise(r=>setTimeout(r,ms));
const isNumericId=(s)=>/^\d{1,12}$/.test(String(s).trim());
function extractIds(input){
  const ids=new Set(); const str=String(input??"");
  [...str.matchAll(/(?:\b|[?&])XID=(\d{1,12})\b/gi)].forEach(m=>ids.add(m[1]));
  [...str.matchAll(/\/(?:user|profiles)[^0-9]*?(\d{1,12})\b/gi)].forEach(m=>ids.add(m[1]));
  [...str.matchAll(/[\[#](\d{1,12})[\]\)]?/g)].forEach(m=>ids.add(m[1]));
  [...str.matchAll(/\b(\d{6,12})\b/g)].forEach(m=>ids.add(m[1]));
  const t=str.trim(); if(isNumericId(t)) ids.add(t);
  return [...ids];
}
function persist(){
  localStorage.setItem(STORE_KEY, JSON.stringify({
    version:APP_VERSION, targets:state.targets, results:state.results, settings:state.settings
  }));
}
function restore(){
  try{
    const raw=localStorage.getItem(STORE_KEY);
    if(raw){
      const data=JSON.parse(raw);
      if(Array.isArray(data.targets)) state.targets=data.targets;
      if(data.results && typeof data.results==="object") state.results=data.results;
      if(data.settings && typeof data.settings==="object") state.settings={...state.settings,...data.settings};
    }
    const savedKey=localStorage.getItem(KEY_KEY);
    if(savedKey){ state.apiKey=savedKey; apiKeyEl.value=savedKey; rememberKeyEl.checked=true; }
    applySettingsToUI();
    render();
  }catch(e){ console.warn("Restore failed",e); }
}
function applySettingsToUI(){
  concurrencyEl.value=String(state.settings.concurrency);
  throttleEl.value=String(state.settings.throttleMs);
  useProxyEl.checked=state.settings.useProxy;
  proxyUrlEl.value=state.settings.proxyUrl||"";
}
function saveKeyMaybe(){
  state.apiKey=apiKeyEl.value.trim();
  if(rememberKeyEl.checked && state.apiKey) localStorage.setItem(KEY_KEY,state.apiKey);
  else localStorage.removeItem(KEY_KEY);
}

/* When saving from the mobile offcanvas, read from the clone and mirror back */
function readFromOffcanvasIfPresent(){
  const oc = document.getElementById("sidebarOffcanvas");
  if(!oc) return;
  const cloneApi = oc.querySelector('[data-bind="apiKey"]');
  const cloneRemember = oc.querySelector('[data-bind="rememberKey"]');
  if(cloneApi){
    apiKeyEl.value = cloneApi.value;
  }
  if(cloneRemember){
    rememberKeyEl.checked = cloneRemember.checked;
  }
}

/* ---------- Layout calc (table-only scroll) ---------- */
function setHeights(){
  const topbar = document.getElementById("appTopbar");
  const h = topbar ? topbar.offsetHeight : 56;
  document.documentElement.style.setProperty("--topbar-h", `${h}px`);
}
window.addEventListener("resize", setHeights);
window.addEventListener("orientationchange", setHeights);

/* ---------- Rendering ---------- */
function ensureVisibleState(){
  const hasRows=state.targets.length>0;
  emptyGlobal.classList.toggle("d-none", hasRows);
  tableWrap.classList.toggle("d-none", !hasRows);
  const metaText = hasRows
    ? `${state.targets.length} target${state.targets.length!==1?'s':''} • last saved ${new Date().toLocaleTimeString()}`
    : `No data yet`;
  boardMeta.textContent = metaText;
  if (statusBarSaved) statusBarSaved.textContent = metaText;
}
function statusDisplay(s){
  const str=(s?.state||"").toLowerCase();
  if(str.includes("hospital")) return {label:"Hospital", badge:"border-danger-subtle bg-danger-subtle text-danger-emphasis"};
  if(str.includes("jail"))     return {label:"Jail", badge:"border-warning-subtle bg-warning-subtle text-warning-emphasis"};
  if(str.includes("abroad")||str.includes("travel")) return {label:"Abroad", badge:"border-info-subtle bg-info-subtle text-info-emphasis"};
  if(str.includes("okay"))     return {label:"Okay", badge:"border-success-subtle bg-success-subtle text-success-emphasis"};
  if(str)                      return {label:s.state, badge:"border-secondary-subtle bg-secondary-subtle text-body"};
  return {label:"Offline", badge:"border-secondary-subtle bg-secondary-subtle text-body"};
}
function formatLast(last){
  if(!last) return "";
  if(last.relative) return last.relative;
  if(last.status) return last.status;
  if(last.timestamp) try{ return new Date(last.timestamp*1000).toLocaleString(); }catch{}
  return "";
}
function rowData(id){
  const r=state.results[id]||{};
  return { id, name:r.name||"", level:r.level??"", st:statusDisplay(r.status||{}), last:formatLast(r.last_action) };
}
function render(){
  ensureVisibleState();
  const filter=statusFilterEl.value;
  const term=(searchBoxEl.value||"").trim().toLowerCase();

  grid.querySelectorAll("th.sortable").forEach(th=>{
    th.classList.remove("sort-asc","sort-desc");
    if(th.dataset.sort===state.sort.key){
      th.classList.add(state.sort.dir>0?"sort-asc":"sort-desc");
    }
  });

  const frag=document.createDocumentFragment(); let visible=0;
  for(const id of sortedTargets()){
    const {name,level,st,last}=rowData(id);
    if(filter!=="all" && st.label.toLowerCase()!==filter.toLowerCase()) continue;
    if(term){
      const hay=(id+" "+(name||"")).toLowerCase();
      if(!hay.includes(term)) continue;
    }
    const tr=document.createElement("tr");
    tr.dataset.id=id;
    tr.innerHTML=`
      <td><input type="checkbox" class="rowchk" /></td>
      <td class="font-monospace">${id}</td>
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(level)}</td>
      <td><span class="badge rounded-pill ${st.badge} border">${escapeHtml(st.label)}</span></td>
      <td>${escapeHtml(last)}</td>
    `;
    frag.appendChild(tr); visible++;
  }
  tbody.innerHTML=""; tbody.appendChild(frag);
  tableEmpty.classList.toggle("d-none", !(state.targets.length>0 && visible===0));
  updateChipCounts(); persist();
}
function sortedTargets(){
  const arr=[...state.targets];
  const {key,dir}=state.sort;
  return arr.sort((a,b)=>{
    const ra=rowData(a), rb=rowData(b);
    const va= key==="status"?ra.st.label:ra[key];
    const vb= key==="status"?rb.st.label:rb[key];
    return String(va).localeCompare(String(vb), undefined, {numeric:true,sensitivity:"base"}) * dir;
  });
}
function updateChipCounts(){
  const c={all:state.targets.length, ok:0,hosp:0,jail:0,travel:0,off:0};
  for(const id of state.targets){
    const cls=rowData(id).st.label.toLowerCase();
    if(cls.includes("okay")) c.ok++; else if(cls.includes("hospital")) c.hosp++;
    else if(cls.includes("jail")) c.jail++; else if(cls.includes("abroad")) c.travel++; else c.off++;
  }
  $("#c-all").textContent=c.all; $("#c-ok").textContent=c.ok; $("#c-hosp").textContent=c.hosp;
  $("#c-jail").textContent=c.jail; $("#c-travel").textContent=c.travel; $("#c-off").textContent=c.off;
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

/* Sorting */
grid.querySelectorAll("th.sortable").forEach(th=>{
  th.addEventListener("click",()=>{
    const key=th.dataset.sort;
    state.sort = (state.sort.key===key) ? {key, dir:state.sort.dir*-1} : {key, dir:1};
    render();
  });
});

/* Selection + row click */
chkAll?.addEventListener("change",()=>{
  tbody.querySelectorAll(".rowchk").forEach(cb=>cb.checked=chkAll.checked);
});
tbody.addEventListener("change",(e)=>{
  if(!(e.target instanceof HTMLInputElement)) return;
  if(e.target.classList.contains("rowchk")){
    const boxes=[...tbody.querySelectorAll(".rowchk")];
    chkAll.checked = boxes.length>0 && boxes.every(b=>b.checked);
  }
});
tbody.addEventListener("click",(e)=>{
  if(e.target.closest("input,button,a,label")) return;
  const tr=e.target.closest("tr"); if(!tr) return;
  const id=tr.dataset.id; if(!id) return;
  window.open(`https://www.torn.com/profiles.php?XID=${encodeURIComponent(id)}`,"_blank","noopener");
});

/* Filters */
statusFilterEl.addEventListener("change",()=>{
  chipsWrap.querySelectorAll(".chip").forEach(c=>c.classList.toggle("active", c.dataset.val===statusFilterEl.value || (statusFilterEl.value==="all" && c.dataset.val==="all")));
  render();
});
chipsWrap.addEventListener("click",(e)=>{
  const btn=e.target.closest(".chip"); if(!btn) return;
  chipsWrap.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
  btn.classList.add("active");
  statusFilterEl.value=btn.dataset.val || "all";
  render();
});
searchBoxEl.addEventListener("input",()=>render());

/* --- Sidebar actions for desktop + mobile clone (event delegation) --- */
document.addEventListener("click",(e)=>{
  const act = e.target.closest("[data-action]")?.dataset.action;
  if(!act) return;

  if(act==="save-api"){
    e.preventDefault();
    saveApiAndCloseSidebar();
  }else if(act==="open-add"){
    e.preventDefault();
    openAddDialog("single", true);
  }else if(act==="open-bulk"){
    e.preventDefault();
    openAddDialog("bulk", true);
  }
});

/* Keep direct hooks for desktop IDs */
btnAddDialog?.addEventListener("click",()=>openAddDialog("single", true));
btnBulk?.addEventListener("click",()=>openAddDialog("bulk", true));

ctaAdd.addEventListener("click",()=>openAddDialog("single", false));

function closeOffcanvasIfOpen(){
  if(!offcanvasEl) return;
  const inst = bootstrap.Offcanvas.getInstance(offcanvasEl) || bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
  if(offcanvasEl.classList.contains("show")) inst.hide();
}
function openAddDialog(tab="single", fromSidebar=false){
  if(fromSidebar) closeOffcanvasIfOpen();
  if(addDlgEl.classList.contains("show")) return;

  new bootstrap.Tab(document.querySelector(`[data-bs-target="#${tab==="single"?"singleTab":"bulkTab"}"]`)).show();
  singleInput.value=""; singleHint.textContent="Waiting for input…";
  bulkText.value=""; bulkHint.textContent="0 valid IDs detected.";
  addDlg.show();
}

singleInput.addEventListener("input",()=>{
  const ids=extractIds(singleInput.value);
  singleHint.textContent = ids.length ? `Resolved → ${ids.join(", ")}` : `No valid ID found yet. Paste an ID or Torn profile URL.`;
});
bulkText.addEventListener("input",()=>{
  const ids=extractIds(bulkText.value);
  bulkHint.textContent = `${ids.length} valid ID${ids.length!==1?'s':''} detected.`;
});
addConfirm.addEventListener("click",async ()=>{
  const activeTab=document.querySelector("#addTabs .nav-link.active")?.getAttribute("data-bs-target")||"#singleTab";
  const source = activeTab==="#singleTab" ? singleInput.value : bulkText.value;
  let ids = extractIds(source);
  if(activeTab==="#singleTab" && !ids.length && state.apiKey && source.trim()){
    addConfirm.disabled=true; addConfirm.textContent="Resolving…";
    const id = await resolveNameToId(source.trim()).catch(()=>null);
    addConfirm.disabled=false; addConfirm.textContent="Add";
    if(id) ids=[id];
  }
  if(!ids.length){ singleHint.textContent="No valid IDs found. Try a different input."; return; }
  let added=0; for(const id of ids){ if(!state.targets.includes(id)){ state.targets.push(id); added++; } }
  sortTargets(); render(); addDlg.hide();
  setStatus("Targets updated.", false);

  if(!state.apiKey){ showApiKeyInfo(); } else { startFetchAll(); }
});

/* Bulk (legacy textarea) */
const bulkTextLegacy=$("#bulkTextLegacy");
const bulkConfirmLegacy=$("#bulkConfirmLegacy");
bulkConfirmLegacy?.addEventListener("click",()=>{
  const ids=extractIds(bulkTextLegacy.value);
  let added=0; for(const id of ids){ if(!state.targets.includes(id)){ state.targets.push(id); added++; } }
  bulkTextLegacy.value=""; new bootstrap.Modal($("#bulkDlg")).hide?.();
  if(!added) alert("No new IDs found.");
  sortTargets(); render();
  setStatus("Targets updated.", false);
  if(!state.apiKey) showApiKeyInfo();
});

/* Remove / Clear */
btnRemove?.addEventListener("click",()=>{
  const selected=[...tbody.querySelectorAll("tr")].filter(tr=>tr.querySelector(".rowchk")?.checked).map(tr=>tr.dataset.id);
  if(!selected.length) return alert("Select rows to remove.");
  state.targets=state.targets.filter(id=>!selected.includes(id));
  for(const id of selected) delete state.results[id];
  render();
  setStatus("Removed selected targets.", false);
});
btnClear?.addEventListener("click",()=>{ if(confirm("Clear all targets?")){ state.targets=[]; state.results={}; render(); setStatus("Cleared target list.", false);} });

/* Open/Save file */
btnOpen.addEventListener("click",()=>$("#file").click());
ctaOpen.addEventListener("click",()=>$("#file").click());
$("#file").addEventListener("change",async(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  try{ importFromJSON(await f.text()); setStatus("List loaded from file.", false); }catch{ alert("Could not read file."); }
  finally{ e.target.value=""; }
});
btnSave.addEventListener("click",()=>{
  const payload={app:"Torn Targets",version:APP_VERSION,exportedAt:new Date().toISOString(),targets:state.targets};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=`torn-targets-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  setStatus("Exported list as JSON.", false);
});
function importFromJSON(text){
  try{
    const j=JSON.parse(text);
    let ids=[];
    if(Array.isArray(j)) ids=j;
    else if(Array.isArray(j.targets)) ids=j.targets;
    else if(Array.isArray(j.list)) ids=j.list;
    else throw new Error("Invalid JSON");
    const clean=[...new Set(ids.map(x=>String(x).trim()).filter(isNumericId))];
    state.targets=clean; state.results={}; sortTargets(); render();
  }catch(e){ console.error(e); alert("Invalid targets JSON."); }
}

/* Fetching */
btnFetch.addEventListener("click",()=>{
  // If the user typed the key in the offcanvas, mirror it first.
  readFromOffcanvasIfPresent();
  if(!apiKeyPresent()) { showApiKeyInfo(); return; }
  startFetchAll();
});
btnStop.addEventListener("click",()=>{ state.stop=true; setStatus("Stopped by user.", false); fetchDlg.hide(); });
btnResetCols.addEventListener("click",()=>{ /* future column prefs */ });

function apiKeyPresent(){
  saveKeyMaybe();
  return !!state.apiKey;
}

async function startFetchAll(){
  saveKeyMaybe();
  if(!state.apiKey) return;
  if(!state.targets.length) return alert("No targets to fetch.");

  state.stop=false;
  showLoading(true);
  setProgress(0);

  const q=[...state.targets]; let done=0;
  const total=q.length;

  const worker=async()=>{
    while(!state.stop && q.length){
      const id=q.shift();
      await fetchOne(id);
      done++; setProgress(done/total*100, done, total);
      await sleep(state.settings.throttleMs);
    }
  };
  const n=Math.max(1, Math.min(4, parseInt(concurrencyEl.value,10)||2));
  await Promise.all([...Array(n)].map(()=>worker()));

  showLoading(false);
  render();
  setStatus("Fetch complete.", false);
}
function showLoading(flag){
  progressWrap.classList.toggle("d-none", !flag);
  btnFetch.disabled=flag; btnStop.disabled=!flag;

  if(flag){
    updateRing(0);
    ringPct.textContent="0%";
    ringSub.textContent="Fetching…";
    fetchDlg.show();
  }else{
    fetchDlg.hide();
  }
  loadingOverlay.classList.add("d-none");
}
function setProgress(pct, done=0, total=0){
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  progressBar.style.width=`${p}%`;
  progressText.textContent=`${p}%`;
  updateRing(p);
  ringPct.textContent = `${p}%`;
  if(total){ ringSub.textContent = `${done} / ${total}`; }
}
function updateRing(p){
  if(!ringFg) return;
  const off = 100 - p;
  ringFg.style.strokeDashoffset = String(off);
}

async function fetchOne(id){
  const url=`https://api.torn.com/user/${encodeURIComponent(id)}?selections=basic,profile&key=${encodeURIComponent(state.apiKey)}`;
  const finalUrl = state.settings.useProxy && state.settings.proxyUrl
    ? state.settings.proxyUrl.replace(/\/+$/,"") + "/" + url
    : url;
  try{
    const res=await fetch(finalUrl,{cache:"no-store"});
    if(res.status===429){ await sleep(3000); return await fetchOne(id); }
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    if(data?.error){
      state.results[id]={ name:"", level:"", status:{state:`Error ${data.error.error}`}, last_action:{} };
    }else{
      state.results[id]={ name:data.name, level:data.level, status:data.status, last_action:data.last_action };
    }
    renderRow(id);
  }catch(e){
    console.error("Fetch failed",id,e);
    state.results[id]={ name:"", level:"", status:{state:"Offline"}, last_action:{} };
    renderRow(id);
  }
}
function renderRow(id){
  const tr=tbody.querySelector(`tr[data-id="${CSS.escape(id)}"]`); if(!tr) return;
  const r=rowData(id); const tds=tr.children;
  tds[2].innerHTML=escapeHtml(r.name);
  tds[3].innerHTML=escapeHtml(r.level);
  tds[4].innerHTML=`<span class="badge rounded-pill ${r.st.badge} border">${escapeHtml(r.st.label)}</span>`;
  tds[5].innerHTML=escapeHtml(r.last);
  updateChipCounts(); persist();
}
function sortTargets(){ state.targets = sortedTargets(); }

/* Username → ID */
async function resolveNameToId(name){
  const url = `https://api.torn.com/torn/?selections=search&key=${encodeURIComponent(state.apiKey)}&search=${encodeURIComponent(name)}`;
  const finalUrl = state.settings.useProxy && state.settings.proxyUrl
    ? state.settings.proxyUrl.replace(/\/+$/,"") + "/" + url
    : url;
  try{
    const res=await fetch(finalUrl,{cache:"no-store"});
    if(!res.ok) return null;
    const data=await res.json();
    const players = (data?.players ?? []);
    const match = players.find(p => (p.name||"").toLowerCase()===name.toLowerCase()) ?? players[0];
    return match?.player_id ? String(match.player_id) : null;
  }catch{ return null; }
}

/* Settings */
concurrencyEl.addEventListener("change",()=>{
  const v=parseInt(concurrencyEl.value,10);
  state.settings.concurrency=Math.max(1,Math.min(4,isFinite(v)?v:2)); persist();
});
throttleEl.addEventListener("change",()=>{
  const v=parseInt(throttleEl.value,10);
  state.settings.throttleMs=Math.max(300,isFinite(v)?v:1500); persist();
});
useProxyEl.addEventListener("change",()=>{ state.settings.useProxy=useProxyEl.checked; persist(); });
proxyUrlEl.addEventListener("change",()=>{ state.settings.proxyUrl=proxyUrlEl.value.trim(); persist(); });
apiKeyEl.addEventListener("change",saveKeyMaybe);
rememberKeyEl.addEventListener("change",saveKeyMaybe);

/* Offcanvas clone (mobile) */
offcanvasEl?.addEventListener("show.bs.offcanvas", ()=>{
  const src = document.getElementById("sidebar");
  const dest = document.getElementById("sidebarClone");
  if(!src || !dest) return;
  dest.innerHTML = "";
  const frag = document.createDocumentFragment();
  src.querySelectorAll(".card.glass").forEach(card=>{
    const clone = card.cloneNode(true);
    // remove only IDs; keep data-bind so we can mirror values
    clone.querySelectorAll("[id]").forEach(n=>n.removeAttribute("id"));
    frag.appendChild(clone);
  });
  dest.appendChild(frag);

  // Prefill the cloned inputs with the real values
  const cloneApi = dest.querySelector('[data-bind="apiKey"]');
  const cloneRemember = dest.querySelector('[data-bind="rememberKey"]');
  if(cloneApi) cloneApi.value = apiKeyEl.value;
  if(cloneRemember) cloneRemember.checked = rememberKeyEl.checked;

  // Live sync from the clone back to real fields so actions work even without pressing Save
  dest.addEventListener("input",(ev)=>{
    if(ev.target.matches('[data-bind="apiKey"]')) apiKeyEl.value = ev.target.value;
  });
  dest.addEventListener("change",(ev)=>{
    if(ev.target.matches('[data-bind="rememberKey"]')) rememberKeyEl.checked = ev.target.checked;
  }, { once:false });
});

/* About modal */
btnAbout?.addEventListener("click", async ()=>{
  aboutVersion.textContent = APP_VERSION;
  aboutThemeLabel.textContent = `Theme: ${localStorage.getItem("theme") || "dark"}`;
  await ensureAboutAvatar();
  aboutDlg.show();
});
copyIdBtn?.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(ABOUT_TORN_ID);
    copyIdBtn.innerHTML = '<i class="bi bi-clipboard-check me-1"></i> Copied!';
    setTimeout(()=>copyIdBtn.innerHTML='<i class="bi bi-clipboard me-1"></i> Copy profile ID',1200);
  }catch{}
});
async function ensureAboutAvatar(){
  if(!aboutAvatar || aboutAvatar.dataset.loaded === "1") return;
  let url = "";
  const key = state.apiKey || localStorage.getItem(KEY_KEY) || "";
  if(key){
    try{
      const res = await fetch(`https://api.torn.com/user/${ABOUT_TORN_ID}?selections=profile&key=${encodeURIComponent(key)}`,{cache:"no-store"});
      if(res.ok){
        const data=await res.json();
        if(data?.profile_image) url = data.profile_image;
      }
    }catch{}
  }
  if(!url) url = `https://www.torn.com/signature.php?user=${ABOUT_TORN_ID}`;
  aboutAvatar.src = url;
  aboutAvatar.dataset.loaded = "1";
}

/* API key helpers */
function showApiKeyInfo(){ keyInfoDlg.show(); }
keyFocusBtn?.addEventListener("click", ()=>{
  keyInfoDlg.hide();
  // Open the offcanvas on small screens for convenience
  if(window.innerWidth < 992){
    const inst = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
    inst.show();
  }
  setTimeout(()=>{
    document.querySelector('[data-bind="apiKey"]')?.focus();
  }, 300);
});
function saveApiAndCloseSidebar(){
  // If the user typed inside the offcanvas, mirror first
  readFromOffcanvasIfPresent();
  saveKeyMaybe();
  setStatus(state.apiKey ? "API key saved." : "API key cleared.", false);
  closeOffcanvasIfOpen();
}

/* Init */
initTheme();
setHeights();
restore();

/* Torn Targets UI — table + mobile cards + brilliant fetch dialog + mobile actions */
const APP_VERSION = "2.5.0";
const STORE_KEY = "tornTargets.data.v2";
const KEY_KEY   = "tornTargets.apiKey.v1";
const ABOUT_TORN_ID = "3212954";
const AVATAR_FALLBACK = "assets/profile.png";

/* ---------- State ---------- */
const state = {
  apiKey: "",
  targets: [],
  results: {}, // {id:{name, level, status, last_action, avatar}}
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

const tableWrap=$("#tableWrap"), tbody=$("#tbody"), grid=$("#grid");
const tableEmpty=$("#tableEmpty"), chkAll=$("#chk-all");

const progressWrap=$("#progressWrap"), progressBar=$("#progressBar"), progressText=$("#progressText");
const boardMeta=$("#boardMeta");

const ctaAdd=$("#cta-add"), ctaOpen=$("#cta-open");
const btnAddDialog=$("#btn-add-dialog"), btnBulk=$("#btn-bulk"), btnRemove=$("#btn-remove"), btnClear=$("#btn-clear");

const loadingOverlay=$("#loadingOverlay");

/* Add Target modal */
const addDlgEl=$("#addDlg"); const addDlg = new bootstrap.Modal(addDlgEl);
const singleInput=$("#singleInput"), singleHint=$("#singleHint");
const bulkText=$("#bulkText"), bulkHint=$("#bulkHint");
const addConfirm=$("#addConfirm");

/* Legacy bulk modal */
const bulkDlg = new bootstrap.Modal($("#bulkDlg"));
const bulkTextLegacy=$("#bulkTextLegacy");
const bulkConfirmLegacy=$("#bulkConfirmLegacy");

/* API info modal */
const apiKeyInfoDlg = new bootstrap.Modal($("#apiKeyInfoDlg"));
$("#keyFocusBtn")?.addEventListener("click", ()=>{
  apiKeyInfoDlg.hide();
  // focus the API key field (desktop or offcanvas clone)
  const off = document.querySelector('#sidebarOffcanvas [data-bind="apiKey"]');
  const el = apiKeyEl || off;
  el?.focus();
});

/* Sort bar (mobile) */
function ensureSortBar(){
  if(document.getElementById("sortBar")) return;
  const scroller = document.querySelector(".board-col");
  if(!scroller) return;
  const bar = document.createElement("div");
  bar.id = "sortBar";
  bar.innerHTML = `
    <div class="sortbar d-lg-none">
      <div class="label"><i class="bi bi-arrow-down-up me-1"></i>
        <span id="sortBarLabel">Sort: Id ↑</span>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-ghost btn-sm" data-action="toggle-sort-dir" aria-label="Toggle direction">
          <i class="bi bi-sort-down"></i>
        </button>
        <div class="dropdown">
          <button class="btn btn-ghost btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="bi bi-sliders me-1"></i> Choose
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><button class="dropdown-item" data-action="sort-key" data-key="id">Id</button></li>
            <li><button class="dropdown-item" data-action="sort-key" data-key="name">Name</button></li>
            <li><button class="dropdown-item" data-action="sort-key" data-key="level">Level</button></li>
            <li><button class="dropdown-item" data-action="sort-key" data-key="status">Status</button></li>
            <li><button class="dropdown-item" data-action="sort-key" data-key="last">Last action</button></li>
          </ul>
        </div>
      </div>
    </div>`;
  const anchor = document.getElementById("gridScroll");
  scroller.insertBefore(bar, anchor);
  updateSortBar();
}
function updateSortBar(){
  const map = {id:"Id", name:"Name", level:"Level", status:"Status", last:"Last action"};
  const dir = state.sort.dir>0 ? "↑" : "↓";
  const label = $("#sortBarLabel");
  if (label) label.replaceChildren(document.createTextNode(`Sort: ${map[state.sort.key]} ${dir}`));
}

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
    const m = localStorage.getItem(THEME_KEY)||"auto";
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
    if(savedKey){ state.apiKey=savedKey; if(apiKeyEl) apiKeyEl.value=savedKey; if(rememberKeyEl) rememberKeyEl.checked=true; }
    applySettingsToUI();
    render();
  }catch(e){ console.warn("Restore failed",e); }
}
function applySettingsToUI(){
  if(concurrencyEl) concurrencyEl.value=String(state.settings.concurrency);
  if(throttleEl)    throttleEl.value=String(state.settings.throttleMs);
  if(useProxyEl)    useProxyEl.checked=state.settings.useProxy;
  if(proxyUrlEl)    proxyUrlEl.value=state.settings.proxyUrl||"";
}
function saveKeyMaybe(){
  // pull value from desktop field if present, else from offcanvas clone
  let key = apiKeyEl?.value?.trim();
  if(!key){
    const off = document.querySelector('#sidebarOffcanvas [data-bind="apiKey"]');
    key = off?.value?.trim() || "";
  }
  const remember = rememberKeyEl?.checked ?? document.querySelector('#sidebarOffcanvas [data-bind="rememberKey"]')?.checked ?? false;

  state.apiKey = key;
  if(remember && key) localStorage.setItem(KEY_KEY,key);
  else localStorage.removeItem(KEY_KEY);
}
function saveApiAndCloseSidebar(){
  saveKeyMaybe();
  closeOffcanvasIfOpen();
  setStatus(state.apiKey ? "API key saved." : "API key cleared.", false);
}

/* Helpers for offcanvas */
function closeOffcanvasIfOpen(){
  const ocEl = document.getElementById("sidebarOffcanvas");
  if(!ocEl) return;
  const inst = bootstrap.Offcanvas.getInstance(ocEl);
  if(inst) inst.hide();
}
function readFromOffcanvasIfPresent(){
  // copy values from offcanvas into state/UI before actions
  const offApi = document.querySelector('#sidebarOffcanvas [data-bind="apiKey"]');
  const offRmb = document.querySelector('#sidebarOffcanvas [data-bind="rememberKey"]');
  if(offApi){
    if(apiKeyEl) apiKeyEl.value = offApi.value;
  }
  if(offRmb){
    if(rememberKeyEl) rememberKeyEl.checked = offRmb.checked;
  }
  saveKeyMaybe();
}
function apiKeyPresent(){ return !!(state.apiKey && state.apiKey.trim()); }
function showApiKeyInfo(){ apiKeyInfoDlg.show(); }

/* ---------- Layout calc ---------- */
function setHeights(){
  const topbar = document.getElementById("appTopbar");
  const h = topbar ? topbar.offsetHeight : 56;
  document.documentElement.style.setProperty("--topbar-h", `${h}px`);
}
window.addEventListener("resize", setHeights);
window.addEventListener("orientationchange", setHeights);

/* ---------- Rendering ---------- */
function statusDisplay(s){
  const str=(s?.state||"").toLowerCase();
  if(str.includes("hospital")) return {label:"Hospital", badge:"border-danger-subtle bg-danger-subtle text-danger-emphasis"};
  if(str.includes("jail"))     return {label:"Jail", badge:"border-warning-subtle bg-warning-subtle text-warning-emphasis"};
  if(str.includes("abroad")||str.includes("travel")) return {label:"Abroad", badge:"border-info-subtle bg-info-subtle text-info-emphasis"};
  if(str.includes("okay"))     return {label:"Okay", badge:"border-success-subtle bg-success-subtle text-success-emphasis"};
  if(str)                      return {label:s.state, badge:"border-secondary-subtle bg-secondary-subtle text-body"};
  return {label:"Offline", badge:"border-secondary-subtle bg-body text-body"};
}
function formatLast(last){
  if(!last) return "";
  if(last.relative) return last.relative;
  if(last.status) return last.status;
  if(last.timestamp) try{ return `${Math.max(0, Math.floor((Date.now()/1000 - last.timestamp)/86400))} days ago`; }catch{}
  return "";
}
function rowData(id){
  const r=state.results[id]||{};
  return { id, name:r.name||"", level:r.level??"", st:statusDisplay(r.status||{}), last:formatLast(r.last_action), avatar:r.avatar||AVATAR_FALLBACK };
}
function ensureVisibleState(){
  const emptyGlobal=$("#emptyGlobal");
  const hasRows=state.targets.length>0;
  emptyGlobal.classList.toggle("d-none", hasRows);
  tableWrap.classList.toggle("d-none", !hasRows);
  const metaText = hasRows
    ? `${state.targets.length} target${state.targets.length!==1?'s':''} • last saved ${new Date().toLocaleTimeString()}`
    : `No data yet`;
  boardMeta.textContent = metaText;
  if (statusBarSaved) statusBarSaved.textContent = metaText;
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
function render(){
  ensureVisibleState();
  updateChipCounts();
  updateSortBar();

  grid.querySelectorAll("th.sortable").forEach(th=>{
    th.classList.remove("sort-asc","sort-desc");
    if(th.dataset.sort===state.sort.key){
      th.classList.add(state.sort.dir>0?"sort-asc":"sort-desc");
    }
  });

  const filter=statusFilterEl.value;
  const term=(searchBoxEl.value||"").trim().toLowerCase();

  const frag=document.createDocumentFragment(); let visible=0;
  for(const id of sortedTargets()){
    const {name,level,st,last,avatar}=rowData(id);
    if(filter!=="all" && st.label.toLowerCase()!==filter.toLowerCase()) continue;
    if(term){
      const hay=(id+" "+(name||"")).toLowerCase();
      if(!hay.includes(term)) continue;
    }
    const tr=document.createElement("tr");
    tr.dataset.id=id;
    tr.innerHTML=`
      <td><input type="checkbox" class="rowchk" /></td>
      <td class="cell-id font-monospace">#${escapeHtml(id)}</td>
      <td class="cell-name">
        <span class="name-wrap">
          <img class="avatar" src="${escapeAttr(avatar)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${AVATAR_FALLBACK}';">
          <span class="name-text">${escapeHtml(name||"")}</span>
        </span>
      </td>
      <td class="cell-level">${level!==""?`Lv ${escapeHtml(level)}`:""}</td>
      <td class="cell-status"><span class="badge rounded-pill ${st.badge} border">${escapeHtml(st.label)}</span></td>
      <td class="cell-last"><i class="bi bi-clock-history"></i><span>${escapeHtml(last)}</span></td>
    `;
    frag.appendChild(tr); visible++;
  }
  tbody.innerHTML=""; tbody.appendChild(frag);
  tableEmpty.classList.toggle("d-none", !(state.targets.length>0 && visible===0));
  persist();
}

/* chip counts for sidebar filter */
function updateChipCounts(){
  const c = { all: state.targets.length, ok: 0, hosp: 0, jail: 0, travel: 0, off: 0 };

  for (const id of state.targets){
    const cls = rowData(id).st.label.toLowerCase();
    if (cls.includes("okay")) c.ok++;
    else if (cls.includes("hospital")) c.hosp++;
    else if (cls.includes("jail")) c.jail++;
    else if (cls.includes("abroad")) c.travel++;
    else c.off++;
  }

  const allEl  = $("#c-all");    if (allEl)  allEl.textContent  = c.all;
  const okEl   = $("#c-ok");     if (okEl)   okEl.textContent   = c.ok;
  const hospEl = $("#c-hosp");   if (hospEl) hospEl.textContent = c.hosp;   // ← fixed
  const jailEl = $("#c-jail");   if (jailEl) jailEl.textContent = c.jail;
  const travEl = $("#c-travel"); if (travEl) travEl.textContent = c.travel;
  const offEl  = $("#c-off");    if (offEl)  offEl.textContent  = c.off;
}


function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function escapeAttr(s){return String(s??"").replace(/"/g,"&quot;")}

/* Sorting */
grid.querySelectorAll("th.sortable").forEach(th=>{
  th.addEventListener("click",()=>{
    const key=th.dataset.sort;
    state.sort = (state.sort.key===key) ? {key, dir:state.sort.dir*-1} : {key, dir:1};
    render(); updateSortBar();
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

/* Add / Remove / Clear */
btnAddDialog?.addEventListener("click",()=>openAddDialog("single", true));
ctaAdd?.addEventListener("click",()=>openAddDialog("single", false));
function openAddDialog(tab="single", fromSidebar=false){
  if(fromSidebar) closeOffcanvasIfOpen();
  new bootstrap.Tab(document.querySelector(`[data-bs-target="#${tab==="single"?"singleTab":"bulkTab"}"]`)).show();
  singleInput.value=""; singleHint.textContent="Waiting for input…";
  bulkText.value=""; bulkHint.textContent="0 valid IDs detected.";
  addDlg.show();
}
singleInput?.addEventListener("input",()=>{
  const ids=extractIds(singleInput.value);
  singleHint.textContent = ids.length ? `Resolved → ${ids.join(", ")}` : `No valid ID found yet. Paste an ID or Torn profile URL.`;
});
bulkText?.addEventListener("input",()=>{
  const ids=extractIds(bulkText.value);
  bulkHint.textContent = `${ids.length} valid ID${ids.length!==1?'s':''} detected.`;
});
addConfirm?.addEventListener("click",async ()=>{
  const activeTab=document.querySelector("#addTabs .nav-link.active")?.getAttribute("data-bs-target")||"#singleTab";
  const source = activeTab==="#singleTab" ? singleInput.value : bulkText.value;
  let ids = extractIds(source);

  // If single tab and no numeric id was found, and there is no API key,
  // we can't resolve a username → id; show info modal.
  if(activeTab==="#singleTab" && !ids.length){
    saveKeyMaybe();
    if(!apiKeyPresent()){
      apiKeyInfoDlg.show();
      return;
    }
    // try resolve via search
    addConfirm.disabled=true; addConfirm.textContent="Resolving…";
    const id = await resolveNameToId(source.trim()).catch(()=>null);
    addConfirm.disabled=false; addConfirm.textContent="Add";
    if(id) ids=[id];
  }
  if(!ids.length){ singleHint.textContent="No valid IDs found. Try a different input."; return; }

  let added=0; for(const id of ids){ if(!state.targets.includes(id)){ state.targets.push(id); added++; } }
  sortTargets(); render(); addDlg.hide();
  if(added>0 && state.apiKey) startFetchAll();
  setStatus("Targets updated.", false);
});
btnBulk?.addEventListener("click",()=>openAddDialog("bulk", true));
bulkConfirmLegacy?.addEventListener("click",()=>{
  const ids=extractIds(bulkTextLegacy.value);
  let added=0; for(const id of ids){ if(!state.targets.includes(id)){ state.targets.push(id); added++; } }
  bulkTextLegacy.value=""; bulkDlg.hide();
  if(!added) alert("No new IDs found.");
  sortTargets(); render();
  setStatus("Targets updated.", false);
});
btnRemove?.addEventListener("click",()=>{
  const selected=[...tbody.querySelectorAll("tr")].filter(tr=>tr.querySelector(".rowchk")?.checked).map(tr=>tr.dataset.id);
  if(!selected.length) return alert("Select rows to remove.");
  state.targets=state.targets.filter(id=>!selected.includes(id));
  for(const id of selected) delete state.results[id];
  render();
  setStatus("Removed selected targets.", false);
});
btnClear?.addEventListener("click",()=>{ if(confirm("Clear all targets?")){ state.targets=[]; state.results={}; render(); setStatus("Cleared target list.", false);} });

/* Open/Save */
btnOpen?.addEventListener("click",()=>$("#file").click());
ctaOpen?.addEventListener("click",()=>$("#file").click());
$("#file")?.addEventListener("change",async(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  try{ importFromJSON(await f.text()); setStatus("List loaded from file.", false); }catch{ alert("Could not read file."); }
  finally{ e.target.value=""; }
});
btnSave?.addEventListener("click",()=>{
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

/* ================== FETCH DIALOG (brilliant, smoothed) ================== */
const fetchDlgEl = $("#fetchDlg");
const fetchDlg   = new bootstrap.Modal(fetchDlgEl);
const ringFg     = $("#ringFg");
const ringPct    = $("#ringPct");
const ringSub    = $("#ringSub");
const ringIcon   = $("#ringIcon");
const statDone   = $("#statDone");
const statTotal  = $("#statTotal");
const statRate   = $("#statRate");
const statElapsed= $("#statElapsed");
const statEta    = $("#statEta");

// Smoothing + windowed rate controller
const stats = {
  windowSec: 12,        // rolling window size for rate (seconds)
  alphaRate: 0.25,      // EMA smoothing for rate
  alphaEta:  0.22,      // EMA smoothing for ETA
  startMs: 0,
  lastDone: 0,
  times: [],            // completion timestamps (seconds)
  rateEma: null,
  etaEma: null
};

let fetchStartMs = 0;

$("#fetchCancel")?.addEventListener("click", ()=>{
  // graceful stopping
  state.stop = true;
  setStatus("Stopping…", false);
  setFetchState("stopped");
  if (ringSub) ringSub.textContent = "Stopping…";
});
btnStop ?.addEventListener("click",()=>{ 
  state.stop=true; 
  setStatus("Stopping…", false); 
  setFetchState("stopped"); 
  if (ringSub) ringSub.textContent="Stopping…"; 
});

/* Show/hide loading */
function showLoading(flag){
  progressWrap.classList.toggle("d-none", !flag);
  if (btnFetch) btnFetch.disabled = flag;
  if (btnStop)  btnStop.disabled  = !flag;

  if(flag){
    // reset UI
    updateRing(0);
    if (ringPct) ringPct.textContent="0%";
    if (ringSub) ringSub.textContent="Preparing…";
    if (ringIcon) ringIcon.classList.add("d-none");
    setFetchState("fetching");
    resetStats();

    fetchStartMs = performance.now();
    stats.startMs = fetchStartMs;
    fetchDlg.show();
  }else{
    fetchDlg.hide();
  }
  loadingOverlay?.classList.add("d-none");
}

/* Progress + Stats */
function setProgress(pct, done=0, total=0){
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  // header bar
  progressBar.style.width=`${p}%`;
  progressText.textContent=`${p}%`;
  // ring
  updateRing(p);
  if (ringPct) ringPct.textContent = `${p}%`;
  if (total){
    if (ringSub) ringSub.textContent = `${done} / ${total}`;
    updateStats(done, total);
  }
}

/* Smooth ring update */
function updateRing(p){
  if(!ringFg) return;
  const off = 100 - p;
  ringFg.style.strokeDashoffset = String(off);
}

/* Stats helpers (smoothed) */
function resetStats(){
  stats.lastDone = 0;
  stats.times.length = 0;
  stats.rateEma = null;
  stats.etaEma  = null;

  if (statDone)    statDone.textContent = "0";
  if (statTotal)   statTotal.textContent = "0";
  if (statRate)    statRate.textContent = "0";
  if (statElapsed) statElapsed.textContent = "0s";
  if (statEta)     statEta.textContent = "—";
}
function ema(prev, value, alpha){
  return prev == null ? value : (prev*(1-alpha) + value*alpha);
}
function updateStats(done, total){
  const nowMs = performance.now();
  const nowSec = nowMs / 1000;
  const elapsedSec = Math.max(0.001, (nowMs - stats.startMs)/1000);

  // Register newly completed items (handles concurrency bursts)
  const delta = Math.max(0, done - stats.lastDone);
  for (let i=0; i<delta; i++) stats.times.push(nowSec);

  stats.lastDone = done;

  // Keep only timestamps within the active window (window length ≤ elapsed)
  const windowUsed = Math.min(stats.windowSec, Math.max(1, elapsedSec));
  const cutoff = nowSec - windowUsed;
  while (stats.times.length && stats.times[0] < cutoff) stats.times.shift();

  // Windowed instantaneous rate (completions per second)
  const winCount = stats.times.length;
  const rateInstant = winCount / windowUsed;

  // EMA-smoothed rate for display & ETA
  stats.rateEma = ema(stats.rateEma, rateInstant, stats.alphaRate);

  // Compute ETA from smoothed rate; fallback to global avg early on
  const rateForEta =
    (stats.rateEma && stats.rateEma > 0.0001) ? stats.rateEma :
    (done > 0 ? (done / elapsedSec) : 0);

  const remaining = Math.max(0, total - done);
  const etaNew = rateForEta > 0 ? remaining / rateForEta : Infinity;

  // EMA-smoothed ETA to avoid bouncing
  if (isFinite(etaNew)) stats.etaEma = ema(stats.etaEma, etaNew, stats.alphaEta);

  // Update UI (stable formatting)
  if (statDone)    statDone.textContent = String(done);
  if (statTotal)   statTotal.textContent = String(total);

  // Rate
  const rateShow = Math.max(0, rateForEta);
  if (statRate)    statRate.textContent = rateShow < 10 ? rateShow.toFixed(1) : String(Math.round(rateShow));

  // Elapsed
  if (statElapsed) statElapsed.textContent = formatDuration(elapsedSec);

  // ETA
  if (remaining === 0){
    if (statEta) statEta.textContent = "0s";
  } else if (!isFinite(etaNew) || rateShow <= 0 || stats.etaEma == null) {
    if (statEta) statEta.textContent = "—";
  } else {
    if (statEta) statEta.textContent = formatDuration(stats.etaEma);
  }
}
function formatDuration(sec){
  sec = Math.max(0, sec);
  const m = Math.floor(sec/60);
  const s = Math.round(sec%60);
  return m ? `${m}:${String(s).padStart(2,"0")}` : `${s}s`;
}

/* Visual states: fetching | complete | stopped */
function setFetchState(mode){
  if(!fetchDlgEl) return;
  const box = fetchDlgEl.querySelector(".fetch-modal");
  box?.classList.remove("is-complete","is-stopped");
  if(mode==="complete"){
    box?.classList.add("is-complete");
    if (ringIcon){
      ringIcon.classList.remove("d-none");
      ringIcon.innerHTML = '<i class="bi bi-check2-circle"></i>';
    }
  }else if(mode==="stopped"){
    box?.classList.add("is-stopped");
    if (ringIcon){
      ringIcon.classList.remove("d-none");
      ringIcon.innerHTML = '<i class="bi bi-stop-circle"></i>';
    }
  }else{
    if (ringIcon) ringIcon.classList.add("d-none");
  }
}

/* Finalize animation then close */
async function finalizeFetchUI(mode){
  if (mode==="complete"){
    // sweep to 100 if not there yet
    updateRing(100);
    if (ringPct) ringPct.textContent = "100%";
    if (ringSub) ringSub.textContent = "Complete";
    setFetchState("complete");
    await sleep(650);
  }else if(mode==="stopped"){
    if (ringSub) ringSub.textContent = "Stopped";
    setFetchState("stopped");
    await sleep(600);
  }
  showLoading(false);
}

/* ================== FETCH FLOW ================== */
btnFetch?.addEventListener("click",()=>startFetchAll());

async function startFetchAll(){
  readFromOffcanvasIfPresent();
  saveKeyMaybe();
  if(!state.apiKey){ apiKeyInfoDlg.show(); return; }
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
  const n=Math.max(1, Math.min(4, parseInt(concurrencyEl?.value||state.settings.concurrency,10)||2));
  await Promise.all([...Array(n)].map(()=>worker()));

  render();

  // Finalize with a brief, satisfying finish before closing
  await finalizeFetchUI(state.stop ? "stopped" : "complete");
  setStatus(state.stop ? "Stopped by user." : "Fetch complete.", false);
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
      state.results[id]={ name:"", level:"", status:{state:`Error ${data.error.error}`}, last_action:{}, avatar: AVATAR_FALLBACK };
    }else{
      state.results[id]={
        name:data.name, level:data.level, status:data.status, last_action:data.last_action,
        avatar: data.profile_image || AVATAR_FALLBACK
      };
    }
    renderRow(id);
  }catch(e){
    console.error("Fetch failed",id,e);
    state.results[id]={ name:"", level:"", status:{state:"Offline"}, last_action:{}, avatar: AVATAR_FALLBACK };
    renderRow(id);
  }
}
function renderRow(id){
  const tr=tbody.querySelector(`tr[data-id="${CSS.escape(id)}"]`); if(!tr) return;
  const r=rowData(id); const tds=tr.children;
  tds[1].innerHTML=`#${escapeHtml(id)}`; // ID
  tds[2].innerHTML=`
    <span class="name-wrap">
      <img class="avatar" src="${escapeAttr(r.avatar)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${AVATAR_FALLBACK}';">
      <span class="name-text">${escapeHtml(r.name||"")}</span>
    </span>`;
  tds[3].innerHTML=r.level!==""?`Lv ${escapeHtml(r.level)}`:"";
  tds[4].innerHTML=`<span class="badge rounded-pill ${r.st.badge} border">${escapeHtml(r.st.label)}</span>`;
  tds[5].innerHTML=`<i class="bi bi-clock-history"></i><span>${escapeHtml(r.last)}</span>`;
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
concurrencyEl?.addEventListener("change",()=>{
  const v=parseInt(concurrencyEl.value,10);
  state.settings.concurrency=Math.max(1,Math.min(4,isFinite(v)?v:2)); persist();
});
throttleEl?.addEventListener("change",()=>{
  const v=parseInt(throttleEl.value,10);
  state.settings.throttleMs=Math.max(300,isFinite(v)?v:1500); persist();
});
useProxyEl?.addEventListener("change",()=>{ state.settings.useProxy=useProxyEl.checked; persist(); });
proxyUrlEl?.addEventListener("change",()=>{ state.settings.proxyUrl=proxyUrlEl.value.trim(); persist(); });
apiKeyEl?.addEventListener("change",saveKeyMaybe);
rememberKeyEl?.addEventListener("change",saveKeyMaybe);

/* Offcanvas clone (mobile) */
const offcanvasEl = document.getElementById("sidebarOffcanvas");
offcanvasEl?.addEventListener("show.bs.offcanvas", ()=>{
  const src = document.getElementById("sidebar");
  const dest = document.getElementById("sidebarClone");
  if(!src || !dest) return;
  dest.innerHTML = "";
  const frag = document.createDocumentFragment();
  src.querySelectorAll(".card.glass").forEach(card=>{
    const clone = card.cloneNode(true);
    // keep data-action buttons, but drop ids to avoid duplicates
    clone.querySelectorAll("[id]").forEach(n=>{
      // keep specific ids for inputs we read directly
      if(n.id==="addDlg" || n.id==="bulkDlg" ) return;
      n.removeAttribute("id");
    });
    // annotate binds for api key & remember
    clone.querySelector('input[type="password"]')?.setAttribute("data-bind","apiKey");
    clone.querySelector('input[type="checkbox"]')?.setAttribute("data-bind","rememberKey");
    frag.appendChild(clone);
  });
  dest.appendChild(frag);
});

/* ---------------- About modal (updated) ---------------- */
btnAbout?.addEventListener("click", async ()=>{
  // version + theme
  const ver = $("#aboutVersion");
  const verF = $("#aboutVersionFooter");
  const themeLbl = $("#aboutThemeLabel");
  const themeLblF = $("#aboutThemeLabelFooter");

  if (ver)  ver.textContent  = APP_VERSION;
  if (verF) verF.textContent = APP_VERSION;

  const theme = localStorage.getItem("theme") || "dark";
  const themeText = `Theme: ${theme}`;
  if (themeLbl)  themeLbl.textContent  = themeText.replace("Theme: ", "");
  if (themeLblF) themeLblF.textContent = themeText;

  // quick stats
  const tCount = state.targets.length;
  const aboutTargets = $("#aboutTargets");
  const aboutSavedMeta = $("#aboutSavedMeta");
  if (aboutTargets)   aboutTargets.textContent = String(tCount);
  if (aboutSavedMeta) aboutSavedMeta.textContent = ($("#savedMeta")?.textContent || "—");

  // avatar
  await ensureAboutAvatar();

  new bootstrap.Modal($("#aboutDlg")).show();
});

$("#copyIdBtn")?.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(ABOUT_TORN_ID);
    const btn = $("#copyIdBtn");
    if (btn) {
      btn.innerHTML = '<i class="bi bi-clipboard-check me-1"></i> Copied!';
      setTimeout(()=>{ const b=$("#copyIdBtn"); if(b) b.innerHTML='<i class="bi bi-clipboard me-1"></i> Copy profile ID'; },1200);
    }
  }catch{}
});

async function ensureAboutAvatar(){
  const avatar = $("#aboutAvatar");
  if(!avatar || avatar.dataset.loaded === "1") return;
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
  avatar.src = url;
  avatar.dataset.loaded = "1";
}

/* Global [data-action] handler for mobile sidebar actions */
document.addEventListener("click",(e)=>{
  const target = e.target.closest("[data-action]");
  if(!target) return;
  const act = target.dataset.action;

  if(act==="save-api"){ e.preventDefault(); saveApiAndCloseSidebar(); return; }
  if(act==="open-add"){ e.preventDefault(); openAddDialog("single", true); return; }
  if(act==="open-bulk"){ e.preventDefault(); openAddDialog("bulk", true); return; }

  if(act==="open-file"){ e.preventDefault(); $("#file")?.click(); return; }
  if(act==="export-json"){ e.preventDefault(); btnSave?.click(); return; }
  if(act==="fetch-start"){
    e.preventDefault();
    readFromOffcanvasIfPresent();
    if(!apiKeyPresent()){ showApiKeyInfo(); return; }
    closeOffcanvasIfOpen();
    startFetchAll();
    return;
  }
  if(act==="fetch-stop"){ e.preventDefault(); state.stop=true; setStatus("Stopping…", false); setFetchState("stopped"); if (ringSub) ringSub.textContent="Stopping…"; return; }
  if(act==="about"){ e.preventDefault(); btnAbout?.click(); return; }
  if(act==="theme-auto"){ setTheme("auto", true); return; }
  if(act==="theme-light"){ setTheme("light", true); return; }
  if(act==="theme-dark"){ setTheme("dark", true); return; }

  if(act==="toggle-sort-dir"){ state.sort.dir *= -1; render(); updateSortBar(); return; }
  if(act==="sort-key"){ state.sort.key = target.dataset.key; render(); updateSortBar(); return; }
});

/* Init */
initTheme();
setHeights();
ensureSortBar();
restore();

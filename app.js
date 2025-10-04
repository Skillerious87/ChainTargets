/* Torn Targets UI — crisp fetch ring, hover states, rounded table */
const APP_VERSION = "2.9.3";
const STORE_KEY = "tornTargets.data.v2";
const KEY_KEY   = "tornTargets.apiKey.v1";
const ABOUT_TORN_ID = "3212954";

/* ---------- State ---------- */
const state = {
  apiKey: "",
  targets: [],
  results: {},
  settings: { concurrency: 2, throttleMs: 1500, useProxy: false, proxyUrl: "" },
  sort: { key: "id", dir: 1 }, // dir: 1 asc, -1 desc
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

/* Add Target modal */
const singleInput=$("#singleInput"), singleHint=$("#singleHint");
const bulkText=$("#bulkText"), bulkHint=$("#bulkHint");
const addConfirm=$("#addConfirm");

/* Legacy bulk modal */
const bulkTextLegacy=$("#bulkTextLegacy");
const bulkConfirmLegacy=$("#bulkConfirmLegacy");

/* Fetch modal */
const ringFg     = $("#ringFg");
const ringPct    = $("#ringPct");
const ringSub    = $("#ringSub");

/* Offcanvas */
const offcanvasEl = document.getElementById("sidebarOffcanvas");

/* ---------- Status Bar ---------- */
const statusBarText = $("#statusText");
const statusBarSaved = $("#savedMeta");
const statusDot      = $("#statusDot");
function setStatus(msg, busy=false) {
  if (statusBarText) statusBarText.textContent = msg;
  if (statusDot) statusDot.style.background = busy ? "#60a5fa" : "#36d39f";
}

/* Bootstrap-safe modal helpers */
function modalGetOrCreate(selector){
  const el = typeof selector === "string" ? $(selector) : selector;
  if(!el) return null;
  return bootstrap.Modal.getOrCreateInstance(el);
}
function modalShow(selector){ modalGetOrCreate(selector)?.show(); }
function modalHide(selector){ modalGetOrCreate(selector)?.hide(); }

/* ---------- Theme ---------- */
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
  try{
    localStorage.setItem(STORE_KEY, JSON.stringify({
      version:APP_VERSION, targets:state.targets, results:state.results, settings:state.settings
    }));
  }catch(e){}
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
  if(throttleEl) throttleEl.value=String(state.settings.throttleMs);
  if(useProxyEl) useProxyEl.checked=state.settings.useProxy;
  if(proxyUrlEl) proxyUrlEl.value=state.settings.proxyUrl||"";
}
function persistKeyToStorage(){
  try{
    const k = (apiKeyEl?.value || "").trim();
    state.apiKey = k;
    if(rememberKeyEl?.checked && k){
      localStorage.setItem(KEY_KEY, k);
    }else{
      localStorage.removeItem(KEY_KEY);
    }
  }catch(e){}
}
function readFromOffcanvasIfPresent(){
  const oc = document.getElementById("sidebarOffcanvas");
  if(!oc) return;
  const cloneApi = oc.querySelector('[data-bind="apiKey"]');
  const cloneRemember = oc.querySelector('[data-bind="rememberKey"]');
  if(cloneApi && apiKeyEl) apiKeyEl.value = cloneApi.value;
  if(cloneRemember && rememberKeyEl) rememberKeyEl.checked = cloneRemember.checked;
}

/* ---------- Layout calc ---------- */
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
  if(emptyGlobal) emptyGlobal.classList.toggle("d-none", hasRows);
  if(tableWrap) tableWrap.classList.toggle("d-none", !hasRows);
  const metaText = hasRows
    ? `${state.targets.length} target${state.targets.length!==1?'s':''} • last saved ${new Date().toLocaleTimeString()}`
    : `No data yet`;
  if(boardMeta) boardMeta.textContent = metaText;
  if(statusBarSaved) statusBarSaved.textContent = metaText;
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
  const avatar = (r.avatar && String(r.avatar).trim()) ? r.avatar : "assets/profile.png";
  return { id, name:r.name||"", level:r.level??"", avatar, st:statusDisplay(r.status||{}), last:formatLast(r.last_action) };
}
function render(){
  ensureVisibleState();
  const filter=statusFilterEl?.value || "all";
  const term=(searchBoxEl?.value||"").trim().toLowerCase();

  grid?.querySelectorAll("th.sortable").forEach(th=>{
    th.classList.remove("sort-asc","sort-desc");
    if(th.dataset.sort===state.sort.key){
      th.classList.add(state.sort.dir>0?"sort-asc":"sort-desc");
    }
  });

  const frag=document.createDocumentFragment(); let visible=0;
  for(const id of sortedTargets()){
    const {name,level,st,last,avatar}=rowData(id);
    if(filter!=="all" && st.label.toLowerCase()!==filter.toLowerCase()) continue;
    if(term){
      const hay=(id+" "+(name||"")).toLowerCase();
      if(!hay.includes(term)) continue;
    }
    const avatarHtml = `<img class="avatar" src="${escapeHtml(avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/profile.png';">`;
    const tr=document.createElement("tr");
    tr.dataset.id=id;
    tr.innerHTML=`
      <td><input type="checkbox" class="rowchk" /></td>
      <td class="font-monospace cell-id" data-label="ID">#${id}</td>
      <td class="cell-name" data-label="Name">
        <span class="name-wrap">${avatarHtml}<span class="name-text">${escapeHtml(name||"")}</span></span>
      </td>
      <td class="cell-level" data-label="Level"><span class="lvl-pill">Lv ${escapeHtml(level)}</span></td>
      <td class="cell-status" data-label="Status"><span class="badge rounded-pill ${st.badge} border">${escapeHtml(st.label)}</span></td>
      <td class="cell-last" data-label="Last action"><i class="bi bi-clock-history"></i><span>${escapeHtml(last)}</span></td>
    `;
    frag.appendChild(tr); visible++;
  }
  if(tbody){ tbody.innerHTML=""; tbody.appendChild(frag); }
  if(tableEmpty) tableEmpty.classList.toggle("d-none", !(state.targets.length>0 && visible===0));
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

/* Sorting (desktop header) */
grid?.querySelectorAll("th.sortable").forEach(th=>{
  th.addEventListener("click",()=>{
    const key=th.dataset.sort;
    state.sort = (state.sort.key===key) ? {key, dir:state.sort.dir*-1} : {key, dir:1};
    updateMobileSortLabel();
    render();
  });
});

/* Selection + row click */
chkAll?.addEventListener("change",()=>{
  tbody?.querySelectorAll(".rowchk").forEach(cb=>cb.checked=chkAll.checked);
});
tbody?.addEventListener("change",(e)=>{
  if(!(e.target instanceof HTMLInputElement)) return;
  if(e.target.classList.contains("rowchk")){
    const boxes=[...tbody.querySelectorAll(".rowchk")];
    chkAll.checked = boxes.length>0 && boxes.every(b=>b.checked);
  }
});
tbody?.addEventListener("click",(e)=>{
  if(e.target.closest("input,button,a,label")) return;
  const tr=e.target.closest("tr"); if(!tr) return;
  const id=tr.dataset.id; if(!id) return;
  window.open(`https://www.torn.com/profiles.php?XID=${encodeURIComponent(id)}`,"_blank","noopener");
});

/* Filters */
statusFilterEl?.addEventListener("change",()=>{
  chipsWrap.querySelectorAll(".chip").forEach(c=>c.classList.toggle("active", c.dataset.val===statusFilterEl.value || (statusFilterEl.value==="all" && c.dataset.val==="all")));
  render();
});
chipsWrap?.addEventListener("click",(e)=>{
  const btn=e.target.closest(".chip"); if(!btn) return;
  chipsWrap.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
  btn.classList.add("active");
  if(statusFilterEl) statusFilterEl.value=btn.dataset.val || "all";
  render();
});
searchBoxEl?.addEventListener("input",()=>render());

/* --- Sidebar & actions --- */
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
btnAddDialog?.addEventListener("click",()=>openAddDialog("single", true));
btnBulk?.addEventListener("click",()=>openAddDialog("bulk", true));
ctaAdd?.addEventListener("click",()=>openAddDialog("single", false));

function closeOffcanvasIfOpen(){
  if(!offcanvasEl) return;
  const inst = bootstrap.Offcanvas.getInstance(offcanvasEl) || bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
  if(offcanvasEl.classList.contains("show")) inst.hide();
}
function openAddDialog(tab="single", fromSidebar=false){
  if(fromSidebar) closeOffcanvasIfOpen();
  const el = $("#addDlg");
  if(el?.classList.contains("show")) return;

  new bootstrap.Tab(document.querySelector(`[data-bs-target="#${tab==="single"?"singleTab":"bulkTab"}"]`)).show();
  if(singleInput) singleInput.value="";
  if(singleHint) singleHint.textContent="Waiting for input…";
  if(bulkText) bulkText.value="";
  if(bulkHint) bulkHint.textContent="0 valid IDs detected.";
  modalShow("#addDlg");
}

singleInput?.addEventListener("input",()=>{
  const ids=extractIds(singleInput.value);
  if(singleHint) singleHint.textContent = ids.length ? `Resolved → ${ids.join(", ")}` : `No valid ID found yet. Paste an ID or Torn profile URL.`;
});
bulkText?.addEventListener("input",()=>{
  const ids=extractIds(bulkText.value);
  if(bulkHint) bulkHint.textContent = `${ids.length} valid ID${ids.length!==1?'s':''} detected.`;
});
addConfirm?.addEventListener("click",async ()=>{
  const activeTab=document.querySelector("#addTabs .nav-link.active")?.getAttribute("data-bs-target")||"#singleTab";
  const source = activeTab==="#singleTab" ? (singleInput?.value||"") : (bulkText?.value||"");
  let ids = extractIds(source);
  if(activeTab==="#singleTab" && !ids.length && state.apiKey && source.trim()){
    addConfirm.disabled=true; addConfirm.textContent="Resolving…";
    const id = await resolveNameToId(source.trim()).catch(()=>null);
    addConfirm.disabled=false; addConfirm.textContent="Add";
    if(id) ids=[id];
  }
  if(!ids.length){ if(singleHint) singleHint.textContent="No valid IDs found. Try a different input."; return; }
  let added=0; for(const id of ids){ if(!state.targets.includes(id)){ state.targets.push(id); added++; } }
  sortTargets(); render(); modalHide("#addDlg");
  setStatus("Targets updated.", false);

  if(!state.apiKey){ showApiKeyInfo(); } else { startFetchAll(); }
});

/* Bulk (legacy) */
bulkConfirmLegacy?.addEventListener("click",()=>{
  const ids=extractIds(bulkTextLegacy.value);
  let added=0; for(const id of ids){ if(!state.targets.includes(id)){ state.targets.push(id); added++; } }
  bulkTextLegacy.value=""; modalHide("#bulkDlg");
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

/* Fetching */
btnFetch?.addEventListener("click",()=>{
  readFromOffcanvasIfPresent();
  if(!apiKeyPresent()) { showApiKeyInfo(); return; }
  startFetchAll();
});
btnStop?.addEventListener("click",()=>{ state.stop=true; setStatus("Stopped by user.", false); modalHide("#fetchDlg"); });
$("#fetchCancel")?.addEventListener("click", ()=>{ state.stop=true; setStatus("Stopped by user.", false); modalHide("#fetchDlg"); });

btnResetCols?.addEventListener("click",()=>{ /* future column prefs */ });

function apiKeyPresent(){
  persistKeyToStorage();
  return !!state.apiKey;
}

async function startFetchAll(){
  persistKeyToStorage();
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
  const n=Math.max(1, Math.min(4, parseInt(concurrencyEl?.value,10)||2));
  await Promise.all([...Array(n)].map(()=>worker()));

  showLoading(false);
  render();
  setStatus("Fetch complete.", false);
}
function showLoading(flag){
  if(progressWrap) progressWrap.classList.toggle("d-none", !flag);
  if(btnFetch) btnFetch.disabled=flag;
  if(btnStop) btnStop.disabled=!flag;

  if(flag){
    updateRing(0);
    if(ringPct) ringPct.textContent="0%";
    if(ringSub) ringSub.textContent="Fetching…";
    modalShow("#fetchDlg");
  }else{
    modalHide("#fetchDlg");
  }
  loadingOverlay?.classList.add("d-none");
}
function setProgress(pct, done=0, total=0){
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  if(progressBar) progressBar.style.width=`${p}%`;
  if(progressText) progressText.textContent=`${p}%`;
  updateRing(p);
  if(ringPct) ringPct.textContent = `${p}%`;
  if(total && ringSub){ ringSub.textContent = `${done} / ${total}`; }
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
      state.results[id]={ name:"", level:"", avatar:"", status:{state:`Error ${data.error.error}`}, last_action:{} };
    }else{
      state.results[id]={
        name:data.name,
        level:data.level,
        avatar: data.profile_image || "",
        status:data.status,
        last_action:data.last_action
      };
    }
    renderRow(id);
  }catch(e){
    console.error("Fetch failed",id,e);
    state.results[id]={ name:"", level:"", avatar:"", status:{state:"Offline"}, last_action:{} };
    renderRow(id);
  }
}
function renderRow(id){
  const tr=tbody?.querySelector(`tr[data-id="${CSS.escape(id)}"]`); if(!tr) return;
  const r=rowData(id); const tds=tr.children;
  const nameCell = tds[2].querySelector(".name-text");
  const avatarImg = tds[2].querySelector(".avatar");
  if(nameCell) nameCell.textContent = r.name || "";
  if(avatarImg){
    avatarImg.src = r.avatar || "assets/profile.png";
    avatarImg.onerror = function(){ this.onerror=null; this.src="assets/profile.png"; };
  }
  tds[3].innerHTML=`<span class="lvl-pill">Lv ${escapeHtml(r.level)}</span>`;
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

/* Persist API key */
apiKeyEl?.addEventListener("input", persistKeyToStorage);
apiKeyEl?.addEventListener("change", persistKeyToStorage);
rememberKeyEl?.addEventListener("change", persistKeyToStorage);

/* Offcanvas clone (mobile) */
offcanvasEl?.addEventListener("show.bs.offcanvas", ()=>{
  const src = document.getElementById("sidebar");
  const dest = document.getElementById("sidebarClone");
  if(!src || !dest) return;
  dest.innerHTML = "";
  const frag = document.createDocumentFragment();
  src.querySelectorAll(".card.glass").forEach(card=>{
    const clone = card.cloneNode(true);
    clone.querySelectorAll("[id]").forEach(n=>n.removeAttribute("id"));
    frag.appendChild(clone);
  });
  dest.appendChild(frag);

  // Bind values into clone
  const cloneApi = dest.querySelector('[data-bind="apiKey"]');
  const cloneRemember = dest.querySelector('[data-bind="rememberKey"]');
  if(cloneApi && apiKeyEl) cloneApi.value = apiKeyEl.value;
  if(cloneRemember && rememberKeyEl) cloneRemember.checked = rememberKeyEl.checked;

  dest.addEventListener("input",(ev)=>{
    if(ev.target.matches('[data-bind="apiKey"]') && apiKeyEl){
      apiKeyEl.value = ev.target.value;
      persistKeyToStorage();
    }
  });
  dest.addEventListener("change",(ev)=>{
    if(ev.target.matches('[data-bind="rememberKey"]') && rememberKeyEl){
      rememberKeyEl.checked = ev.target.checked;
      persistKeyToStorage();
    }
  }, { once:false });
});

/* About modal */
btnAbout?.addEventListener("click", async ()=>{
  $("#aboutVersion").textContent = APP_VERSION;
  $("#aboutThemeLabel").textContent = `Theme: ${localStorage.getItem("theme") || "dark"}`;
  await ensureAboutAvatar();
  modalShow("#aboutDlg");
});
$("#copyIdBtn")?.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(ABOUT_TORN_ID);
    $("#copyIdBtn").innerHTML = '<i class="bi bi-clipboard-check me-1"></i> Copied!';
    setTimeout(()=>$("#copyIdBtn").innerHTML='<i class="bi bi-clipboard me-1"></i> Copy profile ID',1200);
  }catch{}
});
async function ensureAboutAvatar(){
  const aboutAvatar = $("#aboutAvatar");
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

/* API key info dialog */
function showApiKeyInfo(){ modalShow("#apiKeyInfoDlg"); }
$("#keyFocusBtn")?.addEventListener("click", ()=>{
  modalHide("#apiKeyInfoDlg");
  if(window.innerWidth < 992 && offcanvasEl){
    bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl).show();
  }
  setTimeout(()=>{
    document.querySelector('[data-bind="apiKey"]')?.focus();
  }, 300);
});
function saveApiAndCloseSidebar(){
  readFromOffcanvasIfPresent();
  persistKeyToStorage();
  setStatus(state.apiKey ? "API key saved." : "API key cleared.", false);
  if(offcanvasEl){
    const inst = bootstrap.Offcanvas.getInstance(offcanvasEl) || bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
    if(offcanvasEl.classList.contains("show")) inst.hide();
  }
}

/* ---------- Mobile polish: global + card CSS + sort bar ---------- */
function injectMobileStyles(){
  if(document.getElementById("mobile-card-styles")) return;
  const s = document.createElement("style");
  s.id = "mobile-card-styles";
  s.textContent = `
/* Global fixes */
.table-wrap{ border-radius: var(--radius); overflow: clip; clip-path: inset(0 round var(--radius)); }
@supports not (overflow: clip){ .table-wrap{ overflow: hidden; } }

/* Always constrain avatars */
#grid .avatar{ width:26px; height:26px; border-radius:8px; object-fit:cover; border:1px solid var(--border); background:rgba(0,0,0,.15); }

/* Mobile cards & interactions */
@media (max-width: 768px){
  .table-modern thead{ display:none !important; }

  /* Sort bar lives OUTSIDE the scroll area now; spacing only */
  #mobileSortBar{ margin: 6px 0 10px; }
  #mobileSortBar .btn{ border-radius:12px; }

  /* Kill row hover highlight on mobile completely */
  .table-modern tbody tr:hover,
  .table-modern tbody tr:hover td{ background: inherit !important; }
  .table-modern tbody tr{ cursor: default; }

  .table-responsive{ overflow: visible; }
  #grid{ border-collapse: separate; border-spacing: 0 14px; }
  #grid tbody td{ border-bottom:0 !important; padding:.35rem .4rem; }

  #grid tbody tr{
    display:grid;
    grid-template-columns: 36px 1fr auto;
    grid-template-areas:
      "chk title status"
      "chk meta1 status"
      "chk meta2 status"
      "chk foot  foot";
    gap: 6px 12px;
    background:
      radial-gradient(450px 110px at 10% -60%, rgba(125,211,252,.10), transparent 70%),
      var(--tbl-bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 12px 12px 10px 8px;
    box-shadow: 0 10px 24px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.05);
  }

  #grid tbody td:first-child{ grid-area: chk; align-self:start; padding-top:.35rem; }
  #grid input[type="checkbox"]{ width:22px; height:22px; }

  #grid .avatar{ width:42px; height:42px; border-radius:12px; }
  .cell-name{ grid-area: title; font-size:1.05rem; font-weight:800; letter-spacing:.2px; }
  .cell-name .name-wrap{ display:flex; align-items:center; gap:.6rem; }

  .cell-status{ grid-area: status; justify-self:end; align-self:start; }
  .cell-status .badge{ padding:.35rem .6rem; font-weight:800; letter-spacing:.15px; box-shadow: 0 4px 18px rgba(0,0,0,.25); }

  .cell-id{ grid-area: meta1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--bs-secondary-color); }
  .cell-level{ grid-area: meta2; }
  .lvl-pill{ display:inline-block; padding:.18rem .5rem; border-radius:999px; border:1px solid var(--border); background: rgba(125,211,252,.06); font-weight:800; letter-spacing:.2px; }

  .cell-last{ grid-area: foot; display:flex; align-items:center; gap:.45rem; color: var(--bs-secondary-color); margin-top:.2rem; }
  .cell-last .bi{ opacity:.8; }
}
  `;
  document.head.appendChild(s);
}

function insertMobileSortBar(){
  if(document.getElementById("mobileSortBar")) return;

  // Place BEFORE the scroll container so it never overlays cards
  const gridScroll = document.getElementById("gridScroll");
  if(!gridScroll || !gridScroll.parentElement) return;

  const wrap = document.createElement("div");
  wrap.id = "mobileSortBar";
  wrap.className = "d-md-none";
  wrap.innerHTML = `
    <div class="d-flex gap-2">
      <div class="dropdown flex-grow-1">
        <button class="btn btn-ghost btn-sm w-100 dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="bi bi-arrow-down-up me-1"></i><span id="sortLabel">Sort: ID ↑</span>
        </button>
        <ul class="dropdown-menu w-100">
          <li><button class="dropdown-item" data-sort="id">ID</button></li>
          <li><button class="dropdown-item" data-sort="name">Name</button></li>
          <li><button class="dropdown-item" data-sort="level">Level</button></li>
          <li><button class="dropdown-item" data-sort="status">Status</button></li>
          <li><button class="dropdown-item" data-sort="last">Last action</button></li>
        </ul>
      </div>
      <button class="btn btn-ghost btn-sm" id="toggleSortDir" aria-label="Toggle sort direction">
        <i id="sortDirIcon" class="bi bi-sort-down"></i>
      </button>
    </div>
  `;
  gridScroll.parentElement.insertBefore(wrap, gridScroll);

  wrap.querySelectorAll(".dropdown-item").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const key = btn.dataset.sort;
      state.sort = { key, dir: 1 };
      updateMobileSortLabel();
      render();
    });
  });
  $("#toggleSortDir").addEventListener("click", ()=>{
    state.sort.dir *= -1;
    updateMobileSortLabel();
    render();
  });
  updateMobileSortLabel();
}
function updateMobileSortLabel(){
  const label = document.getElementById("sortLabel");
  const icon  = document.getElementById("sortDirIcon");
  if(!label || !icon) return;
  const dirArrow = state.sort.dir>0 ? "↑" : "↓";
  label.textContent = `Sort: ${titleCase(state.sort.key)} ${dirArrow}`;
  icon.className = state.sort.dir>0 ? "bi bi-sort-down" : "bi bi-sort-up";
}
function titleCase(s){ return String(s||"").replace(/\b\w/g, c=>c.toUpperCase()); }

/* ---------- Init ---------- */
initTheme();
setHeights();
injectMobileStyles();
insertMobileSortBar();
restore();

const SUPABASE_URL="https://hnowbhfopmvroabicfro.supabase.co",SUPABASE_KEY="sb_publishable_p06dNyqgbCai4JQ5ZSdtsg_i-YJzsaE",db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let me,people=[],tasks=[],done=[],tx=[],events=[],filter="Alle",newIcon="⭐",editIcon="⭐";
const ICONS=["⭐","👕","🧺","🧹","🛏️","🍽️","🗑️","🐕","🌱","🚿","📚","🧽","🪟","♻️","🍳","🚲"];
const $=x=>document.getElementById(x),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),money=n=>new Intl.NumberFormat("da-DK",{style:"currency",currency:"DKK"}).format(Number(n||0)),person=id=>people.find(p=>p.id===id)?.navn||"",parent=()=>me?.rolle==="forælder",date=d=>new Date(d).toLocaleDateString("sv-SE",{timeZone:"Europe/Copenhagen"});
function monday(d){let x=new Date(new Date(d).toLocaleString("en-US",{timeZone:"Europe/Copenhagen"}));x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x.toISOString().slice(0,10)}
function pk(t){return t.gentagelse==="daglig"?date(new Date()):t.gentagelse==="ugentlig"?monday(new Date()):date(t.created_at)}
function closed(t){return events.some(e=>e.opgave_id===t.id&&e.type==="ikke_lavet"&&e.periode_start===pk(t))}
function completed(t){return done.some(c=>c.opgave_id===t.id&&["pending","godkendt"].includes(c.status)&&(t.gentagelse==="engang"||t.gentagelse==="daglig"&&date(c.udfoert_at)===pk(t)||t.gentagelse==="ugentlig"&&monday(c.udfoert_at)===pk(t)))}
async function rpc(n,a={}){let{data,error}=await db.rpc(n,a);if(error)throw error;return data}function err(e){alert(e.message||e)}
async function pin(){return new Promise(r=>{let d=$("pinDialog"),i=$("pinInput");i.value="";d.showModal();d.addEventListener("close",()=>r(d.returnValue==="ok"?i.value:null),{once:true})})}
function showLogin(){$("login").classList.remove("hidden");$("app").classList.add("hidden")}
function go(tab){document.querySelectorAll(".tab").forEach(x=>x.classList.add("hidden"));$(tab).classList.remove("hidden");document.querySelectorAll(".bottom [data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab===tab))}
async function boot(){const {data:{session},error}=await db.auth.getSession();if(error)throw error;if(!session){showLogin();return}try{let p=await rpc("min_person");me=Array.isArray(p)?p[0]:p;if(!me)throw Error("Brugeren er ikke koblet til familien.");people=await rpc("hent_familie");$("name").textContent=me.navn;$("login").classList.add("hidden");$("app").classList.remove("hidden");$("profileName").textContent=me.navn;$("profileRole").textContent=parent()?"Forælder":"Barn";await refresh();go("tasks")}catch(e){$("loginMsg").textContent="Fejl efter login: "+(e?.message||String(e));showLogin()}}
async function refresh(){let a=await Promise.all([db.from("opgaver").select("*").order("created_at",{ascending:false}),db.from("udfoerte_opgaver").select("*").order("udfoert_at",{ascending:false}),db.from("transaktioner").select("*").order("created_at",{ascending:false}),db.from("opgave_haendelser").select("*").order("created_at",{ascending:false})]);for(let r of a)if(r.error)throw r.error;[tasks,done,tx,events]=a.map(r=>r.data||[]);render()}
function activeFor(t,n){return t.aktiv&&!closed(t)&&!completed(t)&&(t.tildelt_til==="begge"||t.tildelt_til===n.toLowerCase())}
function avatar(el,p){if(!el||!p)return;el.innerHTML=p.profilbillede_url?`<img src="${esc(p.profilbillede_url)}" alt="">`:esc(p.navn[0])}
function render(){for(let n of ["Julius","Rosa"]){let p=people.find(x=>x.navn===n),s=tx.filter(x=>x.barn_id===p?.id).reduce((a,x)=>a+Number(x.beloeb),0);$(n==="Julius"?"saldoJ":"saldoR").textContent=money(s);$(n==="Julius"?"jCount":"rCount").textContent=tasks.filter(t=>activeFor(t,n)).length+" aktive opgaver";avatar($(n==="Julius"?"avatarJ":"avatarR"),p)}avatar($("profileAvatar"),people.find(x=>x.id===me.id));avatar($("topProfileAvatar"),people.find(x=>x.id===me.id));renderTasks();renderHistory();renderPending()}
function card(t,controls=true){return `<div class="item"><div class="row"><div class="taskMain"><div class="taskIcon">${esc(t.ikon||"⭐")}</div><div><div class="title">${esc(t.titel)}</div><div class="meta">${esc(t.beskrivelse||"")}${t.beskrivelse?" · ":""}${t.gentagelse==="daglig"?"Daglig":t.gentagelse==="ugentlig"?"Ugentlig":"Én gang"}</div></div></div><div class="amount">${money(t.beloeb)}</div></div>${controls?`<div class="actions">${parent()?`<button class="light" onclick="edit('${t.id}')">Rediger</button><button class="danger" onclick="miss('${t.id}')">Ikke lavet</button>`:`<button onclick="finish('${t.id}')">Jeg har gjort det</button>`}</div>`:""}</div>`}
function renderTasks(){let list=tasks.filter(t=>t.aktiv&&!closed(t)&&!completed(t)&&(parent()||t.tildelt_til==="begge"||t.tildelt_til===me.navn.toLowerCase()));$("taskList").innerHTML=list.length?list.map(t=>card(t)).join(""):'<div class="empty">Ingen aktive opgaver lige nu ✨</div>'}
function history(){return [...tx.map(x=>({d:x.created_at,n:person(x.barn_id),t:x.beskrivelse,a:Number(x.beloeb),k:x.type})),...events.map(x=>({d:x.created_at,n:x.barn_id?person(x.barn_id):"Begge",t:x.titel_snapshot,a:null,k:"ikke_lavet"}))].sort((a,b)=>new Date(b.d)-new Date(a.d))}
function renderHistory(){let l=history();if(filter!=="Alle")l=l.filter(x=>x.n===filter||x.n==="Begge");$("historyList").innerHTML=l.length?l.map(x=>`<div class="item"><div class="row"><div><div class="title">${esc(x.t)}</div><div class="meta">${esc(x.n)} · ${new Date(x.d).toLocaleString("da-DK",{dateStyle:"medium",timeStyle:"short"})}${x.k==="ikke_lavet"?' · Ikke lavet':""}</div></div>${x.a===null?"":`<div class="amount ${x.a>=0?"positive":"negative"}">${x.a>=0?"+":""}${money(x.a)}</div>`}</div></div>`).join(""):'<div class="empty">Ingen historik.</div>'}
function renderPending(){if(!parent())return;let l=done.filter(x=>x.status==="pending");$("pendingList").innerHTML=l.length?l.map(c=>{let t=tasks.find(x=>x.id===c.opgave_id);return`<div class="item"><div class="row"><div><div class="title">${esc(t?.titel||"Opgave")}</div><div class="meta">${person(c.barn_id)}</div></div><div class="amount">${money(t?.beloeb)}</div></div><div class="actions"><button class="danger" onclick="review('${c.id}',false)">Afvis</button><button onclick="review('${c.id}',true)">Godkend</button></div></div>`}).join(""):'<div class="empty">Intet venter på godkendelse.</div>'}
function iconPicker(id,selected,cb){$(id).innerHTML=ICONS.map(i=>`<button type="button" class="iconPick ${i===selected?"selected":""}" data-icon="${i}">${i}</button>`).join("");$(id).querySelectorAll(".iconPick").forEach(b=>b.onclick=()=>{cb(b.dataset.icon);iconPicker(id,b.dataset.icon,cb)})}
iconPicker("newIcons",newIcon,v=>newIcon=v);iconPicker("editIcons",editIcon,v=>editIcon=v);
window.finish=async id=>{try{await rpc("marker_udfoert",{opgave_uuid:id});await refresh();go("tasks")}catch(e){err(e)}};window.review=async(id,yes)=>{let p=await pin();if(!p)return;try{await rpc(yes?"godkend_opgave":"afvis_opgave",{udfoert_uuid:id,foraelder_navn:me.navn,pin:p});await refresh();go("tasks")}catch(e){err(e)}};window.miss=async id=>{if(!confirm('Markér som "ikke lavet"?'))return;let p=await pin();if(!p)return;try{await rpc("marker_ikke_lavet",{opgave_uuid:id,foraelder_navn:me.navn,pin:p});await refresh();go("tasks")}catch(e){err(e)}};
window.edit=id=>{let t=tasks.find(x=>x.id===id);$("editId").value=id;$("editTitle").value=t.titel;$("editDesc").value=t.beskrivelse||"";$("editAmount").value=t.beloeb;$("editAssignee").value=t.tildelt_til;$("editRepeat").value=t.gentagelse;editIcon=t.ikon||"⭐";iconPicker("editIcons",editIcon,v=>editIcon=v);$("editDialog").showModal()};
$("saveEdit").onclick=async e=>{e.preventDefault();let p=await pin();if(!p)return;try{await rpc("rediger_opgave",{opgave_uuid:$("editId").value,ny_titel:$("editTitle").value.trim(),ny_beskrivelse:$("editDesc").value.trim(),nyt_beloeb:Number($("editAmount").value),ny_tildeling:$("editAssignee").value,ny_gentagelse:$("editRepeat").value,foraelder_navn:me.navn,pin:p,nyt_ikon:editIcon});$("editDialog").close();await refresh();go("tasks")}catch(e){err(e)}};
$("loginBtn").onclick=async()=>{let m=$("loginMsg");try{m.textContent="Logger ind…";let{data,error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error)throw error;if(!data.session)throw Error("Login mislykkedes.");await boot()}catch(e){m.textContent="Fejl: "+(e.message||e)}};
$("password").onkeydown=e=>{if(e.key==="Enter")$("loginBtn").click()};$("logout").onclick=async()=>{await db.auth.signOut();showLogin()};
$("topProfile").onclick=()=>go("profile");
$("plusBtn").onclick=()=>{if(!parent()){alert("Kun forældre har adgang til at oprette og administrere opgaver.");return}go("parent")};
$("createTask").onclick=async()=>{let p=await pin();if(!p)return;try{await rpc("opret_opgave",{foraelder_navn:me.navn,pin:p,titel:$("newTitle").value.trim(),beskrivelse:$("newDesc").value.trim(),beloeb:Number($("newAmount").value),tildelt_til:$("newAssignee").value,gentagelse:$("newRepeat").value,ikon:newIcon});await refresh();go("tasks")}catch(e){err(e)}};
$("deductBtn").onclick=async()=>{let p=await pin();if(!p)return;try{await rpc("registrer_fradrag",{barn_navn:$("deductChild").value,beloeb:Number($("deductAmount").value),type:$("deductType").value,beskrivelse:$("deductDesc").value.trim(),foraelder_navn:me.navn,pin:p});await refresh();go("tasks")}catch(e){err(e)}};
document.querySelectorAll(".bottom [data-tab]").forEach(b=>b.onclick=()=>go(b.dataset.tab));
document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));renderHistory()});
document.querySelectorAll(".balance").forEach(b=>b.onclick=()=>{filter=b.dataset.person;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x.dataset.filter===filter));go("history");renderHistory()});
$("profileFile").onchange=async e=>{
 const file=e.target.files?.[0]; if(!file)return;
 const msg=$("photoMsg");
 try{
  if(!file.type.startsWith("image/"))throw Error("Vælg en billedfil.");
  if(file.size>5*1024*1024)throw Error("Billedet må højst fylde 5 MB.");
  msg.textContent="Uploader billede…";
  const {data:{user},error:userError}=await db.auth.getUser();
  if(userError)throw userError;
  if(!user)throw Error("Du er ikke logget ind.");
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
  const path=`${user.id}/profil.${ext}`;
  const {error:uploadError}=await db.storage.from("profilbilleder").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});
  if(uploadError)throw uploadError;
  const {data:urlData}=db.storage.from("profilbilleder").getPublicUrl(path);
  const publicUrl=urlData.publicUrl+"?v="+Date.now();
  await rpc("opdater_profilbillede",{billede_url:publicUrl});
  people=await rpc("hent_familie");
  me=people.find(x=>x.id===me.id)||me;
  render();
  msg.textContent="Profilbilledet er gemt.";
 }catch(ex){console.error(ex);msg.textContent="Fejl: "+(ex.message||String(ex))}
 finally{e.target.value=""}
};
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js");boot();
const SUPABASE_URL = "https://hnowbhfopmvroabicfro.supabase.co";
const SUPABASE_KEY = "sb_publishable_p06dNyqgbCai4JQ5ZSdtsg_i-YJzsaE";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let me=null, people=[], tasks=[], completions=[], transactions=[];
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("da-DK",{style:"currency",currency:"DKK"}).format(Number(n||0));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const person=id=>people.find(p=>p.id===id)?.navn||"";
const isParent=()=>me?.rolle==="forælder";

async function rpc(name,args={}){const {data,error}=await db.rpc(name,args);if(error)throw error;return data}
function message(e){alert(e?.message||String(e))}
async function pin(){return new Promise(resolve=>{const d=$("pinDialog"),i=$("pinInput");i.value="";d.showModal();d.addEventListener("close",()=>resolve(d.returnValue==="default"?i.value:null),{once:true});setTimeout(()=>i.focus(),50)})}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session){showLogin();return}
  try{
    const p=await rpc("min_person");
    me=Array.isArray(p)?p[0]:p;
    if(!me) throw new Error("Denne login-bruger er ikke koblet til familien.");
    people=await rpc("hent_familie");
    $("who").textContent=`Logget ind som ${me.navn}`;
    $("login").classList.add("hidden");$("app").classList.remove("hidden");$("logout").classList.remove("hidden");
    $("parentTab").classList.toggle("hidden",!isParent());
    await refresh();
  }catch(e){message(e);await db.auth.signOut();showLogin()}
}
function showLogin(){$("login").classList.remove("hidden");$("app").classList.add("hidden");$("logout").classList.add("hidden");$("who").textContent="Familien"}

async function refresh(){
  const [t,c,x]=await Promise.all([
    db.from("opgaver").select("*").order("created_at",{ascending:false}),
    db.from("udfoerte_opgaver").select("*").order("udfoert_at",{ascending:false}),
    db.from("transaktioner").select("*").order("created_at",{ascending:false})
  ]);
  for(const r of [t,c,x]) if(r.error) throw r.error;
  tasks=t.data||[];completions=c.data||[];transactions=x.data||[];
  renderBalances();renderTasks();renderHistory();renderPending();
}

function renderBalances(){
  for(const n of ["Julius","Rosa"]){
    const p=people.find(x=>x.navn===n);
    const sum=transactions.filter(x=>x.barn_id===p?.id).reduce((a,x)=>a+Number(x.beloeb),0);
    $(n==="Julius"?"saldoJ":"saldoR").textContent=money(sum);
  }
}
function available(task){
  if(isParent()) return true;
  const n=me.navn.toLowerCase();
  if(!(task.tildelt_til===n||task.tildelt_til==="begge"))return false;
  const relevant=completions.filter(c=>c.opgave_id===task.id&&["pending","godkendt"].includes(c.status));
  const now=new Date(), local=d=>new Date(d).toLocaleDateString("da-DK",{timeZone:"Europe/Copenhagen"});
  if(task.gentagelse==="engang") return relevant.length===0;
  if(task.gentagelse==="daglig") return !relevant.some(c=>local(c.udfoert_at)===local(now));
  if(task.gentagelse==="ugentlig"){
    const week=d=>{let x=new Date(new Date(d).toLocaleString("en-US",{timeZone:"Europe/Copenhagen"}));x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x.toISOString().slice(0,10)};
    return !relevant.some(c=>week(c.udfoert_at)===week(now));
  }
  return false;
}
function renderTasks(){
  let list=tasks.filter(t=>t.aktiv).filter(t=>isParent()||t.tildelt_til===me.navn.toLowerCase()||t.tildelt_til==="begge");
  $("taskList").innerHTML=list.length?list.map(t=>{
    const can=available(t), pending=completions.some(c=>c.opgave_id===t.id&&c.status==="pending");
    return `<div class="item"><div class="itemHead"><div><strong>${esc(t.titel)}</strong><div class="muted">${esc(t.beskrivelse||"")} · ${t.gentagelse}</div></div><span class="amount">${money(t.beloeb)}</span></div>
    ${!isParent()?`<div class="actions"><button ${can?"":"disabled"} onclick="doneTask('${t.id}')">${pending?"Afventer godkendelse":can?"Jeg har gjort det":"Allerede udført"}</button></div>`:""}</div>`}).join(""):`<div class="empty">Ingen aktive opgaver lige nu.</div>`;
}
function renderHistory(){
  $("historyList").innerHTML=transactions.length?transactions.map(t=>`<div class="item"><div class="itemHead"><div><strong>${esc(t.beskrivelse)}</strong><div class="muted">${person(t.barn_id)} · ${new Date(t.created_at).toLocaleDateString("da-DK")}</div></div><span class="amount ${Number(t.beloeb)>=0?"positive":"negative"}">${money(t.beloeb)}</span></div></div>`).join(""):`<div class="empty">Ingen posteringer endnu.</div>`;
}
function renderPending(){
  if(!isParent())return;
  const list=completions.filter(c=>c.status==="pending");
  $("pendingList").innerHTML=list.length?list.map(c=>{const t=tasks.find(x=>x.id===c.opgave_id);return `<div class="item"><div class="itemHead"><div><strong>${esc(t?.titel||"Opgave")}</strong><div class="muted">${person(c.barn_id)} · ${new Date(c.udfoert_at).toLocaleString("da-DK")}</div></div><span class="amount">${money(t?.beloeb)}</span></div><div class="actions"><button class="danger" onclick="review('${c.id}',false)">Afvis</button><button onclick="review('${c.id}',true)">Godkend</button></div></div>`}).join(""):`<div class="empty">Intet venter på godkendelse.</div>`;
}

window.doneTask=async id=>{try{await rpc("marker_udfoert",{opgave_uuid:id});await refresh()}catch(e){message(e)}}
window.review=async(id,approve)=>{const p=await pin();if(!p)return;try{await rpc(approve?"godkend_opgave":"afvis_opgave",{udfoert_uuid:id,foraelder_navn:me.navn,pin:p});await refresh()}catch(e){message(e)}}

$("loginBtn").onclick=async()=>{try{$("loginMsg").textContent="Logger ind…";const {error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error)throw error;$("loginMsg").textContent="";await boot()}catch(e){$("loginMsg").textContent=e.message}}
$("logout").onclick=async()=>{await db.auth.signOut();me=null;showLogin()}
$("createTask").onclick=async()=>{const p=await pin();if(!p)return;try{await rpc("opret_opgave",{foraelder_navn:me.navn,pin:p,titel:$("newTitle").value.trim(),beskrivelse:$("newDesc").value.trim(),beloeb:Number($("newAmount").value),tildelt_til:$("newAssignee").value,gentagelse:$("newRepeat").value});$("newTitle").value="";$("newDesc").value="";$("newAmount").value="";await refresh()}catch(e){message(e)}}
$("deductBtn").onclick=async()=>{const p=await pin();if(!p)return;try{await rpc("registrer_fradrag",{barn_navn:$("deductChild").value,beloeb:Number($("deductAmount").value),type:$("deductType").value,beskrivelse:$("deductDesc").value.trim(),foraelder_navn:me.navn,pin:p});$("deductAmount").value="";$("deductDesc").value="";await refresh()}catch(e){message(e)}}
document.querySelectorAll("#nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".tab").forEach(x=>x.classList.add("hidden"));$(b.dataset.tab).classList.remove("hidden")});
db.auth.onAuthStateChange(()=>{});
if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
boot();
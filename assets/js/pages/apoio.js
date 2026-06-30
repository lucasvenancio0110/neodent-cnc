import "../core/config.js";

const API = window.NC_CONFIG.apiBase;
const token = localStorage.getItem("nc_token");
const user = JSON.parse(localStorage.getItem("nc_user") || "null");

if (!token || !user) window.location.href = "login.html";

const OVERRIDE_KEY = "nc_ao_vivo_overrides_v1";
const feed = document.getElementById("tempoRealFeed");
const resumo = document.getElementById("setorResumo");
const eventCount = document.getElementById("eventCount");
const setupCount = document.getElementById("setupCount");
const ajusteCount = document.getElementById("ajusteCount");
const apoioCount = document.getElementById("apoioCount");
const lastUpdate = document.getElementById("lastUpdate");
const clock = document.getElementById("tempoRealClock");
const aoCardModal = document.getElementById("aoCardModal");
const aoModalKind = document.getElementById("aoModalKind");
const aoModalTitle = document.getElementById("aoModalTitle");
const aoModalSub = document.getElementById("aoModalSub");
const aoModalBody = document.getElementById("aoModalBody");
const aoModalMsg = document.getElementById("aoModalMsg");
let latestItems = [];
let activeModalItem = null;

function pad2(n){return String(n).padStart(2,"0");}
function nowTime(){const d=new Date();return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;}
function tick(){if(clock)clock.textContent=nowTime();}
tick();setInterval(tick,1000);

async function api(path,options={}){
  const res=await fetch(API+path,{...options,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...(options.headers||{})}});
  const data=await res.json().catch(()=>null);
  if(!res.ok)throw new Error((data&&data.error)||"Erro na API");
  return data;
}

function clean(v){return String(v||"").trim();}
function upper(v){return clean(v).toUpperCase();}
function safe(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
function parseJson(v){if(!v)return null;if(typeof v==="object")return v;try{return JSON.parse(v)}catch{return null}}
function textOf(o){return `${o.status||""} ${o.motivo||""} ${o.detalhe||""} ${o.observacao||""}`.toLowerCase();}
function tnlOf(o){return clean(o.tnl).padStart(3,"0");}
function userName(){return clean(user.nome||user.name||user.login||"Preparador");}
function detailText(o){return clean(o.detalhe||o.observacao||o.motivo||"").split("\n").filter(Boolean).join(" • ");}

function readOverrides(){try{return JSON.parse(localStorage.getItem(OVERRIDE_KEY)||"{}")}catch{return {}}}
function saveOverrides(map){localStorage.setItem(OVERRIDE_KEY,JSON.stringify(map));}
function applyOverride(item){const key=clean(item._key||item.id||"");const ov=readOverrides()[key];return ov?{...item,...ov,_key:key,_override:ov}:item;}
function saveOverride(patch){if(!activeModalItem?._key)return null;const map=readOverrides();map[activeModalItem._key]={...(map[activeModalItem._key]||{}),...patch};saveOverrides(map);return map[activeModalItem._key];}

function isConcluido(o){return upper(o.status).includes("CONCL")||upper(o.situacao).includes("CONCL")||clean(o.concluido_em);}
function isAndamento(o){return upper(o.status_atividade).includes("ANDAMENTO")||upper(o.situacao).includes("ANDAMENTO")||clean(o.iniciado_em);}
function isAssumido(o){return clean(o.assumido_por_nome||"")||upper(o.status_atividade).includes("ASSUM")||upper(o.situacao).includes("ASSUM");}
function hasApoio(o){return upper(o.status).includes("APOIO")||Number(o.precisa_apoio||0)===1||clean(o.apoio_solicitado_em);}
function isSetup(o){return upper(o.status).includes("SETUP")||textOf(o).includes("setup");}
function isAjuste(o){return upper(o.status).includes("AJUSTE")||textOf(o).includes("ajuste");}
function isManut(o){return upper(o.status).includes("MANUT")||upper(o.status).includes("FALTA")||textOf(o).includes("manutenção")||textOf(o).includes("manutencao")||textOf(o).includes("falta mp");}
function person(o){return clean(o.responsavel_nome||o.responsavel||o.assumido_por_nome||o.aberto_por_nome||o.aberto_por||o.usuario||"Sem dono");}

function setupLevel(o){const t=textOf(o);if(t.includes("setup vermelho"))return{emoji:"🔴",label:"Vermelho"};if(t.includes("setup verde"))return{emoji:"🟢",label:"Verde"};if(t.includes("setup azul"))return{emoji:"🔵",label:"Azul"};return{emoji:"🔵",label:"Setup"};}
function createdAt(o,i){const raw=o.created_at||o.criado_em||o.aberto_em||o.atualizado_em||o.updated_at||"";const ts=Date.parse(raw);return Number.isFinite(ts)?ts:Date.now()-i*1000;}
function rondaData(o){return parseJson(o.payload_ronda)||parseJson(o.payloadRonda)||parseJson(o.payload)||{};}
function forecastOf(o){const data=rondaData(o);const live=data.previsaoViva||data.previsao_viva||data.liveProjection||o.liveProjection||{};const calc=data.calcResumo||data.calc||o.calcResumo||o.calc||{};const end=live.previsao_fim||live.endAt||calc.endAt||o.previsao_fim||o.fim_previsto||o.endAt||"";const ts=Date.parse(end);return Number.isFinite(ts)?{end,ts,live,calc}:null;}
function formatDuration(mins){const v=Math.max(0,Math.round(Math.abs(mins)));if(v>=60){const h=Math.floor(v/60);const m=v%60;return m?`${h}h${pad2(m)}`:`${h}h`;}return `${v}min`;}
function formatDateTime(value){const d=new Date(value);return Number.isFinite(d.getTime())?`${pad2(d.getDate())}/${pad2(d.getMonth()+1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`:"--";}
function countdownInfo(o,now=Date.now()){if(isConcluido(o))return{text:"Concluído",state:"done",end:""};const f=forecastOf(o);if(!f)return{text:"",state:"none",end:""};const diff=Math.ceil((f.ts-now)/60000);if(diff<0)return{text:`Atrasado ${formatDuration(diff)}`,state:"late",end:f.end};if(diff===0)return{text:"Acaba agora",state:"critical",end:f.end};if(diff<=15)return{text:`Acaba em ${formatDuration(diff)}`,state:"critical",end:f.end};if(diff<=60)return{text:`Acaba em ${formatDuration(diff)}`,state:"alert",end:f.end};if(diff<=240)return{text:`Acaba em ${formatDuration(diff)}`,state:"warn",end:f.end};return{text:`Acaba em ${formatDuration(diff)}`,state:"ok",end:f.end};}
function updateLiveCountdowns(){document.querySelectorAll("[data-end]").forEach(node=>{const end=node.getAttribute("data-end");const info=countdownInfo({payload_ronda:{previsaoViva:{previsao_fim:end}}});node.textContent=info.text;node.className=`${node.dataset.baseClass||"ao-countdown"} ${info.state}`.trim();const card=node.closest(".ao-card");if(card){card.classList.remove("clock-ok","clock-warn","clock-alert","clock-critical","clock-late");if(info.state!=="none"&&info.state!=="done")card.classList.add(`clock-${info.state}`);}});}

function uniqueItems(raw){const map=new Map();raw.forEach((item,i)=>{if(!item)return;const id=clean(item.id||`${item.tnl}-${item.status}-${i}`);map.set(id,applyOverride({...item,_key:id,_sort:createdAt(item,i)}));});return Array.from(map.values()).sort((a,b)=>b._sort-a._sort);}
function groupKey(o){if(hasApoio(o))return"apoio";if(isManut(o))return"manut";if(isSetup(o))return"setup";if(isAjuste(o))return"ajuste";return"obs";}
function groupTitle(k){return{setup:"SETUP",ajuste:"AJUSTES",manut:"MANUTENÇÃO PARADA",apoio:"APOIO",obs:"OBSERVAÇÕES"}[k]||k;}
function cardLabel(o,k){if(isConcluido(o))return"Concluído";if(isAndamento(o))return"Em andamento";if(hasApoio(o)&&k==="apoio")return"Aguardando";if(isAssumido(o))return"Assumido";if(k==="setup")return setupLevel(o).label;if(k==="ajuste")return"Ajuste";if(k==="manut")return"Parada";return"Obs.";}
function cardToken(o,k){return k==="setup"?setupLevel(o).emoji:tnlOf(o);}
function sectorCard(o,k,i){const done=isConcluido(o)?"✅":"";const c=countdownInfo(o);const countHtml=c.end?`<small class="ao-countdown ${c.state}" data-base-class="ao-countdown" data-end="${safe(c.end)}">${safe(c.text)}</small>`:`<small>${safe(cardLabel(o,k))}</small>`;const clockClass=c.end&&c.state!=="none"&&c.state!=="done"?` clock-${c.state}`:"";const assign=isAssumido(o)?" assigned":"";return `<button class="ao-card ${k}${clockClass}${assign}" type="button" data-key="${safe(o._key)}" style="--i:${i}"><span>${safe(cardToken(o,k))}</span><strong>${safe(tnlOf(o))}</strong><em>${safe(person(o))}${done}</em>${countHtml}</button>`;}
function renderGroups(items){const groups={setup:[],ajuste:[],manut:[],apoio:[],obs:[]};items.forEach(item=>groups[groupKey(item)].push(item));const order=["setup","ajuste","manut","apoio","obs"];resumo.innerHTML=order.filter(k=>groups[k].length||k!=="obs").map(k=>`<section class="ao-group ${k}"><div class="ao-group-title"><h3>${groupTitle(k)}</h3><span>${groups[k].length}</span></div><div class="ao-grid">${groups[k].length?groups[k].map((item,i)=>sectorCard(item,k,i)).join(""):`<div class="ao-empty">Sem ${groupTitle(k).toLowerCase()}.</div>`}</div></section>`).join("");updateLiveCountdowns();}

function feedTitle(o){const who=person(o);const tnl=tnlOf(o);const level=setupLevel(o);if(isConcluido(o))return `${who} concluiu TNL ${tnl}`;if(isAndamento(o))return `${who} iniciou TNL ${tnl}`;if(hasApoio(o)&&clean(o.apoio_solicitado_por_nome))return `${o.apoio_solicitado_por_nome} pediu apoio na TNL ${tnl}`;if(isAssumido(o))return `${who} assumiu TNL ${tnl}`;if(isSetup(o))return `${who} programou ${level.emoji} setup TNL ${tnl}`;if(isAjuste(o))return `${who} registrou ajuste TNL ${tnl}`;if(isManut(o))return `${who} colocou TNL ${tnl} em manutenção`;return `${who} fez observação na TNL ${tnl}`;}
function liveItem(o,i){const key=groupKey(o);const level=setupLevel(o);const c=countdownInfo(o);const badge=c.end?c.text:cardLabel(o,key);return `<article class="live-item ${key}" style="--i:${i}"><div class="live-dot">${key==="setup"?level.emoji:""}</div><div class="live-content"><strong>${safe(feedTitle(o))}</strong><span>${safe(detailText(o)||"Sem detalhe")}</span><em class="live-count ${c.state}" ${c.end?`data-base-class="live-count" data-end="${safe(c.end)}"`:""}>${safe(badge)}</em></div></article>`;}
function modalField(label,value){return `<div><span>${safe(label)}</span><strong>${safe(value||"--")}</strong></div>`;}
function openCardModal(item){activeModalItem=item;const key=groupKey(item);const f=forecastOf(item);const c=countdownInfo(item);const data=rondaData(item);const live=(f&&f.live)||data.previsaoViva||{};const createdBy=live.criado_por_nome||item.aberto_por_nome||item.aberto_por||item.usuario||"Sistema";const status=item.status_atividade||live.status_atividade||item.situacao||item.status||"Aberto";const detail=detailText(item)||"Sem detalhe registrado.";aoModalKind.textContent=groupTitle(key);aoModalTitle.textContent=`TNL ${tnlOf(item)}`;aoModalSub.textContent=`${cardToken(item,key)} ${cardLabel(item,key)} • ${person(item)}`.trim();aoModalBody.innerHTML=`<section class="ao-modal-main ${key}"><div class="ao-modal-machine"><span>${safe(cardToken(item,key))}</span><strong>${safe(tnlOf(item))}</strong><em>${safe(cardLabel(item,key))}</em></div><div class="ao-modal-clock">${c.end?`<strong class="modal-countdown ${c.state}" data-base-class="modal-countdown" data-end="${safe(c.end)}">${safe(c.text)}</strong><span>Prev. ${safe(formatDateTime(c.end))}</span>`:`<strong>${safe(status)}</strong><span>Sem previsão viva</span>`}</div></section><section class="ao-modal-grid">${modalField("Responsável",person(item))}${modalField("Status",status)}${modalField("Criado por",createdBy)}${modalField("Célula",item.celula||live.celula||"--")}</section><section class="ao-modal-detail"><span>Detalhe</span><p>${safe(detail)}</p></section>`;aoModalMsg.textContent=isConcluido(item)?"Atividade concluída.":"Escolha uma ação.";aoCardModal.hidden=false;document.body.classList.add("modal-open");updateLiveCountdowns();}
function closeCardModal(){activeModalItem=null;aoCardModal.hidden=true;document.body.classList.remove("modal-open");}
function rerenderWithOverrides(message=""){latestItems=latestItems.map(applyOverride);render(latestItems);if(activeModalItem){const updated=latestItems.find(i=>i._key===activeModalItem._key);if(updated){openCardModal(updated);if(message)aoModalMsg.textContent=message;}}}
function doPatch(patch,message){const saved=saveOverride(patch);if(saved)rerenderWithOverrides(message);}
function assumeActiveItem(){const n=userName();doPatch({responsavel_nome:n,responsavel_tipo:"Preparador",assumido_por_nome:n,assumido_por_login:user.login||"",assumido_em:new Date().toISOString(),status_atividade:"assumido",situacao:"ASSUMIDO"},`${n} assumiu essa atividade.`);}
function indicateResponsible(){if(!activeModalItem?._key)return;const current=person(activeModalItem)==="Sem dono"?"":person(activeModalItem);const name=clean(window.prompt("Quem vai fazer essa atividade?",current)||"");if(!name)return;const typeRaw=clean(window.prompt("Tipo: Operador, Preparador, Técnico ou Líder",activeModalItem.responsavel_tipo||"Operador")||"Operador");const type=["Operador","Preparador","Técnico","Líder"].includes(typeRaw)?typeRaw:"Operador";doPatch({responsavel_nome:name,responsavel_tipo:type,responsavel_indicado_por_nome:userName(),responsavel_indicado_em:new Date().toISOString(),status_atividade:"responsavel_indicado",situacao:"RESPONSAVEL_INDICADO"},`${name} indicado como responsável.`);}
function startActiveItem(){const n=person(activeModalItem)==="Sem dono"?userName():person(activeModalItem);doPatch({responsavel_nome:n,status_atividade:"em_andamento",situacao:"EM_ANDAMENTO",iniciado_por_nome:userName(),iniciado_em:new Date().toISOString()},`${userName()} iniciou essa atividade.`);}
function finishActiveItem(){doPatch({status:"CONCLUIDO",status_atividade:"concluido",situacao:"CONCLUIDO",concluido_por_nome:userName(),concluido_em:new Date().toISOString()},`${userName()} concluiu essa atividade.`);}
function observeActiveItem(){const obs=clean(window.prompt("Observação da atividade","")||"");if(!obs)return;const base=clean(activeModalItem.observacao||"");doPatch({observacao:base?`${base}\n${userName()}: ${obs}`:`${userName()}: ${obs}`,observado_por_nome:userName(),observado_em:new Date().toISOString()},"Observação adicionada.");}
function requestSupport(){doPatch({precisa_apoio:1,apoio_status:"AGUARDANDO",apoio_solicitado_por_nome:userName(),apoio_solicitado_em:new Date().toISOString(),status_atividade:"apoio_solicitado",situacao:"APOIO_SOLICITADO"},"Apoio solicitado.");}

function render(items){latestItems=items.map(applyOverride);eventCount.textContent=latestItems.length;setupCount.textContent=latestItems.filter(isSetup).length;ajusteCount.textContent=latestItems.filter(isAjuste).length;apoioCount.textContent=latestItems.filter(hasApoio).length;lastUpdate.textContent=nowTime();renderGroups(latestItems);feed.innerHTML=latestItems.length?latestItems.slice(0,12).map(liveItem).join(""):`<div class="empty-state">Sem atualização no momento.</div>`;updateLiveCountdowns();}
resumo.addEventListener("click",e=>{const card=e.target.closest(".ao-card");if(!card)return;const item=latestItems.find(entry=>entry._key===card.dataset.key);if(item)openCardModal(item);});
aoCardModal.addEventListener("click",e=>{if(e.target.closest("[data-close-ao-modal]"))closeCardModal();const btn=e.target.closest("[data-future-action]");if(!btn)return;const action=btn.dataset.futureAction;if(action==="assumir")assumeActiveItem();else if(action==="responsavel")indicateResponsible();else if(action==="iniciar")startActiveItem();else if(action==="concluir")finishActiveItem();else if(action==="observacao")observeActiveItem();else if(action==="apoio")requestSupport();});
async function load(){try{const[painelRes,apoioRes]=await Promise.allSettled([api("/painel-geral"),api("/apoio")]);const painelItems=painelRes.status==="fulfilled"?(painelRes.value.ocorrencias||[]):[];const apoioItems=apoioRes.status==="fulfilled"?(apoioRes.value.apoio||[]):[];render(uniqueItems([...painelItems,...apoioItems]));}catch(err){resumo.innerHTML=`<div class="empty-state">${safe(err.message)}</div>`;feed.innerHTML="";}}
load();setInterval(load,10000);setInterval(updateLiveCountdowns,1000);

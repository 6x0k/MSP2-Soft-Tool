// 6x0k Space Clean — service worker
// No webRequest permission, password capture, credential vault, telemetry,
// remote kill-switch, third-party API calls, or credential persistence.

const HOST_MATCHES = [
  "https://moviestarplanet2.com/*",
  "https://*.moviestarplanet2.com/*",
];

const PACK = {
  app: "app.js",
  boot: "boot.js",
  seed: "seed.js",
  d1: "d1.json",
  d2: "d2.json",
  d3: "d3.json",
  softIds: "soft-ids.json",
};

const ID_ISO="cs-iso-clean";
const ID_MAIN="cs-main-clean";
const ID_SEED="cs-s0-clean";

let MAIN_FILES=[PACK.app], ISO_FILES=[PACK.boot], SEED_FILES=[PACK.seed];
let _layoutReady=null;
const _jsonCache=new Map();
const _dbgAttached=new Set();
const _coreInjectedTabs=new Set();

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

async function resolvePackLayout(){
  if(_layoutReady) return _layoutReady;
  _layoutReady=(async()=>{
    try{
      const r=await fetch(chrome.runtime.getURL(PACK.app));
      if(r.ok){
        MAIN_FILES=[PACK.app]; ISO_FILES=[PACK.boot]; SEED_FILES=[PACK.seed];
        return "flat";
      }
    }catch{}
    MAIN_FILES=[`dist/${PACK.app}`];
    ISO_FILES=[`dist/${PACK.boot}`];
    SEED_FILES=[`dist/${PACK.seed}`];
    return "dist";
  })();
  return _layoutReady;
}

// ---------- Unity CDP input ----------
function dbgTarget(tabId){return {tabId};}
async function dbgAttach(tabId){
  if(_dbgAttached.has(tabId)) return true;
  try{
    await chrome.debugger.attach(dbgTarget(tabId),"1.3");
    _dbgAttached.add(tabId); return true;
  }catch(e){
    if(/already attached/i.test(String(e?.message||e))){
      _dbgAttached.add(tabId); return true;
    }
    throw e;
  }
}
async function dbgDetach(tabId){
  try{await chrome.debugger.detach(dbgTarget(tabId));}catch{}
  _dbgAttached.delete(tabId); return true;
}
async function dbgSend(tabId,method,params){
  return chrome.debugger.sendCommand(dbgTarget(tabId),method,params||{});
}
async function cdpBringFront(tabId){try{await dbgSend(tabId,"Page.bringToFront");}catch{}}
async function cdpClick(tabId,x,y){
  const cx=Math.round(Number(x)),cy=Math.round(Number(y));
  if(!Number.isFinite(cx)||!Number.isFinite(cy)) throw new Error("bad coords");
  const fresh=!_dbgAttached.has(tabId);
  await dbgAttach(tabId);
  if(fresh) await sleep(400);
  await cdpBringFront(tabId);
  await dbgSend(tabId,"Input.dispatchMouseEvent",{type:"mouseMoved",x:cx,y:cy,button:"none",buttons:0,pointerType:"mouse"});
  await sleep(40);
  await dbgSend(tabId,"Input.dispatchMouseEvent",{type:"mousePressed",x:cx,y:cy,button:"left",buttons:1,clickCount:1,pointerType:"mouse"});
  await sleep(55);
  await dbgSend(tabId,"Input.dispatchMouseEvent",{type:"mouseReleased",x:cx,y:cy,button:"left",buttons:0,clickCount:1,pointerType:"mouse"});
  return true;
}
function vk(ch){
  if(ch==="\n"||ch==="\r")return 13;
  if(ch==="\t")return 9;
  if(ch===" ")return 32;
  const u=String(ch).toUpperCase();
  if(u.length===1&&u>="A"&&u<="Z")return u.charCodeAt(0);
  if(ch>="0"&&ch<="9")return ch.charCodeAt(0);
  return ch.charCodeAt(0);
}
function code(ch){
  if(ch==="\n"||ch==="\r")return "Enter";
  if(ch==="\t")return "Tab";
  if(ch===" ")return "Space";
  if(/^[a-zA-Z]$/.test(ch))return "Key"+ch.toUpperCase();
  if(/^[0-9]$/.test(ch))return "Digit"+ch;
  return "";
}
async function cdpType(tabId,text){
  const s=String(text||""); if(!s)return true;
  await dbgAttach(tabId); await cdpBringFront(tabId);
  for(const ch of s){
    const k=vk(ch),c=code(ch),printable=ch.length===1&&ch>=" "&&ch!=="\x7f";
    const base={windowsVirtualKeyCode:k,nativeVirtualKeyCode:k,
      key:(ch==="\n"||ch==="\r")?"Enter":ch,code:c||undefined,
      unmodifiedText:printable?ch:undefined,text:printable?ch:undefined};
    await dbgSend(tabId,"Input.dispatchKeyEvent",{type:"keyDown",...base});
    if(printable){try{await dbgSend(tabId,"Input.dispatchKeyEvent",{type:"char",...base});}catch{}}
    await dbgSend(tabId,"Input.dispatchKeyEvent",{type:"keyUp",windowsVirtualKeyCode:k,nativeVirtualKeyCode:k,key:base.key,code:c||undefined});
    await sleep(16);
  }
  return true;
}
chrome.debugger.onDetach.addListener(s=>{if(typeof s?.tabId==="number")_dbgAttached.delete(s.tabId);});

// ---------- Content-script registration ----------
async function injectHeavyCore(tabId,reason){
  if(!tabId)return {ok:false,error:"no_tab"};
  if(_coreInjectedTabs.has(tabId))return {ok:true,already:true};
  await resolvePackLayout();
  try{
    await chrome.scripting.executeScript({target:{tabId,allFrames:true},files:MAIN_FILES,world:"MAIN"});
    _coreInjectedTabs.add(tabId);
    return {ok:true,reason:reason||"play"};
  }catch(e){return {ok:false,error:String(e?.message||e)}}
}
async function registerAll(){
  await resolvePackLayout();
  try{
    const old=await chrome.scripting.getRegisteredContentScripts({ids:[ID_ISO,ID_MAIN,ID_SEED,"cs-iso","cs-main","cs-watch","cs-stub","cs-s0"]});
    if(old?.length)await chrome.scripting.unregisterContentScripts({ids:old.map(x=>x.id)});
  }catch{}
  try{
    await chrome.scripting.registerContentScripts([
      {id:ID_MAIN,matches:HOST_MATCHES,js:MAIN_FILES,runAt:"document_start",allFrames:true,persistAcrossSessions:true,world:"MAIN"},
      {id:ID_ISO,matches:HOST_MATCHES,js:ISO_FILES,runAt:"document_start",allFrames:true,persistAcrossSessions:true},
      // Seed is intentionally empty but kept for package compatibility.
      {id:ID_SEED,matches:HOST_MATCHES,js:SEED_FILES,runAt:"document_start",allFrames:true,persistAcrossSessions:true,world:"MAIN"}
    ]);
  }catch{}
}
async function injectIntoTab(tab){
  if(!tab?.id||!/^https:\/\/([a-z0-9-]+\.)?moviestarplanet2\.com\//i.test(tab.url||""))return;
  try{await resolvePackLayout();}catch{}
  try{await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},files:ISO_FILES});}catch{}
  try{await injectHeavyCore(tab.id,"action");}catch{}
}
chrome.runtime.onInstalled.addListener(()=>{registerAll().catch(()=>{});});
chrome.runtime.onStartup.addListener(()=>{registerAll().catch(()=>{});});
chrome.tabs.onUpdated.addListener((tabId,info)=>{if(info?.status==="loading")_coreInjectedTabs.delete(tabId);});
chrome.tabs.onRemoved.addListener(tabId=>_coreInjectedTabs.delete(tabId));
chrome.action?.onClicked?.addListener(injectIntoTab);
registerAll().catch(()=>{});

// ---------- Local data packs ----------
async function readJSON(logical){
  const map={
    d1:[PACK.d1,`dist/${PACK.d1}`],
    d2:[PACK.d2,`dist/${PACK.d2}`],
    d3:[PACK.d3,`dist/${PACK.d3}`],
    softids:[PACK.softIds,`dist/${PACK.softIds}`],
  };
  const key=String(logical||"").toLowerCase();
  const aliases={homes:"d1",questions:"d2",emojis:"d3",softids:"softids"};
  const k=aliases[key]||key;
  if(_jsonCache.has(k))return _jsonCache.get(k);
  for(const path of (map[k]||[logical,`dist/${logical}`])){
    try{
      const r=await fetch(chrome.runtime.getURL(path));
      if(r.ok){
        const data=await r.json(); _jsonCache.set(k,data);
        if(k==="d3"){_jsonCache.set("emojis",data);}
        return data;
      }
    }catch{}
  }
  return null;
}
function homesLight(homes){
  if(!Array.isArray(homes))return [];
  return homes.filter(h=>h&&typeof h.name==="string"&&h.name)
    .map(h=>({name:h.name,bundled:true,hasBson:!!(h.bson_data&&String(h.bson_data).length),
      hasImg:!!(h.img&&String(h.img).length),img:""}));
}
async function homeFullByName(name){
  const key=String(name||"").trim(); if(!key)return null;
  const homes=await readJSON("d1"); if(!Array.isArray(homes))return null;
  const h=homes.find(x=>x&&x.name===key); if(!h)return null;
  return {name:h.name,img:typeof h.img==="string"?h.img:"",bson_data:typeof h.bson_data==="string"?h.bson_data:"",bundled:true};
}

// ---------- Runtime messages ----------
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(!msg||typeof msg!=="object")return false;

  if(msg.type==="xb:home"){
    homeFullByName(msg.name).then(home=>sendResponse(home&&home.bson_data?{ok:true,home}:{ok:false,error:"home-not-found"}))
      .catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
    return true;
  }
  if(msg.type==="xb:pack"){
    readJSON("d3").then(emojis=>sendResponse(emojis?{ok:true,emojis}:{ok:false,error:"emojis-not-found"}))
      .catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
    return true;
  }
  if(msg.type==="xb:prefetch"){
    (async()=>{
      try{
        for(const p of (Array.isArray(msg.packs)?msg.packs:["d1","d2"])){
          await readJSON(p); await sleep(10);
        }
        sendResponse({ok:true});
      }catch(e){sendResponse({ok:false,error:String(e?.message||e)})}
    })();
    return true;
  }
  if(msg.type==="xb:catalog"){
    (async()=>{
      try{
        if(["softids","soft-ids","ids"].includes(String(msg.pack||"").toLowerCase())){
          sendResponse({ok:true,data:(await readJSON("softids"))||{}});
          return;
        }
        const [homes,questions]=await Promise.all([readJSON("d1"),readJSON("d2")]);
        sendResponse({ok:true,homes:homesLight(homes),questions:questions&&typeof questions==="object"?questions:{}});
      }catch(e){sendResponse({ok:false,error:String(e?.message||e)})}
    })();
    return true;
  }
  if(msg.type==="xb:input"){
    const tabId=sender?.tab?.id;
    if(typeof tabId!=="number"){sendResponse({ok:false,error:"no-tab"});return false;}
    (async()=>{
      try{
        const op=String(msg.op||"");
        if(op==="attach"){await dbgAttach(tabId);sendResponse({ok:true,via:"cdp"});return;}
        if(op==="detach"){await dbgDetach(tabId);sendResponse({ok:true,via:"cdp"});return;}
        if(op==="click"){await cdpClick(tabId,msg.x,msg.y);sendResponse({ok:true,via:"cdp"});return;}
        if(op==="type"){await cdpType(tabId,msg.text);sendResponse({ok:true,via:"cdp"});return;}
        sendResponse({ok:false,error:"bad-op"});
      }catch(e){sendResponse({ok:false,error:String(e?.message||e)})}
    })();
    return true;
  }
  if(msg.type==="xb:sync"){
    // Only non-secret identity metadata is accepted.
    sendResponse({ok:true,hadPassword:false});
    return false;
  }
  if(msg.type==="xb:clearPresence"){
    sendResponse({ok:true}); return false;
  }
  if(msg.type==="xb:getGate"){
    sendResponse({ok:true,gate:{allowed:true,reason:"clean-build"}}); return false;
  }
  if(msg.type==="xb:heartbeat"){
    sendResponse({ok:true,gate:{allowed:true,reason:"clean-build"}}); return false;
  }
  if(msg.type==="xb:feedback"){
    sendResponse({ok:false,error:"remote-feedback-disabled",code:"disabled"}); return false;
  }
  if(msg.type==="xb:session"||msg.type==="xb:credGet"||msg.type==="xb:credSet"){
    sendResponse({ok:false,error:"credential-storage-disabled",password:null}); return false;
  }
  if(msg.type==="xb:injectMain"){
    injectHeavyCore(sender?.tab?.id,msg.why).then(sendResponse).catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
    return true;
  }
  return false;
});

chrome.runtime.onMessage.addListener((msg,_sender,sendResponse)=>{
  if(msg?.type!=="xb-clipboard-write")return false;
  const text=String(msg.text||""); if(!text){sendResponse({ok:false});return true;}
  navigator.clipboard?.writeText?.(text).then(()=>sendResponse({ok:true})).catch(()=>sendResponse({ok:false}));
  return true;
});

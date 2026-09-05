(function(){
  const cfg = window.MINI_APP_CONFIG;
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");

  function freshState(){
    return {
      sceneId:null,
      options:[],
      answers:[],
      history:[],
      scores:{},
      data:{},
      createdAt:Date.now()
    };
  }

  class MiniAppEngine{
    constructor(config){
      this.config=config;
      this.state=this.load() || freshState();
      this.scenes={};
      this.applyTheme();
    }
    applyTheme(){
      const t=this.config.theme||{};
      const r=document.documentElement.style;
      if(t.background)r.setProperty("--bg",t.background);
      if(t.surface)r.setProperty("--surface",t.surface);
      if(t.text)r.setProperty("--text",t.text);
      if(t.muted)r.setProperty("--muted",t.muted);
      if(t.accent)r.setProperty("--accent",t.accent);
      if(t.radius)r.setProperty("--radius",t.radius);
    }
    register(scenes){ this.scenes=scenes; }
    save(){ localStorage.setItem(this.config.storageKey,JSON.stringify(this.state)); }
    load(){
      try{return JSON.parse(localStorage.getItem(this.config.storageKey));}
      catch(e){return null}
    }
    reset(){
      localStorage.removeItem(this.config.storageKey);
      this.state=freshState();
    }
    option(label, source="preset"){
      return {id:"o_"+Math.random().toString(36).slice(2,9),label:String(label).trim(),source,active:true,wins:0,losses:0};
    }
    addOption(label,source="user"){
      const o=this.option(label,source);
      this.state.options.push(o);this.save();return o;
    }
    setOptions(labels){
      this.state.options=labels.map(x=>typeof x==="string"?this.option(x):this.option(x.label,x.source||"preset"));
      this.save();
    }
    activeOptions(){return this.state.options.filter(o=>o.active)}
    getOption(id){return this.state.options.find(o=>o.id===id)}
    record(type,payload={}){
      this.state.history.push({type,payload,at:Date.now()});
      this.save();
    }
    answer(sceneId,value,extra={}){
      this.state.answers.push({sceneId,value,...extra,at:Date.now()});
      this.save();
    }
    score(key,delta){this.state.scores[key]=(this.state.scores[key]||0)+delta;this.save()}
    go(id){
      const scene=this.scenes[id];
      if(!scene) throw new Error("Unknown scene: "+id);
      this.state.sceneId=id;this.save();
      scene(this);
    }
    shell(inner,progress){
      app.innerHTML=`<section class="screen">${progress?this.progress(progress.current,progress.total):""}${inner}</section>`;
    }
    progress(current,total){
      return `<div class="progress" aria-label="Прогресс">${Array.from({length:total},(_,i)=>`<span class="dot ${i<current?"on":""}"></span>`).join("")}</div>`;
    }
    start({eyebrow="",title,text,button="Начать",onNext}){
      this.shell(`<div class="eyebrow">${this.esc(eyebrow)}</div><h1>${this.esc(title)}</h1><p>${this.esc(text)}</p><div class="actions"><button class="primary" id="next">${this.esc(button)}</button></div>`);
      document.getElementById("next").onclick=onNext;
    }
    choice({title,text="",options,allowCustom=false,customLabel="✏️ Свой вариант",progress,onChoose,onCustom}){
      const cards=options.map(o=>`<button class="card ${o.source==="user"?"user":""}" data-id="${o.id}">${this.esc(o.label)}</button>`).join("");
      const custom=allowCustom?`<button class="card" id="custom">${this.esc(customLabel)}</button>`:"";
      this.shell(`<h2>${this.esc(title)}</h2>${text?`<p>${this.esc(text)}</p>`:""}<div class="stack">${cards}${custom}</div>`,progress);
      app.querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>onChoose(this.getOption(b.dataset.id)));
      if(allowCustom)document.getElementById("custom").onclick=()=>onCustom();
    }
    input({title,text="",placeholder="Напиши свой вариант",button="Добавить",progress,onSubmit}){
      this.shell(`<h2>${this.esc(title)}</h2>${text?`<p>${this.esc(text)}</p>`:""}<div class="input-row"><input class="input" id="input" maxlength="80" placeholder="${this.esc(placeholder)}"><button class="primary" id="submit">${this.esc(button)}</button></div><p class="note">До 80 символов. Этот вариант будет реально использован дальше.</p>`,progress);
      const input=document.getElementById("input");
      const submit=()=>{const v=input.value.trim();if(v)onSubmit(v)};
      document.getElementById("submit").onclick=submit;
      input.onkeydown=e=>{if(e.key==="Enter")submit()};
      setTimeout(()=>input.focus(),50);
    }
    duel({title,a,b,progress,onChoose}){
      this.shell(`<h2>${this.esc(title)}</h2><div class="stack"><button class="card" data-pick="${a.id}">${this.esc(a.label)}</button><div class="vs">VS</div><button class="card" data-pick="${b.id}">${this.esc(b.label)}</button></div>`,progress);
      app.querySelectorAll("[data-pick]").forEach(btn=>btn.onclick=()=>{
        const winner=this.getOption(btn.dataset.pick);
        const loser=winner.id===a.id?b:a;
        winner.wins++;loser.losses++;
        this.record("duel",{winner:winner.label,loser:loser.label});
        onChoose(winner,loser);
      });
    }
    eliminate({title,options,progress,onChoose}){
      this.choice({title,options,progress,onChoose:(o)=>{
        const el=app.querySelector(`[data-id="${o.id}"]`);
        if(el)el.classList.add("removed");
        o.active=false;this.record("eliminate",{label:o.label});
        setTimeout(()=>onChoose(o),260);
      }});
    }
    message({eyebrow="",title,text="",button="Дальше",progress,onNext}){
      this.shell(`<div class="eyebrow">${this.esc(eyebrow)}</div><h2>${this.esc(title)}</h2>${text?`<p>${this.esc(text)}</p>`:""}<div class="actions"><button class="primary" id="next">${this.esc(button)}</button></div>`,progress);
      document.getElementById("next").onclick=onNext;
    }
    result({eyebrow="Результат",title,text,history=[],onRestart,onWhy,onShare}){
      this.shell(`<div class="result"><div class="eyebrow">${this.esc(eyebrow)}</div><div class="result-title">${this.esc(title)}</div><p>${this.esc(text)}</p>${history.length?`<div class="history">${history.map(x=>`<div class="history-item">${this.esc(x)}</div>`).join("")}</div>`:""}</div><div class="actions"><button class="primary" id="share">↗ Поделиться</button><button class="secondary" id="restart">↻ Ещё раз</button><button class="text-btn" id="why">Почему такой результат?</button></div>`);
      document.getElementById("restart").onclick=onRestart;
      document.getElementById("why").onclick=onWhy;
      document.getElementById("share").onclick=onShare;
    }
    modal(title,text){
      modalRoot.innerHTML=`<div class="modal-backdrop" id="backdrop"><div class="modal"><h2>${this.esc(title)}</h2><p>${this.esc(text)}</p><div class="actions"><button class="primary" id="close">Понятно</button></div></div></div>`;
      const close=()=>modalRoot.innerHTML="";
      document.getElementById("close").onclick=close;
      document.getElementById("backdrop").onclick=e=>{if(e.target.id==="backdrop")close()};
    }
    async share({title,text,url=location.href}){
      try{
        if(navigator.share){await navigator.share({title,text,url});return}
        await navigator.clipboard.writeText(`${text} ${url}`);
        this.modal("Скопировано","Текст и ссылка скопированы. Можно отправлять.");
      }catch(e){}
    }
    esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
  }
  window.MiniAppEngine=MiniAppEngine;
})();

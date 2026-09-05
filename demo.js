const engine = new MiniAppEngine(window.MINI_APP_CONFIG);

function ensureBaseOptions(){
  if(!engine.state.options.length){
    engine.setOptions(["🎬 Кино","🍕 Вкусная еда","🎮 Игры","🛋 Диван"]);
  }
}
function chooseDifferent(exceptId){
  return engine.activeOptions().find(o=>o.id!==exceptId) || engine.state.options.find(o=>o.id!==exceptId);
}
function summary(){
  return engine.state.history.slice(-4).map(h=>{
    if(h.type==="custom")return `Ты добавил свой вариант: ${h.payload.label}`;
    if(h.type==="duel")return `${h.payload.winner} победил вариант «${h.payload.loser}».`;
    if(h.type==="eliminate")return `Ты отказался от варианта «${h.payload.label}».`;
    if(h.type==="choice")return `Ты выбрал: ${h.payload.label}.`;
    return h.type;
  });
}
function bestOption(){
  const active=engine.activeOptions();
  return [...(active.length?active:engine.state.options)].sort((a,b)=>(b.wins-b.losses)-(a.wins-a.losses))[0];
}

const scenes = {
  start(e){
    ensureBaseOptions();
    e.start({
      eyebrow:"Mini App Engine · v0.1",
      title:"Проверим двигатель.",
      text:"Шесть коротких экранов. Заодно проверим, что твой собственный вариант не потеряется.",
      button:"Поехали →",
      onNext:()=>e.go("choice")
    });
  },
  choice(e){
    e.choice({
      title:"Что бы ты выбрал на свободный вечер?",
      text:"Можно выбрать готовое или добавить вообще что угодно.",
      options:e.activeOptions(),
      allowCustom:true,
      progress:{current:1,total:4},
      onChoose:o=>{
        e.state.data.firstPick=o.id;
        e.record("choice",{label:o.label});
        e.answer("choice",o.id);
        e.go("duel");
      },
      onCustom:()=>e.go("custom")
    });
  },
  custom(e){
    e.input({
      title:"Свой вариант",
      text:"Напиши как есть. Движку не нужно понимать смысл, чтобы использовать его в выборе.",
      progress:{current:1,total:4},
      onSubmit:value=>{
        const o=e.addOption(value,"user");
        e.state.data.firstPick=o.id;
        e.state.data.customId=o.id;
        e.record("custom",{label:o.label});
        e.answer("custom",o.id);
        e.save();
        e.go("duel");
      }
    });
  },
  duel(e){
    const picked=e.getOption(e.state.data.firstPick) || e.activeOptions()[0];
    const rival=chooseDifferent(picked.id);
    e.duel({
      title:picked.source==="user"?"Твой вариант сразу в игре":"Теперь дуэль",
      a:picked,b:rival,
      progress:{current:2,total:4},
      onChoose:(winner)=>{
        e.state.data.duelWinner=winner.id;
        e.save();
        e.go("eliminate");
      }
    });
  },
  eliminate(e){
    const opts=e.activeOptions();
    e.eliminate({
      title:"От чего проще отказаться?",
      options:opts,
      progress:{current:3,total:4},
      onChoose:()=>e.go("message")
    });
  },
  message(e){
    e.message({
      eyebrow:"Так-так…",
      title:"Мы всё про тебя поняли.",
      text:"Или делаем очень уверенный вид. Сейчас посмотрим.",
      button:"Страшно, но показывай",
      progress:{current:4,total:4},
      onNext:()=>e.go("result")
    });
  },
  result(e){
    const best=bestOption();
    e.result({
      title:best?best.label:"🦝 Енот-стратег",
      text:"Это демонстрационный результат. В настоящем приложении здесь будет вывод из истории твоих решений.",
      history:summary(),
      onRestart:()=>{e.reset();e.go("start")},
      onWhy:()=>e.modal("Почему?","Движок сохранил твои действия: готовые и пользовательские варианты, победы в дуэлях и исключения. Поэтому приложение может объяснять результат, а не просто выдавать случайный ответ."),
      onShare:()=>e.share({title:"Mini App Engine",text:`Я протестировал Mini App Engine. Мой демо-результат: ${best?best.label:"Енот-стратег"}.`})
    });
  }
};

engine.register(scenes);

// Небольшая тестовая кнопка. Добавляем ?test=1 к адресу, чтобы увидеть её.
if(new URLSearchParams(location.search).get("test")==="1"){
  const bar=document.createElement("div");
  bar.className="testbar";
  bar.innerHTML='<button type="button">⚙ TEST</button>';
  bar.querySelector("button").onclick=()=>{
    engine.modal("TEST","Для v0.1 тест-режим подтверждает, что служебная панель может включаться только параметром ?test=1. Расширим её после первого реального приложения, если это действительно понадобится.");
  };
  document.body.appendChild(bar);
}

const resumable=engine.state.sceneId && engine.state.sceneId!=="result";
if(resumable){
  engine.start({
    eyebrow:"Незавершённое прохождение",
    title:"Продолжим?",
    text:"Движок сохранил состояние на этом устройстве.",
    button:"Продолжить",
    onNext:()=>engine.go(engine.state.sceneId)
  });
  const screen=document.querySelector(".screen");
  const actions=screen.querySelector(".actions");
  const reset=document.createElement("button");
  reset.className="secondary";
  reset.textContent="Начать заново";
  reset.onclick=()=>{engine.reset();engine.go("start")};
  actions.appendChild(reset);
}else{
  engine.go(engine.state.sceneId==="result"?"result":"start");
}

let currentSaju = null;
let selectedPersona = '현실적인 도사';
let flow = 'career';
let selectedCards = [];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const api = async (path, body) => {
  const r = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d = await r.json();
  if(!r.ok) throw new Error(d.error || '요청에 실패했습니다.');
  return d;
};
const setLoading=(el,msg='Astra가 해석 중입니다…')=>{el.textContent=msg;el.classList.add('loading')};
const setOutput=(el,text)=>{el.textContent=text;el.classList.remove('loading')};

const personas=[
  ['🜁','현실적인 도사','차분하고 구체적'],
  ['🌙','다정한 무녀','공감 중심'],
  ['⚔️','팩폭 사주가','돌려 말하지 않음'],
  ['💘','연애 전문','관계와 감정 집중'],
  ['💰','재물 전문','일·돈·기회 집중']
];
$('#personas').innerHTML=personas.map((p,i)=>`<button class="persona ${i===0?'active':''}" data-persona="${p[1]}"><div class="face">${p[0]}</div><b>${p[1]}</b><small>${p[2]}</small></button>`).join('');
$$('.persona').forEach(b=>b.onclick=()=>{$$('.persona').forEach(x=>x.classList.remove('active'));b.classList.add('active');selectedPersona=b.dataset.persona});

const tarotCards=['바보','마법사','여사제','여황제','황제','연인','전차','힘','은둔자','운명의 수레바퀴','정의','매달린 사람','죽음','절제','악마','탑','별','달','태양','심판','세계'];
const tarotDeck=[...tarotCards].sort(()=>Math.random()-.5).slice(0,12);
$('#tarotDeck').innerHTML=tarotDeck.map((c,i)=>`<button class="tarot-card" data-card="${c}">✦<br>${i+1}</button>`).join('');
$$('.tarot-card').forEach(b=>b.onclick=()=>{
  const c=b.dataset.card;
  if(b.classList.contains('selected')){b.classList.remove('selected');selectedCards=selectedCards.filter(x=>x!==c)}
  else if(selectedCards.length<3){b.classList.add('selected');b.innerHTML=`${c}`;selectedCards.push(c)}
});

$('#birthForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const f=new FormData(e.currentTarget); const body=Object.fromEntries(f.entries());
  body.leapMonth=f.get('leapMonth')==='on';
  $('#birthStatus').textContent='만세력 계산 중…';
  try{
    currentSaju=await api('/api/saju',body);
    localStorage.setItem('fate-profile',JSON.stringify(currentSaju));
    renderProfile(currentSaju);
    $('#profile').classList.remove('hidden');
    $('#birthStatus').textContent='운명 프로필이 생성되었습니다.';
    $('#profile').scrollIntoView({behavior:'smooth'});
  }catch(err){$('#birthStatus').textContent='입력값을 확인해주세요: '+err.message}
});

function renderProfile(s){
  $('#profileName').textContent=s.name||'당신';
  $('#codeLine').textContent=`${s.pillars.year} · ${s.pillars.month} · ${s.pillars.day} · ${s.pillars.hour}`;
  const labels={year:'연주',month:'월주',day:'일주',hour:'시주'};
  $('#pillars').innerHTML=['year','month','day','hour'].map(k=>`<div class="pillar"><small>${labels[k]}</small><b>${s.pillars[k]}</b><em>${s.hanja?.[k]||''}</em></div>`).join('');
  const total=Object.values(s.elements).reduce((a,b)=>a+b,0)||1;
  const sorted=Object.entries(s.elements).sort((a,b)=>b[1]-a[1]);
  $('#dominantElement').textContent=`가장 강한 기운 · ${sorted[0][0]}`;
  $('#elementBars').innerHTML=Object.entries(s.elements).map(([k,v])=>`<div class="element-row"><span>${k}</span><div class="bar"><i style="width:${v/total*100}%"></i></div><b>${Math.round(v/total*100)}%</b></div>`).join('');
  drawRadar(s.scores); renderTimeline();
  $('#dailyScore').textContent=`오늘 ${s.daily.score} / 100`;
  $('#dailyContent').innerHTML=`<div><small>오늘의 키워드</small><b>${s.daily.keyword}</b></div><div><small>주의</small><b>${s.daily.caution}</b></div><div><small>행운 시간</small><b>${s.daily.luckyTime}</b></div><div><small>행운 장소</small><b>${s.daily.luckyPlace}</b></div>`;
  const cluster=sorted.slice(0,2).map(x=>x[0]).join('·');
  $('#clusterSigil').textContent=sorted[0][0];
  $('#clusterText').textContent=`당신은 현재 “${cluster}형” 클러스터입니다. ${sorted[0][0]}의 에너지가 중심이고 ${sorted[1][0]}가 보조하는 형태로 분류됩니다.`;
}

function drawRadar(scores){
  const c=$('#radar'),ctx=c.getContext('2d');const w=c.width,h=c.height,cx=w/2,cy=h/2+5,R=Math.min(w,h)*.34;
  const entries=Object.entries(scores),n=entries.length;ctx.clearRect(0,0,w,h);ctx.font='13px sans-serif';ctx.textAlign='center';
  for(let ring=1;ring<=5;ring++){ctx.beginPath();entries.forEach((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n,x=cx+Math.cos(a)*R*ring/5,y=cy+Math.sin(a)*R*ring/5;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.strokeStyle='#34344e';ctx.stroke()}
  entries.forEach(([name],i)=>{const a=-Math.PI/2+i*2*Math.PI/n,x=cx+Math.cos(a)*(R+32),y=cy+Math.sin(a)*(R+25);ctx.fillStyle='#bdb8c9';ctx.fillText(name,x,y)});
  ctx.beginPath();entries.forEach(([_,v],i)=>{const a=-Math.PI/2+i*2*Math.PI/n,r=R*v/100,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fillStyle='#9b7cff33';ctx.fill();ctx.strokeStyle='#bd8cff';ctx.lineWidth=2;ctx.stroke();
}
function renderTimeline(){if(!currentSaju)return;$('#timeline').innerHTML=currentSaju.timeline.map(x=>`<div class="year-bar"><i style="height:${Math.max(25,x[flow]*1.8)}px"></i><b>${x.year}</b><small>${x[flow]}</small></div>`).join('')}
$$('.seg button').forEach(b=>b.onclick=()=>{$$('.seg button').forEach(x=>x.classList.remove('active'));b.classList.add('active');flow=b.dataset.flow;renderTimeline()});

$('#interpretBtn').onclick=async()=>{if(!currentSaju)return alert('먼저 사주 프로필을 만들어주세요.');setLoading($('#interpretOutput'));try{const d=await api('/api/interpret',{saju:currentSaju,persona:selectedPersona,focus:$('#focus').value});setOutput($('#interpretOutput'),d.text)}catch(e){setOutput($('#interpretOutput'),e.message)}};
$('#decisionBtn').onclick=async()=>{if(!currentSaju)return alert('먼저 사주 프로필을 만들어주세요.');const options=[$('#optionA').value,$('#optionB').value,$('#optionC').value].filter(Boolean);setLoading($('#decisionOutput'));try{const d=await api('/api/decision',{saju:currentSaju,question:$('#decisionQ').value,options});setOutput($('#decisionOutput'),d.text)}catch(e){setOutput($('#decisionOutput'),e.message)}};
$('#compatBtn').onclick=async()=>{if(!currentSaju)return alert('내 사주 프로필을 먼저 만들어주세요.');setLoading($('#compatOutput'),'상대 사주를 계산하고 궁핣 지도를 만드는 중…');try{const b=await api('/api/saju',{name:$('#bName').value||'상대',year:$('#bYear').value,month:$('#bMonth').value,day:$('#bDay').value,hour:$('#bHour').value||12,minute:0,calendar:$('#bCalendar').value,gender:$('#bGender').value});const d=await api('/api/compatibility',{a:currentSaju,b,relation:$('#relation').value});setOutput($('#compatOutput'),d.text)}catch(e){setOutput($('#compatOutput'),e.message)}};
$('#tarotBtn').onclick=async()=>{if(selectedCards.length!==3)return alert('카드 3장을 선택해주세요.');setLoading($('#tarotOutput'));try{const d=await api('/api/tarot',{question:$('#tarotQ').value,cards:selectedCards});setOutput($('#tarotOutput'),d.text)}catch(e){setOutput($('#tarotOutput'),e.message)}};
$('#mbtiBtn').onclick=async()=>{if(!currentSaju)return alert('먼저 사주 프로필을 만들어주세요.');setLoading($('#mbtiOutput'));try{const d=await api('/api/mbti',{mbti:$('#mbti').value,saju:currentSaju});setOutput($('#mbtiOutput'),d.text)}catch(e){setOutput($('#mbtiOutput'),e.message)}};
$('#dreamBtn').onclick=async()=>{setLoading($('#dreamOutput'));try{const d=await api('/api/dream',{dream:$('#dream').value,saju:currentSaju});setOutput($('#dreamOutput'),d.text)}catch(e){setOutput($('#dreamOutput'),e.message)}};
$('#saveDaily').onclick=()=>{if(!currentSaju)return;localStorage.setItem('fate-daily-'+new Date().toISOString().slice(0,10),JSON.stringify(currentSaju.daily));alert('오늘의 운세 카드를 저장했습니다.')};

$('#letterSave').onclick=()=>{const text=$('#letterText').value.trim(),date=$('#letterDate').value;if(!text||!date)return alert('편지와 열어볼 날짜를 입력해주세요.');const box=JSON.parse(localStorage.getItem('fate-letters')||'[]');box.push({text,date,saved:new Date().toISOString()});localStorage.setItem('fate-letters',JSON.stringify(box));$('#letterOutput').textContent=`${date} 이후 열 수 있도록 이 기기에 봉인했습니다.`;$('#letterText').value=''};
$('#letterOpen').onclick=()=>{const box=JSON.parse(localStorage.getItem('fate-letters')||'[]'),today=new Date().toISOString().slice(0,10);if(!box.length){$('#letterOutput').textContent='아직 봉인한 편지가 없습니다.';return}$('#letterOutput').textContent=box.map((x,i)=>`${i+1}. ${x.date} · ${today>=x.date?x.text:'🔒 아직 열 수 없음'}`).join('\n\n')};

const saved=localStorage.getItem('fate-profile');if(saved){try{currentSaju=JSON.parse(saved);renderProfile(currentSaju);$('#profile').classList.remove('hidden')}catch{}}

$('#shareProfile').onclick=async()=>{
  if(!currentSaju)return alert('먼저 사주 프로필을 만들어주세요.');
  const text=`✦ 운명공방 · ${currentSaju.name||'나'}의 운명 코드\n${currentSaju.pillars.year} · ${currentSaju.pillars.month} · ${currentSaju.pillars.day} · ${currentSaju.pillars.hour}\n오행: ${Object.entries(currentSaju.elements).map(([k,v])=>`${k}${v}`).join(' ')}`;
  try{if(navigator.share)await navigator.share({title:'나의 운명 코드',text});else{await navigator.clipboard.writeText(text);alert('운명 코드를 클립보드에 복사했습니다.')}}catch{}
};

$('#branchesBtn').onclick=async()=>{
  if(!currentSaju)return alert('먼저 사주 프로필을 만들어주세요.');
  setLoading($('#branchesOutput'));
  try{const d=await api('/api/branches',{saju:currentSaju,events:$('#pastEvents').value});setOutput($('#branchesOutput'),d.text)}catch(e){setOutput($('#branchesOutput'),e.message)}
};

async function imageToCompactDataUrl(file){
  const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src});
  const max=1280,scale=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',.76);
}
$('#faceBtn').onclick=async()=>{
  const file=$('#faceImage').files?.[0];if(!file)return alert('사진을 선택해주세요.');
  if(file.size>10*1024*1024)return alert('10MB 이하 이미지로 선택해주세요.');
  setLoading($('#faceOutput'),'사진을 최적화하고 관상풍 카드를 만드는 중…');
  try{const dataUrl=await imageToCompactDataUrl(file);const d=await api('/api/face',{imageDataUrl:dataUrl,saju:currentSaju});setOutput($('#faceOutput'),d.text)}catch(e){setOutput($('#faceOutput'),e.message)}
};


const chatHistory=[];
$('#chatSend').onclick=async()=>{
  if(!currentSaju)return alert('먼저 사주 프로필을 만들어주세요.');
  const message=$('#chatInput').value.trim();if(!message)return;
  const log=$('#chatLog');setLoading(log,'Astra가 사주 프로필을 보며 답변 중…');
  try{
    const d=await api('/api/chat',{saju:currentSaju,message,persona:selectedPersona,history:chatHistory});
    chatHistory.push({role:'user',text:message},{role:'assistant',text:d.text});
    log.textContent=chatHistory.slice(-8).map(x=>`${x.role==='user'?'나':'Astra'}: ${x.text}`).join('\n\n');
    log.classList.remove('loading');$('#chatInput').value='';
  }catch(e){setOutput(log,e.message)}
};
$('#chatInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#chatSend').click()});

$('#exportProfile').onclick=()=>{
  if(!currentSaju)return alert('먼저 사주 프로필을 만들어주세요.');
  const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,1080,1350);g.addColorStop(0,'#100d1a');g.addColorStop(1,'#251632');x.fillStyle=g;x.fillRect(0,0,c.width,c.height);
  x.fillStyle='#e9d5ff';x.font='700 34px sans-serif';x.fillText('✦ 운명공방 · DESTINY PROFILE',70,95);
  x.fillStyle='#fff';x.font='700 72px sans-serif';x.fillText(currentSaju.name||'나의 운명 코드',70,205);
  x.fillStyle='#bd8cff';x.font='700 48px sans-serif';x.fillText(`${currentSaju.pillars.year} · ${currentSaju.pillars.month} · ${currentSaju.pillars.day} · ${currentSaju.pillars.hour}`,70,290);
  const total=Object.values(currentSaju.elements).reduce((a,b)=>a+b,0)||1;let y=430;
  x.font='700 38px sans-serif';x.fillStyle='#fff';x.fillText('五行 DNA',70,y);y+=70;
  for(const [k,v] of Object.entries(currentSaju.elements)){const pct=Math.round(v/total*100);x.fillStyle='#c7b6d9';x.font='600 34px sans-serif';x.fillText(k,70,y);x.fillStyle='#332844';x.fillRect(150,y-29,720,38);x.fillStyle='#a97cff';x.fillRect(150,y-29,720*pct/100,38);x.fillStyle='#fff';x.fillText(`${pct}%`,900,y);y+=92}
  x.fillStyle='#d8cfe3';x.font='500 30px sans-serif';x.fillText(`오늘의 키워드 · ${currentSaju.daily.keyword}`,70,1080);x.fillText(`행운 시간 · ${currentSaju.daily.luckyTime}  /  장소 · ${currentSaju.daily.luckyPlace}`,70,1135);
  x.fillStyle='#8f869a';x.font='500 24px sans-serif';x.fillText('오락 및 자기성찰용 콘텐츠 · 미래를 확정적으로 예언하지 않습니다.',70,1260);
  const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download=`fate-profile-${currentSaju.name||'me'}.png`;a.click();
};

fetch('/api/status').then(r=>r.json()).then(d=>{$('#serviceStatus').textContent=`AI: GPT‑6 Astra · 계산: manseryeok · 서비스 정상`}).catch(()=>{$('#serviceStatus').textContent='AI: GPT‑6 Astra · 계산: manseryeok · 상태 확인 실패'});

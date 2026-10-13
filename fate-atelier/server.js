import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateFourPillars } from 'manseryeok';
import { generateText } from 'ai';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const AI_MODEL = 'openai/gpt-6-astra';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const stemElement = { 갑:'목', 을:'목', 병:'화', 정:'화', 무:'토', 기:'토', 경:'금', 신:'금', 임:'수', 계:'수' };
const branchElement = { 자:'수', 축:'토', 인:'목', 묘:'목', 진:'토', 사:'화', 오:'화', 미:'토', 신:'금', 유:'금', 술:'토', 해:'수' };

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 3_700_000) throw new Error('요청 용량이 너무 큽니다. 이미지를 줄여 다시 시도해주세요.');
  }
  return body ? JSON.parse(body) : {};
}

function deterministic(seed) {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function calcScores(seed, elements) {
  const rnd = deterministic(seed);
  const e = elements;
  const total = Math.max(1, Object.values(e).reduce((a,b)=>a+b,0));
  const pct = k => e[k] / total;
  return {
    추진력: Math.round(48 + pct('화')*30 + pct('목')*18 + rnd()*10),
    감수성: Math.round(45 + pct('수')*35 + pct('목')*12 + rnd()*10),
    현실감각: Math.round(45 + pct('토')*36 + pct('금')*12 + rnd()*10),
    결단력: Math.round(46 + pct('금')*34 + pct('화')*12 + rnd()*10),
    관계몰입: Math.round(44 + pct('목')*28 + pct('수')*18 + rnd()*10),
    변화욕구: Math.round(45 + (1-Math.max(...Object.values(e))/total)*34 + rnd()*14)
  };
}

function buildTimeline(seed) {
  const rnd = deterministic(seed + ':timeline');
  const years = [];
  const now = new Date().getFullYear();
  for (let offset = -2; offset <= 8; offset++) {
    years.push({
      year: now + offset,
      love: Math.round(35 + rnd()*60),
      money: Math.round(35 + rnd()*60),
      career: Math.round(35 + rnd()*60),
      relation: Math.round(35 + rnd()*60)
    });
  }
  return years;
}

function dailyFortune(seed) {
  const day = new Date().toISOString().slice(0,10);
  const rnd = deterministic(seed + day);
  const keywords = ['정리','연락','몰입','기회','휴식','직감','이동','집중','정면승부','관망'];
  const cautions = ['급한 결론','과소비','감정적인 답장','수면 부족','무리한 약속','뒷말','충동 결정'];
  const places = ['카페','공원','도서관','조용한 골목','물가 주변','사람 많은 장소','익숙한 동네'];
  return {
    score: Math.round(55 + rnd()*40),
    keyword: keywords[Math.floor(rnd()*keywords.length)],
    caution: cautions[Math.floor(rnd()*cautions.length)],
    luckyTime: `${9 + Math.floor(rnd()*12)}:${rnd() > .5 ? '30' : '00'}`,
    luckyPlace: places[Math.floor(rnd()*places.length)]
  };
}

function calculateSaju(input) {
  const { name='', year, month, day, hour=12, minute=0, calendar='solar', leapMonth=false, gender='male' } = input;
  const result = calculateFourPillars({
    year: Number(year), month: Number(month), day: Number(day), hour: Number(hour), minute: Number(minute),
    isLunar: calendar === 'lunar', isLeapMonth: Boolean(leapMonth), gender: gender === 'female' ? 'female' : 'male'
  });
  const pillars = result.toObject();
  const hanja = result.toHanjaObject?.() || {};
  const elements = { 목:0, 화:0, 토:0, 금:0, 수:0 };
  for (const key of ['year','month','day','hour']) {
    const p = pillars[key];
    if (!p) continue;
    const s = p[0], b = p[1];
    if (stemElement[s]) elements[stemElement[s]]++;
    if (branchElement[b]) elements[branchElement[b]]++;
  }
  const seed = `${name}|${year}-${month}-${day}|${hour}:${minute}|${pillars.year}${pillars.month}${pillars.day}${pillars.hour}`;
  return {
    name, pillars, hanja, elements,
    dayMaster: pillars.day?.[0] || '',
    dayElement: result.dayElement || null,
    yinYang: result.dayYinYang || null,
    tenGods: result.tenGods || null,
    voidBranches: result.voidBranches || null,
    luckPillars: result.luckPillars || null,
    scores: calcScores(seed, elements),
    timeline: buildTimeline(seed),
    daily: dailyFortune(seed),
    seed
  };
}

async function askAstra({ system, user, effort='medium' }) {
  const { text } = await generateText({
    model: AI_MODEL,
    system,
    prompt: user,
    maxOutputTokens: 1400
  });
  return { demo:false, text, model:AI_MODEL };
}

async function askAstraWithImage({ system, text, imageDataUrl, effort='low' }) {
  const result = await generateText({
    model: AI_MODEL,
    system,
    maxOutputTokens: 1000,
    messages: [{ role:'user', content:[
      { type:'text', text },
      { type:'image', image:imageDataUrl }
    ] }]
  });
  return { demo:false, text:result.text, model:AI_MODEL };
}

const baseSystem = `너는 한국어로 대화하는 운세/사주 엔터테인먼트 해석가다. 결정론적으로 미래를 단정하지 말고, 사용자가 제공한 사주 계산값과 질문을 바탕으로 성찰과 재미를 주는 방식으로 답한다. 의료·법률·재정 등 중요한 결정은 점술만으로 내리라고 권하지 않는다. 불필요하게 무섭게 말하지 않는다. 답변은 구체적이고 자연스럽게 작성한다.`;

const buckets = new Map();
function allowRequest(req, limit=18, windowMs=60_000) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
  const now = Date.now();
  const key = `${ip}:${Math.floor(now/windowMs)}`;
  const count = (buckets.get(key) || 0) + 1;
  buckets.set(key, count);
  if (buckets.size > 5000) for (const k of buckets.keys()) if (!k.endsWith(String(Math.floor(now/windowMs)))) buckets.delete(k);
  return count <= limit;
}

async function handleApi(req, res, url) {
  try {
    if (req.method === 'GET' && url.pathname === '/api/status') return sendJson(res, 200, { ok:true, model:AI_MODEL, gateway:'vercel-ai-gateway', sajuEngine:'manseryeok-2.x' });
    if (req.method === 'POST' && url.pathname !== '/api/saju' && !allowRequest(req, 12)) return sendJson(res, 429, { error:'요청이 많습니다. 잠시 후 다시 시도해주세요.' });
    if (req.method === 'POST' && url.pathname === '/api/saju') {
      const input = await readJson(req);
      const data = calculateSaju(input);
      return sendJson(res, 200, data);
    }
    if (req.method === 'POST' && url.pathname === '/api/interpret') {
      const { saju, persona='현실적인 도사', focus='종합운' } = await readJson(req);
      const prompt = `상담 캐릭터: ${persona}\n관심 영역: ${focus}\n계산된 사주 데이터:\n${JSON.stringify(saju)}\n\n이 데이터를 바탕으로 ①핵심 기질 ②강점과 주의점 ③${focus} ④향후 1~2년을 해석해줘. 미래를 확정하지 말고 가능성과 행동 힌트로 표현해.`;
      const out = await askAstra({ system: baseSystem, user: prompt, effort:'medium' });
      return sendJson(res, 200, out);
    }
    if (req.method === 'POST' && url.pathname === '/api/decision') {
      const { saju, question, options=[] } = await readJson(req);
      const prompt = `사주 데이터: ${JSON.stringify(saju)}\n고민: ${question}\n선택지: ${options.join(' / ')}\n각 선택지를 '기회 / 부담 / 관계 영향 / 후회 가능성 / 한 줄 조언'으로 비교해줘. 점수는 오락용 참고 지표임을 분명히 하고 결정을 대신하지 마.`;
      const out = await askAstra({ system: baseSystem, user: prompt });
      return sendJson(res, 200, out);
    }
    if (req.method === 'POST' && url.pathname === '/api/compatibility') {
      const { a, b, relation='연애' } = await readJson(req);
      const prompt = `A 사주: ${JSON.stringify(a)}\nB 사주: ${JSON.stringify(b)}\n관계: ${relation}\n대화, 감정표현, 갈등, 생활리듬, 장기성, 서로에게 필요한 배려를 항목별로 분석해줘. 궁합은 결정적 사실이 아니라 대화 소재와 성찰 도구라고 밝혀.`;
      const out = await askAstra({ system: baseSystem, user: prompt });
      return sendJson(res, 200, out);
    }
    if (req.method === 'POST' && url.pathname === '/api/dream') {
      const { dream, saju } = await readJson(req);
      const prompt = `사용자 사주: ${JSON.stringify(saju)}\n꿈 내용: ${dream}\n꿈을 상징적·심리적 관점과 전통적 해몽의 재미 요소를 나눠 설명하고, 불길한 예언처럼 단정하지 마.`;
      const out = await askAstra({ system: baseSystem, user: prompt });
      return sendJson(res, 200, out);
    }
    if (req.method === 'POST' && url.pathname === '/api/mbti') {
      const { mbti, saju } = await readJson(req);
      const prompt = `MBTI: ${mbti}\n사주 데이터: ${JSON.stringify(saju)}\n둘을 과학적으로 동일시하지 말고, 서로 다른 자기이해 도구라는 전제에서 겹치는 면/충돌하는 면/대인관계 팁/일 스타일을 재미있게 해석해.`;
      const out = await askAstra({ system: baseSystem, user: prompt });
      return sendJson(res, 200, out);
    }
    if (req.method === 'POST' && url.pathname === '/api/branches') {
      const { saju, events='' } = await readJson(req);
      const prompt = `사주 데이터: ${JSON.stringify(saju)}\n사용자가 기억하는 과거 사건: ${events}\n\n과거 사건을 사주와 억지로 맞췄다고 주장하지 말고, 어떤 시기에 변화/관계/진로의 체감이 컸는지 사용자가 스스로 돌아볼 수 있도록 '과거 분기점 → 현재에 남은 패턴 → 앞으로 확인할 질문' 구조로 정리해줘.`;
      const out = await askAstra({ system: baseSystem, user: prompt });
      return sendJson(res, 200, out);
    }
    if (req.method === 'POST' && url.pathname === '/api/face') {
      const { imageDataUrl='', saju=null } = await readJson(req);
      if (!imageDataUrl.startsWith('data:image/')) throw new Error('이미지 파일이 필요합니다.');
      const system = `너는 사진에서 확인 가능한 비민감한 시각적 특징을 바탕으로 '관상풍 엔터테인먼트 카드'를 만든다. 실제 성격, 지능, 건강, 범죄성, 민족성, 성적 지향, 정치 성향 등 사람의 속성이나 민감한 특성을 얼굴에서 추론하지 않는다. 미래를 예언한다고 주장하지 않는다. 얼굴형/눈썹·눈·입의 시각적 인상, 표정, 헤어/스타일 같은 눈에 보이는 요소만 묘사하고, 전통 관상에서 연상되는 상징을 명확히 '재미용 상징'으로 구분해 표현한다.`;
      const text = `사주 데이터(있으면 참고): ${JSON.stringify(saju)}\n사진을 보고 ①보이는 인상 ②관상풍 상징 키워드 3개 ③사주와 연결한 재미용 한 줄 카드 ④사진 분위기에 어울리는 행운 테마를 한국어로 작성해.`;
      const out = await askAstraWithImage({ system, text, imageDataUrl, effort:'low' });
      return sendJson(res, 200, out);
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const { saju, message='', persona='현실적인 도사', history=[] } = await readJson(req);
      if (!String(message).trim()) throw new Error('질문을 입력해주세요.');
      const recent = Array.isArray(history) ? history.slice(-6) : [];
      const prompt = `상담 캐릭터: ${persona}\n사주 데이터: ${JSON.stringify(saju)}\n최근 대화: ${JSON.stringify(recent)}\n사용자 질문: ${message}\n\n질문에 직접 답하고, 필요하면 사주 계산값과 연결하되 미래를 사실처럼 단정하지 마. 5~10문장 정도로 자연스럽게 답해.`;
      const out = await askAstra({ system: baseSystem, user: prompt, effort:'medium' });
      return sendJson(res, 200, out);
    }
    if (req.method === 'POST' && url.pathname === '/api/tarot') {
      const { question='', cards=[] } = await readJson(req);
      const prompt = `질문: ${question}\n뽑힌 카드: ${cards.join(', ')}\n과거-현재-가능한 방향 3단계로 타로를 해석해. 예언이 아니라 상황을 바라보는 프레임으로 제시해.`;
      const out = await askAstra({ system: baseSystem, user: prompt });
      return sendJson(res, 200, out);
    }
    return sendJson(res, 404, { error:'Not found' });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: err.message || 'Server error' });
  }
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const safe = normalize(pathname).replace(/^([.][.][/\\])+/, '');
  const filePath = join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  try {
    const s = await stat(filePath);
    if (!s.isFile()) throw new Error('not file');
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin', 'X-Frame-Options':'DENY', 'Permissions-Policy':'camera=(), microphone=(), geolocation=()' });
    res.end(data);
  } catch {
    const html = await readFile(join(PUBLIC_DIR, 'index.html'));
    res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin', 'X-Frame-Options':'DENY', 'Permissions-Policy':'camera=(), microphone=(), geolocation=()' });
    res.end(html);
  }
}

const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req,res,url);
  return serveStatic(req,res,url);
});

server.listen(PORT, () => console.log(`Fate Atelier → http://localhost:${PORT}`));

/* ==========================================================
   포트폴리오 공통 도우미 (PF)
   - 세 화면(프로젝트 묶기 / STAR 정리 / 포트폴리오 만들기)이 함께 씁니다.
   - 데이터는 팀 규칙대로 common/storage.js 함수로만 읽고 씁니다.
   - common/storage.js가 아직 없을 때(혼자 테스트할 때)만
     아래 "단독 실행용 저장 함수"가 대신 동작합니다. 합치면 자동으로 꺼집니다.
   ========================================================== */
(function () {
  'use strict';

  // 팀 공통 역량 태그 (기능 명세 기준, 1주차 회의에서 확정되면 여기만 바꾸면 됨)
  const TAGS = ['기획', '디자인', '개발', '영상', '글쓰기', '협업', '사용자 리서치', '데이터 분석', '발표'];

  /* ---------- 1. 단독 실행용 저장 함수 ---------- */
  // common/storage.js가 로드되었다면 getRecords가 이미 있으므로 아무것도 하지 않습니다.
  const standalone = typeof getRecords !== 'function';
  if (standalone) {
    console.info('[포트폴리오] common/storage.js가 없어 단독 실행 모드로 동작합니다. (팀 코드와 합치면 자동으로 꺼져요)');
    const read = (key, def) => {
      try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; }
    };
    const write = (key, v) => localStorage.setItem(key, JSON.stringify(v));
    const upsert = (key, item) => {
      const list = read(key, []);
      const i = list.findIndex((x) => x.id === item.id);
      if (i >= 0) list[i] = item; else list.push(item);
      write(key, list);
      return item;
    };
    window.getUser = () => read('user', null);
    window.saveUser = (u) => write('user', u);
    window.getRecords = () => read('records', []);
    window.saveRecord = (r) => upsert('records', r);
    window.getProjects = () => read('projects', []);
    window.saveProject = (p) => upsert('projects', p);
    window.deleteProject = (id) => write('projects', read('projects', []).filter((p) => p.id !== id));
    window.getTagCounts = () => {
      const c = {};
      read('records', []).forEach((r) => (r.tags || []).forEach((t) => { c[t] = (c[t] || 0) + 1; }));
      return c;
    };
  }

  /* ---------- 2. 저장 함수 감싸기 (없거나 모양이 달라도 안 깨지게) ---------- */
  const store = {
    user() { try { return getUser() || {}; } catch (e) { return {}; } },
    records() { try { return (getRecords() || []).filter(Boolean); } catch (e) { return []; } },
    projects() {
      try {
        // 다른 팀원이 project에 필드를 더 넣었어도 지워지지 않게 원래 값을 그대로 유지
        return (getProjects() || []).filter(Boolean).map((p) => ({
          ...p,
          title: p.title || '이름 없는 프로젝트',
          recordIds: Array.isArray(p.recordIds) ? p.recordIds : [],
          star: Object.assign({ s: '', t: '', a: '', r: '' }, p.star || {}),
        }));
      } catch (e) { return []; }
    },
    saveProject(p) { return saveProject(p); },
    canDelete() { return typeof deleteProject === 'function'; },
    deleteProject(id) { if (typeof deleteProject === 'function') deleteProject(id); },
    saveRecord(r) { return saveRecord(r); },
  };

  /* ---------- 3. 작은 도우미 ---------- */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const fmtDate = (d) => {
    if (!d) return '';
    const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}.${m[2]}.${m[3]}` : String(d);
  };
  const fmtMonth = (d) => {
    const m = String(d || '').match(/(\d{4})-(\d{2})/);
    return m ? `${m[1]}.${m[2]}` : '';
  };

  // 기록 출처 표시 이름 (record.source 값 그대로 사용)
  const sourceLabel = (src) => ({ 기록: '기록', 경험꺼내기: '경험 꺼내기', 공모전: '공모전', 미션: '미션' }[src] || src || '기록');

  // 태그별 개수 → [[태그, 개수], ...] 많은 순
  function tagCounts(records) {
    const c = {};
    records.forEach((r) => (r.tags || []).forEach((t) => { c[t] = (c[t] || 0) + 1; }));
    return Object.entries(c).sort((a, b) => b[1] - a[1] || TAGS.indexOf(a[0]) - TAGS.indexOf(b[0]));
  }

  function recordsOf(project, allRecords) {
    const map = new Map((allRecords || store.records()).map((r) => [r.id, r]));
    return project.recordIds.map((id) => map.get(id)).filter(Boolean);
  }

  // 묶인 기록들의 기간 (가장 이른 날짜 ~ 가장 늦은 날짜)
  function period(records) {
    const ds = records.map((r) => r.date).filter(Boolean).sort();
    if (!ds.length) return '';
    const a = fmtMonth(ds[0]); const b = fmtMonth(ds[ds.length - 1]);
    return a === b ? a : `${a} – ${b}`;
  }

  function starStatus(project) {
    const n = ['s', 't', 'a', 'r'].filter((k) => (project.star[k] || '').trim()).length;
    if (n === 0) return { n, key: 'none', label: 'STAR 미작성', icon: 'pen-line' };
    if (n < 4) return { n, key: 'doing', label: `STAR 작성 중 ${n}/4`, icon: 'pen-line' };
    return { n, key: 'done', label: 'STAR 완성', icon: 'circle-check' };
  }

  /* ---------- 4. 직무 데이터 (data/jobs.js) ---------- */
  // data/jobs.js 가 const jobs / JOBS 중 어떤 이름으로 만들어져도 찾아 씁니다.
  const FALLBACK_JOBS = [
    { id: 'planner', name: '서비스 기획자', desc: '사용자 문제를 정의하고 서비스 기능과 흐름을 설계', skills: { 기획: 3, '사용자 리서치': 2, '데이터 분석': 1, 협업: 2, 발표: 1 }, tasks: [] },
    { id: 'ux-designer', name: 'UX 디자이너', desc: '사용자 조사를 바탕으로 화면과 경험을 설계', skills: { 디자인: 3, '사용자 리서치': 2, 기획: 1, 협업: 1 }, tasks: [] },
    { id: 'frontend', name: '프론트엔드 개발자', desc: '사용자가 보는 웹 화면을 구현', skills: { 개발: 3, 디자인: 1, 협업: 2 }, tasks: [] },
  ];
  function getJobList() {
    /* global jobs, JOBS */
    try { if (typeof jobs !== 'undefined' && Array.isArray(jobs)) return jobs; } catch (e) { /* 없음 */ }
    try { if (typeof JOBS !== 'undefined' && Array.isArray(JOBS)) return JOBS; } catch (e) { /* 없음 */ }
    return FALLBACK_JOBS; // data/jobs.js가 아직 없을 때 테스트용
  }
  // user.targetJob 이 id 든 이름이든 찾기
  function findJob(target) {
    if (!target) return null;
    const key = typeof target === 'object' ? (target.id || target.name) : target;
    return getJobList().find((j) => j.id === key || j.name === key) || null;
  }

  /* ---------- 5. STAR 문장 만들기 (AI 없이 문장 틀에 끼워 넣기) ---------- */
  // 받침 확인으로 을/를 고르기
  function hasBatchim(word) {
    const ch = String(word).trim().slice(-1);
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
    if (/[0136789]/.test(ch)) return true; // 영 일 삼 육 칠 팔 구(X) …
    if (/[245]/.test(ch)) return false;
    return null; // 영어 등은 판단 불가
  }
  function eulReul(word) { const b = hasBatchim(word); return b === null ? '을(를)' : (b ? '을' : '를'); }

  // "~다" 로 끝나는 문장을 "~습니다/~합니다" 로 (배웠다 → 배웠습니다, 필요하다 → 필요합니다)
  function formal(x) {
    if (!/다$/.test(x)) return x;
    const prev = x.slice(-2, -1);
    if (prev === '하') return x.replace(/하다$/, '합니다');
    if (prev === '이') return x.replace(/이다$/, '입니다');
    const code = prev.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0) return `${x.slice(0, -1)}습니다`;
    return x;
  }

  const clean = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/[.!~。]+$/, '').trim();

  // 상황: "○○ 상황에서"
  function sitPart(s) {
    let x = clean(s);
    if (!x) return null;
    x = x.replace(/\s*(상황이었습니다|상황이었다|상황이었어요|상황이었음|상황)$/, '');
    if (/(습니다|어요|아요|였다|었다|았다|했다|다)$/.test(x)) {
      // "참여율이 낮았다" → "참여율이 낮았던"
      x = x.replace(/(습니다|어요|아요)$/, '던').replace(/다$/, '던');
    }
    return `${x} 상황에서`;
  }
  // 과제: 명사형이면 "○○을 해결하기 위해", 문장이면 "○○했습니다. 이를 해결하기 위해"
  function taskPart(t) {
    const x = clean(t);
    if (!x) return null;
    const isSentence = /(다|요|함|음)$/.test(x);
    if (!isSentence) return { inline: `${x}${eulReul(x)} 해결하기 위해` };
    let sentence = x
      .replace(/(했|였|었|았|웠|겠)어요$/, '$1습니다')
      .replace(/해야 함$/, '해야 했습니다').replace(/했음$/, '했습니다').replace(/함$/, '했습니다');
    sentence = formal(sentence);
    return { sentence: `${sentence}.`, after: '이를 해결하기 위해' };
  }
  // 행동: "○○을 했고" / "○○했고"
  function actPart(a) {
    let x = clean(a);
    if (!x) return null;
    if (/습니다$/.test(x)) return x.replace(/습니다$/, '고');
    if (/(어요|아요)$/.test(x)) return x.replace(/(어요|아요)$/, '고');
    if (/했음$/.test(x)) return x.replace(/했음$/, '했고');
    if (/함$/.test(x)) return x.replace(/함$/, '했고');
    if (/다$/.test(x)) return x.replace(/다$/, '고');
    return `${x}${eulReul(x)} 했고`;
  }
  // 결과: "그 결과 ○○했습니다."
  function resPart(r) {
    let x = clean(r);
    if (!x) return null;
    if (/(니다|어요|아요)$/.test(x)) return `${x}.`;
    if (/다$/.test(x)) return `${formal(x)}.`;
    if (/배움$/.test(x)) return `${x.replace(/배움$/, '배웠습니다')}.`;
    if (/됨$/.test(x)) return `${x.replace(/됨$/, '됐습니다')}.`;
    if (/(했음|함)$/.test(x)) return `${x.replace(/(했음|함)$/, '했습니다')}.`;
    if (/음$/.test(x)) return `${x}.`; // "A+ 받음" 처럼 바꾸기 어려운 끝맺음은 그대로
    return `${x}했습니다.`;
  }

  // 자소서 문장형: 빈 칸은 null 대신 placeholder로 표시
  function starSentence(star, opts = {}) {
    const blank = opts.blank || ((label) => `[${label}]`);
    const S = sitPart(star.s) || `${blank('상황')} 상황에서`;
    const T = taskPart(star.t);
    const A = actPart(star.a) || `${blank('행동')}${'을(를)'} 했고`;
    const R = resPart(star.r) || `${blank('결과')}했습니다.`;
    if (!T) return `${S} ${blank('과제')}을(를) 해결하기 위해 ${A}, 그 결과 ${R}`;
    if (T.inline) return `${S} ${T.inline} ${A}, 그 결과 ${R}`;
    return `${S} ${T.sentence} ${T.after} ${A}, 그 결과 ${R}`;
  }

  /* ---------- 6. 화면 부품 ---------- */
  function subnav(active) {
    const el = document.getElementById('pf-subnav');
    if (!el) return;
    const items = [
      ['projects', 'index.html', '프로젝트 묶기'],
      ['star', 'star.html', 'STAR 정리'],
      ['export', 'export.html', '포트폴리오 만들기'],
    ];
    el.className = 'pf-subnav';
    el.setAttribute('aria-label', '포트폴리오 단계');
    el.innerHTML = items.map(([key, href, label], i) =>
      `<a href="${href}" class="${key === active ? 'is-active' : ''}" ${key === active ? 'aria-current="page"' : ''}><span class="pf-num">${i + 1}</span>${label}</a>`).join('');
  }

  function icons() { if (window.lucide && lucide.createIcons) lucide.createIcons(); }

  let toastTimer;
  function toast(msg) {
    let el = document.querySelector('.pf-toast');
    if (!el) { el = document.createElement('div'); el.className = 'pf-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 2000);
  }

  // "삭제" 같은 버튼을 두 번 눌러야 실행되게 (브라우저 confirm 창 대신)
  function confirmClick(btn, label, run) {
    if (btn.classList.contains('is-confirm')) { run(); return; }
    const old = btn.innerHTML;
    btn.classList.add('is-confirm');
    btn.textContent = label;
    setTimeout(() => { if (btn.isConnected) { btn.classList.remove('is-confirm'); btn.innerHTML = old; icons(); } }, 3000);
  }

  // 공통 header.js가 없을 때만 임시 헤더를 그림 (합치면 header.js가 채우므로 안 보임)
  function devHeader() {
    const h = document.getElementById('header');
    if (!h || h.children.length || h.textContent.trim()) return;
    const menus = ['나 탐색', '경험 기록', '직무 연결', '포트폴리오', '경험 채우기', '마이페이지'];
    h.className = 'pf-dev-header';
    h.innerHTML = `<nav><span class="pf-logo">자기 계발 서비스</span>${menus.map((m) =>
      `<a href="${m === '포트폴리오' ? 'index.html' : '#'}" class="${m === '포트폴리오' ? 'is-active' : ''}">${m}</a>`).join('')}</nav>`;
  }
  window.addEventListener('load', devHeader);

  /* ---------- 7. 시연·테스트용 샘플 기록 ---------- */
  // 기록이 하나도 없을 때만 버튼으로 보여줍니다. 공통 saveRecord를 통해 저장합니다.
  const SAMPLE_RECORDS = [
    { id: 'pf_sample_1', source: '경험꺼내기', template: '', category: '동아리·대외활동', title: '교내 IT 동아리 신입 행사 기획', content: '신입 부원 행사 참여율이 30%대로 낮았음. 부원 12명에게 왜 안 오는지 짧은 설문을 돌리고, 행사 시간을 수업 끝나는 시간에 맞춰 바꿈.\n기간: 2026.03 – 2026.05 / 역할: 기획 담당', date: '2026-03-20', tags: ['기획', '사용자 리서치', '협업'] },
    { id: 'pf_sample_2', source: '기록', template: '회고형', category: '', title: '행사 2회차 회고 (KPT)', content: 'Keep: 설문으로 원인을 먼저 찾은 것\nProblem: 홍보 포스터가 늦게 나옴\nTry: 다음엔 2주 전에 일정표 공유하기', date: '2026-04-18', tags: ['기획', '협업'] },
    { id: 'pf_sample_3', source: '기록', template: '사진 한 장 기록', category: '', title: '행사 홍보 포스터 직접 만들기', content: 'Figma로 포스터 3가지 시안을 만들고 부원 투표로 골랐다.', date: '2026-04-02', tags: ['디자인'] },
    { id: 'pf_sample_4', source: '공모전', template: '', category: '', title: '캠퍼스 앱 UX 아이디어 공모전 (입선)', content: '결과: 입선 / 역할: 사용자 인터뷰, 화면 설계\n배운 점: 인터뷰 질문을 미리 다듬어야 진짜 불편함이 나온다.', date: '2026-07-10', tags: ['사용자 리서치', '디자인', '발표'] },
    { id: 'pf_sample_5', source: '미션', template: '', category: '', title: '자주 쓰는 앱에 대해 친구 3명 인터뷰하기', content: '만족도 4/5 · 다들 알림이 너무 많다고 해서 놀랐다.', date: '2026-06-01', tags: ['사용자 리서치'] },
    { id: 'pf_sample_6', source: '경험꺼내기', template: '', category: '수업 과제', title: '데이터분석 수업 – 학식 메뉴 만족도 분석', content: '학생 80명 설문 데이터를 엑셀 피벗으로 정리해 요일별 만족도 차이를 발표함.\n기간: 2026.05 / 역할: 데이터 정리, 발표', date: '2026-05-28', tags: ['데이터 분석', '발표'] },
    { id: 'pf_sample_7', source: '기록', template: '일기형', category: '', title: '처음 HTML로 동아리 소개 페이지 만들기', content: '생각보다 CSS가 어려웠지만 완성하니 뿌듯했다.', date: '2026-08-15', tags: ['개발'] },
  ];
  function loadSample() {
    SAMPLE_RECORDS.forEach((r) => store.saveRecord({ ...r }));
    if (standalone && !getUser()) saveUser({ nickname: '김민지', userType: 2, testResult: null, targetJob: 'planner' });
  }
  function sampleEmpty(message) {
    return `<div class="pf-empty"><i data-lucide="inbox"></i><strong>아직 기록이 없어요</strong><p>${message}</p>
      <button type="button" class="pf-btn pf-btn--sm" data-pf-sample><i data-lucide="sparkles"></i>시연용 샘플 기록 넣기</button></div>`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pf-sample]');
    if (!b) return;
    loadSample();
    toast('샘플 기록을 넣었어요');
    document.dispatchEvent(new CustomEvent('pf:changed'));
  });

  window.PF = {
    TAGS, standalone, store, esc, newId, fmtDate, period, sourceLabel, tagCounts, recordsOf, starStatus,
    jobs: getJobList, findJob, eulReul, starSentence, subnav, icons, toast, confirmClick, sampleEmpty,
  };
})();

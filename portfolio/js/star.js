/* ==========================================================
   2. STAR 정리
   - 상황 → 과제 → 행동 → 결과 질문에 차례로 답함
   - 묶인 기록을 옆에 띄워 참고 / 문장 틀에 끼워 넣어 미리보기
   - 저장: project.star = { s, t, a, r } (입력하는 즉시 자동 저장)

   다른 화면에서 들어오는 주소
     star.html?project=프로젝트ID          → 그 프로젝트를 열기
     star.html?record=기록ID               → 그 기록이 든 프로젝트를 열고,
                                            없으면 그 기록으로 새 프로젝트를 만들어 열기
     (예: 부족 역량 분석 "STAR 정리하기", 참여 기록 "포트폴리오로 보내기")
   ========================================================== */
(function () {
  'use strict';
  const { store, esc, fmtDate, sourceLabel, recordsOf, starStatus, icons, toast } = PF;

  const STEPS = [
    { k: 's', letter: 'S', name: '상황', en: 'Situation', q: '어떤 상황이었나요?',
      hint: '언제, 어디서, 누구와 함께였는지, 그때 어떤 문제가 있었는지 적어 보세요.',
      ex: '예: 동아리 신입 부원 행사 참여율이 30%대에 머물던' },
    { k: 't', letter: 'T', name: '과제', en: 'Task', q: '무엇을 해결해야 했나요?',
      hint: '내가 맡은 목표나 풀어야 했던 문제를 한 가지로 좁혀 보세요.',
      ex: '예: 신입 부원이 행사에 오지 않는 문제' },
    { k: 'a', letter: 'A', name: '행동', en: 'Action', q: '내가 한 일은?',
      hint: '팀 전체가 아니라 "내가" 한 행동을 구체적으로. 숫자가 있으면 더 좋아요.',
      ex: '예: 부원 12명에게 설문을 돌려 원인을 찾고 행사 시간을 수업 직후로 옮겼다' },
    { k: 'r', letter: 'R', name: '결과', en: 'Result', q: '어떤 결과가 나왔고 무엇을 배웠나요?',
      hint: '달라진 점(되도록 숫자)과 그 경험으로 배운 점을 함께 적어 보세요.',
      ex: '예: 참여율이 55%로 올랐고, 원인을 먼저 묻는 것이 중요하다는 것을 배웠다' },
  ];
  // 문장 틀 (현재 칸만 강조)
  const FRAME = [['s', ' 상황에서 '], ['t', '을(를) 해결하기 위해 '], ['a', '을(를) 했고, 그 결과 '], ['r', '했습니다.']];

  const $root = document.getElementById('star-root');
  const params = new URLSearchParams(location.search);
  const state = { projectId: null, step: 0, view: 'sentence' };
  let saveTimer;

  /* ---------- 들어온 주소 처리 ---------- */
  function resolveEntry() {
    const projects = store.projects();
    const recParam = params.get('record');
    if (recParam) {
      const ids = recParam.split(',').map((s) => s.trim()).filter(Boolean);
      const found = projects.find((p) => ids.some((id) => p.recordIds.includes(id)));
      if (found) return found.id;
      const recs = store.records().filter((r) => ids.includes(r.id));
      if (recs.length) {
        const p = { id: PF.newId('p'), title: recs[0].title || '새 프로젝트', recordIds: recs.map((r) => r.id), star: { s: '', t: '', a: '', r: '' } };
        store.saveProject(p);
        toast('기록으로 새 프로젝트를 만들었어요');
        return p.id;
      }
    }
    const pid = params.get('project');
    if (pid && projects.some((p) => p.id === pid)) return pid;
    // 기본: 아직 완성 안 된 첫 프로젝트
    const todo = projects.slice().reverse().find((p) => starStatus(p).key !== 'done');
    return (todo || projects[projects.length - 1] || {}).id || null;
  }

  // 현재 프로젝트 (화면에서 고치는 중인 값을 들고 있음)
  let cached = null;
  function current() {
    if (!cached || cached.id !== state.projectId) cached = store.projects().find((p) => p.id === state.projectId) || null;
    return cached;
  }

  /* ---------- 그리기 ---------- */
  function render() {
    const projects = store.projects();
    if (!projects.length) {
      const hasRecords = store.records().length > 0;
      $root.innerHTML = `<div class="pf-card">${hasRecords
        ? `<div class="pf-empty"><i data-lucide="folder-kanban"></i><strong>먼저 프로젝트를 만들어 주세요</strong><p>기록을 프로젝트로 묶어야 STAR로 정리할 수 있어요.</p><a class="pf-btn pf-btn--primary" href="index.html"><i data-lucide="arrow-left"></i>프로젝트 묶기로 가기</a></div>`
        : PF.sampleEmpty('기록을 남기고 프로젝트로 묶으면 여기서 정리할 수 있어요.')}</div>`;
      icons();
      return;
    }
    if (!projects.some((p) => p.id === state.projectId)) state.projectId = resolveEntry();
    cached = null;
    const p = current();
    const recs = recordsOf(p);

    $root.innerHTML = `
      <div class="pf-picker" role="group" aria-label="정리할 프로젝트">
        <span>프로젝트</span>
        ${projects.slice().reverse().map((x) => {
          const st = starStatus(x);
          return `<button type="button" class="pf-pick ${x.id === p.id ? 'is-on' : ''}" data-pick="${esc(x.id)}" aria-pressed="${x.id === p.id}"><span class="pf-dot ${st.key === 'none' ? '' : `is-${st.key}`}" data-dot="${esc(x.id)}"></span>${esc(x.title)}</button>`;
        }).join('')}
      </div>

      <div class="pf-star-layout">
        <div class="pf-star-main">
          <ol class="pf-steps" id="steps">
            ${STEPS.map((s, i) => `<li><button type="button" data-step="${i}" class="${i === state.step ? 'is-on' : ''} ${(p.star[s.k] || '').trim() ? 'is-filled' : ''}"><span class="pf-step-letter">${s.letter}</span><span class="pf-step-name">${s.name}<small>${s.en}</small></span></button></li>`).join('')}
          </ol>

          <section class="pf-card pf-q" id="question" aria-live="polite"></section>

          <section class="pf-card pf-out" aria-labelledby="out-title">
            <div class="pf-out-head">
              <h2 class="pf-section-title" id="out-title"><i data-lucide="sparkles"></i>완성 문장 미리보기</h2>
              <div style="display:flex;gap:8px;align-items:center">
                <div class="pf-seg" role="group" aria-label="미리보기 형식">
                  <button type="button" data-view="sentence" class="${state.view === 'sentence' ? 'is-on' : ''}">자소서 문장형</button>
                  <button type="button" data-view="items" class="${state.view === 'items' ? 'is-on' : ''}">STAR 항목형</button>
                </div>
                <button type="button" class="pf-btn pf-btn--sm" id="copy"><i data-lucide="copy"></i>복사</button>
              </div>
            </div>
            <div class="pf-out-body" id="out"></div>
            <p class="pf-out-note">답변을 문장 틀에 끼워 만든 초안이에요. 어색한 부분은 복사한 뒤 자연스럽게 다듬어 주세요.</p>
          </section>
        </div>

        <aside class="pf-card pf-ref" aria-labelledby="ref-title">
          <h2 class="pf-section-title" id="ref-title"><i data-lucide="file-text"></i>묶인 기록 참고 <span class="pf-count">${recs.length}</span></h2>
          <div class="pf-ref-list">
            ${recs.length ? recs.map((r, i) => `
              <details class="pf-ref-item" ${i === 0 ? 'open' : ''}>
                <summary>
                  <div class="pf-rec-top"><span class="pf-source" data-src="${esc(r.source)}">${esc(sourceLabel(r.source))}</span>${esc(fmtDate(r.date))}${r.template ? ` · ${esc(r.template)}` : ''}${r.category ? ` · ${esc(r.category)}` : ''}</div>
                  <p class="pf-rec-title">${esc(r.title || '제목 없는 기록')}</p>
                </summary>
                <div class="pf-ref-body">${esc(r.content || '내용 없음')}<div class="pf-tags">${(r.tags || []).map((t) => `<span class="pf-tag">${esc(t)}</span>`).join('')}</div></div>
              </details>`).join('')
            : `<div class="pf-empty" style="padding:16px 4px"><p>이 프로젝트에 묶인 기록이 없어요.</p><a class="pf-btn pf-btn--sm" href="index.html"><i data-lucide="plus"></i>기록 묶으러 가기</a></div>`}
          </div>
        </aside>
      </div>`;

    renderQuestion();
    renderOutput();
    icons();
  }

  function renderQuestion() {
    const p = current();
    const s = STEPS[state.step];
    const frame = FRAME.map(([k, tail]) => (k === s.k ? `<mark>여기</mark>` : '○○') + tail).join('');
    const last = state.step === STEPS.length - 1;
    document.getElementById('question').innerHTML = `
      <p class="pf-q-label">${state.step + 1}단계 · ${s.name} ${s.en}</p>
      <h2>${s.q}</h2>
      <p class="pf-q-hint">${s.hint}</p>
      <p class="pf-frame"><b>문장 틀</b>${frame}</p>
      <label class="pf-label" for="answer">내 답변</label>
      <textarea id="answer" class="pf-textarea" placeholder="여기에 답변을 적어 주세요">${esc(p.star[s.k] || '')}</textarea>
      <p class="pf-example">${esc(s.ex)}</p>
      <div class="pf-q-foot">
        <span class="pf-saved" id="saved"></span>
        <div style="display:flex;gap:8px">
          <button type="button" class="pf-btn" id="prev" ${state.step === 0 ? 'disabled' : ''}><i data-lucide="arrow-left"></i>이전</button>
          ${last
            ? `<a class="pf-btn pf-btn--primary" href="export.html?project=${encodeURIComponent(p.id)}">포트폴리오 만들기<i data-lucide="arrow-right"></i></a>`
            : '<button type="button" class="pf-btn pf-btn--primary" id="next">다음<i data-lucide="arrow-right"></i></button>'}
        </div>
      </div>`;
    icons();
  }

  function renderOutput() {
    const p = current();
    const $out = document.getElementById('out');
    if (state.view === 'sentence') {
      const text = PF.starSentence(p.star, { blank: (label) => `\u0001${label}\u0002` });
      $out.innerHTML = esc(text).replace(/\u0001(.+?)\u0002/g, '<span class="pf-blank">$1</span>');
    } else {
      $out.innerHTML = `<dl>${STEPS.map((s) => `<dt>${s.name}</dt><dd>${(p.star[s.k] || '').trim() ? esc(p.star[s.k].trim()) : '<span class="pf-blank">아직 비어 있어요</span>'}</dd>`).join('')}</dl>`;
    }
  }

  function plainOutput() {
    const p = current();
    if (state.view === 'sentence') return PF.starSentence(p.star, { blank: (l) => `[${l}]` });
    return STEPS.map((s) => `[${s.name}] ${(p.star[s.k] || '').trim()}`).join('\n');
  }

  /* ---------- 저장 ---------- */
  function saveAnswer(value) {
    const p = current();
    if (!p) return;
    p.star[STEPS[state.step].k] = value;
    store.saveProject(p);
    // 단계 표시·프로젝트 점 갱신 (전체 다시 그리지 않아 입력 커서 유지)
    const stepBtn = document.querySelector(`[data-step="${state.step}"]`);
    if (stepBtn) stepBtn.classList.toggle('is-filled', !!value.trim());
    const dot = document.querySelector(`[data-dot="${CSS.escape(p.id)}"]`);
    if (dot) { const st = starStatus(p); dot.className = `pf-dot ${st.key === 'none' ? '' : `is-${st.key}`}`; }
    const saved = document.getElementById('saved');
    if (saved) { saved.innerHTML = '<i data-lucide="check"></i>자동 저장됨'; icons(); }
  }

  function goStep(i) {
    state.step = Math.max(0, Math.min(STEPS.length - 1, i));
    document.querySelectorAll('[data-step]').forEach((b) => b.classList.toggle('is-on', Number(b.dataset.step) === state.step));
    renderQuestion();
    document.getElementById('answer').focus();
  }

  async function copy() {
    const text = plainOutput();
    try { await navigator.clipboard.writeText(text); } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    toast('복사했어요');
  }

  /* ---------- 이벤트 ---------- */
  $root.addEventListener('input', (e) => {
    if (e.target.id !== 'answer') return;
    const value = e.target.value;
    current().star[STEPS[state.step].k] = value;
    renderOutput(); // 미리보기는 바로
    clearTimeout(saveTimer); // 저장은 입력이 잠깐 멈췄을 때
    saveTimer = setTimeout(() => saveAnswer(value), 350);
  });

  $root.addEventListener('keydown', (e) => {
    if (e.target.id === 'answer' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); flush(); goStep(state.step + 1); }
  });

  function flush() {
    const ta = document.getElementById('answer');
    if (ta && current()) { clearTimeout(saveTimer); saveAnswer(ta.value); }
  }

  $root.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      flush();
      state.projectId = pick.dataset.pick;
      state.step = 0;
      history.replaceState(null, '', `?project=${encodeURIComponent(state.projectId)}`);
      render();
      return;
    }
    const step = e.target.closest('[data-step]');
    if (step) { flush(); goStep(Number(step.dataset.step)); return; }
    if (e.target.closest('#prev')) { flush(); goStep(state.step - 1); return; }
    if (e.target.closest('#next')) { flush(); goStep(state.step + 1); return; }
    const view = e.target.closest('[data-view]');
    if (view) {
      state.view = view.dataset.view;
      document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('is-on', b === view));
      renderOutput();
      return;
    }
    if (e.target.closest('#copy')) copy();
    if (e.target.closest('a[href^="export.html"]')) flush();
  });

  window.addEventListener('beforeunload', flush);
  document.addEventListener('pf:changed', () => { state.projectId = null; cached = null; render(); });

  PF.subnav('star');
  state.projectId = resolveEntry();
  if (state.projectId && params.get('record')) history.replaceState(null, '', `?project=${encodeURIComponent(state.projectId)}`);
  render();
})();

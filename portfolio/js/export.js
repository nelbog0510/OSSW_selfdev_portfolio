/* ==========================================================
   3. 포트폴리오 만들기 (PPT)
   - 목표 직무에 맞는 디자인 테마를 자동으로 골라 슬라이드를 만듦
   - 화면에서 슬라이드를 넘겨 보며 확인 → .pptx(파워포인트) / PDF로 저장, 발표 모드
   - 슬라이드 배치·테마는 js/slides.js
   ========================================================== */
(function () {
  'use strict';
  const { store, esc, fmtDate, period, tagCounts, recordsOf, starStatus, icons, toast, sourceLabel } = PF;
  const S = PFSlides;

  const $panel = document.getElementById('panel');
  const $main = document.getElementById('main-slide');
  const $mainScale = document.getElementById('main-scale');
  const $thumbs = document.getElementById('thumbs');
  const $label = document.getElementById('slide-label');
  const params = new URLSearchParams(location.search);

  const user = store.user();
  const projects = store.projects();
  const records = store.records();
  const firstJob = PF.findJob(user.targetJob);

  const state = {
    theme: S.THEMES[params.get('theme')] ? params.get('theme') : S.themeForJob(firstJob),
    auto: !S.THEMES[params.get('theme')], // true면 직무를 바꿀 때 테마도 따라 바뀜
    jobId: firstJob ? firstJob.id : '',
    name: user.nickname || '',
    intro: '',
    contact: '',
    selected: new Set(projects.filter((p) => recordsOf(p, records).length).map((p) => p.id)),
    sections: { about: true, contents: true, others: true, closing: true },
    current: 0,
  };
  if (params.get('project')) state.selected.add(params.get('project'));
  let slides = [];

  /* ---------- 데이터 모으기 ---------- */
  const job = () => PF.jobs().find((j) => j.id === state.jobId) || null;
  const needTags = () => { const j = job(); return j && j.skills ? Object.keys(j.skills) : []; };

  // 선택한 프로젝트 (목표 직무와 관련 높은 순)
  function chosen() {
    const need = needTags();
    const score = (p) => tagCounts(recordsOf(p, records)).filter(([t]) => need.includes(t)).reduce((s, [, n]) => s + n, 0);
    return projects.slice().reverse().filter((p) => state.selected.has(p.id)).sort((a, b) => score(b) - score(a));
  }

  // 직무 매칭과 같은 방식: 역량별 충족도(내 경험 수 ÷ 필요 수준, 최대 1)의 평균
  function jobFit(j) {
    if (!j || !j.skills) return null;
    const mine = Object.fromEntries(tagCounts(records));
    const rows = Object.entries(j.skills).map(([tag, need]) => {
      const n = Number(need) || 1; const have = mine[tag] || 0;
      return { tag, need: n, have, ratio: Math.min(1, have / n) };
    }).sort((a, b) => b.ratio - a.ratio);
    return { rows, rate: rows.length ? Math.round((rows.reduce((s, r) => s + r.ratio, 0) / rows.length) * 100) : 0 };
  }

  function deckData() {
    const list = chosen();
    const need = needTags();
    const recsInDeck = list.flatMap((p) => recordsOf(p, records));
    const ranked = tagCounts(recsInDeck).map(([t, n]) => ({ tag: t, count: n }));
    const strengthInfo = ranked.filter((r) => need.includes(r.tag)).concat(ranked.filter((r) => !need.includes(r.tag))).slice(0, 3)
      .map((s) => {
        // 그 역량이 가장 많이 나온 프로젝트 = 근거
        const best = list.map((p) => ({ p, n: recordsOf(p, records).filter((r) => (r.tags || []).includes(s.tag)).length }))
          .sort((a, b) => b.n - a.n)[0];
        return { ...s, evidence: best && best.n ? best.p.title : '' };
      });
    const used = new Set(list.flatMap((p) => p.recordIds));
    return {
      name: state.name || '이름',
      intro: state.intro.trim(),
      contact: state.contact.trim(),
      job: job(),
      fit: jobFit(job()),
      strengths: strengthInfo.map((s) => s.tag),
      strengthInfo,
      allTags: tagCounts(records),
      sections: state.sections,
      projects: list.map((p) => {
        const recs = recordsOf(p, records);
        return {
          title: p.title,
          period: period(recs),
          tags: tagCounts(recs).map(([t]) => t).sort((a, b) => need.includes(b) - need.includes(a)),
          star: p.star,
          records: recs.map((r) => ({ title: r.title || '제목 없는 기록', date: fmtDate(r.date), source: sourceLabel(r.source) })),
        };
      }),
      otherRecords: records.filter((r) => !used.has(r.id))
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .map((r) => ({ title: r.title || '제목 없는 기록', date: fmtDate(r.date).slice(0, 7), source: sourceLabel(r.source) })),
    };
  }

  /* ---------- 설정 패널 ---------- */
  function renderPanel() {
    const jobs = PF.jobs();
    $panel.innerHTML = `
      <div class="pf-actions">
        <button type="button" class="pf-btn pf-btn--primary pf-btn--lg" id="save-pptx"><i data-lucide="presentation"></i>PPT로 저장</button>
        <button type="button" class="pf-btn pf-btn--lg" id="save-pdf" title="PDF로 저장" aria-label="PDF로 저장"><i data-lucide="file-down"></i>PDF</button>
      </div>

      <section>
        <h2>목표 직무</h2>
        <select id="f-job" class="pf-select">
          <option value="">선택 안 함</option>
          ${jobs.map((j) => `<option value="${esc(j.id)}" ${state.jobId === j.id ? 'selected' : ''}>${esc(j.name)}</option>`).join('')}
        </select>
        <p class="pf-help">${firstJob ? `부족 역량 분석에서 정한 목표 직무(${esc(firstJob.name)})가 자동으로 들어갔어요.` : '부족 역량 분석에서 목표 직무를 정하면 자동으로 들어가요.'}</p>
      </section>

      <section>
        <h2>디자인 테마</h2>
        <p class="pf-tpl-note" id="theme-note"></p>
        <div class="pf-themes">${Object.values(S.THEMES).map((t) => `
          <label class="pf-theme">
            <input type="radio" name="theme" value="${t.id}" ${state.theme === t.id ? 'checked' : ''}>
            <span class="pf-swatch" style="background:#${t.bg}"><i style="background:#${t.accent}"></i><i style="background:#${t.ink}"></i><i style="background:#${t.soft}"></i></span>
            <span class="pf-theme-text"><strong>${t.name}</strong><span>${t.label}</span><em>${t.fit}</em></span>
          </label>`).join('')}
        </div>
      </section>

      <section>
        <h2>기본 정보</h2>
        <div><label class="pf-label" for="f-name">이름</label><input id="f-name" class="pf-input" value="${esc(state.name)}" placeholder="이름 또는 닉네임" maxlength="20"></div>
        <div><label class="pf-label" for="f-intro">한 줄 소개</label><input id="f-intro" class="pf-input" value="${esc(state.intro)}" placeholder="예: 사용자의 불편을 먼저 묻는 기획자" maxlength="40"></div>
        <div><label class="pf-label" for="f-contact">연락처 (선택)</label><input id="f-contact" class="pf-input" value="${esc(state.contact)}" placeholder="이메일 등" maxlength="50"></div>
      </section>

      <section>
        <h2>슬라이드 구성</h2>
        <div class="pf-checks">
          ${[['about', '한눈에 보기', '강점 역량 · 직무 적합도'], ['contents', '목차', '프로젝트 2개 이상일 때'], ['others', '그 밖의 경험', '프로젝트에 안 넣은 기록'], ['closing', '마무리', '감사 인사 · 연락처']].map(([k, name, help]) => `
            <label class="pf-check"><input type="checkbox" data-section="${k}" ${state.sections[k] ? 'checked' : ''}><span class="pf-check-name">${name}</span><span class="pf-help">${help}</span></label>`).join('')}
        </div>
      </section>

      <section>
        <h2>넣을 프로젝트</h2>
        ${projects.length ? `<div class="pf-checks">${projects.slice().reverse().map((p) => {
          const st = starStatus(p);
          return `<label class="pf-check"><input type="checkbox" data-project value="${esc(p.id)}" ${state.selected.has(p.id) ? 'checked' : ''}><span class="pf-check-name">${esc(p.title)}</span><span class="pf-badge pf-badge--${st.key}">${st.key === 'done' ? '완성' : st.key === 'doing' ? `${st.n}/4` : '미작성'}</span></label>`;
        }).join('')}</div>
        <p class="pf-help">프로젝트마다 슬라이드 1장이 만들어져요. 목표 직무와 관련 높은 순서로 들어가요.</p>
        <p class="pf-warn" id="star-warn" hidden></p>`
        : `<p class="pf-help">아직 프로젝트가 없어요.</p><a class="pf-btn pf-btn--sm" href="index.html"><i data-lucide="folder-kanban"></i>프로젝트 묶으러 가기</a>`}
      </section>`;
    icons();
  }

  function updatePanel() {
    $panel.querySelectorAll('input[name="theme"]').forEach((r) => { r.checked = r.value === state.theme; });
    const j = job();
    const t = S.THEMES[state.theme];
    document.getElementById('theme-note').innerHTML = state.auto
      ? (j ? `<i data-lucide="sparkles"></i>${esc(j.name)}에 어울리는 <b>${t.name} · ${t.label}</b> 테마예요` : '<i data-lucide="info"></i>목표 직무를 고르면 어울리는 테마를 골라 줘요')
      : `<i data-lucide="hand"></i>직접 고른 테마예요 · <button type="button" class="pf-linkbtn" id="theme-auto">직무에 맞추기</button>`;
    const warn = document.getElementById('star-warn');
    if (warn) {
      const n = chosen().filter((p) => starStatus(p).key !== 'done').length;
      warn.hidden = !n;
      warn.innerHTML = `STAR가 덜 채워진 프로젝트가 ${n}개 있어요. 그 슬라이드에는 묶인 기록 목록이 대신 들어가요. <a href="star.html" style="color:inherit">STAR 정리하기</a>`;
    }
    icons();
  }

  /* ---------- 슬라이드 보기 ---------- */
  function renderSlides() {
    slides = S.build(state.theme, deckData());
    state.current = Math.min(state.current, slides.length - 1);
    $thumbs.innerHTML = slides.map((s, i) => `
      <button type="button" class="pf-thumb ${i === state.current ? 'is-on' : ''}" data-go="${i}" aria-label="${i + 1}번 슬라이드 ${esc(s.label)}">
        <span class="pf-thumb-scale">${S.toHTML(s)}</span><span class="pf-thumb-no">${i + 1}</span>
      </button>`).join('');
    showCurrent();
    updatePanel();
  }

  function showCurrent() {
    const s = slides[state.current];
    $mainScale.innerHTML = S.toHTML(s);
    $label.textContent = `${state.current + 1} / ${slides.length} · ${s.label}`;
    $thumbs.querySelectorAll('.pf-thumb').forEach((b, i) => b.classList.toggle('is-on', i === state.current));
    const on = $thumbs.querySelector('.is-on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    fit();
  }

  function fit() {
    const w = $main.clientWidth;
    $mainScale.style.zoom = String(w / (S.W * S.PX));
  }

  function go(i) {
    if (!slides.length) return;
    state.current = Math.max(0, Math.min(slides.length - 1, i));
    showCurrent();
    if (presenting) showPresent();
  }

  /* ---------- 발표 모드 ---------- */
  let presenting = null;
  function present() {
    presenting = document.createElement('div');
    presenting.className = 'pf-present';
    presenting.innerHTML = '<div class="pf-present-scale"></div><p class="pf-present-help">← → 넘기기 · Esc 나가기</p>';
    document.body.appendChild(presenting);
    presenting.addEventListener('click', (e) => go(state.current + (e.clientX < window.innerWidth / 3 ? -1 : 1)));
    if (presenting.requestFullscreen) presenting.requestFullscreen().catch(() => {});
    showPresent();
  }
  function showPresent() {
    const sc = presenting.querySelector('.pf-present-scale');
    sc.innerHTML = S.toHTML(slides[state.current]);
    const z = Math.min(window.innerWidth / (S.W * S.PX), window.innerHeight / (S.H * S.PX));
    sc.style.zoom = String(z);
  }
  function endPresent() {
    if (!presenting) return;
    presenting.remove();
    presenting = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && presenting) endPresent(); });

  /* ---------- 저장 ---------- */
  const fileName = () => `포트폴리오_${(state.name || '이름').replace(/[\\/:*?"<>|]/g, '')}_${S.THEMES[state.theme].name}`;

  async function busy(btn, label, work) {
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = label;
    try { await work(); } catch (e) { console.error(e); toast('저장하지 못했어요. 잠시 뒤 다시 해 보세요'); }
    btn.disabled = false;
    btn.innerHTML = old;
    icons();
  }

  function savePptx(btn) {
    if (typeof PptxGenJS === 'undefined') { toast('PPT 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요'); return; }
    busy(btn, 'PPT 만드는 중…', async () => {
      await S.toPptx(slides, { name: state.name || '이름', fileName: fileName() });
      toast('PPT 파일을 저장했어요');
    });
  }

  // 슬라이드를 한 장씩 그림으로 찍어 가로 PDF로
  function savePdf(btn) {
    if (typeof html2pdf === 'undefined') { toast('PDF 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요'); return; }
    busy(btn, 'PDF…', async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-20000px;top:0;';
      holder.innerHTML = slides.map((s) => S.toHTML(s)).join('');
      document.body.appendChild(holder);
      const nodes = [...holder.children];
      const w = S.W * S.PX; const h = S.H * S.PX;
      const opt = {
        margin: 0,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, width: w, height: h, windowWidth: w },
        jsPDF: { unit: 'px', format: [w, h], orientation: 'landscape', hotfixes: ['px_scaling'] },
      };
      try {
        // 한 장씩 그림으로 찍기 (html2pdf 안의 html2canvas 사용)
        const canvases = [];
        let pdf = null;
        for (let i = 0; i < nodes.length; i += 1) {
          const worker = html2pdf().set(opt).from(nodes[i]);
          canvases.push(await worker.toCanvas().get('canvas'));
          if (!pdf) pdf = await worker.toPdf().get('pdf'); // html2pdf에 들어 있는 jsPDF 문서를 그대로 사용
        }
        // 첫 장만 남기고 비운 뒤 한 장에 슬라이드 하나씩
        while (pdf.getNumberOfPages() > 1) pdf.deletePage(pdf.getNumberOfPages());
        canvases.forEach((c, i) => {
          if (i > 0) pdf.addPage([w, h], 'landscape'); else pdf.setPage(1);
          pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h);
        });
        pdf.save(`${fileName()}.pdf`);
        toast('PDF를 저장했어요');
      } finally {
        holder.remove();
      }
    });
  }

  /* ---------- 이벤트 ---------- */
  $panel.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'theme') { state.theme = t.value; state.auto = false; }
    else if (t.id === 'f-job') { state.jobId = t.value; if (state.auto) state.theme = S.themeForJob(job()); }
    else if (t.dataset.section) state.sections[t.dataset.section] = t.checked;
    else if (t.hasAttribute('data-project')) { if (t.checked) state.selected.add(t.value); else state.selected.delete(t.value); }
    else return;
    renderSlides();
  });
  let typing;
  $panel.addEventListener('input', (e) => {
    const map = { 'f-name': 'name', 'f-intro': 'intro', 'f-contact': 'contact' };
    if (!map[e.target.id]) return;
    state[map[e.target.id]] = e.target.value;
    clearTimeout(typing);
    typing = setTimeout(renderSlides, 250);
  });
  $panel.addEventListener('click', (e) => {
    const pptxBtn = e.target.closest('#save-pptx');
    if (pptxBtn) savePptx(pptxBtn);
    const pdfBtn = e.target.closest('#save-pdf');
    if (pdfBtn) savePdf(pdfBtn);
    if (e.target.closest('#theme-auto')) { state.auto = true; state.theme = S.themeForJob(job()); renderSlides(); }
  });
  $thumbs.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(Number(b.dataset.go)); });
  document.getElementById('prev').addEventListener('click', () => go(state.current - 1));
  document.getElementById('next').addEventListener('click', () => go(state.current + 1));
  document.getElementById('present').addEventListener('click', present);
  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || (presenting && e.key === ' ')) { e.preventDefault(); go(state.current + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(state.current - 1); }
    if (e.key === 'Escape') endPresent();
  });
  window.addEventListener('resize', () => { fit(); if (presenting) showPresent(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  document.addEventListener('pf:changed', () => location.reload());

  PF.subnav('export');
  renderPanel();
  renderSlides();
})();

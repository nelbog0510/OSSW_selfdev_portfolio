/* ==========================================================
   1. 프로젝트 묶기
   - 왼쪽: 어떤 프로젝트에도 안 들어간 기록
   - 오른쪽: 프로젝트 칸 (SortableJS로 끌어다 넣기)
   - 저장: project.recordIds / 대표 역량 = 묶인 기록 태그 합계
   ========================================================== */
(function () {
  'use strict';
  const { store, esc, fmtDate, sourceLabel, tagCounts, recordsOf, starStatus, icons, toast } = PF;

  const $pool = document.getElementById('pool-list');
  const $poolCount = document.getElementById('pool-count');
  const $filter = document.getElementById('pool-filter');
  const $search = document.getElementById('pool-search');
  const $projects = document.getElementById('project-list');
  const $projectCount = document.getElementById('project-count');

  const state = { tag: '', query: '', justCreated: null };
  let sortables = [];

  /* ---------- 그리기 ---------- */
  function render() {
    const records = store.records().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const projects = store.projects();
    const used = new Set(projects.flatMap((p) => p.recordIds));
    const pool = records.filter((r) => !used.has(r.id));

    renderPool(records, pool, projects);
    renderProjects(records, projects);
    applyFilter();
    bindSortable();
    icons();
  }

  function renderPool(records, pool, projects) {
    $poolCount.textContent = pool.length;
    $pool.parentElement.querySelector('.pf-empty')?.remove();
    // 기록이 아예 없으면 안내 + 샘플 버튼
    if (!records.length) {
      $filter.innerHTML = '';
      $pool.innerHTML = '';
      $pool.hidden = true;
      $pool.insertAdjacentHTML('afterend', PF.sampleEmpty('경험 기록 메뉴에서 기록을 남기거나, 샘플 기록으로 먼저 살펴보세요.'));
      return;
    }
    $pool.hidden = false;

    // 태그 필터 칩 (정리 안 된 기록에 있는 태그만)
    const tags = tagCounts(pool).map(([t]) => t);
    if (state.tag && !tags.includes(state.tag)) state.tag = '';
    $filter.innerHTML = tags.length
      ? [`<button type="button" class="pf-chip ${state.tag ? '' : 'is-on'}" data-tag="">전체</button>`]
        .concat(tags.map((t) => `<button type="button" class="pf-chip ${state.tag === t ? 'is-on' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`)).join('')
      : '';

    const options = projects.length
      ? `<option value="">프로젝트에 넣기</option>${projects.slice().reverse().map((p) => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('')}`
      : '';
    $pool.innerHTML = pool.map((r) => `
      <li class="pf-rec" data-id="${esc(r.id)}" data-search="${esc(`${r.title || ''} ${r.content || ''}`.toLowerCase())}" data-tags="${esc((r.tags || []).join('|'))}">
        <span class="pf-grip" aria-hidden="true"><i data-lucide="grip-vertical"></i></span>
        <div class="pf-rec-top"><span class="pf-source" data-src="${esc(r.source)}">${esc(sourceLabel(r.source))}</span>${esc(fmtDate(r.date))}</div>
        <p class="pf-rec-title">${esc(r.title || '제목 없는 기록')}</p>
        ${r.content ? `<p class="pf-rec-text">${esc(r.content)}</p>` : ''}
        <div class="pf-rec-foot">
          <div class="pf-tags">${(r.tags || []).map((t) => `<span class="pf-tag pf-tag--gray">${esc(t)}</span>`).join('')}</div>
          ${options ? `<select class="pf-select pf-move" aria-label="${esc(r.title)} 프로젝트에 넣기">${options}</select>` : ''}
        </div>
      </li>`).join('');
  }

  function renderProjects(records, projects) {
    $projectCount.textContent = projects.length;
    if (!projects.length) {
      $projects.innerHTML = `<div class="pf-card pf-empty" style="grid-column:1/-1">
        <i data-lucide="folder-kanban"></i><strong>첫 프로젝트를 만들어 보세요</strong>
        <p>같은 활동에서 나온 기록들을 한 프로젝트로 묶으면<br>STAR로 정리하고 포트폴리오에 넣을 수 있어요.</p>
        <button type="button" class="pf-btn pf-btn--primary" data-add-project><i data-lucide="plus"></i>새 프로젝트 만들기</button></div>`;
      return;
    }
    $projects.innerHTML = projects.slice().reverse().map((p) => {
      const recs = recordsOf(p, records);
      const rep = tagCounts(recs);
      const st = starStatus(p);
      return `
      <article class="pf-card pf-project ${state.justCreated === p.id ? 'is-new' : ''}" data-id="${esc(p.id)}">
        <div>
          <input class="pf-project-title" value="${esc(p.title)}" aria-label="프로젝트 제목" placeholder="프로젝트 제목 입력" maxlength="60">
          <div class="pf-project-meta">
            <span>기록 ${recs.length}개</span>
            <span class="pf-badge pf-badge--${st.key}"><i data-lucide="${st.icon}"></i>${st.label}</span>
          </div>
        </div>
        <ul class="pf-drop" data-empty="왼쪽 기록을 여기로 끌어다 놓으세요">${recs.map((r) => `<li class="pf-rec pf-rec--mini" data-id="${esc(r.id)}"><span class="pf-grip" aria-hidden="true"><i data-lucide="grip-vertical"></i></span><div class="pf-rec-row"><p class="pf-rec-title">${esc(r.title || '제목 없는 기록')}</p><button type="button" class="pf-icon-btn" data-unlink="${esc(r.id)}" aria-label="${esc(r.title)} 빼기" title="프로젝트에서 빼기"><i data-lucide="x"></i></button></div><div class="pf-tags"><span class="pf-source" data-src="${esc(r.source)}">${esc(sourceLabel(r.source))}</span>${(r.tags || []).map((t) => `<span class="pf-tag pf-tag--gray">${esc(t)}</span>`).join('')}</div></li>`).join('')}</ul>
        <div class="pf-rep">
          <span class="pf-label">대표 역량</span>
          <div class="pf-tags">${rep.length ? rep.map(([t, n]) => `<span class="pf-tag">${esc(t)} <b>${n}</b></span>`).join('') : '<span class="pf-help">기록을 넣으면 태그가 모여요</span>'}</div>
        </div>
        <div class="pf-project-actions">
          <a class="pf-btn pf-btn--sm ${recs.length ? 'pf-btn--primary' : ''}" href="star.html?project=${encodeURIComponent(p.id)}"><i data-lucide="star"></i>STAR 정리하기</a>
          ${store.canDelete() ? '<button type="button" class="pf-btn pf-btn--sm pf-btn--ghost pf-btn--danger" data-delete><i data-lucide="trash-2"></i>삭제</button>' : ''}
        </div>
      </article>`;
    }).join('');
  }

  /* ---------- 검색·태그 거르기 (정리 안 된 기록) ---------- */
  function applyFilter() {
    const q = state.query.trim().toLowerCase();
    $pool.querySelectorAll('.pf-rec').forEach((li) => {
      const okTag = !state.tag || li.dataset.tags.split('|').includes(state.tag);
      const okQ = !q || li.dataset.search.includes(q);
      li.classList.toggle('is-hidden', !(okTag && okQ));
    });
  }

  /* ---------- 끌어다 놓기 ---------- */
  function bindSortable() {
    sortables.forEach((s) => s.destroy());
    sortables = [];
    if (typeof Sortable === 'undefined') return; // 못 불러와도 "프로젝트에 넣기" 선택으로 사용 가능
    const lists = [$pool, ...$projects.querySelectorAll('.pf-drop')];
    lists.forEach((el) => {
      sortables.push(Sortable.create(el, {
        group: 'pf-records',
        animation: 160,
        filter: 'select, button, input',
        preventOnFilter: false,
        onEnd: (evt) => { if (evt.from !== evt.to || evt.oldIndex !== evt.newIndex) syncFromDom(); },
      }));
    });
  }

  // 화면에 놓인 순서 그대로 각 프로젝트의 recordIds 저장
  function syncFromDom() {
    const projects = store.projects();
    let moved = false;
    $projects.querySelectorAll('.pf-project').forEach((card) => {
      const p = projects.find((x) => x.id === card.dataset.id);
      if (!p) return;
      const ids = [...card.querySelectorAll('.pf-drop > .pf-rec')].map((li) => li.dataset.id);
      if (ids.join() !== p.recordIds.join()) {
        if (ids.length > p.recordIds.length) moved = true;
        p.recordIds = ids;
        store.saveProject(p);
      }
    });
    state.justCreated = null;
    render();
    if (moved) toast('프로젝트에 묶었어요');
  }

  function update(id, fn) {
    const p = store.projects().find((x) => x.id === id);
    if (!p) return;
    fn(p);
    store.saveProject(p);
  }

  function addProject() {
    const p = { id: PF.newId('p'), title: '새 프로젝트', recordIds: [], star: { s: '', t: '', a: '', r: '' } };
    store.saveProject(p);
    state.justCreated = p.id;
    render();
    const input = $projects.querySelector(`.pf-project[data-id="${CSS.escape(p.id)}"] .pf-project-title`);
    if (input) { input.focus(); input.select(); }
  }

  /* ---------- 이벤트 ---------- */
  document.getElementById('add-project').addEventListener('click', addProject);
  document.addEventListener('click', (e) => { if (e.target.closest('[data-add-project]')) addProject(); });

  $search.addEventListener('input', () => { state.query = $search.value; applyFilter(); });
  $filter.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    state.tag = b.dataset.tag;
    $filter.querySelectorAll('.pf-chip').forEach((c) => c.classList.toggle('is-on', c === b));
    applyFilter();
  });

  // 드래그 대신 선택으로 넣기 (모바일·키보드 사용자용)
  $pool.addEventListener('change', (e) => {
    const sel = e.target.closest('.pf-move');
    if (!sel || !sel.value) return;
    const recId = sel.closest('.pf-rec').dataset.id;
    update(sel.value, (p) => { if (!p.recordIds.includes(recId)) p.recordIds.push(recId); });
    state.justCreated = null;
    render();
    toast('프로젝트에 묶었어요');
  });

  $projects.addEventListener('click', (e) => {
    const card = e.target.closest('.pf-project');
    if (!card) return;
    const un = e.target.closest('[data-unlink]');
    if (un) {
      update(card.dataset.id, (p) => { p.recordIds = p.recordIds.filter((id) => id !== un.dataset.unlink); });
      state.justCreated = null;
      render();
      return;
    }
    const del = e.target.closest('[data-delete]');
    if (del) {
      PF.confirmClick(del, '한 번 더 누르면 삭제', () => {
        store.deleteProject(card.dataset.id);
        render();
        toast('프로젝트를 삭제했어요 (기록은 그대로 남아요)');
      });
    }
  });

  // 제목 저장
  $projects.addEventListener('change', (e) => {
    const input = e.target.closest('.pf-project-title');
    if (!input) return;
    const title = input.value.trim() || '이름 없는 프로젝트';
    input.value = title;
    update(input.closest('.pf-project').dataset.id, (p) => { p.title = title; });
    // 왼쪽 "프로젝트에 넣기" 목록 이름도 새로
    $pool.querySelectorAll(`option[value="${CSS.escape(input.closest('.pf-project').dataset.id)}"]`).forEach((o) => { o.textContent = title; });
    toast('제목을 저장했어요');
  });
  $projects.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('pf-project-title')) e.target.blur();
  });

  document.addEventListener('pf:changed', render);
  window.addEventListener('storage', render); // 다른 탭에서 기록이 바뀌면 새로 그림

  PF.subnav('projects');
  render();
})();

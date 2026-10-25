/* ==========================================================================
   《你不是矫情》· 站点交互
   检索 / 筛选 / 键盘操作。数据由 build_site.py 内联进 search-data.js，
   不用 fetch，所以直接双击 index.html 也能用。
   ========================================================================== */
(function () {
  'use strict';

  var DATA = window.__SEARCH__ || [];
  var ENTRIES = DATA.filter(function (d) { return d.type === 'entry'; });
  var GROUPS = window.__GROUPS__ || [];
  var SCENES = window.__SCENES__ || [];

  var GROUP_NAME = {};
  GROUPS.forEach(function (g) { GROUP_NAME[g[0]] = g[1]; });

  /* ── 工具 ────────────────────────────────────────────────────────────── */
  function norm(s) {
    return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function tokens(q) {
    return norm(q).split(/[、,，\/\s]+/).filter(function (t) { return t.length > 0; });
  }

  function score(item, toks) {
    var t = norm(item.title), a = norm(item.alias), p = norm(item.pick),
        g = norm(GROUP_NAME[item.group] || ''), x = norm(item.text);
    var total = 0;
    for (var i = 0; i < toks.length; i++) {
      var k = toks[i], s = 0;
      if (t.indexOf(k) >= 0) s += 100;
      if (a.indexOf(k) >= 0) s += 60;
      if (p.indexOf(k) >= 0) s += 50;
      if (g.indexOf(k) >= 0) s += 30;
      if (x.indexOf(k) >= 0) s += 10;
      if (s === 0) return -1;           // 必须全部命中
      total += s;
    }
    return total;
  }

  function snippet(text, toks, len) {
    len = len || 108;
    var raw = String(text || '').replace(/\s+/g, ' ');
    var pos = -1;
    for (var i = 0; i < toks.length; i++) {
      var p = raw.indexOf(toks[i]);
      if (p > 28) { pos = p; break; }
    }
    if (pos < 0) return raw.slice(0, len);
    var start = Math.max(0, pos - 28);
    return (start > 0 ? '…' : '') + raw.slice(start, start + len);
  }

  function highlight(text, toks) {
    var out = esc(text);
    for (var i = 0; i < toks.length; i++) {
      var k = esc(toks[i]);
      if (!k) continue;
      out = out.split(k).join('<mark>' + k + '</mark>');
    }
    return out;
  }

  /* ── 搜索 ────────────────────────────────────────────────────────────── */
  function search(q, kind) {
    var toks = tokens(q);
    if (!toks.length) return [];
    var pool = DATA;
    if (kind === 'entry') pool = ENTRIES;
    var out = [];
    for (var i = 0; i < pool.length; i++) {
      var s = score(pool[i], toks);
      if (s > 0) out.push({ item: pool[i], s: s });
    }
    out.sort(function (a, b) { return b.s - a.s; });
    return out.map(function (o) { return o.item; });
  }

  /* ── 浮层搜索（全站） ────────────────────────────────────────────────── */
  var overlay = document.getElementById('overlay');
  var sinput = document.getElementById('s-input');
  var sres = document.getElementById('s-res');
  var openBtn = document.getElementById('search-open');
  var closeBtn = document.getElementById('s-close');

  function openSearch() {
    if (!overlay) return;
    overlay.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    if (sinput) { sinput.value = ''; sinput.focus(); }
    renderSearch('');
  }

  function closeSearch() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.documentElement.style.overflow = '';
  }

  function typeLabel(t) {
    return { entry: '症状条目', tool: '通用工具', story: '自修样本', book: '延伸书单' }[t] || '';
  }

  function renderSearch(q) {
    if (!sres) return;
    if (!q || !q.trim()) {
      sres.innerHTML =
        '<div class="search-empty">想说什么都可以：睡不着、心慌、反复想一件事、怕猫狗……<br>' +
        '也可以直接输入身体部位，比如「胃」「心跳」。</div>';
      return;
    }
    var toks = tokens(q);
    var hits = search(q);
    if (!hits.length) {
      sres.innerHTML = '<div class="search-empty">没有找到。换个说法试试，' +
        '比如把「我很难受」换成具体的「睡不着」「心慌」。</div>';
      return;
    }
    var html = hits.slice(0, 24).map(function (h) {
      var sub = h.alias || h.pick || '';
      return '<a href="' + h.url + '">' +
        '<div class="r-t">' + highlight(h.title, toks) + '</div>' +
        (sub ? '<div class="r-m">' + highlight(sub, toks) + '</div>' : '') +
        '<div class="r-x">' + highlight(snippet(h.text, toks), toks) + '</div>' +
        '</a>';
    }).join('');
    sres.innerHTML = html;
  }

  if (openBtn) openBtn.addEventListener('click', openSearch);
  if (closeBtn) closeBtn.addEventListener('click', closeSearch);
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeSearch();
    });
  }
  if (sinput) {
    sinput.addEventListener('input', function () { renderSearch(sinput.value); });
  }

  /* ── 检索页 ──────────────────────────────────────────────────────────── */
  var binput = document.getElementById('b-input');
  var btags = document.getElementById('b-tags');
  var blist = document.getElementById('b-list');
  var bcount = document.getElementById('b-count');
  var bnone = document.getElementById('b-none');
  var state = { g: '', q: '', ids: null };

  function renderTags() {
    if (!btags) return;
    Array.prototype.forEach.call(btags.querySelectorAll('.tag'), function (b) {
      var g = b.getAttribute('data-g') || '';
      b.className = 'tag' + (state.g === g ? ' on' : '');
      b.onclick = function () {
        state.g = g;
        state.ids = null;
        renderTags();
        filterCards();
        writeHash();
      };
    });
  }

  function filterCards() {
    if (!blist) return;
    var cards = blist.querySelectorAll('.card-e');
    var toks = tokens(state.q);
    /* 关键词走全文索引（内联在 search-data.js 里），
       这样在检索页输入「心慌」「胃疼」也能命中正文里提到的条目。 */
    var hitIds = null;
    if (toks.length) {
      hitIds = {};
      search(state.q, 'entry').forEach(function (h) { hitIds[h.id] = 1; });
    }
    var shown = 0;
    Array.prototype.forEach.call(cards, function (c) {
      var ok = true;
      if (state.g && c.getAttribute('data-letter') !== state.g) ok = false;
      if (ok && state.ids) ok = state.ids.indexOf(c.getAttribute('data-id')) >= 0;
      if (ok && hitIds) ok = !!hitIds[c.getAttribute('data-id')];
      c.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    if (bcount) bcount.textContent = shown ? ('共 ' + shown + ' 条') : '没有匹配的条目';
    if (bnone) bnone.style.display = shown ? 'none' : '';
  }

  function readHash() {
    var h = (location.hash || '').replace(/^#/, '');
    var g = ((/g=([A-J])/.exec(h) || [])[1] || '');
    var q = '';
    var mq = /q=([^&]*)/.exec(h);
    if (mq) { try { q = decodeURIComponent(mq[1]); } catch (e) { q = mq[1]; } }
    var ids = null;
    var mi = /ids=([^&]*)/.exec(h);
    if (mi && mi[1]) ids = mi[1].split(',');
    return { g: g, q: q, ids: ids };
  }

  function writeHash() {
    var parts = [];
    if (state.g) parts.push('g=' + state.g);
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (parts.length && history && history.replaceState) {
      history.replaceState(null, '', '#' + parts.join('&'));
    }
  }

  if (binput && blist) {   /* 仅检索页绑定筛选逻辑 */
    var st = readHash();
    state.g = st.g; state.q = st.q; state.ids = st.ids;
    binput.value = state.q;
    renderTags();
    filterCards();
    binput.addEventListener('input', function () {
      state.q = binput.value;
      state.ids = null;
      filterCards();
      writeHash();
    });
  }

  /* ── 大搜索框：首页提交后跳检索页；检索页就地筛选 ──────────────────── */
  var hform = document.getElementById('hero-search');
  if (hform) {
    hform.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = (binput && binput.value) || '';
      if (blist) {                    /* 已在检索页 */
        state.q = v;
        state.ids = null;
        filterCards();
        writeHash();
      } else {
        location.href = 'browse.html#q=' + encodeURIComponent(v);
      }
    });
  }

  /* ── 键盘：/ 聚焦搜索，Esc 关闭 ─────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    if (e.key === '/' && !typing) {
      if (binput) { e.preventDefault(); binput.focus(); }
      else if (overlay) { e.preventDefault(); openSearch(); }
    }
    if (e.key === 'Escape') { closeSearch(); }
  });

  /* ── 返回顶部 ────────────────────────────────────────────────────────── */
  var top = document.getElementById('to-top');
  if (top) {
    top.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', function () {
      top.classList.toggle('show', window.scrollY > 700);
    }, { passive: true });
  }
})();

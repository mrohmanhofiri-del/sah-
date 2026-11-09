(() => {
  'use strict';
  const CATEGORIES = ['KUA', 'Venue', 'Katering', 'Pakaian', 'Undangan', 'Dekorasi', 'Dokumentasi', 'Hiburan', 'Lainnya'];
  const PRIORITIES = [['normal', 'Normal'], ['tinggi', 'Tinggi'], ['rendah', 'Rendah']];
  const ASSIGNEES = ['Mempelai', 'Orang tua', 'Keluarga', 'WO'];
  const BUDGET_CATS = ['Venue', 'Katering', 'Dekorasi', 'Pakaian', 'Fotografi', 'MUA', 'Undangan', 'Hiburan', 'Seserahan & mahar', 'Souvenir', 'Administrasi', 'Lainnya'];
  const PROFILES = { ade: { name: 'Ade', id: 1 }, rohman: { name: 'Rohman', id: 2 } };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rp = (n) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n) || 0);
  const num = (s) => parseInt(String(s).replace(/\D/g, ''), 10) || 0;
  const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDate = (s) => parseDate(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  const state = { tasks: [], budgets: [], catbud: [], loadingCat: true, slists: [], sitems: [], loadingShop: true, vtab: 'vendor', editList: null, editItem: null, itemList: null, channel: null, settings: null, view: 'task',
    fStatus: 'all', fCat: '', fTime: '', fQ: '', fPj: '', fPri: '', grp: {}, openMonths: {},
    loadingTasks: true, loadingBudget: true, loadingPay: true, loadErr: {}, noData: {}, fresh: {}, snap: null, lastOk: null,
    editTask: null, editBudget: null,
    vendors: [], payments: [], loadingVendor: true, profile: null, authed: false, authFailed: false, settingsLoaded: false, editVendor: null, editPay: null, payVendor: null,
    cal: { y: new Date().getFullYear(), m: new Date().getMonth() }, calSel: todayStr() };

  /* ---------- Supabase ---------- */
  const cfg = window.APP_CONFIG || {};
  let sb = null;
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY;
  if (configured && window.supabase) sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  function finalizeToast() { const a = toast._act; toast._act = null; if (a && a.onExpire) a.onExpire(); }
  function hideToast() {
    const t = $('toast'); t.classList.add('hidden');
    if (t.hidePopover) { try { t.hidePopover(); } catch (e) { /* abaikan */ } }
  }
  function toast(msg, act) {
    finalizeToast();
    const t = $('toast'); t.textContent = '';
    const span = document.createElement('span'); span.textContent = msg; t.append(span);
    if (act) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.undo = '1'; b.textContent = act.label;
      b.className = 'ml-3 min-h-touch px-2 font-semibold text-emerald-300 underline';
      b.addEventListener('click', () => { const a = toast._act; toast._act = null; clearTimeout(toast._t); hideToast(); if (a) a.fn(); });
      t.append(b);
    }
    toast._act = act || null;
    t.classList.remove('hidden');
    // Popover = top layer, supaya pesan tetap terlihat di atas <dialog> modal yang masih terbuka.
    if (t.showPopover) { try { if (!t.matches(':popover-open')) t.showPopover(); } catch (e) { /* abaikan */ } }
    clearTimeout(toast._t); toast._t = setTimeout(() => { finalizeToast(); hideToast(); }, act ? 8000 : 3500);
  }
  function banner(html) { const b = $('banner'); b.innerHTML = `<div class="rounded-lg bg-warn-soft border border-warn-line text-warn-ink-2 text-sm p-3">${html}</div>`; b.classList.remove('hidden'); }

  async function init() {
    renderChips(); fillSelects(); setView('home'); renderHome(); renderTasks(); renderBudget(); renderVendors();
    const last = lastProfile();
    if (last && PROFILES[last]) selectProfile(last); else showPicker();
    if (!sb) { banner('Aplikasi belum terhubung ke Supabase. Isi <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> (lihat README).'); return; }
    sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') onSignedOut(); });
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch (e) { /* tampilkan login */ }
    if (session && session.user && session.user.email && !session.user.is_anonymous) await startSession(session);
    else { if (session) { try { await sb.auth.signOut(); } catch (e) { /* abaikan */ } } showLogin(); }
  }

  /* ---------- Login (email + kata sandi) ---------- */
  const ERR_ON = 'rounded-xl border border-danger-line bg-danger-soft text-danger-ink px-3 py-2.5 text-sm'.split(' ');
  function loginErr(msg) {
    const el = $('login-err'); el.textContent = msg || ''; el.classList.toggle('login-err-on', !!msg);
    ERR_ON.forEach((c) => el.classList.toggle(c, !!msg));
    ['l-email', 'l-pass'].forEach((id) => { if (msg) $(id).setAttribute('aria-invalid', 'true'); else $(id).removeAttribute('aria-invalid'); });
  }
  ['l-email', 'l-pass'].forEach((id) => $(id).addEventListener('input', () => { if ($('login-err').textContent) loginErr(''); }));
  $('l-pass-toggle').addEventListener('click', () => {
    const i = $('l-pass'), show = i.type === 'password', t = $('l-pass-toggle');
    i.type = show ? 'text' : 'password';
    t.setAttribute('aria-pressed', String(show)); t.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
  });
  function showLogin() {
    loginErr(''); $('picker').classList.add('hidden'); $('login').classList.remove('hidden');
    $('l-pass').type = 'password'; $('l-pass-toggle').setAttribute('aria-pressed', 'false');
    $('l-email').value ? $('l-pass').focus() : $('l-email').focus();
  }
  async function startSession(session) {
    $('login').classList.add('hidden');
    $('acct-email').textContent = session.user.email; $('pk-email').textContent = session.user.email;
    if (!state.channel) {
      const deb = (fn) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, 300); }; };
      state.channel = sb.channel('wp-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, deb(loadTasks))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, deb(loadSettings))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, deb(loadBudgets))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'category_budgets' }, deb(loadCatbud))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, deb(loadVendors))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists' }, deb(loadShop))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, deb(loadShop))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_payments' }, deb(loadPayments))
        .subscribe((st) => { if (st === 'SUBSCRIBED') { if (state.subbed && state.ready) refreshAll(); state.subbed = true; } });
    }
    state.authed = true; state.authFailed = false;
    if (state.profile) { await refreshAll(); state.ready = true; }
  }
  function onSignedOut() {
    state.subbed = false;
    state.authed = false; state.ready = false;
    if (state.channel) { sb.removeChannel(state.channel); state.channel = null; }
    try { Object.keys(localStorage).filter((k) => k.startsWith('wp-snap-')).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* abaikan */ }
    state.settings = null; state.tasks = []; state.budgets = []; state.catbud = []; state.slists = []; state.sitems = []; state.vendors = []; state.payments = [];
    state.fresh = {}; state.snap = null; state.loadErr = {}; state.noData = {};
    document.querySelectorAll('dialog[open]').forEach((d) => d.close());
    $('picker').classList.add('hidden');
    renderAll(); showLogin();
  }
  lockSubmit($('form-login'), async () => {
    loginErr('');
    if (!sb) return;
    const email = $('l-email').value.trim(), pass = $('l-pass').value;
    if (!email || !pass) { loginErr(!email ? 'Isi email Anda.' : 'Isi kata sandi Anda.'); $(!email ? 'l-email' : 'l-pass').focus(); return; }
    if (navigator.onLine === false) return loginErr('Tidak ada koneksi internet. Periksa jaringan lalu coba lagi.');
    $('login-spin').classList.remove('hidden'); $('login-label').textContent = 'Memproses...';
    try {
      let res; try { res = await sb.auth.signInWithPassword({ email, password: pass }); } catch (e) { res = { error: e }; }
      if (res.error || !res.data || !res.data.session) {
        const bad = res.error && /invalid|credentials/i.test(res.error.message || '');
        loginErr(bad ? 'Email atau kata sandi salah. Periksa lagi lalu coba kembali.' : 'Gagal masuk. Periksa koneksi lalu coba lagi.');
        if (bad) { $('l-pass').select(); }
        return;
      }
      $('l-pass').value = '';
      if (!lastProfile() || !PROFILES[lastProfile()]) showPicker(); else $('picker').classList.add('hidden');
      await startSession(res.data.session);
    } finally { $('login-spin').classList.add('hidden'); $('login-label').textContent = 'Masuk'; }
  });
  async function doLogout() {
    if (!await appConfirm({ title: 'Keluar dari akun?', message: 'Anda perlu masuk lagi untuk membuka data.', ok: 'Keluar' })) return;
    $('dlg-settings').close(); try { await sb.auth.signOut(); } catch (e) { /* abaikan */ } onSignedOut();
  }
  $('btn-logout').addEventListener('click', doLogout);
  $('pk-logout').addEventListener('click', doLogout);

  /* ---------- Muat data + snapshot offline ---------- */
  // Setiap pemuat hanya mengambil data mempelai aktif dan membuang hasil yang datang terlambat
  // bila pengguna sudah berpindah. Bila gagal, data terakhir yang pernah berhasil dimuat (snapshot
  // di perangkat) ditampilkan dengan penanda jelas, bukan layar kosong yang menyesatkan.
  const KEYS = ['settings', 'tasks', 'budgets', 'catbud', 'vendors', 'payments', 'slists', 'sitems'];
  const SRC = { tasks: ['tasks', 'due_date'], budgets: ['budgets', 'item_name'], catbud: ['category_budgets', 'category'], slists: ['shopping_lists', 'name'], sitems: ['shopping_items', 'name'], vendors: ['vendors', 'name'], payments: ['vendor_payments', 'due_date'] };
  const LOADFLAG = { tasks: 'loadingTasks', budgets: 'loadingBudget', catbud: 'loadingCat', slists: 'loadingShop', sitems: 'loadingShop', vendors: 'loadingVendor', payments: 'loadingPay' };
  const readSnap = (p) => { try { return JSON.parse(localStorage.getItem('wp-snap-' + p)); } catch (e) { return null; } };
  function saveSnap() {
    if (!KEYS.every((k) => state.fresh[k])) return;
    try { localStorage.setItem('wp-snap-' + state.profile, JSON.stringify({ t: Date.now(), d: Object.fromEntries(KEYS.map((k) => [k, state[k]])) })); } catch (e) { /* kuota penuh: abaikan */ }
  }
  /* ---------- Perubahan optimistis: tampil langsung, dibatalkan sendiri bila gagal ---------- */
  const opt = {};
  const optOf = (k) => opt[k] || (opt[k] = { ins: new Map(), upd: new Map(), del: new Set() });
  // Saat data dimuat ulang di tengah proses simpan, perubahan yang belum terkonfirmasi tetap ditampilkan.
  function reconcile(key, data) {
    const o = opt[key]; if (!o) return data;
    const out = data.filter((x) => !o.del.has(x.id)).map((x) => o.upd.get(x.id) || x), have = new Set(out.map((x) => x.id));
    o.ins.forEach((r, id) => { if (!have.has(id)) out.push(r); });
    return out;
  }
  const newId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
  async function optSave(key, table, loader, existing, row, dlg, failMsg, onOk) {
    const o = optOf(key); let id, prev = null;
    if (existing) { id = existing.id; prev = { ...existing }; const rec = { ...existing, ...row }; o.upd.set(id, rec); state[key] = state[key].map((x) => (x.id === id ? rec : x)); }
    else { id = newId(); const rec = { ...row, id, created_at: new Date().toISOString() }; o.ins.set(id, rec); state[key] = state[key].concat(rec); }
    dlg.close(); renderAll();
    let error; try { ({ error } = await (existing ? sb.from(table).update(row).eq('id', id) : sb.from(table).insert({ ...row, id }))); } catch (e) { error = e; }
    o.ins.delete(id); o.upd.delete(id);
    if (error) { state[key] = prev ? state[key].map((x) => (x.id === id ? prev : x)) : state[key].filter((x) => x.id !== id); renderAll(); toast(failMsg + ' Perubahan dibatalkan.'); return false; }
    if (onOk) onOk(); loader(); return true;
  }
  async function optDelete(key, table, loader, row, dlg, failMsg, kids) {
    const o = optOf(key), kr = kids ? kids.rows : [], ko = kids ? optOf(kids.key) : null;
    o.del.add(row.id); state[key] = state[key].filter((x) => x.id !== row.id);
    if (kids) { kr.forEach((r) => ko.del.add(r.id)); state[kids.key] = state[kids.key].filter((x) => !kr.some((r) => r.id === x.id)); }
    dlg.close(); renderAll();
    let error; try { ({ error } = await sb.from(table).delete().eq('id', row.id)); } catch (e) { error = e; }
    o.del.delete(row.id); if (kids) kr.forEach((r) => ko.del.delete(r.id));
    if (error) { state[key] = state[key].concat(row); if (kids) state[kids.key] = state[kids.key].concat(kr); renderAll(); toast(failMsg + ' Perubahan dibatalkan.'); return false; }
    loader(); return true;
  }

  const pullSeq = {};
  async function pull(key) {
    const prof = state.profile; if (!prof || !sb) return;
    const mySeq = pullSeq[key] = (pullSeq[key] || 0) + 1;
    let res;
    try {
      res = key === 'settings'
        ? await sb.from('settings').select('*').eq('profile', prof).maybeSingle()
        : await sb.from(SRC[key][0]).select('*').eq('profile', prof).order(SRC[key][1], { ascending: true });
    } catch (e) { res = { error: e }; }
    if (prof !== state.profile || mySeq !== pullSeq[key]) return;
    if (key === 'settings') state.settingsLoaded = true; else state[LOADFLAG[key]] = false;
    if (res.error) {
      state.loadErr[key] = true;
      if (!state.fresh[key]) {
        if (state.snap && state.snap.d && key in state.snap.d) state[key] = state.snap.d[key];
        else state.noData[key] = true;
      }
      toast('Gagal memuat data. Periksa koneksi.');
    } else {
      state.loadErr[key] = false; state.noData[key] = false; state.fresh[key] = true; state.lastOk = Date.now();
      state[key] = reconcile(key, res.data); saveSnap();
    }
    renderAll(); renderSync();
  }
  const loadSettings = () => pull('settings'), loadTasks = () => pull('tasks'), loadBudgets = () => pull('budgets'), loadCatbud = () => pull('catbud'), loadShop = () => Promise.all([pull('slists'), pull('sitems')]),
    loadVendors = () => pull('vendors'), loadPayments = () => pull('payments');
  const hasNoData = () => KEYS.some((k) => state.noData[k]);
  function renderSync() {
    const el = $('sync-banner');
    if (!KEYS.some((k) => state.loadErr[k])) { el.classList.add('hidden'); return; }
    const t = state.lastOk || (state.snap && state.snap.t);
    const when = t ? new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const msg = hasNoData() || !when ? 'Data belum bisa dimuat. Periksa koneksi internet.' : `Koneksi bermasalah. Menampilkan data terakhir yang tersimpan (${esc(when)}). Perubahan baru belum bisa disimpan.`;
    el.innerHTML = `<div class="rounded-lg bg-warn-soft border border-warn-line text-warn-ink-2 text-sm p-3">${msg}<button data-sync-retry class="block mt-1 min-h-touch font-medium text-warn-ink-3 underline">Coba lagi</button></div>`;
    el.classList.remove('hidden');
  }
  $('sync-banner').addEventListener('click', (e) => { if (e.target.closest('[data-sync-retry]')) refreshAll(); });

  /* ---------- Countdown ---------- */
  // Selisih hari kalender (lokal). Dipakai chip header dan Beranda supaya angkanya selalu sama.
  function daysToWedding(t) {
    const n = new Date();
    return Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
  }
  function countdownParts(target) {
    const now = new Date();
    if (target <= now) return null;
    let m = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
    const addM = (n) => { const d = new Date(now); d.setMonth(d.getMonth() + n); return d; };
    while (m > 0 && addM(m) > target) m--;
    let rest = target - addM(m);
    const days = Math.floor(rest / 864e5); rest -= days * 864e5;
    const hours = Math.floor(rest / 36e5); rest -= hours * 36e5;
    const mins = Math.floor(rest / 6e4);
    return [m, days, hours, mins];
  }
  // Tanggal hari H bawaan migrasi (sekarang + 6 bulan) memuat detik/milidetik sisa jam server,
  // sedangkan tanggal yang disimpan lewat Pengaturan selalu bulat ke menit. Selisih itulah penandanya.
  const datePlaceholder = () => {
    if (!state.settings) return false;
    const d = new Date(state.settings.wedding_date);
    return d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0;
  };
  state.cdOpen = (() => { try { return localStorage.getItem('wp-cd-open') === '1'; } catch (e) { return false; } })();
  function renderCountdown() {
    const el = $('countdown'), open = state.cdOpen, chip = $('cd-chip');
    let text, html, cls = 'mt-2 grid grid-cols-4 gap-2 text-center';
    if (!state.settings) {
      const known = !sb || state.authFailed || state.settingsLoaded;
      text = known ? 'Atur hari H' : '...';
      if (known) html = '<p class="col-span-4 text-sm text-muted py-2">Hari H belum diatur. Atur lewat ikon pengaturan.</p>';
    } else {
      const t = new Date(state.settings.wedding_date), p = countdownParts(t);
      if (!p) { text = 'Hari H tiba'; cls = 'mt-2'; html = '<p class="text-brand-ink-2 font-medium py-2">Hari H sudah tiba. Selamat menempuh hidup baru!</p>'; }
      else {
        const days = daysToWedding(t), labels = ['Bulan', 'Hari', 'Jam', 'Menit'];
        text = datePlaceholder() ? 'Atur hari H' : days <= 0 ? 'Hari H hari ini' : 'H-' + days;
        html = p.map((v, i) => `<div class="rounded-lg bg-brand-soft py-2"><div class="text-2xl font-semibold text-brand-ink-2 tabular-nums leading-tight">${pad(v)}</div><div class="text-xs text-muted">${labels[i]}</div></div>`).join('');
      }
    }
    const warn = datePlaceholder();
    chip.className = chip.className.replace(/bg-(emerald|amber)-50|text-(emerald|amber)-\d+|hover:bg-(emerald|amber)-100/g, '').trim() +
      (warn ? ' bg-warn-soft text-warn-ink hover:bg-warn-hover' : ' bg-brand-soft text-brand-ink-2 hover:bg-brand-hover');
    chip.setAttribute('aria-expanded', String(open && !warn));
    $('cd-chev').classList.toggle('rotate-180', open && !warn);
    $('cd-chip-text').textContent = text;
    el.className = cls + (open && !warn ? '' : ' hidden');
    if (html !== undefined) el.innerHTML = html;
  }
  $('cd-chip').addEventListener('click', () => {
    if (datePlaceholder() || !state.settings) return $('btn-settings').click(); // tanggal belum benar: arahkan ke Pengaturan
    state.cdOpen = !state.cdOpen;
    try { localStorage.setItem('wp-cd-open', state.cdOpen ? '1' : '0'); } catch (e) { /* abaikan */ }
    renderCountdown();
  });
  setInterval(renderCountdown, 10000);

  /* ---------- Navigasi ---------- */
  const VIEWS = ['home', 'task', 'calendar', 'vendor', 'budget'];
  const FAB_LABEL = { home: 'Tambah tugas', task: 'Tambah tugas', calendar: 'Tambah tugas', vendor: 'Tambah vendor', budget: 'Tambah pengeluaran' };
  function setView(v) {
    state.view = v;
    VIEWS.forEach((n) => $('view-' + n).classList.toggle('hidden', n !== v));
    document.querySelectorAll('.nav-btn').forEach((b) => {
      const on = b.dataset.nav === v;
      b.classList.toggle('text-brand-ink', on); b.classList.toggle('font-semibold', on);
      b.classList.toggle('text-muted', !on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    $('fab').setAttribute('aria-label', FAB_LABEL[v]);
    if (v === 'calendar') renderCalendar();
    if (v === 'home') renderHome();
  }
  document.querySelectorAll('.nav-btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.nav)));

  /* ---------- Filter ---------- */
  function fillSelects() {
    $('f-cat').insertAdjacentHTML('beforeend', CATEGORIES.map((c) => `<option>${c}</option>`).join(''));
    $('t-cat').innerHTML = CATEGORIES.map((c) => `<option>${c}</option>`).join('');
    $('t-pri').innerHTML = PRIORITIES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    $('t-pj').innerHTML = '<option value="">Belum ditentukan</option>' + ASSIGNEES.map((a) => `<option>${a}</option>`).join('');
    $('f-pj').insertAdjacentHTML('beforeend', ASSIGNEES.map((a) => `<option>${a}</option>`).join('') + '<option value="-">Belum ditentukan</option>');
  }
  function renderChips() {
    const items = [['all', 'Semua'], ['pending', 'Belum selesai'], ['done', 'Selesai']];
    $('status-chips').innerHTML = items.map(([k, l]) => {
      const on = state.fStatus === k;
      return `<button data-status="${k}" aria-pressed="${on}" class="min-h-touch flex-1 rounded-full border text-sm font-medium transition-colors duration-150 ${on ? 'bg-brand border-brand-edge text-white' : 'bg-surface border-line-strong text-ink-3'}">${l}</button>`;
    }).join('');
  }
  $('status-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-status]'); if (!b) return;
    state.fStatus = b.dataset.status; renderChips(); renderTasks();
  });
  $('btn-filter').addEventListener('click', () => { const h = $('filter-panel').classList.toggle('hidden'); $('btn-filter').setAttribute('aria-expanded', String(!h)); });
  $('f-cat').addEventListener('change', (e) => { state.fCat = e.target.value; renderTasks(); });
  $('f-time').addEventListener('change', (e) => { state.fTime = e.target.value; renderTasks(); });
  $('f-pj').addEventListener('change', (e) => { state.fPj = e.target.value; renderTasks(); });
  $('f-pri').addEventListener('change', (e) => { state.fPri = e.target.value; renderTasks(); });
  $('f-q').addEventListener('input', (e) => { state.fQ = e.target.value; renderTasks(); });

  /* ---------- Tasklist ---------- */
  const isOverdue = (t) => !t.is_completed && t.due_date < todayStr();
  const monthLabel = (ds) => parseDate(ds).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const PRI_RANK = { tinggi: 0, normal: 1, rendah: 2 };
  function taskCard(t) {
    const od = isOverdue(t), d = daysUntil(t.due_date);
    const when = t.is_completed ? '<span class="text-brand-ink-2 font-medium">Selesai</span>' : od ? `<span class="text-danger-ink font-semibold">Terlambat ${-d} hari</span>` : d === 0 ? '<span class="text-warn-ink font-semibold">Hari ini</span>' : `<span class="text-ink-4">${fmtDate(t.due_date)}</span>`;
    const chip = (x, c) => `<span class="rounded-full px-2 py-0.5 text-xs font-medium ${c || 'bg-fill text-ink-4'}">${x}</span>`;
    const chips = chip(esc(t.category)) + (t.priority === 'tinggi' ? chip('Prioritas tinggi', 'bg-danger-soft text-danger-ink') : '') + (t.assignee ? chip(esc(t.assignee), 'bg-brand-soft text-brand-ink-3') : '');
    return `<div class="flex items-start gap-1 pr-3 ${od ? 'border-l-4 border-l-rose-500' : ''}">
        <button data-toggle="${t.id}" role="checkbox" aria-checked="${t.is_completed}" aria-label="Tandai ${esc(t.title)} selesai" class="shrink-0 w-11 h-12 flex items-center justify-center">
          <span class="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors duration-150 ${t.is_completed ? 'bg-brand border-brand-edge' : 'bg-surface border-line-control'}">${t.is_completed ? CHECK : ''}</span></button>
        <button data-edit="${t.id}" aria-label="Ubah tugas ${esc(t.title)}" class="flex-1 min-w-0 py-3 text-left">
          <div class="font-medium ${t.is_completed ? 'line-through text-muted' : 'text-ink'}">${esc(t.title)}</div>
          <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">${when}${chips}</div>
          ${t.notes ? `<div class="mt-1 text-sm text-muted truncate">${esc(t.notes)}</div>` : ''}</button></div>`;
  }
  function renderTasks() {
    const list = $('task-list');
    const nf = [state.fCat, state.fTime, state.fPj, state.fPri].filter(Boolean).length;
    $('btn-filter-n').textContent = nf; $('btn-filter-n').classList.toggle('hidden', !nf);
    $('task-progress').textContent = state.tasks.length ? `${state.tasks.filter((t) => t.is_completed).length} dari ${state.tasks.length} tugas selesai` : '';
    if (state.loadingTasks) {
      list.innerHTML = Array.from({ length: 4 }, () => '<div class="skeleton skeleton-pulse h-24"></div>').join(''); return;
    }
    const today = todayStr(), ym = today.slice(0, 7), week = addDays(6), q = state.fQ.trim().toLowerCase();
    const rows = state.tasks.filter((t) =>
      (state.fStatus === 'all' || (state.fStatus === 'done') === t.is_completed) &&
      (!state.fCat || t.category === state.fCat) &&
      (!state.fTime || (state.fTime === 'month' ? t.due_date.slice(0, 7) === ym : isOverdue(t))) &&
      (!state.fPj || (state.fPj === '-' ? !t.assignee : t.assignee === state.fPj)) &&
      (!state.fPri || t.priority === state.fPri) &&
      (!q || [t.title, t.notes, t.category, t.assignee].join(' ').toLowerCase().includes(q))
    );
    if (!rows.length) {
      const msg = state.noData.tasks ? 'Tugas belum bisa dimuat. Periksa koneksi lalu coba lagi.'
        : state.tasks.length ? 'Tidak ada tugas yang cocok dengan filter.' : 'Belum ada tugas. Ketuk tombol + untuk menambah tugas, atau pakai template checklist di atas.';
      list.innerHTML = `<div class="empty-box">${msg}</div>`; return;
    }
    // Kelompokkan per periode: Terlambat, Minggu ini, sisa bulan ini, tiap bulan berikutnya, lalu yang sudah selesai.
    const groups = new Map();
    const put = (key, label, t) => { if (!groups.has(key)) groups.set(key, { label, tasks: [] }); groups.get(key).tasks.push(t); };
    rows.forEach((t) => {
      if (!t.is_completed && t.due_date < today) put('0', 'Terlambat', t);
      else if (t.is_completed && t.due_date < today) put('9', 'Selesai sebelumnya', t);
      else if (t.due_date <= week) put('1', 'Minggu ini', t);
      else if (t.due_date.slice(0, 7) === ym) put('2' + ym, 'Sisa bulan ini', t);
      else put('2' + t.due_date.slice(0, 7), monthLabel(t.due_date), t);
    });
    const filtering = !!(q || state.fCat || state.fTime || state.fPj || state.fPri || state.fStatus !== 'all');
    list.innerHTML = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, g]) => {
      g.tasks.sort((a, b) => (a.is_completed - b.is_completed) || a.due_date.localeCompare(b.due_date) || ((PRI_RANK[a.priority] ?? 1) - (PRI_RANK[b.priority] ?? 1)));
      const done = g.tasks.filter((t) => t.is_completed).length;
      const dflt = filtering || (done < g.tasks.length && g.label !== 'Selesai sebelumnya');
      const open = g.label in state.grp ? state.grp[g.label] : dflt;
      return `<details data-grp="${esc(g.label)}" class="group" ${open ? 'open' : ''}>
        <summary data-grp-sum class="flex items-center justify-between gap-2 min-h-touch cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span class="flex items-center gap-1 font-semibold ${g.label === 'Terlambat' ? 'text-danger-ink' : 'text-ink-3'}"><svg class="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>${esc(g.label)}</span>
          <span class="text-sm text-muted tabular-nums">${done}/${g.tasks.length} selesai</span></summary>
        <div class="mt-1 rounded-xl bg-surface border border-line divide-y divide-line-soft overflow-hidden">${g.tasks.map(taskCard).join('')}</div></details>`;
    }).join('');
  }
  $('task-list').addEventListener('click', (e) => {
    const sum = e.target.closest('[data-grp-sum]');
    if (sum) { // buka/tutup dikendalikan lewat state agar tidak berubah saat data dimuat ulang
      e.preventDefault(); const d = sum.parentElement; state.grp[d.dataset.grp] = !d.open; renderTasks(); return;
    }
    const tg = e.target.closest('[data-toggle]');
    if (tg) return toggleTask(tg.dataset.toggle);
    const ed = e.target.closest('[data-edit]');
    if (ed) openTask(state.tasks.find((x) => x.id === ed.dataset.edit));
  });

  function undoToast(msg, restore, cleanup) {
    toast(msg, { label: 'Urungkan', onExpire: cleanup, fn: async () => {
      try { await restore(); toast('Data dipulihkan.'); } catch (err) { console.error(err); toast('Gagal memulihkan data.'); if (cleanup) cleanup(); }
    } });
  }
  const removeFiles = (rows) => { const paths = rows.map((r) => r.receipt_path).filter(Boolean); if (paths.length && sb) sb.storage.from('receipts').remove(paths); };
  async function toggleTask(id) {
    const t = state.tasks.find((x) => x.id === id); if (!t || !guard()) return;
    t.is_completed = !t.is_completed; renderAll();
    const { error } = await sb.from('tasks').update({ is_completed: t.is_completed }).eq('id', t.id);
    if (error) { t.is_completed = !t.is_completed; renderAll(); toast('Gagal menyimpan status. Coba lagi.'); }
  }
  async function togglePayment(id) {
    const p = state.payments.find((x) => x.id === id); if (!p || !guard()) return;
    const prev = p.paid_date; p.paid_date = prev ? null : todayStr(); renderAll();
    const { error } = await sb.from('vendor_payments').update({ paid_date: p.paid_date }).eq('id', p.id);
    if (error) { p.paid_date = prev; renderAll(); toast('Gagal menyimpan status pembayaran.'); }
  }

  /* ---------- Dialog helpers ---------- */
  /* Cegah simpan ganda (tap dua kali / koneksi lambat): satu pengiriman per form pada satu waktu. */
  function lockSubmit(form, fn) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (form._busy) return;
      form._busy = true;
      const btn = form.querySelector('[type="submit"]'); if (btn) btn.disabled = true;
      try { await fn(e); } finally { form._busy = false; if (btn) btn.disabled = false; }
    });
  }
  /* Konfirmasi di dalam aplikasi (tanpa confirm()/alert() bawaan browser). */
  const CF_OK_CLASS = { normal: 'bg-brand hover:bg-brand-strong', danger: 'bg-rose-600 hover:bg-rose-700' };
  function appConfirm({ title, message, ok = 'Ya', cancel = 'Batal', danger = false }) {
    return new Promise((resolve) => {
      const d = $('dlg-confirm'), okB = $('cf-ok'), noB = $('cf-cancel');
      $('cf-title').textContent = title; $('cf-msg').textContent = message || '';
      $('cf-msg').classList.toggle('hidden', !message);
      okB.textContent = ok; noB.textContent = cancel;
      okB.className = `min-h-touch px-5 rounded-lg text-white font-medium transition-colors duration-150 ${danger ? CF_OK_CLASS.danger : CF_OK_CLASS.normal}`;
      let done = false;
      const finish = (v) => {
        if (done) return; done = true;
        okB.onclick = noB.onclick = d.onclick = d.oncancel = d.onpointerdown = null;
        if (d.open) d.close();
        resolve(v);
      };
      let downOnBackdrop = false;
      okB.onclick = () => finish(true);
      noB.onclick = () => finish(false);
      d.oncancel = (e) => { e.preventDefault(); finish(false); };       // tombol Esc / Back = batal
      d.onpointerdown = (e) => { downOnBackdrop = e.target === d; };
      d.onclick = (e) => { if (e.target === d && downOnBackdrop) finish(false); };
      d.showModal();
      (danger ? noB : okB).focus();                                         // tombol aman jadi fokus awal
    });
  }
  const askDiscard = () => appConfirm({ title: 'Buang perubahan?', message: 'Isian yang belum disimpan akan hilang.', ok: 'Buang', cancel: 'Lanjut mengisi', danger: true });

  /* Deteksi isian belum disimpan: salinan nilai form saat dialog dibuka dibanding nilai sekarang. */
  const NO_TRACK = new Set(['danger-confirm', 'f-import', 'p-file', 'tpl-past']);
  const fieldsOf = (d) => [...d.querySelectorAll('input, select, textarea')].filter((el) => el.id && !NO_TRACK.has(el.id) && el.type !== 'file');
  const snapOf = (d) => JSON.stringify(fieldsOf(d).map((el) => (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value));
  const EXTRA_DIRTY = { 'dlg-payment': () => !!(rc.file || rc.remove) };
  const isDirty = (d) => d._snap !== undefined && (snapOf(d) !== d._snap || !!(EXTRA_DIRTY[d.id] && EXTRA_DIRTY[d.id]()));
  const nativeShowModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    nativeShowModal.call(this); this._snap = snapOf(this);
    if (this.id === 'dlg-confirm') return;
    // Satu entri riwayat per dialog: tombol Back / geser balik menutup dialog (dengan konfirmasi bila ada isian), bukan keluar dari aplikasi.
    const entry = { dlg: this.id };
    if (history.state && history.state.dlg) history.replaceState(entry, ''); else history.pushState(entry, '');
  };
  let ignorePops = 0;
  if (history.state && history.state.dlg) history.replaceState(null, '');
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) { ignorePops--; return; }
    const confirmOpen = $('dlg-confirm').open;
    const d = [...document.querySelectorAll('dialog[open]')].filter((x) => x.id !== 'dlg-confirm').pop();
    if (confirmOpen) { if (d) history.pushState({ dlg: d.id }, ''); return; }       // Back saat konfirmasi tampil: abaikan
    if (!d) return;
    if (isDirty(d)) history.pushState({ dlg: d.id }, '');                            // tetap di halaman sampai pengguna memutuskan
    requestClose(d);
  });
  async function requestClose(d) {
    if (!d.open || d._asking) return;
    if (!isDirty(d)) return d.close();
    d._asking = true;
    const discard = await askDiscard();
    d._asking = false;
    if (discard && d.open) d.close();
  }
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => requestClose(b.closest('dialog'))));
  document.querySelectorAll('dialog:not(#dlg-confirm)').forEach((d) => {
    let downOnBackdrop = false;
    // Hanya tap yang benar-benar mulai dan selesai di area gelap yang dianggap "klik luar".
    d.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === d; });
    d.addEventListener('click', (e) => { if (e.target === d && downOnBackdrop) requestClose(d); downOnBackdrop = false; });
    d.addEventListener('cancel', (e) => { e.preventDefault(); requestClose(d); });   // tombol Esc
    d.addEventListener('close', () => { if (history.state && history.state.dlg === d.id) { ignorePops++; history.back(); } });
  });
  document.querySelectorAll('.money').forEach((i) => i.addEventListener('input', () => {
    const n = num(i.value); i.value = i.value === '' ? '' : new Intl.NumberFormat('id-ID').format(n);
  }));
  const setMoney = (el, n) => { el.value = new Intl.NumberFormat('id-ID').format(Number(n) || 0); };
  const guard = () => {
    if (!sb) { toast('Hubungkan Supabase terlebih dahulu.'); return false; }
    if (navigator.onLine === false) { toast('Sedang offline. Perubahan belum bisa disimpan.'); return false; }
    return true;
  };

  /* ---------- Dialog tugas ---------- */
  function openTask(t, presetDate) {
    state.editTask = t || null;
    $('task-dlg-title').textContent = t ? 'Ubah tugas' : 'Tambah tugas';
    $('t-title').value = t ? t.title : '';
    $('t-cat').value = t ? t.category : CATEGORIES[0];
    $('t-due').value = t ? t.due_date : (presetDate || todayStr());
    $('t-pri').value = t && t.priority ? t.priority : 'normal';
    $('t-pj').value = t && t.assignee ? t.assignee : '';
    $('t-notes').value = t && t.notes ? t.notes : '';
    $('t-done').checked = !!(t && t.is_completed);
    $('t-delete').classList.toggle('hidden', !t);
    $('dlg-task').showModal();
  }
  lockSubmit($('form-task'), async (e) => {
    e.preventDefault(); if (!guard()) return;
    const row = { title: $('t-title').value.trim(), category: $('t-cat').value, due_date: $('t-due').value, is_completed: $('t-done').checked, priority: $('t-pri').value, assignee: $('t-pj').value, notes: $('t-notes').value.trim(), profile: state.profile };
    if (!row.title) return;
    await optSave('tasks', 'tasks', loadTasks, state.editTask, row, $('dlg-task'), 'Gagal menyimpan tugas.');
  });
  $('t-delete').addEventListener('click', async () => {
    if (!state.editTask || !guard()) return;
    if (!await appConfirm({ title: 'Hapus tugas?', message: `"${state.editTask.title}" akan dihapus.`, ok: 'Hapus', danger: true })) return;
    const row = { ...state.editTask };
    if (!await optDelete('tasks', 'tasks', loadTasks, row, $('dlg-task'), 'Gagal menghapus tugas.')) return;
    undoToast('Tugas dihapus.', async () => { const r = await sb.from('tasks').insert(row); if (r.error) throw r.error; await loadTasks(); });
  });

  /* ---------- Budget ---------- */
  // Posisi keuangan satu vendor: kontrak, jadwal bayar, dan selisih keduanya.
  function vendorFin(v) {
    const pays = state.payments.filter((p) => p.vendor_id === v.id);
    const total = Number(v.total_cost), sched = pays.reduce((a, p) => a + Number(p.amount), 0);
    const paid = pays.filter((p) => p.paid_date).reduce((a, p) => a + Number(p.amount), 0);
    return { total, sched, paid, unsched: Math.max(0, total - sched), over: total > 0 ? Math.max(0, sched - total) : 0, committed: Math.max(total, sched) };
  }
  function budgetStats() {
    const cap = state.settings ? Number(state.settings.master_budget) : 0;
    const manual = state.budgets.filter((b) => b.paid_date).reduce((a, b) => a + Number(b.actual_cost), 0) + state.sitems.filter((i) => i.paid_date).reduce((a, i) => a + Number(i.actual_cost), 0);
    const bUnpaid = state.budgets.filter((b) => !b.paid_date).reduce((a, b) => a + Math.max(Number(b.est_cost), Number(b.actual_cost)), 0) + state.sitems.filter((i) => !i.paid_date).reduce((a, i) => a + Math.max(Number(i.est_cost), Number(i.actual_cost)), 0);
    const vPaid = state.payments.filter((p) => p.paid_date).reduce((a, p) => a + Number(p.amount), 0);
    const vDue = state.payments.filter((p) => !p.paid_date).reduce((a, p) => a + Number(p.amount), 0);
    const fins = state.vendors.map(vendorFin);
    const vUnsched = fins.reduce((a, f) => a + f.unsched, 0), vCommitted = fins.reduce((a, f) => a + f.committed, 0);
    const itemsProj = state.budgets.reduce((a, b) => a + Math.max(Number(b.est_cost), Number(b.actual_cost)), 0) + state.sitems.reduce((a, i) => a + Math.max(Number(i.est_cost), Number(i.actual_cost)), 0);
    const used = manual + vPaid;
    return { cap, manual, bUnpaid, vPaid, vDue, vUnsched, vCommitted, itemsProj, proj: vCommitted + itemsProj, used, left: cap - used, pct: cap > 0 ? (used / cap) * 100 : 0 };
  }
  function renderCashflow() {
    const el = $('budget-cashflow'), months = {};
    state.payments.forEach((p) => {
      const m = months[p.due_date.slice(0, 7)] || (months[p.due_date.slice(0, 7)] = { pay: 0, paid: 0, items: [] });
      if (p.paid_date) m.paid += Number(p.amount); else m.pay += Number(p.amount);
      m.items.push(p);
    });
    const keys = Object.keys(months).sort(), unsched = budgetStats().vUnsched;
    if (!keys.length && !unsched) { el.innerHTML = ''; return; }
    const max = Math.max(1, ...keys.map((k) => months[k].pay + months[k].paid)), thisM = todayStr().slice(0, 7);
    const totalOut = keys.reduce((a, k) => a + months[k].pay, 0) + unsched;
    const rows = keys.map((k) => {
      const m = months[k], late = m.items.some((p) => !p.paid_date && p.due_date < todayStr()), open = !!state.openMonths[k];
      const tag = late ? '<span class="text-danger-ink font-medium"> Ada yang terlambat</span>' : k === thisM ? '<span class="text-brand-ink-2"> Bulan ini</span>' : '';
      const items = m.items.slice().sort((a, b) => a.due_date.localeCompare(b.due_date)).map((p) => `<div class="flex justify-between gap-2 text-sm py-1">
          <div class="min-w-0"><div><span class="font-medium">${esc(vendorName(p.vendor_id))}</span> | ${esc(p.label)}</div><div class="text-muted">${fmtDate(p.due_date)} &nbsp;|&nbsp; ${payBadge(p)}</div></div>
          <div class="tabular-nums shrink-0">${rp(p.amount)}</div></div>`).join('');
      return `<details data-m="${k}" class="group border-t border-line-soft first:border-t-0" ${open ? 'open' : ''}>
        <summary data-m-sum class="py-2 min-h-touch cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div class="flex justify-between gap-2 items-baseline"><span class="font-medium text-ink-2">${monthLabel(k + '-01')}${tag}</span>
            <span class="tabular-nums font-medium">${m.pay > 0 ? rp(m.pay) : '<span class="text-brand-ink-2">Lunas</span>'}</span></div>
          <div class="mt-1 h-2 rounded-full bg-fill flex overflow-hidden"><div class="bg-emerald-400" style="width:${(m.paid / max) * 100}%"></div><div class="bg-amber-400" style="width:${(m.pay / max) * 100}%"></div></div>
          <div class="text-xs text-muted mt-1 tabular-nums">${m.paid > 0 ? 'Sudah dibayar ' + rp(m.paid) + ' | ' : ''}${m.items.length} pembayaran</div></summary>
        <div class="pb-2 pl-1">${items}</div></details>`;
    }).join('');
    el.innerHTML = `<div class="card">
      <h2 class="font-semibold text-ink-2">Arus kas bulanan</h2>
      <p class="text-sm text-muted">Pembayaran vendor per bulan. Ketuk bulan untuk rincian.</p>
      <div class="mt-2 text-sm">Total yang masih harus keluar: <span class="font-semibold tabular-nums">${rp(totalOut)}</span></div>
      <div class="mt-1 text-xs text-muted flex gap-3"><span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-xs bg-amber-400"></span>Harus keluar</span><span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-xs bg-emerald-400"></span>Sudah dibayar</span></div>
      <div class="mt-2">${rows}</div>
      ${unsched > 0 ? `<div class="border-t border-line-soft pt-2 flex justify-between gap-2 text-sm"><span class="text-warn-ink">Belum dijadwalkan (selisih kontrak dan jadwal bayar)</span><span class="tabular-nums font-medium">${rp(unsched)}</span></div>` : ''}</div>`;
  }
  $('budget-cashflow').addEventListener('click', (e) => {
    const sum = e.target.closest('[data-m-sum]'); if (!sum) return;
    e.preventDefault(); const k = sum.parentElement.dataset.m; state.openMonths[k] = !state.openMonths[k]; renderCashflow();
  });
  function renderBudget() {
    const sum = $('budget-summary'), list = $('budget-list');
    if (state.loadingBudget || state.loadingPay || state.loadingShop) {
      $('budget-cats').innerHTML = ''; $('budget-cashflow').innerHTML = '';
      sum.innerHTML = '<div class="skeleton skeleton-pulse h-32"></div>';
      list.innerHTML = Array.from({ length: 3 }, () => '<div class="skeleton skeleton-pulse h-20"></div>').join(''); return;
    }
    const { cap, manual, bUnpaid, vPaid, vDue, vUnsched, used, left, pct } = budgetStats();
    const leftColor = left < 0 ? 'text-danger-ink' : 'text-ink-2';
    const after = left - vDue - vUnsched - bUnpaid;
    const upcoming = vDue + vUnsched + bUnpaid, scale = Math.max(cap, used + upcoming, 1), w = (n) => (Math.max(0, n) / scale) * 100, over = cap > 0 && after < 0;
    const verdict = cap <= 0 ? 'Plafon belum diatur' : over ? `Diperkirakan melebihi plafon ${rp(-after)}` : `Aman: sisa ${rp(after)} setelah semua tagihan`;
    const warns = state.vendors.map((v) => ({ v, f: vendorFin(v) })).filter((x) => x.f.unsched > 0 || x.f.over > 0).map(({ v, f }) =>
      f.unsched > 0 ? `<li class="text-warn-ink">${esc(v.name)}: ${rp(f.unsched)} belum dijadwalkan pembayarannya</li>` : `<li class="text-danger-ink">${esc(v.name)}: jadwal bayar melebihi kontrak ${rp(f.over)}</li>`).join('');
    const dot = (c) => `<span class="w-2.5 h-2.5 rounded-xs ${c}"></span>`, lg = (c, l, v) => `<div class="flex items-center justify-between gap-2 py-1"><span class="inline-flex items-center gap-2 text-ink-4">${dot(c)}${l}</span><span class="font-semibold tabular-nums">${rp(v)}</span></div>`;
    sum.innerHTML = `<div class="card">
      <div class="inline-flex rounded-full px-3 py-1 text-sm font-semibold ${over ? 'bg-danger-soft text-danger-ink' : cap <= 0 ? 'bg-fill text-ink-4' : 'bg-brand-soft text-brand-ink-3'}">${verdict}</div>
      ${warns ? `<ul class="mt-2 text-sm list-disc pl-5">${warns}</ul>` : ''}
      <div class="mt-3 text-sm text-muted">Sisa saldo saat ini</div><div class="text-3xl font-bold tabular-nums ${leftColor}">${rp(left)}</div>
      <div class="relative mt-3"><div class="h-4 rounded-full bg-fill-2 flex overflow-hidden" role="progressbar" aria-label="Anggaran terpakai" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><div class="bg-brand" style="width:${w(used)}%"></div><div class="bg-amber-400" style="width:${w(upcoming)}%"></div></div>${scale > cap && cap > 0 ? `<div class="absolute -top-1 -bottom-1 w-0.5 bg-inverse" style="left:${(cap / scale) * 100}%" title="Plafon"></div>` : ''}</div>
      <div class="mt-3 text-sm">${lg('bg-brand', 'Sudah dibayar', used)}${lg('bg-amber-400', 'Tagihan akan datang', upcoming)}${lg('bg-fill-2', 'Plafon total', cap)}</div>
      <details class="mt-2 border-t border-line"><summary class="min-h-touch flex items-center text-sm font-medium text-brand-ink-2 cursor-pointer">Lihat rincian angka</summary>
      <div class="pb-1 text-sm flex flex-col gap-1 tabular-nums">
        <div class="flex justify-between gap-2"><span class="text-muted">Item budget &amp; belanja (sudah dibayar)</span><span class="font-medium">${rp(manual)}</span></div>
        ${bUnpaid > 0 ? `<div class="flex justify-between gap-2"><span class="text-muted">Item budget &amp; belanja belum dibayar</span><span class="font-medium">${rp(bUnpaid)}</span></div>` : ''}
        <div class="flex justify-between gap-2"><span class="text-muted">Pembayaran vendor (sudah dibayar)</span><span class="font-medium">${rp(vPaid)}</span></div>
        <div class="flex justify-between gap-2"><span class="text-muted">Tagihan vendor belum dibayar</span><span class="font-medium">${rp(vDue)}</span></div>
        ${vUnsched > 0 ? `<div class="flex justify-between gap-2"><span class="text-muted">Belum dijadwalkan (kontrak - jadwal)</span><span class="font-medium">${rp(vUnsched)}</span></div>` : ''}
        ${vDue + vUnsched + bUnpaid > 0 ? `<div class="flex justify-between gap-2"><span class="text-muted">Sisa setelah semua tagihan</span><span class="font-medium ${after < 0 ? 'text-danger-ink' : ''}">${rp(after)}</span></div>` : ''}
      </div><p class="pb-2 text-xs text-muted">Jangan mencatat biaya yang sama di tab Vendor, daftar belanja, dan item budget agar tidak terhitung dua kali.</p></details></div>`;
    renderCats(); renderCashflow();
    if (state.noData.budgets) { list.innerHTML = '<div class="empty-box">Budget belum bisa dimuat. Periksa koneksi lalu coba lagi.</div>'; return; }
    if (!state.budgets.length) {
      list.innerHTML = '<div class="empty-box">Belum ada pengeluaran. Ketuk tombol + untuk mencatat item pertama. Pembayaran vendor dicatat di tab Vendor dan otomatis dihitung di sini.</div>'; return;
    }
    list.innerHTML = state.budgets.map((b) => {
      const est = Number(b.est_cost), act = Number(b.actual_cost), diff = est - act, paid = !!b.paid_date;
      const diffTxt = diff >= 0 ? `Selisih: ${rp(diff)} di bawah estimasi` : `<span class="text-danger-ink font-medium">Selisih: ${rp(-diff)} melebihi estimasi</span>`;
      const badge = paid ? `<span class="text-sm text-brand-ink-2 font-medium shrink-0">Dibayar ${fmtDate(b.paid_date)}</span>` : '<span class="text-sm text-warn-ink font-medium shrink-0">Belum dibayar</span>';
      return `<article class="flex items-start gap-1 rounded-xl bg-surface border border-line p-3 pl-4">
        <div class="flex-1 min-w-0 py-1">
          <div class="flex items-center justify-between gap-2"><span class="font-medium text-ink-2">${esc(b.item_name)}</span>${badge}</div>
          <div class="text-xs text-muted mt-0.5">${esc(b.category || 'Lainnya')}</div>
          <div class="text-sm text-muted mt-1 tabular-nums">Est: ${rp(est)} &nbsp;|&nbsp; Akt: ${rp(act)}</div>
          ${act > 0 ? `<div class="text-sm text-muted mt-0.5">${diffTxt}</div>` : ''}
          <button data-bpay="${b.id}" class="mt-1 min-h-touch text-sm font-medium underline ${paid ? 'text-muted' : 'text-brand-ink-2'}">${paid ? 'Batalkan status dibayar' : 'Tandai sudah dibayar'}</button>
        </div>
        <button data-bedit="${b.id}" aria-label="Ubah ${esc(b.item_name)}" class="${EDIT_BTN}">${PENCIL}</button></article>`;
    }).join('');
  }
  $('budget-list').addEventListener('click', (e) => {
    const p = e.target.closest('[data-bpay]'); if (p) return toggleBudgetPaid(p.dataset.bpay);
    const b = e.target.closest('[data-bedit]'); if (b) openBudget(state.budgets.find((x) => x.id === b.dataset.bedit));
  });
  async function toggleBudgetPaid(id) {
    const b = state.budgets.find((x) => x.id === id); if (!b || !guard()) return;
    const prev = { paid_date: b.paid_date, actual_cost: b.actual_cost };
    if (b.paid_date) b.paid_date = null; else { b.paid_date = todayStr(); if (!Number(b.actual_cost)) b.actual_cost = b.est_cost; }
    renderAll();
    const { error } = await sb.from('budgets').update({ paid_date: b.paid_date, actual_cost: b.actual_cost }).eq('id', b.id);
    if (error) { Object.assign(b, prev); renderAll(); toast('Gagal menyimpan status pembayaran.'); }
  }
  function updateDiff() {
    const d = num($('b-est').value) - num($('b-act').value);
    $('b-diff').textContent = d >= 0 ? `Selisih: ${rp(d)} di bawah estimasi` : `Selisih: ${rp(-d)} melebihi estimasi`;
  }
  $('b-paid').addEventListener('change', () => {
    const on = $('b-paid').checked; $('b-paid-wrap').classList.toggle('hidden', !on);
    if (on) { if (!$('b-paiddate').value) $('b-paiddate').value = todayStr(); if (num($('b-act').value) === 0) { setMoney($('b-act'), num($('b-est').value)); updateDiff(); } }
  });
  $('b-est').addEventListener('input', updateDiff); $('b-act').addEventListener('input', updateDiff);
  function openBudget(b) {
    state.editBudget = b || null;
    $('budget-dlg-title').textContent = b ? 'Ubah pengeluaran' : 'Tambah pengeluaran';
    $('b-name').value = b ? b.item_name : '';
    $('b-cat').value = b && BUDGET_CATS.includes(b.category) ? b.category : 'Lainnya';
    setMoney($('b-est'), b ? b.est_cost : 0); setMoney($('b-act'), b ? b.actual_cost : 0);
    $('b-paid').checked = !!(b && b.paid_date); $('b-paiddate').value = b && b.paid_date ? b.paid_date : '';
    $('b-paid-wrap').classList.toggle('hidden', !$('b-paid').checked);
    $('b-delete').classList.toggle('hidden', !b); updateDiff();
    $('dlg-budget').showModal();
  }
  lockSubmit($('form-budget'), async (e) => {
    e.preventDefault(); if (!guard()) return;
    const paid = $('b-paid').checked, est = num($('b-est').value);
    const row = { item_name: $('b-name').value.trim(), category: $('b-cat').value, est_cost: est, actual_cost: num($('b-act').value), paid_date: paid ? ($('b-paiddate').value || todayStr()) : null, profile: state.profile };
    if (!row.item_name) return;
    if (paid && row.actual_cost === 0) row.actual_cost = est;
    await optSave('budgets', 'budgets', loadBudgets, state.editBudget, row, $('dlg-budget'), 'Gagal menyimpan item.');
  });
  $('b-delete').addEventListener('click', async () => {
    if (!state.editBudget || !guard()) return;
    if (!await appConfirm({ title: 'Hapus item budget?', message: `"${state.editBudget.item_name}" akan dihapus.`, ok: 'Hapus', danger: true })) return;
    const row = { ...state.editBudget };
    if (!await optDelete('budgets', 'budgets', loadBudgets, row, $('dlg-budget'), 'Gagal menghapus item.')) return;
    undoToast('Item budget dihapus.', async () => { const r = await sb.from('budgets').insert(row); if (r.error) throw r.error; await loadBudgets(); });
  });

  /* ---------- Daftar belanja ---------- */
  const itemEst = (i) => Math.max(Number(i.est_cost), Number(i.actual_cost));
  const listItems = (id) => state.sitems.filter((i) => i.list_id === id);
  function listFin(l) {
    const its = listItems(l.id), got = its.filter((i) => i.paid_date);
    return { n: its.length, nb: got.length, paid: got.reduce((a, i) => a + Number(i.actual_cost), 0), left: its.filter((i) => !i.paid_date).reduce((a, i) => a + itemEst(i), 0) };
  }
  function setVTab(t) {
    state.vtab = t;
    $('vsub-vendor').classList.toggle('hidden', t !== 'vendor'); $('vsub-shop').classList.toggle('hidden', t !== 'shop');
    document.querySelectorAll('.vtab-btn').forEach((b) => {
      const on = b.dataset.vtab === t;
      b.classList.toggle('bg-surface', on); b.classList.toggle('shadow-xs', on); b.classList.toggle('text-brand-ink-2', on); b.classList.toggle('text-ink-4', !on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('fab').setAttribute('aria-label', t === 'shop' ? 'Tambah daftar belanja' : 'Tambah vendor');
  }
  document.querySelectorAll('.vtab-btn').forEach((b) => b.addEventListener('click', () => setVTab(b.dataset.vtab)));
  setVTab('vendor');
  const CHECK = '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
  function renderShop() {
    const sum = $('shop-summary'), list = $('shop-list');
    if (state.loadingShop) {
      sum.innerHTML = '<div class="skeleton skeleton-pulse h-28"></div>';
      list.innerHTML = Array.from({ length: 2 }, () => '<div class="skeleton skeleton-pulse h-40"></div>').join(''); return;
    }
    if (state.noData.slists || state.noData.sitems) { sum.innerHTML = ''; list.innerHTML = '<div class="empty-box">Daftar belanja belum bisa dimuat. Periksa koneksi lalu coba lagi.</div>'; return; }
    const fins = state.slists.map(listFin);
    const paid = fins.reduce((a, f) => a + f.paid, 0), left = fins.reduce((a, f) => a + f.left, 0), n = fins.reduce((a, f) => a + f.n, 0), nb = fins.reduce((a, f) => a + f.nb, 0);
    const pct = n ? Math.round((nb / n) * 100) : 0;
    sum.innerHTML = `<div class="card">
      <div class="text-sm text-muted">Sisa belanja</div>
      <div class="text-2xl font-semibold tabular-nums">${rp(left)}</div>
      <div class="mt-3 h-3 rounded-full bg-fill-2 overflow-hidden" role="progressbar" aria-label="Item sudah dibeli" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="h-full bg-brand-mid" style="width:${pct}%"></div></div>
      <div class="mt-1 text-sm text-muted">${nb} dari ${n} item sudah dibeli</div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div><div class="text-muted">Total perkiraan</div><div class="font-medium tabular-nums">${rp(paid + left)}</div></div>
        <div><div class="text-muted">Sudah dibeli</div><div class="font-medium tabular-nums">${rp(paid)}</div></div>
      </div></div>`;
    if (!state.slists.length) { list.innerHTML = '<div class="empty-box">Belum ada daftar belanja. Ketuk tombol + untuk membuat daftar, misalnya Seserahan atau Souvenir. Total belanja otomatis dihitung di tab Budget.</div>'; return; }
    list.innerHTML = state.slists.map((l, idx) => {
      const f = fins[idx], done = f.n > 0 && f.nb === f.n;
      const rows = listItems(l.id).slice().sort((a, b) => (a.paid_date ? 1 : 0) - (b.paid_date ? 1 : 0) || a.name.localeCompare(b.name)).map((i) => `<div class="flex items-start gap-1 border-t border-line-soft">
          <button data-itoggle="${i.id}" role="checkbox" aria-checked="${!!i.paid_date}" aria-label="Tandai ${esc(i.name)} sudah dibeli" class="shrink-0 w-11 h-11 flex items-center justify-center">
            <span class="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors duration-150 ${i.paid_date ? 'bg-brand border-brand-edge' : 'bg-surface border-line-control'}">${i.paid_date ? CHECK : ''}</span></button>
          <div class="flex-1 min-w-0 py-2">
            <div class="font-medium ${i.paid_date ? 'text-muted' : ''}">${esc(i.name)}${Number(i.qty) > 1 ? ` <span class="text-muted font-normal">x${i.qty}</span>` : ''}</div>
            <div class="text-sm text-muted tabular-nums">${i.paid_date ? `<span class="text-brand-ink-2">Dibeli ${fmtDate(i.paid_date)}</span> | ${rp(i.actual_cost)}` : 'Estimasi ' + rp(i.est_cost)}${i.store ? ' | ' + esc(i.store) : ''}</div>
            ${i.notes ? `<div class="text-sm text-muted">${esc(i.notes)}</div>` : ''}
          </div>
          <button data-iedit="${i.id}" aria-label="Ubah ${esc(i.name)}" class="${EDIT_BTN}">${PENCIL}</button></div>`).join('');
      return `<article class="rounded-xl bg-surface border border-line p-4">
        <div class="flex items-start gap-1">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2"><h3 class="font-semibold text-ink">${esc(l.name)}</h3><span class="rounded-full bg-fill text-ink-4 px-2 py-0.5 text-xs font-semibold">${esc(l.category)}</span></div>
            <div class="mt-3 h-2 rounded-full bg-fill-2 overflow-hidden" role="progressbar" aria-label="Item dibeli" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${f.n ? Math.round((f.nb / f.n) * 100) : 0}"><div class="h-full bg-brand" style="width:${f.n ? (f.nb / f.n) * 100 : 0}%"></div></div>
            <div class="mt-1 flex justify-between gap-2 text-sm tabular-nums"><span class="text-muted">${f.nb} dari ${f.n} item dibeli (${rp(f.paid)})</span><span class="font-semibold ${done ? 'text-brand-ink-2' : 'text-ink'}">${done ? 'Semua dibeli' : 'Sisa ' + rp(f.left)}</span></div>
          </div>
          <button data-ledit="${l.id}" aria-label="Ubah daftar ${esc(l.name)}" class="${EDIT_BTN} -mt-2 -mr-2">${PENCIL}</button>
        </div>
        <div class="mt-2">${rows}</div>
        <button data-iadd="${l.id}" class="mt-1 min-h-touch w-full rounded-lg border border-line-strong text-ink-3 text-sm font-medium hover:bg-hover transition-colors duration-150">+ Tambah item</button>
      </article>`;
    }).join('');
  }
  $('shop-list').addEventListener('click', (e) => {
    const t = e.target.closest('[data-itoggle],[data-iedit],[data-iadd],[data-ledit]'); if (!t) return;
    if (t.dataset.itoggle) toggleItem(t.dataset.itoggle);
    else if (t.dataset.iedit) { const i = state.sitems.find((x) => x.id === t.dataset.iedit); if (i) openItem(i.list_id, i); }
    else if (t.dataset.iadd) openItem(t.dataset.iadd);
    else if (t.dataset.ledit) openList(state.slists.find((x) => x.id === t.dataset.ledit));
  });
  async function toggleItem(id) {
    const i = state.sitems.find((x) => x.id === id); if (!i || !guard()) return;
    const prev = { paid_date: i.paid_date, actual_cost: i.actual_cost };
    if (i.paid_date) i.paid_date = null; else { i.paid_date = todayStr(); if (!Number(i.actual_cost)) i.actual_cost = i.est_cost; }
    renderAll();
    const { error } = await sb.from('shopping_items').update({ paid_date: i.paid_date, actual_cost: i.actual_cost }).eq('id', i.id);
    if (error) { Object.assign(i, prev); renderAll(); toast('Gagal menyimpan status item.'); }
  }
  /* --- Dialog daftar --- */
  function openList(l) {
    state.editList = l || null;
    $('list-dlg-title').textContent = l ? 'Ubah daftar belanja' : 'Tambah daftar belanja';
    $('l-name').value = l ? l.name : ''; $('l-cat').value = l && BUDGET_CATS.includes(l.category) ? l.category : 'Seserahan & mahar';
    $('l-delete').classList.toggle('hidden', !l);
    $('dlg-list').showModal();
  }
  lockSubmit($('form-list'), async (e) => {
    e.preventDefault(); if (!guard()) return;
    const row = { name: $('l-name').value.trim(), category: $('l-cat').value, profile: state.profile };
    if (!row.name) return;
    await optSave('slists', 'shopping_lists', loadShop, state.editList, row, $('dlg-list'), 'Gagal menyimpan daftar.');
  });
  $('l-delete').addEventListener('click', async () => {
    if (!state.editList || !guard()) return;
    const l = { ...state.editList }, its = listItems(l.id).map((i) => ({ ...i }));
    if (!await appConfirm({ title: 'Hapus daftar belanja?', message: `"${l.name}"${its.length ? ' beserta ' + its.length + ' item' : ''} akan dihapus.`, ok: 'Hapus', danger: true })) return;
    if (!await optDelete('slists', 'shopping_lists', loadShop, l, $('dlg-list'), 'Gagal menghapus daftar.', { key: 'sitems', rows: its })) return;
    undoToast(`Daftar${its.length ? ' dan ' + its.length + ' item' : ''} dihapus.`, async () => {
      let r = await sb.from('shopping_lists').insert(l); if (r.error) throw r.error;
      if (its.length) { r = await sb.from('shopping_items').insert(its); if (r.error) throw r.error; }
      await loadShop();
    });
  });
  /* --- Dialog item --- */
  function syncItemPaid() { $('i-paid-wrap').classList.toggle('hidden', !$('i-paid').checked); }
  $('i-paid').addEventListener('change', () => {
    if ($('i-paid').checked) { if (!$('i-paiddate').value) $('i-paiddate').value = todayStr(); if (num($('i-act').value) === 0) setMoney($('i-act'), num($('i-est').value)); }
    syncItemPaid();
  });
  function openItem(listId, i) {
    state.itemList = listId; state.editItem = i || null;
    const l = state.slists.find((x) => x.id === listId);
    $('item-dlg-title').textContent = i ? 'Ubah item' : 'Tambah item'; $('i-list').textContent = l ? l.name : '';
    $('i-name').value = i ? i.name : ''; $('i-qty').value = i ? i.qty : 1; setMoney($('i-est'), i ? i.est_cost : 0); setMoney($('i-act'), i ? i.actual_cost : 0);
    $('i-store').value = i ? i.store : ''; $('i-notes').value = i ? i.notes : '';
    $('i-paid').checked = !!(i && i.paid_date); $('i-paiddate').value = i && i.paid_date ? i.paid_date : ''; syncItemPaid();
    $('i-delete').classList.toggle('hidden', !i);
    $('dlg-item').showModal();
  }
  lockSubmit($('form-item'), async (e) => {
    e.preventDefault(); if (!guard()) return;
    const paid = $('i-paid').checked, est = num($('i-est').value);
    const row = { list_id: state.itemList, name: $('i-name').value.trim(), qty: Math.min(999, Math.max(1, parseInt($('i-qty').value, 10) || 1)), est_cost: est, actual_cost: paid ? num($('i-act').value) : 0,
      store: $('i-store').value.trim(), notes: $('i-notes').value.trim(), paid_date: paid ? ($('i-paiddate').value || todayStr()) : null, profile: state.profile };
    if (!row.name) return;
    if (paid && row.actual_cost === 0) row.actual_cost = est;
    await optSave('sitems', 'shopping_items', loadShop, state.editItem, row, $('dlg-item'), 'Gagal menyimpan item.');
  });
  $('i-delete').addEventListener('click', async () => {
    if (!state.editItem || !guard()) return;
    const row = { ...state.editItem };
    if (!await appConfirm({ title: 'Hapus item?', message: `"${row.name}" akan dihapus.`, ok: 'Hapus', danger: true })) return;
    if (!await optDelete('sitems', 'shopping_items', loadShop, row, $('dlg-item'), 'Gagal menghapus item.')) return;
    undoToast('Item dihapus.', async () => { const r = await sb.from('shopping_items').insert(row); if (r.error) throw r.error; await loadShop(); });
  });

  /* ---------- Budget per kategori ---------- */
  function catStats() {
    const m = {}, g = (c) => m[c] || (m[c] = { paid: 0, commit: 0, alloc: 0 });
    state.budgets.forEach((b) => { const x = g(b.category || 'Lainnya'); x.commit += Math.max(Number(b.est_cost), Number(b.actual_cost)); if (b.paid_date) x.paid += Number(b.actual_cost); });
    state.sitems.forEach((i) => { const l = state.slists.find((x) => x.id === i.list_id); const x = g(l ? l.category : 'Lainnya'); x.commit += itemEst(i); if (i.paid_date) x.paid += Number(i.actual_cost); });
    state.vendors.forEach((v) => { g(v.category || 'Lainnya').commit += vendorFin(v).committed; });
    state.payments.filter((p) => p.paid_date).forEach((p) => { const v = state.vendors.find((x) => x.id === p.vendor_id); g(v ? v.category : 'Lainnya').paid += Number(p.amount); });
    state.catbud.forEach((c) => { g(c.category).alloc = Number(c.amount); });
    return m;
  }
  function renderCats() {
    const el = $('budget-cats'), m = catStats(), cap = state.settings ? Number(state.settings.master_budget) : 0;
    const allocSum = state.catbud.reduce((a, c) => a + Number(c.amount), 0);
    const names = BUDGET_CATS.concat(Object.keys(m).filter((c) => !BUDGET_CATS.includes(c))).filter((c) => m[c] && (m[c].alloc > 0 || m[c].commit > 0));
    const rows = names.map((c) => {
      const x = m[c], pct = x.alloc > 0 ? (x.commit / x.alloc) * 100 : 0;
      const color = pct > 100 ? 'bg-rose-600' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-mid';
      const status = x.alloc <= 0 ? '<span class="text-muted">Belum ada alokasi</span>'
        : pct > 100 ? `<span class="text-danger-ink font-medium">Melebihi alokasi ${rp(x.commit - x.alloc)}</span>`
        : `<span class="${pct >= 80 ? 'text-warn-ink' : 'text-muted'}">Sisa alokasi ${rp(x.alloc - x.commit)}</span>`;
      return `<div class="py-2 border-t border-line-soft first:border-t-0">
        <div class="flex justify-between gap-2 items-baseline"><span class="font-medium text-ink-2">${esc(c)}</span><span class="text-sm tabular-nums">${rp(x.commit)}${x.alloc > 0 ? ' / ' + rp(x.alloc) : ''}</span></div>
        ${x.alloc > 0 ? `<div class="mt-1 h-2 rounded-full bg-fill-2 overflow-hidden" role="progressbar" aria-label="${esc(c)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round(pct))}"><div class="h-full ${color}" style="width:${Math.min(pct, 100)}%"></div></div>` : ''}
        <div class="text-xs mt-1 tabular-nums">${status} <span class="text-muted">| Sudah dibayar ${rp(x.paid)}</span></div></div>`;
    }).join('');
    const foot = allocSum <= 0 ? '' : cap > 0 && allocSum > cap
      ? `<div class="mt-2 text-sm text-danger-ink">Total alokasi ${rp(allocSum)} melebihi plafon sebesar ${rp(allocSum - cap)}.</div>`
      : `<div class="mt-2 text-sm text-muted">Belum dialokasikan: <span class="font-medium tabular-nums">${rp(Math.max(0, cap - allocSum))}</span> dari plafon.</div>`;
    el.innerHTML = `<div class="card">
      <div class="flex items-start justify-between gap-2"><div><h2 class="font-semibold text-ink-2">Budget per kategori</h2><p class="text-sm text-muted">Komitmen dibanding alokasi tiap kategori.</p></div>
        <button data-cats-edit class="shrink-0 min-h-touch px-3 rounded-lg border border-brand-edge text-brand-ink-2 text-sm font-medium hover:bg-brand-soft transition-colors duration-150">Atur alokasi</button></div>
      <div class="mt-2">${rows || '<p class="text-sm text-muted py-2">Belum ada pengeluaran atau alokasi. Ketuk "Atur alokasi" untuk membagi plafon per kategori.</p>'}</div>${foot}</div>`;
  }
  const idr = (n) => new Intl.NumberFormat('id-ID').format(Number(n) || 0);
  function updateCatsSum() {
    const tot = [...$('cats-fields').querySelectorAll('input')].reduce((a, i) => a + num(i.value), 0), cap = state.settings ? Number(state.settings.master_budget) : 0;
    $('cats-sum').innerHTML = `Total alokasi: <b>${rp(tot)}</b>` + (cap > 0 ? (tot > cap ? ` <span class="text-danger-ink">(melebihi plafon ${rp(tot - cap)})</span>` : ` (sisa plafon ${rp(cap - tot)})`) : '');
  }
  function openCats() {
    const cur = Object.fromEntries(state.catbud.map((c) => [c.category, c.amount]));
    $('cats-fields').innerHTML = BUDGET_CATS.map((c, i) => `<div class="flex items-center gap-2"><label for="c-${i}" class="flex-1 text-sm font-medium text-ink-3">${esc(c)}</label><input id="c-${i}" data-cat="${esc(c)}" inputmode="numeric" class="w-40 min-h-touch rounded-lg border border-line-strong px-3 text-base text-right tabular-nums" value="${idr(cur[c])}"></div>`).join('');
    updateCatsSum(); $('dlg-cats').showModal();
  }
  $('cats-fields').addEventListener('input', (e) => { const i = e.target; i.value = i.value === '' ? '' : idr(num(i.value)); updateCatsSum(); });
  $('budget-cats').addEventListener('click', (e) => { if (e.target.closest('[data-cats-edit]')) openCats(); });
  lockSubmit($('form-cats'), async (e) => {
    e.preventDefault(); if (!guard()) return;
    const vals = [...$('cats-fields').querySelectorAll('input')].map((i) => ({ category: i.dataset.cat, amount: num(i.value) }));
    const rows = vals.filter((v) => v.amount > 0).map((v) => ({ ...v, profile: state.profile })), zero = vals.filter((v) => !v.amount).map((v) => v.category);
    if (rows.length) { const r = await sb.from('category_budgets').upsert(rows, { onConflict: 'profile,category' }); if (r.error) return toast('Gagal menyimpan alokasi.'); }
    if (zero.length) { const r = await sb.from('category_budgets').delete().eq('profile', state.profile).in('category', zero); if (r.error) return toast('Gagal menyimpan alokasi.'); }
    $('dlg-cats').close(); loadCatbud();
  });

  /* ---------- Tema (Sistem / Terang / Gelap) ---------- */
  const isDark = () => document.documentElement.classList.contains('dark');
  const syncTheme = () => {
    document.querySelectorAll('input[name=theme]').forEach((r) => { r.checked = r.value === window.wpTheme.get(); });
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.setAttribute('aria-label', isDark() ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'));
  };
  document.querySelectorAll('input[name=theme]').forEach((r) => {
    r.addEventListener('change', () => { if (r.checked) { window.wpTheme.set(r.value); syncTheme(); } });
  });
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => { window.wpTheme.set(isDark() ? 'light' : 'dark'); syncTheme(); }));
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(syncTheme));
  syncTheme();

  /* ---------- Pengaturan ---------- */
  $('btn-settings').addEventListener('click', () => {
    const s = state.settings;
    const d = s ? new Date(s.wedding_date) : new Date(Date.now() + 180 * 864e5);
    $('s-date').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setMoney($('s-budget'), s ? s.master_budget : 0);
    $('s-date-hint').classList.toggle('hidden', !datePlaceholder());
    $('danger-confirm').value = ''; syncDanger(); $('danger-zone').open = false;
    $('dlg-settings').showModal();
  });
  lockSubmit($('form-settings'), async (e) => {
    e.preventDefault(); if (!guard()) return;
    const row = { id: PROFILES[state.profile].id, profile: state.profile, wedding_date: new Date($('s-date').value).toISOString(), master_budget: num($('s-budget').value) };
    const { error } = await sb.from('settings').upsert(row);
    if (error) return toast('Gagal menyimpan pengaturan.');
    state.settings = row; $('dlg-settings').close(); renderAll();
  });

  /* ---------- FAB ---------- */
  $('fab').addEventListener('click', () => {
    if (state.view === 'task' || state.view === 'home') openTask();
    else if (state.view === 'calendar') openTask(null, state.calSel);
    else if (state.view === 'vendor') { if (state.vtab === 'shop') openList(); else openVendor(); }
    else openBudget();
  });

  const PENCIL = '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16.9 4.2a2 2 0 112.9 2.8L8 18.8 4 20l1.2-4L16.9 4.2z"/></svg>';
  const IMG_ICON = '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 16l-5-5-8 8"/></svg>';
  const EDIT_BTN = 'shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-muted hover:bg-hover-2 transition-colors duration-150';

  /* ---------- Vendor, pembayaran, kalender ---------- */
  const VENDOR_CATS = ['Venue', 'Katering', 'Dekorasi', 'Pakaian', 'Fotografi', 'MUA', 'Undangan', 'Hiburan', 'Lainnya'];
  const PAY_LABELS = ['DP', 'Cicilan', 'Pelunasan', 'Lainnya'];
  $('v-cat').innerHTML = VENDOR_CATS.map((c) => `<option>${c}</option>`).join('');
  $('l-cat').innerHTML = BUDGET_CATS.map((c) => `<option>${c}</option>`).join('');
  $('b-cat').innerHTML = BUDGET_CATS.map((c) => `<option>${c}</option>`).join('');
  $('p-label').innerHTML = PAY_LABELS.map((c) => `<option>${c}</option>`).join('');

  const daysUntil = (s) => Math.round((parseDate(s) - parseDate(todayStr())) / 864e5);
  const vendorName = (id) => (state.vendors.find((v) => v.id === id) || {}).name || 'Vendor';
  const payStatus = (p) => p.paid_date ? 'paid' : p.due_date < todayStr() ? 'overdue' : daysUntil(p.due_date) <= 7 ? 'soon' : 'pending';
  function payBadge(p) {
    const s = payStatus(p);
    if (s === 'paid') return `<span class="text-brand-ink-2">Dibayar ${fmtDate(p.paid_date)}</span>`;
    if (s === 'overdue') return `<span class="text-danger-ink font-medium">Terlambat ${-daysUntil(p.due_date)} hari</span>`;
    const d = daysUntil(p.due_date);
    const t = d === 0 ? 'Jatuh tempo hari ini' : `Jatuh tempo ${d} hari lagi`;
    return s === 'soon' ? `<span class="text-warn-ink font-medium">${t}</span>` : `<span class="text-muted">${t}</span>`;
  }


  /* --- Daftar vendor --- */
  function renderVendors() {
    const sum = $('vendor-summary'), list = $('vendor-list');
    if (state.loadingVendor || state.loadingPay) {
      sum.innerHTML = '<div class="skeleton skeleton-pulse h-28"></div>';
      list.innerHTML = Array.from({ length: 2 }, () => '<div class="skeleton skeleton-pulse h-40"></div>').join(''); return;
    }
    const contract = state.vendors.reduce((a, v) => a + Number(v.total_cost), 0);
    const paid = state.payments.filter((p) => p.paid_date).reduce((a, p) => a + Number(p.amount), 0);
    const next = state.payments.filter((p) => !p.paid_date).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
    const nextTxt = next
      ? `<div class="mt-3 pt-3 border-t border-line text-sm"><div class="text-muted">Tagihan terdekat</div>
         <div class="font-medium">${esc(vendorName(next.vendor_id))}: ${esc(next.label)} ${rp(next.amount)}</div>
         <div>${fmtDate(next.due_date)} &nbsp;|&nbsp; ${payBadge(next)}</div></div>`
      : '';
    sum.innerHTML = `<div class="card">
      <div class="text-sm text-muted">Sisa tagihan vendor</div>
      <div class="text-2xl font-semibold tabular-nums">${rp(contract - paid)}</div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div><div class="text-muted">Total kontrak</div><div class="font-medium tabular-nums">${rp(contract)}</div></div>
        <div><div class="text-muted">Sudah dibayar</div><div class="font-medium tabular-nums">${rp(paid)}</div></div>
      </div>${nextTxt}</div>`;
    if (state.noData.vendors) { list.innerHTML = '<div class="empty-box">Vendor belum bisa dimuat. Periksa koneksi lalu coba lagi.</div>'; return; }
    if (!state.vendors.length) {
      list.innerHTML = '<div class="empty-box">Belum ada vendor. Ketuk tombol + untuk menambah vendor pertama.</div>'; return;
    }
    list.innerHTML = state.vendors.map((v) => {
      const pays = state.payments.filter((p) => p.vendor_id === v.id).sort((a, b) => a.due_date.localeCompare(b.due_date));
      const vPaid = pays.filter((p) => p.paid_date).reduce((a, p) => a + Number(p.amount), 0);
      const rest = Number(v.total_cost) - vPaid;
      const settled = rest <= 0 && Number(v.total_cost) > 0;
      const fin = vendorFin(v);
      const late = pays.some((p) => payStatus(p) === 'overdue');
      const payRows = pays.map((p) => `<div class="flex items-start gap-1 border-t border-line-soft">
          <button data-ptoggle="${p.id}" role="checkbox" aria-checked="${!!p.paid_date}" aria-label="Tandai ${esc(p.label)} ${esc(v.name)} dibayar" class="shrink-0 w-11 h-11 flex items-center justify-center">
            <span class="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors duration-150 ${p.paid_date ? 'bg-brand border-brand-edge' : 'bg-surface border-line-control'}">
              ${p.paid_date ? '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}
            </span></button>
          <div class="flex-1 min-w-0 py-2">
            <div class="font-medium tabular-nums">${esc(p.label)}: ${rp(p.amount)}</div>
            <div class="text-sm text-muted">Tenggat ${fmtDate(p.due_date)} &nbsp;|&nbsp; ${payBadge(p)}</div>
          </div>
          ${p.receipt_path ? `<button data-receipt="${p.id}" aria-label="Lihat bukti bayar ${esc(p.label)} ${esc(v.name)}" class="${EDIT_BTN}">${IMG_ICON}</button>` : ''}
          <button data-pedit="${p.id}" aria-label="Ubah pembayaran ${esc(p.label)} ${esc(v.name)}" class="${EDIT_BTN}">${PENCIL}</button></div>`).join('');
      const vpct = Number(v.total_cost) > 0 ? Math.min(100, (vPaid / Number(v.total_cost)) * 100) : 0;
      const tag = (x, c) => `<span class="rounded-full px-2 py-0.5 text-xs font-semibold ${c}">${x}</span>`;
      const pill = 'inline-flex items-center min-h-touch px-4 rounded-full border border-line-strong text-sm font-medium text-ink-3 hover:bg-hover';
      return `<article class="rounded-xl bg-surface border p-4 ${late ? 'border-danger-line' : 'border-line'}">
        <div class="flex items-start gap-1">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2"><h3 class="font-semibold text-ink">${esc(v.name)}</h3>${tag(esc(v.category), 'bg-fill text-ink-4')}${late ? tag('Terlambat', 'bg-danger-soft text-danger-ink') : ''}</div>
            <div class="mt-3 h-2 rounded-full bg-fill-2 overflow-hidden" role="progressbar" aria-label="Terbayar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(vpct)}"><div class="h-full bg-brand" style="width:${vpct}%"></div></div>
            <div class="mt-1 flex justify-between gap-2 text-sm tabular-nums"><span class="text-muted">Dibayar ${rp(vPaid)} dari ${rp(v.total_cost)}</span><span class="font-semibold ${settled ? 'text-brand-ink-2' : 'text-ink'}">${settled ? 'Lunas' : 'Sisa ' + rp(rest)}</span></div>
            ${fin.unsched > 0 ? `<div class="mt-1 text-sm text-warn-ink tabular-nums">${rp(fin.unsched)} belum dijadwalkan pembayarannya</div>` : fin.over > 0 ? `<div class="mt-1 text-sm text-danger-ink tabular-nums">Jadwal bayar melebihi kontrak ${rp(fin.over)}</div>` : ''}
            ${v.notes ? `<div class="mt-1 text-sm text-muted">${esc(v.notes)}</div>` : ''}
          </div>
          <button data-vedit="${v.id}" aria-label="Ubah vendor ${esc(v.name)}" class="${EDIT_BTN} -mt-2 -mr-2">${PENCIL}</button>
        </div>
        ${v.phone ? `<div class="mt-2 flex flex-wrap gap-2"><a href="tel:${esc(v.phone.replace(/[^\d+]/g, ''))}" class="${pill}">Telepon</a><button data-wa="${v.id}" class="${pill}">WhatsApp</button></div>` : ''}
        <div class="mt-2">${payRows}</div>
        <button data-padd="${v.id}" class="mt-1 min-h-touch w-full rounded-lg border border-line-strong text-ink-3 text-sm font-medium hover:bg-hover transition-colors duration-150">+ Tambah pembayaran</button>
      </article>`;
    }).join('');
  }

  $('vendor-list').addEventListener('click', async (e) => {
    const tg = e.target.closest('[data-ptoggle]');
    if (tg) return togglePayment(tg.dataset.ptoggle);
    const rc0 = e.target.closest('[data-receipt]'); if (rc0) return openReceipt(state.payments.find((x) => x.id === rc0.dataset.receipt));
    const wa0 = e.target.closest('[data-wa]'); if (wa0) return openWa(wa0.dataset.wa);
    const pe = e.target.closest('[data-pedit]');
    if (pe) return openPayment(state.payments.find((x) => x.id === pe.dataset.pedit));
    const pa = e.target.closest('[data-padd]');
    if (pa) return openPayment(null, pa.dataset.padd);
    const ve = e.target.closest('[data-vedit]');
    if (ve) openVendor(state.vendors.find((x) => x.id === ve.dataset.vedit));
  });

  /* --- Dialog vendor --- */
  function openVendor(v) {
    state.editVendor = v || null;
    $('vendor-dlg-title').textContent = v ? 'Ubah vendor' : 'Tambah vendor';
    $('v-name').value = v ? v.name : '';
    $('v-cat').value = v ? v.category : VENDOR_CATS[0];
    $('v-phone').value = v ? v.phone : '';
    setMoney($('v-total'), v ? v.total_cost : 0);
    $('v-notes').value = v ? v.notes : '';
    $('v-delete').classList.toggle('hidden', !v);
    $('dlg-vendor').showModal();
  }
  lockSubmit($('form-vendor'), async (e) => {
    e.preventDefault(); if (!guard()) return;
    const row = { name: $('v-name').value.trim(), category: $('v-cat').value, phone: $('v-phone').value.trim(), total_cost: num($('v-total').value), notes: $('v-notes').value.trim(), profile: state.profile };
    if (!row.name) return;
    await optSave('vendors', 'vendors', loadVendors, state.editVendor, row, $('dlg-vendor'), 'Gagal menyimpan vendor.');
  });
  $('v-delete').addEventListener('click', async () => {
    if (!state.editVendor || !guard()) return;
    const v = { ...state.editVendor }, pays = state.payments.filter((p) => p.vendor_id === v.id).map((p) => ({ ...p }));
    if (!await appConfirm({ title: 'Hapus vendor?', message: `"${v.name}"${pays.length ? ' beserta ' + pays.length + ' catatan pembayarannya' : ''} akan dihapus.`, ok: 'Hapus', danger: true })) return;
    if (!await optDelete('vendors', 'vendors', () => { loadVendors(); loadPayments(); }, v, $('dlg-vendor'), 'Gagal menghapus vendor.', { key: 'payments', rows: pays })) return;
    undoToast(`Vendor${pays.length ? ' dan ' + pays.length + ' pembayaran' : ''} dihapus.`, async () => {
      let r = await sb.from('vendors').insert(v); if (r.error) throw r.error;
      if (pays.length) { r = await sb.from('vendor_payments').insert(pays); if (r.error) throw r.error; }
      await Promise.all([loadVendors(), loadPayments()]);
    }, () => removeFiles(pays));
  });

  /* --- Dialog pembayaran --- */
  function syncPaidUI() { $('p-paidwrap').classList.toggle('hidden', !$('p-paid').checked); }
  $('p-paid').addEventListener('change', () => { if ($('p-paid').checked && !$('p-paiddate').value) $('p-paiddate').value = todayStr(); syncPaidUI(); });
  function openPayment(p, vendorId) {
    state.editPay = p || null;
    state.payVendor = p ? p.vendor_id : vendorId;
    $('pay-dlg-title').textContent = p ? 'Ubah pembayaran' : 'Tambah pembayaran';
    $('pay-dlg-vendor').textContent = vendorName(state.payVendor);
    const first = !state.payments.some((x) => x.vendor_id === state.payVendor);
    $('p-label').value = p ? p.label : (first ? 'DP' : 'Cicilan');
    setMoney($('p-amount'), p ? p.amount : 0);
    $('p-due').value = p ? p.due_date : todayStr();
    $('p-paid').checked = !!(p && p.paid_date);
    $('p-paiddate').value = p && p.paid_date ? p.paid_date : '';
    syncPaidUI(); rcReset(p);
    $('p-delete').classList.toggle('hidden', !p);
    $('dlg-payment').showModal();
  }
  $('p-delete').addEventListener('click', async () => {
    if (!state.editPay || !guard()) return;
    if (!await appConfirm({ title: 'Hapus pembayaran?', message: `Catatan "${state.editPay.label}" akan dihapus.`, ok: 'Hapus', danger: true })) return;
    const row = { ...state.editPay };
    if (!await optDelete('payments', 'vendor_payments', loadPayments, row, $('dlg-payment'), 'Gagal menghapus pembayaran.')) return;
    undoToast('Catatan pembayaran dihapus.', async () => { const r = await sb.from('vendor_payments').insert(row); if (r.error) throw r.error; await loadPayments(); }, () => removeFiles([row]));
  });

  /* --- Kalender --- */
  function buildAgenda() {
    const m = {}; const add = (d, e) => { (m[d] = m[d] || []).push(e); };
    state.tasks.forEach((t) => add(t.due_date, { type: 'task', t }));
    state.payments.forEach((p) => add(p.due_date, { type: 'pay', p }));
    return m;
  }
  function weddingDay() {
    if (!state.settings) return null;
    const d = new Date(state.settings.wedding_date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function dotColor(e) {
    if (e.type === 'task') return e.t.is_completed ? 'bg-fill-3' : isOverdue(e.t) ? 'bg-rose-600' : 'bg-brand';
    return e.p.paid_date ? 'bg-fill-3' : e.p.due_date < todayStr() ? 'bg-rose-600' : 'bg-amber-500';
  }
  function renderCalendar() {
    const { y, m } = state.cal, agenda = buildAgenda(), wd = weddingDay(), today = todayStr();
    $('cal-title').textContent = new Date(y, m, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const offset = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
    let html = '<div></div>'.repeat(offset);
    for (let d = 1; d <= dim; d++) {
      const ds = `${y}-${pad(m + 1)}-${pad(d)}`, ev = agenda[ds] || [];
      const sel = ds === state.calSel;
      const cls = sel ? 'border-brand-edge bg-brand-soft' : ds === today ? 'border-brand-line-2 bg-surface' : 'border-transparent bg-surface';
      const dots = ds === wd
        ? '<span class="text-xs font-semibold text-brand-ink-2 leading-none">Hari H</span>'
        : ev.slice(0, 3).map((e) => `<span class="w-1.5 h-1.5 ${e.type === 'task' ? 'rounded-full' : 'rounded-xs'} ${dotColor(e)}"></span>`).join('') + (ev.length > 3 ? '<span class="text-xs leading-none text-ink-4">+</span>' : '');
      html += `<button data-day="${ds}" aria-pressed="${sel}" aria-label="${d} ${$('cal-title').textContent}${ds === today ? ', hari ini' : ''}${ds === wd ? ', Hari H' : ''}, ${ev.length} agenda" class="h-14 lg:h-16 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${cls} ${ds === wd ? 'ring-2 ring-selected' : ''}">
        <span class="text-sm ${ds === today ? 'font-bold text-brand-ink-2' : 'text-ink-2'}">${d}</span>
        <span class="flex items-center gap-0.5 h-3">${dots}</span></button>`;
    }
    $('cal-grid').innerHTML = html;
    renderDay(agenda, wd);
  }
  function renderDay(agenda, wd) {
    const sel = state.calSel, ev = agenda[sel] || [];
    const title = parseDate(sel).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let html = `<h3 class="font-semibold text-ink-2">${title}</h3>`;
    if (sel === wd) html += '<div class="rounded-xl bg-emerald-700 text-white p-4 font-semibold">Hari H pernikahan</div>';
    const tasks = ev.filter((e) => e.type === 'task'), pays = ev.filter((e) => e.type === 'pay');
    html += tasks.map(({ t }) => `<article class="flex items-start gap-1 rounded-xl bg-surface border py-1 pl-3 pr-1 ${isOverdue(t) ? 'border-danger-line' : 'border-line'}">
        <div class="flex-1 min-w-0 py-2">
          <div class="flex items-center gap-2 text-xs"><span class="rounded-full bg-brand-soft text-brand-ink-3 px-2 py-0.5 font-semibold">Tugas</span><span class="text-muted">${esc(t.category)}</span></div>
          <div class="font-medium ${t.is_completed ? 'line-through text-muted' : ''}">${esc(t.title)}</div>
          <div class="text-sm">${t.is_completed ? '<span class="text-brand-ink-2">Selesai</span>' : isOverdue(t) ? '<span class="text-danger-ink font-medium">Terlambat</span>' : '<span class="text-muted">Belum selesai</span>'}</div>
        </div>
        <button data-ctask="${t.id}" aria-label="Ubah tugas ${esc(t.title)}" class="${EDIT_BTN}">${PENCIL}</button></article>`).join('');
    html += pays.map(({ p }) => `<article class="flex items-start gap-1 rounded-xl bg-surface border py-1 pl-3 pr-1 ${payStatus(p) === 'overdue' ? 'border-danger-line' : 'border-line'}">
        <div class="flex-1 min-w-0 py-2">
          <div class="flex items-center gap-2 text-xs"><span class="rounded-full bg-warn-soft text-warn-ink-2 px-2 py-0.5 font-semibold">Pembayaran</span><span class="text-muted">${esc(vendorName(p.vendor_id))}</span></div>
          <div class="font-medium tabular-nums">${esc(p.label)}: ${rp(p.amount)}</div>
          <div class="text-sm">${payBadge(p)}</div>
        </div>
        <button data-cpay="${p.id}" aria-label="Ubah pembayaran ${esc(p.label)} ${esc(vendorName(p.vendor_id))}" class="${EDIT_BTN}">${PENCIL}</button></article>`).join('');
    if (!ev.length && sel !== wd) html += '<div class="rounded-xl border border-dashed border-line-strong p-4 text-center text-muted">Tidak ada agenda di tanggal ini. Ketuk + untuk menambah tugas.</div>';
    $('cal-day').innerHTML = html;
  }
  $('cal-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]'); if (!b) return;
    state.calSel = b.dataset.day; renderCalendar();
  });
  $('cal-day').addEventListener('click', (e) => {
    const t = e.target.closest('[data-ctask]');
    if (t) return openTask(state.tasks.find((x) => x.id === t.dataset.ctask));
    const p = e.target.closest('[data-cpay]');
    if (p) openPayment(state.payments.find((x) => x.id === p.dataset.cpay));
  });
  const shiftMonth = (n) => { const d = new Date(state.cal.y, state.cal.m + n, 1); state.cal = { y: d.getFullYear(), m: d.getMonth() }; renderCalendar(); };
  $('cal-prev').addEventListener('click', () => shiftMonth(-1));
  $('cal-next').addEventListener('click', () => shiftMonth(1));
  $('cal-today').addEventListener('click', () => { const n = new Date(); state.cal = { y: n.getFullYear(), m: n.getMonth() }; state.calSel = todayStr(); renderCalendar(); });


  /* ---------- Template checklist ---------- */
  // Tiap grup: jarak ke hari H (m = bulan, w = minggu, d = hari) dan daftar [judul, kategori].
  const TEMPLATE = [
    { label: 'H-12 bulan', m: 12, items: [
      ['Diskusi keluarga: tentukan konsep dan skala pernikahan', 'Lainnya'],
      ['Susun anggaran awal dan pembagian biaya antar keluarga', 'Lainnya'],
      ['Susun daftar tamu awal (keluarga, teman, kantor)', 'Undangan'],
      ['Survei dan booking venue', 'Venue'] ] },
    { label: 'H-10 bulan', m: 10, items: [
      ['Booking katering', 'Katering'],
      ['Booking fotografer dan videografer', 'Dokumentasi'],
      ['Booking MUA dan penata rias', 'Pakaian'] ] },
    { label: 'H-9 bulan', m: 9, items: [
      ['Booking dekorasi dan pelaminan', 'Dekorasi'],
      ['Booking MC, musik, atau hiburan', 'Hiburan'],
      ['Pilih dan pesan baju pengantin', 'Pakaian'] ] },
    { label: 'H-8 bulan', m: 8, items: [
      ['Pilih desain dan vendor undangan', 'Undangan'],
      ['Pilih vendor souvenir', 'Lainnya'] ] },
    { label: 'H-6 bulan', m: 6, items: [
      ['Cek jadwal dan persyaratan pendaftaran di KUA', 'KUA'],
      ['Tentukan mahar', 'Lainnya'],
      ['Rencanakan bulan madu', 'Lainnya'] ] },
    { label: 'H-5 bulan', m: 5, items: [
      ['Beli cincin kawin', 'Pakaian'],
      ['Tasting menu katering', 'Katering'],
      ['Finalisasi daftar tamu', 'Undangan'] ] },
    { label: 'H-4 bulan', m: 4, items: [
      ['Ikuti bimbingan perkawinan (bimwin) atau kursus calon pengantin', 'KUA'],
      ['Finalisasi desain undangan', 'Undangan'],
      ['Fitting pertama baju pengantin', 'Pakaian'] ] },
    { label: 'H-3 bulan', m: 3, items: [
      ['Urus surat pengantar RT/RW dan Kelurahan (N1-N4)', 'KUA'],
      ['Pemeriksaan kesehatan pranikah', 'KUA'],
      ['Cetak undangan', 'Undangan'],
      ['Pesan souvenir', 'Lainnya'],
      ['Siapkan dan pesan seserahan', 'Lainnya'] ] },
    { label: 'H-2 bulan', m: 2, items: [
      ['Sebar undangan', 'Undangan'],
      ['Fitting kedua baju pengantin', 'Pakaian'],
      ['Finalisasi konsep dekorasi dan pelaminan', 'Dekorasi'] ] },
    { label: 'H-6 minggu', w: 6, items: [
      ['Daftarkan pernikahan di KUA', 'KUA'] ] },
    { label: 'H-1 bulan', m: 1, items: [
      ['Konfirmasi ulang semua vendor (jadwal dan kontrak)', 'Lainnya'],
      ['Konfirmasi kehadiran tamu (RSVP)', 'Undangan'],
      ['Susun rundown acara bersama keluarga dan WO', 'Lainnya'],
      ['Cek pelunasan vendor di tab Vendor', 'Lainnya'] ] },
    { label: 'H-2 minggu', w: 2, items: [
      ['Fitting akhir baju pengantin', 'Pakaian'],
      ['Trial makeup', 'Pakaian'],
      ['Konfirmasi jumlah porsi final ke katering', 'Katering'],
      ['Tunjuk penanggung jawab acara dan penerima tamu', 'Lainnya'] ] },
    { label: 'H-1 minggu', w: 1, items: [
      ['Briefing keluarga dan panitia', 'Lainnya'],
      ['Siapkan mahar, cincin, dan dokumen untuk akad', 'KUA'],
      ['Siapkan seserahan dan perlengkapan hari H', 'Lainnya'],
      ['Konfirmasi ulang jam datang semua vendor', 'Lainnya'] ] },
    { label: 'H-3 hari', d: 3, items: [
      ['Perawatan pengantin dan istirahat cukup', 'Pakaian'],
      ['Siapkan amplop, angpao, dan perlengkapan darurat', 'Lainnya'] ] },
    { label: 'H-1', d: 1, items: [
      ['Gladi resik dan cek lokasi', 'Venue'],
      ['Serahkan perlengkapan ke penanggung jawab', 'Lainnya'],
      ['Istirahat cukup dan tidur lebih awal', 'Lainnya'] ] }
  ];
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function offsetDate(wd, g) {
    const d = parseDate(wd);
    if (g.m) { // mundur n bulan, tanggal dipotong bila bulan tujuan lebih pendek
      const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() - g.m);
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    }
    if (g.w) d.setDate(d.getDate() - 7 * g.w);
    if (g.d) d.setDate(d.getDate() - g.d);
    return ymd(d);
  }
  function planTemplate() {
    const wd = weddingDay(), today = todayStr(), mode = $('tpl-past').value;
    const have = new Set(state.tasks.map((t) => t.title.trim().toLowerCase()));
    const plan = { groups: [], total: 0, dup: 0, past: 0, skipped: 0 };
    TEMPLATE.forEach((g) => {
      const due = offsetDate(wd, g), isPast = due < today, rows = [];
      g.items.forEach(([title, category]) => {
        if (have.has(title.toLowerCase())) { plan.dup++; return; }
        if (isPast) { plan.past++; if (mode === 'skip') { plan.skipped++; return; } }
        rows.push({ title, category, due_date: isPast ? today : due });
      });
      if (rows.length || (isPast && mode === 'skip')) plan.groups.push({ label: g.label, due, isPast, rows });
      plan.total += rows.length;
    });
    return plan;
  }
  function renderTemplate() {
    const plan = planTemplate();
    $('tpl-date').textContent = parseDate(weddingDay()).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('tpl-pastwrap').classList.toggle('hidden', !plan.past);
    $('tpl-pastlabel').textContent = `${plan.past} tugas tenggatnya sudah lewat karena hari H kurang dari 12 bulan lagi`;
    const parts = [`${plan.total} tugas akan ditambahkan.`];
    if (plan.dup) parts.push(`${plan.dup} tugas dengan nama sama sudah ada dan dilewati.`);
    $('tpl-summary').textContent = parts.join(' ');
    $('tpl-preview').innerHTML = plan.groups.length ? plan.groups.map((g) => {
      const head = g.isPast ? (g.rows.length ? 'sudah lewat, dijadwalkan hari ini' : 'sudah lewat, dilewati') : fmtDate(g.due);
      return `<div class="sticky top-0 bg-fill px-3 py-1 text-xs font-medium text-ink-4">${g.label} &nbsp;|&nbsp; ${head}</div>` +
        g.rows.map((r) => `<div class="px-3 py-2 border-t border-line-soft"><div class="text-ink-2">${esc(r.title)}</div><div class="text-xs text-muted">${esc(r.category)}</div></div>`).join('');
    }).join('') : '<div class="p-4 text-center text-muted">Semua tugas template sudah ada di daftar Anda.</div>';
    const btn = $('tpl-apply'), tmp = datePlaceholder();
    $('tpl-datewarn').classList.toggle('hidden', !tmp);
    btn.disabled = plan.total === 0 || tmp;
    btn.textContent = plan.total ? `Tambahkan ${plan.total} tugas` : 'Tidak ada yang ditambahkan';
  }
  function openTemplate() {
    if (!guard()) return;
    if (state.loadingTasks) return toast('Tunggu sebentar, tugas masih dimuat.');
    const wd = weddingDay();
    if (!wd || wd <= todayStr()) return toast('Atur tanggal hari H di masa depan lewat ikon pengaturan, lalu coba lagi.');
    $('tpl-past').value = 'today';
    renderTemplate();
    $('dlg-template').showModal();
  }
  $('btn-template').addEventListener('click', openTemplate);
  $('tpl-past').addEventListener('change', renderTemplate);
  $('tpl-change').addEventListener('click', () => { $('dlg-template').close(); $('btn-settings').click(); });
  $('tpl-apply').addEventListener('click', async () => {
    if (!guard()) return;
    const rows = planTemplate().groups.flatMap((g) => g.rows).map((r) => ({ ...r, is_completed: false, profile: state.profile }));
    if (!rows.length) return;
    const btn = $('tpl-apply'); btn.disabled = true; btn.textContent = 'Menambahkan...';
    const { error } = await sb.from('tasks').insert(rows);
    if (error) { renderTemplate(); return toast('Gagal menambahkan template. Periksa koneksi lalu coba lagi.'); }
    $('dlg-template').close(); await loadTasks();
    toast(`${rows.length} tugas ditambahkan dari template.`);
  });

  /* ---------- Beranda ---------- */
  function renderHome() {
    const el = $('home-body');
    if (state.loadingTasks || state.loadingBudget || state.loadingVendor || state.loadingPay) {
      el.innerHTML = '<div class="skeleton skeleton-pulse h-40"></div><div class="skeleton skeleton-pulse h-32"></div><div class="skeleton skeleton-pulse h-28"></div>'; return;
    }
    const today = todayStr(), MAX = 5;
    const card = (title, right, body) => `<section class="rounded-xl bg-surface border border-line p-4"><div class="flex items-baseline justify-between gap-2"><h2 class="font-semibold text-ink-2">${title}</h2>${right || ''}</div>${body}</section>`;
    const empty = (txt) => `<p class="mt-2 text-sm text-muted">${txt}</p>`;
    const link = (attrs, txt) => `<button ${attrs} class="mt-1 min-h-touch text-sm font-medium text-brand-ink-2 hover:underline">${txt}</button>`;
    const box = () => `<span class="w-6 h-6 rounded-md border-2 bg-surface border-line-control"></span>`;

    if (hasNoData()) { el.innerHTML = card('Data belum bisa dimuat', '', empty('Periksa koneksi internet, lalu coba lagi.') + link('data-hact="retry"', 'Coba lagi')); return; }

    /* Tugas terlambat dan hari ini */
    const open = state.tasks.filter((t) => !t.is_completed);
    const overdue = open.filter((t) => t.due_date < today).sort((a, b) => a.due_date.localeCompare(b.due_date));
    const dueToday = open.filter((t) => t.due_date === today);
    const items = [...overdue, ...dueToday], shown = items.slice(0, MAX);
    let tBody;
    if (!state.tasks.length) {
      tBody = empty('Belum ada tugas.');
    } else if (!items.length) {
      const next = open.filter((t) => t.due_date > today).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
      tBody = empty('Tidak ada tugas terlambat atau jatuh tempo hari ini.' + (next ? ` Berikutnya: ${esc(next.title)} (${fmtDate(next.due_date)}).` : ' Semua tugas sudah selesai.'));
    } else {
      tBody = '<div class="mt-2">' + shown.map((t) => {
        const od = t.due_date < today;
        const sub = (od ? `<span class="text-danger-ink font-medium">Terlambat ${-daysUntil(t.due_date)} hari</span>` : '<span class="text-warn-ink font-medium">Jatuh tempo hari ini</span>')
          + (t.priority === 'tinggi' ? ' &nbsp;|&nbsp; <span class="text-danger-ink">Prioritas tinggi</span>' : '') + (t.assignee ? ` &nbsp;|&nbsp; PJ: ${esc(t.assignee)}` : '');
        return `<div class="flex items-start gap-1 border-t border-line-soft first:border-t-0">
          <button data-htoggle="${t.id}" role="checkbox" aria-checked="false" aria-label="Tandai ${esc(t.title)} selesai" class="shrink-0 w-11 h-11 flex items-center justify-center">${box()}</button>
          <div class="flex-1 min-w-0 py-2"><div class="font-medium text-ink-2">${esc(t.title)}</div><div class="text-sm text-muted">${esc(t.category)} &nbsp;|&nbsp; ${sub}</div></div></div>`;
      }).join('') + '</div>' + (items.length > MAX ? link(`data-hact="${overdue.length ? 'overdue' : 'tasks'}"`, `Lihat ${items.length - MAX} tugas lainnya`) : '');
    }
    const tRight = overdue.length ? `<span class="text-sm font-medium text-danger-ink">${overdue.length} terlambat</span>` : '';

    /* Tagihan vendor: terlambat + 7 hari ke depan */
    const unpaid = state.payments.filter((p) => !p.paid_date).sort((a, b) => a.due_date.localeCompare(b.due_date));
    const bills = unpaid.filter((p) => daysUntil(p.due_date) <= 7), billShown = bills.slice(0, MAX);
    const billTotal = bills.reduce((a, p) => a + Number(p.amount), 0);
    let bBody;
    if (!bills.length) {
      const next = unpaid[0];
      bBody = empty('Tidak ada tagihan yang terlambat atau jatuh tempo dalam 7 hari ke depan.' + (next ? ` Berikutnya: ${esc(vendorName(next.vendor_id))}, ${esc(next.label)} ${rp(next.amount)} (${fmtDate(next.due_date)}).` : ''));
    } else {
      bBody = '<div class="mt-2">' + billShown.map((p) => `<div class="flex items-start gap-1 border-t border-line-soft first:border-t-0">
          <button data-hptoggle="${p.id}" role="checkbox" aria-checked="false" aria-label="Tandai ${esc(p.label)} ${esc(vendorName(p.vendor_id))} dibayar" class="shrink-0 w-11 h-11 flex items-center justify-center">${box()}</button>
          <div class="flex-1 min-w-0 py-2"><div class="font-medium text-ink-2">${esc(vendorName(p.vendor_id))}</div>
            <div class="text-sm tabular-nums text-ink-4">${esc(p.label)}: ${rp(p.amount)}</div>
            <div class="text-sm">${payBadge(p)}</div></div></div>`).join('') + '</div>' +
        (bills.length > MAX ? link('data-hact="vendor"', `Lihat ${bills.length - MAX} tagihan lainnya`) : '');
    }
    const bRight = bills.length ? `<span class="text-sm font-medium tabular-nums text-ink-3">${rp(billTotal)}</span>` : '';

    /* Ringkasan: satu sumber untuk hero dan dua tile */
    const total = state.tasks.length, done = state.tasks.filter((t) => t.is_completed).length;
    const tp = total ? Math.round((done / total) * 100) : 0;
    const b = budgetStats();
    const barColor = b.pct > 90 ? 'bg-rose-600' : b.pct >= 75 ? 'bg-amber-500' : 'bg-brand-mid';
    const after = b.left - b.vDue - b.vUnsched - b.bUnpaid;
    const short = (n) => { const a = Math.abs(n), sg = n < 0 ? '-' : ''; return a >= 1e9 ? `${sg}Rp ${+(a / 1e9).toFixed(1)} M` : a >= 1e6 ? `${sg}Rp ${+(a / 1e6).toFixed(1)} jt` : sg + rp(a); };
    const lateBills = bills.filter((p) => p.due_date < today).length, issues = [];
    if (overdue.length) issues.push(`${overdue.length} tugas terlambat`);
    if (lateBills) issues.push(`${lateBills} tagihan terlambat`);
    if (b.cap > 0 && after < 0) issues.push('anggaran diperkirakan melebihi plafon');
    const wd = state.settings ? new Date(state.settings.wedding_date) : null, noDate = !wd || datePlaceholder();
    const cd = noDate ? null : daysToWedding(wd);
    const big = noDate ? 'Atur hari H' : cd <= 0 ? 'Hari H' : 'H-' + cd;
    const wdTxt = noDate ? 'Tanggal belum diatur' : wd.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const hero = `<div class="lg:col-span-2 rounded-2xl bg-emerald-700 text-white p-5">
      <div class="flex items-start justify-between gap-3"><div><div class="text-4xl font-bold tabular-nums leading-none">${big}</div><div class="mt-2 text-sm text-emerald-100">${wdTxt}</div></div>
      <span class="shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${issues.length || noDate ? 'bg-amber-300 text-amber-950' : 'bg-surface text-brand-ink-3'}">${issues.length || noDate ? 'Perlu perhatian' : 'Aman'}</span></div>
      ${noDate ? `<p class="mt-3 text-sm text-emerald-50">Hitung mundur dan tenggat template checklist belum akurat sampai tanggal hari H diisi.</p><button data-hact="settings" class="mt-2 min-h-touch px-4 rounded-lg bg-surface text-brand-ink-3 text-sm font-semibold">Atur tanggal hari H</button>` : ''}
      ${issues.length ? `<p class="mt-3 text-base font-medium">Perlu ditangani: ${issues.join(', ')}.</p>` : ''}</div>`;
    const tile = (act, label, val, sub, pct, bar, col) => `<button data-hact="${act}" class="rounded-xl bg-surface border border-line p-3 text-left"><div class="text-xs text-muted">${label}</div><div class="mt-1 text-lg font-bold tabular-nums ${col || 'text-ink'}">${val}</div><div class="mt-2 h-1.5 rounded-full bg-fill-2 overflow-hidden"><div class="h-full ${bar}" style="width:${pct}%"></div></div><div class="mt-1 text-xs text-muted tabular-nums">${sub}</div></button>`;
    const kpi = `<div class="lg:col-span-2 grid grid-cols-2 gap-2">
      ${tile('tasks', 'Tugas selesai', tp + '%', `${done} dari ${total}`, tp, 'bg-brand')}
      ${tile('budget', 'Sisa saldo', short(b.left), Math.round(b.pct) + '% terpakai', Math.min(b.pct, 100), barColor, b.left < 0 ? 'text-danger-ink' : '')}</div>`;
    const steps = [[b.cap > 0, 'Isi total plafon anggaran', 'settings'], [state.tasks.length > 0, 'Isi checklist tugas', 'template'], [state.vendors.length > 0, 'Tambah vendor dan jadwal bayar', 'vendor']];
    const setup = steps.every((x) => x[0]) ? '' : `<section class="lg:col-span-2 rounded-xl bg-surface border border-brand-line p-4"><h2 class="font-semibold text-ink-2">Mulai dari sini <span class="text-sm font-normal text-muted">${steps.filter((x) => x[0]).length}/${steps.length} langkah</span></h2>
      <ol class="mt-2">${steps.map(([ok, t, act], i) => `<li class="flex items-center gap-3 py-1 border-t border-line-soft first:border-t-0"><span class="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${ok ? 'bg-brand text-white' : 'border-2 border-line-strong text-muted'}">${ok ? '&#10003;' : i + 1}</span><span class="flex-1 ${ok ? 'text-muted line-through' : 'font-medium text-ink-2'}">${t}</span>${ok ? '' : `<button data-hact="${act}" class="min-h-touch px-3 text-sm font-semibold text-brand-ink-2">Mulai</button>`}</li>`).join('')}</ol></section>`;
    el.innerHTML = hero + setup + kpi +
      card('Perlu dikerjakan', tRight, tBody) + card('Tagihan vendor 7 hari ke depan', bRight, bBody);
  }
  $('home-body').addEventListener('click', (e) => {
    const t = e.target.closest('[data-htoggle]'); if (t) return toggleTask(t.dataset.htoggle);
    const p = e.target.closest('[data-hptoggle]'); if (p) return togglePayment(p.dataset.hptoggle);
    const a = e.target.closest('[data-hact]'); if (!a) return;
    const act = a.dataset.hact;
    if (act === 'template') return openTemplate();
    if (act === 'retry') return refreshAll();
    if (act === 'settings') return $('btn-settings').click();
    if (act === 'overdue') { state.fStatus = 'all'; state.fCat = ''; state.fTime = 'overdue'; $('f-cat').value = ''; $('f-time').value = 'overdue'; renderChips(); renderTasks(); return setView('task'); }
    setView(act === 'tasks' ? 'task' : act);
  });


  /* ---------- WhatsApp ke vendor ---------- */
  const waNumber = (ph) => { let d = String(ph).replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d; return d.length >= 9 ? d : ''; };
  const wa = { opts: [], phone: '' };
  function openWa(id) {
    const v = state.vendors.find((x) => x.id === id); if (!v) return;
    const phone = waNumber(v.phone); if (!phone) return toast('Nomor telepon vendor belum valid. Periksa di data vendor.');
    const P = PROFILES[state.profile].name, wdate = state.settings ? new Date(state.settings.wedding_date) : null;
    const wdTxt = wdate ? wdate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'tanggal yang telah disepakati';
    const wtTxt = wdate ? wdate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.') : '';
    const pays = state.payments.filter((p) => p.vendor_id === v.id).sort((a, b) => a.due_date.localeCompare(b.due_date));
    const opts = pays.filter((p) => !p.paid_date).map((p) => ({ label: `Pengingat pembayaran ${p.label} (tenggat ${fmtDate(p.due_date)})`,
      text: `Halo ${v.name}, kami dari pernikahan ${P}. Kami ingin mengonfirmasi pembayaran ${p.label} sebesar ${rp(p.amount)} yang jatuh tempo pada ${fmtDate(p.due_date)}. Mohon dikirimkan nomor rekening tujuan yang berlaku. Terima kasih.` }));
    opts.push({ label: 'Konfirmasi jadwal',
      text: `Halo ${v.name}, kami mengonfirmasi jadwal ${v.category.toLowerCase()} untuk pernikahan ${P} pada ${wdTxt}${wtTxt ? ', pukul ' + wtTxt : ''}. Mohon konfirmasi kesiapan dan jam kedatangan tim. Terima kasih.` });
    pays.filter((p) => p.paid_date).forEach((p) => opts.push({ label: `Konfirmasi sudah dibayar: ${p.label}`,
      text: `Halo ${v.name}, pembayaran ${p.label} sebesar ${rp(p.amount)} sudah kami transfer pada ${fmtDate(p.paid_date)}. Mohon dicek dan dikonfirmasi penerimaannya. Terima kasih.` }));
    wa.opts = opts; wa.phone = phone;
    $('wa-vendor').textContent = v.name;
    $('wa-tpl').innerHTML = opts.map((o, i) => `<option value="${i}">${esc(o.label)}</option>`).join('');
    $('wa-msg').value = opts[0].text;
    $('dlg-wa').showModal();
  }
  $('wa-tpl').addEventListener('change', () => { $('wa-msg').value = wa.opts[Number($('wa-tpl').value)].text; });
  $('wa-open').addEventListener('click', () => {
    const msg = $('wa-msg').value.trim(); if (!msg) return;
    window.open(`https://wa.me/${wa.phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    $('dlg-wa').close();
  });

  /* ---------- Foto bukti bayar (Supabase Storage, bucket privat "receipts") ---------- */
  const BUCKET = 'receipts', RECEIPT_MAX_PX = 1600;
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height, k = Math.min(1, RECEIPT_MAX_PX / Math.max(w0, h0));
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.72);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')); };
      img.src = url;
    });
  }
  async function signedUrl(path) {
    try { const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600); return error ? null : data.signedUrl; } catch (e) { return null; }
  }
  const rc = { file: null, remove: false, token: 0, preview: null };
  function showReceipt(src) {
    $('p-receipt-prev').classList.toggle('hidden', !src);
    if (src) $('p-receipt-img').src = src; else $('p-receipt-img').removeAttribute('src');
  }
  function rcReset(p) {
    rc.file = null; rc.remove = false; rc.token++; $('p-file').value = '';
    if (rc.preview) { URL.revokeObjectURL(rc.preview); rc.preview = null; }
    showReceipt(null);
    $('p-file-remove').classList.toggle('hidden', !(p && p.receipt_path));
    if (p && p.receipt_path && sb) { const t = rc.token; signedUrl(p.receipt_path).then((u) => { if (t === rc.token && u && !rc.file && !rc.remove) showReceipt(u); }); }
  }
  $('p-file').addEventListener('change', () => {
    const f = $('p-file').files && $('p-file').files[0]; if (!f) return;
    if (!/^image\//.test(f.type)) { $('p-file').value = ''; return toast('Pilih berkas gambar.'); }
    rc.file = f; rc.remove = false;
    if (rc.preview) URL.revokeObjectURL(rc.preview);
    rc.preview = URL.createObjectURL(f); showReceipt(rc.preview); $('p-file-remove').classList.remove('hidden');
  });
  $('p-file-remove').addEventListener('click', () => { rc.file = null; rc.remove = true; $('p-file').value = ''; showReceipt(null); $('p-file-remove').classList.add('hidden'); });
  async function openReceipt(p) {
    if (!p || !p.receipt_path || !guard()) return;
    $('rc-info').textContent = `${vendorName(p.vendor_id)} | ${p.label} ${rp(p.amount)}`;
    $('rc-body').textContent = 'Memuat foto...'; $('rc-full').classList.add('hidden');
    $('dlg-receipt').showModal();
    const u = await signedUrl(p.receipt_path);
    if (!u) { $('rc-body').textContent = 'Foto tidak bisa dimuat. Periksa koneksi.'; return; }
    $('rc-body').innerHTML = `<img src="${esc(u)}" alt="Bukti bayar" class="max-h-[60vh] rounded-lg border border-line">`;
    $('rc-full').href = u; $('rc-full').classList.remove('hidden');
  }
  $('form-payment').addEventListener('submit', async (e) => {
    e.preventDefault(); if (!guard()) return;
    const paid = $('p-paid').checked, sub = $('p-submit'), old = state.editPay ? state.editPay.receipt_path || null : null;
    const row = { vendor_id: state.payVendor, label: $('p-label').value, amount: num($('p-amount').value), due_date: $('p-due').value, paid_date: paid ? ($('p-paiddate').value || todayStr()) : null, profile: state.profile };
    if (!rc.file) {
      if (rc.remove) row.receipt_path = null;
      return optSave('payments', 'vendor_payments', loadPayments, state.editPay, row, $('dlg-payment'), 'Gagal menyimpan pembayaran.', () => { if (old && rc.remove) sb.storage.from(BUCKET).remove([old]); });
    }
    sub.disabled = true; let uploaded = null;
    try {
      if (rc.file) {
        const blob = await compressImage(rc.file);
        uploaded = `${state.profile}/${(window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)}.jpg`;
        const up = await sb.storage.from(BUCKET).upload(uploaded, blob, { contentType: 'image/jpeg' });
        if (up.error) { uploaded = null; throw up.error; }
        row.receipt_path = uploaded;
      } else if (rc.remove) row.receipt_path = null;
      const q = state.editPay ? sb.from('vendor_payments').update(row).eq('id', state.editPay.id) : sb.from('vendor_payments').insert(row);
      const { error } = await q; if (error) throw error;
    } catch (err) {
      console.error(err); if (uploaded) sb.storage.from(BUCKET).remove([uploaded]);
      sub.disabled = false; return toast('Gagal menyimpan pembayaran atau mengunggah foto.');
    }
    sub.disabled = false;
    if (old && (rc.file || rc.remove)) sb.storage.from(BUCKET).remove([old]);
    $('dlg-payment').close(); loadPayments();
  });

  /* ---------- Berkas: cadangan JSON dan ekspor .ics ---------- */
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  async function saveFile(name, mime, text) {
    const blob = new Blob([text], { type: mime });
    if (isMobile && navigator.canShare) {
      try { const f = new File([blob], name, { type: mime }); if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; } }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const readFileText = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f); });
  const dataReady = () => {
    if (KEYS.some((k) => state.loadErr[k] || state.noData[k] || !state.fresh[k])) { toast('Data belum termuat penuh. Coba lagi setelah online.'); return false; }
    return true;
  };

  const COLS = {
    tasks: ['id', 'title', 'category', 'due_date', 'is_completed', 'notes', 'priority', 'assignee'],
    budgets: ['id', 'item_name', 'est_cost', 'actual_cost', 'category', 'paid_date'],
    category_budgets: ['id', 'category', 'amount'],
    shopping_lists: ['id', 'name', 'category'],
    shopping_items: ['id', 'list_id', 'name', 'qty', 'est_cost', 'actual_cost', 'store', 'notes', 'paid_date'],
    vendors: ['id', 'name', 'category', 'phone', 'total_cost', 'notes'],
    vendor_payments: ['id', 'vendor_id', 'label', 'amount', 'due_date', 'paid_date', 'receipt_path']
  };
  const pick = (row, cols) => Object.fromEntries(cols.filter((c) => row[c] !== undefined).map((c) => [c, row[c]]));
  const backupBundle = () => ({ app: 'wedding-planner', version: 1, exported_at: new Date().toISOString(), profile: state.profile,
    settings: state.settings, tasks: state.tasks, budgets: state.budgets, category_budgets: state.catbud, shopping_lists: state.slists, shopping_items: state.sitems, vendors: state.vendors, vendor_payments: state.payments });
  async function restoreBundle(b) {
    const pf = state.profile;
    if (b.settings) {
      const { error } = await sb.from('settings').upsert({ id: PROFILES[pf].id, profile: pf, wedding_date: b.settings.wedding_date, master_budget: b.settings.master_budget });
      if (error) throw error;
    }
    for (const tbl of ['tasks', 'budgets', 'category_budgets', 'vendors', 'vendor_payments', 'shopping_lists', 'shopping_items']) {
      const rows = (b[tbl] || []).map((r) => ({ ...pick(r, COLS[tbl]), profile: pf }));
      for (let i = 0; i < rows.length; i += 200) { const { error } = await sb.from(tbl).insert(rows.slice(i, i + 200)); if (error) throw error; }
    }
  }
  $('btn-export').addEventListener('click', () => {
    if (!dataReady()) return;
    saveFile(`wedding-planner-${state.profile}-${todayStr()}.json`, 'application/json', JSON.stringify(backupBundle(), null, 2));
    toast('Cadangan dibuat.');
  });
  $('btn-import').addEventListener('click', () => $('f-import').click());
  $('f-import').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    let b; try { b = JSON.parse(await readFileText(f)); } catch (err) { return toast('Berkas bukan JSON yang valid.'); }
    const valid = b && b.app === 'wedding-planner' && b.version === 1 && ['tasks', 'budgets', 'vendors', 'vendor_payments'].every((k) => Array.isArray(b[k]));
    if (!valid) return toast('Berkas ini bukan cadangan Wedding Planner.');
    if (b.profile !== state.profile) return toast(`Cadangan ini milik ${(PROFILES[b.profile] || {}).name || 'acara lain'}. Buka acara tersebut untuk mengimpornya.`);
    if (!guard() || !dataReady()) return;
    const when = b.exported_at ? new Date(b.exported_at).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'tanggal tidak diketahui';
    if (!await appConfirm({ title: `Ganti semua data ${PROFILES[state.profile].name}?`, message: `Cadangan dibuat: ${when}\nIsi: ${b.tasks.length} tugas, ${b.budgets.length} item budget, ${b.vendors.length} vendor, ${b.vendor_payments.length} pembayaran.\nData saat ini akan diganti.`, ok: 'Ganti data', danger: true })) return;
    const prev = backupBundle();
    runDemo(async () => {
      try { await wipeAll(); await restoreBundle(b); }
      catch (err) { try { await wipeAll(); await restoreBundle(prev); } catch (e2) { console.error(e2); } throw err; }
    }, 'Cadangan dipulihkan.');
  });

  function icsFold(line) {
    const enc = new TextEncoder(); let out = '', cur = '', bytes = 0;
    for (const ch of line) {
      const n = enc.encode(ch).length;
      if (bytes + n > 75) { out += cur + '\r\n'; cur = ' '; bytes = 1; }
      cur += ch; bytes += n;
    }
    return out + cur;
  }
  function buildICS() {
    const L = [], name = PROFILES[state.profile].name, d8 = (x) => x.replace(/-/g, '');
    const esc2 = (x) => String(x).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const nextDay = (x) => { const d = parseDate(x); d.setDate(d.getDate() + 1); return ymd(d); };
    const add = (e) => {
      L.push('BEGIN:VEVENT', `UID:${e.uid}@wedding-planner`, `DTSTAMP:${stamp}`, ...e.lines, `SUMMARY:${esc2(e.summary)}`);
      if (e.desc) L.push(`DESCRIPTION:${esc2(e.desc)}`);
      if (e.prio) L.push(`PRIORITY:${e.prio}`);
      (e.alarms || []).forEach((tr) => L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc2(e.summary)}`, `TRIGGER:${tr}`, 'END:VALARM'));
      L.push('END:VEVENT');
    };
    const allDay = (x) => [`DTSTART;VALUE=DATE:${d8(x)}`, `DTEND;VALUE=DATE:${d8(nextDay(x))}`];
    if (state.settings) {
      const w = new Date(state.settings.wedding_date), end = new Date(w.getTime() + 3 * 36e5);
      const lt = (d) => `${d8(ymd(d))}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
      add({ uid: `hari-h-${state.profile}`, summary: `Hari H pernikahan ${name}`, lines: [`DTSTART:${lt(w)}`, `DTEND:${lt(end)}`], alarms: ['-P7D', '-P1D'] });
    }
    state.tasks.filter((t) => !t.is_completed).forEach((t) => add({ uid: `task-${t.id}`, summary: `Tugas: ${t.title}`,
      desc: [t.category, t.assignee ? 'PJ: ' + t.assignee : '', t.notes].filter(Boolean).join(' | '),
      prio: t.priority === 'tinggi' ? 1 : t.priority === 'rendah' ? 9 : 5, lines: allDay(t.due_date), alarms: ['PT9H'] }));
    state.payments.filter((p) => !p.paid_date).forEach((p) => add({ uid: `pay-${p.id}`, summary: `Bayar ${vendorName(p.vendor_id)}: ${p.label} ${rp(p.amount)}`,
      desc: `Jatuh tempo pembayaran ${p.label} untuk ${vendorName(p.vendor_id)}.`, prio: 1, lines: allDay(p.due_date), alarms: ['-P2DT15H', 'PT9H'] }));
    const head = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding Planner//ID', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:Wedding Planner ${name}`];
    return { text: [...head, ...L, 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n', count: L.filter((x) => x === 'BEGIN:VEVENT').length };
  }
  $('btn-ics').addEventListener('click', () => {
    if (state.loadingTasks || hasNoData()) return toast('Data belum termuat. Coba lagi setelah online.');
    const { text, count } = buildICS();
    saveFile(`wedding-planner-${state.profile}-${todayStr()}.ics`, 'text/calendar', text);
    toast(`${count} agenda diekspor. Buka berkasnya untuk menambahkan ke kalender.`);
  });

  /* ---------- Zona berbahaya ---------- */
  const syncDanger = () => {
    const on = $('danger-confirm').value.trim() === 'HAPUS';
    [$('btn-seed'), $('btn-reset')].forEach((b) => { b.disabled = !on; b.classList.toggle('opacity-40', !on); });
  };
  $('danger-confirm').addEventListener('input', syncDanger);

  /* ---------- Sinkronisasi & mode demo ---------- */
  function renderAll() { renderCountdown(); renderHome(); renderTasks(); renderBudget(); renderVendors(); renderShop(); renderCalendar(); }
  function refreshAll() { return Promise.all([loadSettings(), loadTasks(), loadBudgets(), loadCatbud(), loadVendors(), loadPayments(), loadShop()]); }

  // Muat ulang saat aplikasi kembali dibuka / online, agar data tidak basi bila realtime terputus.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && sb && state.ready) refreshAll(); });
  window.addEventListener('online', () => { if (sb && state.ready) refreshAll(); });
  // Status overdue / jatuh tempo bergantung tanggal: render ulang saat lewat tengah malam.
  let lastDay = todayStr();
  setInterval(() => { if (todayStr() !== lastDay) { lastDay = todayStr(); renderAll(); } }, 30000);

  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  async function wipeAll() {
    for (const tbl of ['vendors', 'tasks', 'budgets', 'category_budgets', 'shopping_lists']) { // pembayaran ikut terhapus (cascade)
      const { error } = await sb.from(tbl).delete().eq('profile', state.profile);
      if (error) throw error;
    }
  }
  async function seedDemo() {
    const wd = new Date(); wd.setDate(wd.getDate() + 120); wd.setHours(10, 0, 0, 0);
    const pf = state.profile;
    const ins = (tbl, rows, sel) => { const q = sb.from(tbl).insert(rows.map((x) => ({ ...x, profile: pf }))); return sel ? q.select() : q; };
    let r = await sb.from('settings').upsert({ id: PROFILES[pf].id, profile: pf, wedding_date: wd.toISOString(), master_budget: 150000000 });
    if (r.error) throw r.error;
    const T = (title, category, d, done = false) => ({ title, category, due_date: addDays(d), is_completed: done });
    r = await ins('tasks', [
      T('Bawa berkas N1-N4 ke Kelurahan', 'KUA', -3),
      { ...T('Daftar nikah di KUA', 'KUA', 10), priority: 'tinggi', assignee: 'Mempelai', notes: 'Bawa fotokopi KTP, KK, dan pas foto' },
      T('DP gedung serbaguna', 'Venue', -20, true),
      T('Survei lokasi akad', 'Venue', 5),
      T('Tasting menu katering', 'Katering', 14),
      T('Beli cincin kawin', 'Pakaian', -10, true),
      T('Fitting baju pengantin', 'Pakaian', 30),
      T('Cetak undangan', 'Undangan', 45),
      T('Finalisasi konsep pelaminan', 'Dekorasi', 60)
    ]);
    if (r.error) throw r.error;
    r = await ins('budgets', [
      { item_name: 'Cincin kawin', category: 'Seserahan & mahar', est_cost: 3000000, actual_cost: 3000000, paid_date: addDays(-10) },
      { item_name: 'Mahar', category: 'Seserahan & mahar', est_cost: 5000000, actual_cost: 5000000, paid_date: addDays(-5) },
      { item_name: 'Biaya administrasi KUA', category: 'Administrasi', est_cost: 600000, actual_cost: 0, paid_date: null }
    ]);
    if (r.error) throw r.error;
    r = await ins('category_budgets', [['Venue', 30000000], ['Katering', 45000000], ['Dekorasi', 18000000], ['MUA', 7000000], ['Seserahan & mahar', 14000000]].map(([category, amount]) => ({ category, amount })));
    if (r.error) throw r.error;
    const vend = [
      { name: 'Gedung Serbaguna Mawar', category: 'Venue', phone: '081234567801', total_cost: 25000000, notes: 'Include kursi dan sound system' },
      { name: 'Katering Sedap Rasa', category: 'Katering', phone: '081234567802', total_cost: 40000000, notes: '500 porsi, 3 menu utama' },
      { name: 'Dekorasi Bunga Indah', category: 'Dekorasi', phone: '081234567803', total_cost: 15000000, notes: '' },
      { name: 'MUA Ayu', category: 'MUA', phone: '081234567804', total_cost: 6000000, notes: 'Akad dan resepsi' }
    ];
    r = await ins('vendors', vend, true);
    if (r.error) throw r.error;
    const id = Object.fromEntries(r.data.map((v) => [v.name, v.id]));
    const P = (v, label, amount, due, paid) => ({ vendor_id: id[v], label, amount, due_date: addDays(due), paid_date: paid === undefined ? null : addDays(paid) });
    r = await ins('vendor_payments', [
      P('Gedung Serbaguna Mawar', 'DP', 10000000, -20, -20),
      P('Gedung Serbaguna Mawar', 'Pelunasan', 15000000, 30),
      P('Katering Sedap Rasa', 'DP', 12000000, -2),
      P('Katering Sedap Rasa', 'Pelunasan', 28000000, 40),
      P('Dekorasi Bunga Indah', 'DP', 5000000, 4),
      P('Dekorasi Bunga Indah', 'Pelunasan', 10000000, 50),
      P('MUA Ayu', 'DP', 2000000, -15, -15),
      P('MUA Ayu', 'Pelunasan', 4000000, 100)
    ]);
    if (r.error) throw r.error;
    r = await ins('shopping_lists', [{ name: 'Seserahan', category: 'Seserahan & mahar' }, { name: 'Souvenir', category: 'Souvenir' }], true);
    if (r.error) throw r.error;
    const lid = Object.fromEntries(r.data.map((l) => [l.name, l.id]));
    const I = (l, name, qty, est, act, store, paid) => ({ list_id: lid[l], name, qty, est_cost: est, actual_cost: act, store, paid_date: paid === undefined ? null : addDays(paid) });
    r = await ins('shopping_items', [
      I('Seserahan', 'Set alat sholat', 1, 800000, 750000, 'Toko Muslimah', -4),
      I('Seserahan', 'Tas', 1, 1200000, 0, 'Butik Cantik'),
      I('Seserahan', 'Sepatu', 1, 900000, 0, ''),
      I('Seserahan', 'Skincare', 1, 700000, 0, 'Online'),
      I('Souvenir', 'Tote bag + stiker', 300, 4500000, 0, 'Percetakan Jaya')
    ]);
    if (r.error) throw r.error;
  }
  async function runDemo(job, okMsg) {
    const btns = [$('btn-seed'), $('btn-reset'), $('btn-import'), $('btn-export')];
    btns.forEach((b) => { b.disabled = true; b.classList.add('opacity-50'); });
    let ok = true;
    try { await job(); } catch (err) { ok = false; console.error(err); }
    btns.forEach((b) => { b.disabled = false; b.classList.remove('opacity-50'); });
    $('danger-confirm').value = ''; syncDanger();
    $('dlg-settings').close();
    await refreshAll();
    toast(ok ? okMsg : 'Gagal mengubah data. Periksa koneksi lalu coba lagi.');
  }
  $('btn-reset').addEventListener('click', async () => {
    if (!guard()) return;
    if (!await appConfirm({ title: `Hapus semua data ${PROFILES[state.profile].name}?`, message: 'Tugas, budget, vendor, dan pembayaran akan dihapus. Tindakan ini tidak bisa diurungkan.', ok: 'Hapus semua', danger: true })) return;
    runDemo(wipeAll, 'Semua data dihapus.');
  });
  $('btn-seed').addEventListener('click', async () => {
    if (!guard()) return;
    if (!await appConfirm({ title: 'Isi data contoh?', message: `Semua data ${PROFILES[state.profile].name} yang ada sekarang akan diganti data contoh.`, ok: 'Isi data contoh', danger: true })) return;
    runDemo(async () => { await wipeAll(); await seedDemo(); }, 'Data contoh dimuat.');
  });

  /* ---------- Pemilihan mempelai ---------- */
  const LAST_KEY = 'wp-last-profile';
  const lastProfile = () => { try { return localStorage.getItem(LAST_KEY); } catch (e) { return null; } };
  function showPicker() {
    const last = lastProfile();
    $('picker-list').innerHTML = Object.entries(PROFILES).map(([k, p]) => `<button data-profile="${k}" class="w-full min-h-[76px] rounded-2xl bg-surface border ${k === last ? 'border-brand-edge' : 'border-line'} text-left px-4 py-3 flex items-center gap-4 hover:border-brand-edge hover:bg-hover transition-colors duration-150">
        <span class="shrink-0 w-12 h-12 rounded-full bg-brand-soft text-brand-ink-2 text-xl font-bold flex items-center justify-center" aria-hidden="true">${esc(p.name.charAt(0).toUpperCase())}</span>
        <span class="flex-1 min-w-0"><span class="block text-lg font-semibold text-ink">${esc(p.name)}</span>
        <span class="block text-sm ${k === last ? 'text-brand-ink-2 font-medium' : 'text-muted'}">${k === last ? 'Terakhir dibuka' : 'Buka planner pernikahan ' + esc(p.name)}</span></span>
        <svg class="shrink-0 w-5 h-5 text-muted" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>`).join('');
    $('picker').classList.remove('hidden');
  }
  $('picker-list').addEventListener('click', (e) => { const b = e.target.closest('[data-profile]'); if (b) selectProfile(b.dataset.profile); });
  $('btn-switch').addEventListener('click', showPicker);

  async function selectProfile(p) {
    $('picker').classList.add('hidden');
    try { localStorage.setItem(LAST_KEY, p); } catch (e) { /* abaikan */ }
    if (p === state.profile && state.ready) return;
    state.profile = p;
    $('profile-name').textContent = PROFILES[p].name;
    document.title = 'Wedding Planner · ' + PROFILES[p].name;
    // kosongkan seluruh data acara sebelumnya agar tidak bercampur
    state.settings = null; state.tasks = []; state.budgets = []; state.catbud = []; state.slists = []; state.sitems = []; state.vendors = []; state.payments = [];
    state.settingsLoaded = false; state.ready = false;
    const live = !!sb && !state.authFailed;
    state.loadingTasks = state.loadingBudget = state.loadingCat = state.loadingShop = state.loadingVendor = state.loadingPay = live;
    state.loadErr = {}; state.noData = {}; state.fresh = {}; state.lastOk = null; state.snap = readSnap(p);
    state.fQ = ''; state.fPj = ''; state.fPri = ''; state.grp = {}; state.openMonths = {};
    $('f-q').value = ''; $('f-pj').value = ''; $('f-pri').value = ''; renderSync();
    state.fStatus = 'all'; state.fCat = ''; state.fTime = '';
    $('f-cat').value = ''; $('f-time').value = ''; renderChips();
    const n = new Date(); state.cal = { y: n.getFullYear(), m: n.getMonth() }; state.calSel = todayStr();
    $('cd-chip-text').textContent = '...';
    $('countdown').innerHTML = '<div class="skeleton skeleton-pulse h-14"></div>'.repeat(4);
    setView('home'); renderAll();
    if (state.authed) { await refreshAll(); state.ready = true; }
  }

  /* ---------- PWA ---------- */
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

  // Aksesibilitas: saat layar masuk / pilih acara terbuka, isi aplikasi di belakangnya dinonaktifkan
  // (inert) agar fokus keyboard dan pembaca layar tidak bocor; Escape menutup pemilih acara bila sudah ada acara aktif.
  (function authFocus() {
    const screens = [$('picker'), $('login')];
    const behind = () => document.querySelectorAll('body > .skip-link, body > header, body > main, body > nav, #fab');
    const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type=hidden]), a[href], select, textarea, [tabindex]:not([tabindex="-1"])';
    let opener = null, wasOpen = false;
    const openScreen = () => screens.find((el) => !el.classList.contains('hidden'));
    function sync() {
      const cur = openScreen();
      behind().forEach((el) => { if (cur) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
      screens.forEach((el) => { if (el === cur) el.removeAttribute('inert'); else el.setAttribute('inert', ''); });
      if (cur && !wasOpen) {
        opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
        setTimeout(() => { if (!cur.contains(document.activeElement)) { const f = cur.querySelector(FOCUSABLE); if (f) f.focus(); } }, 0);
      } else if (!cur && wasOpen) {
        const o = opener; opener = null;
        if (o && document.contains(o) && !o.closest('[inert]')) o.focus(); else $('main').focus();
      }
      wasOpen = !!cur;
    }
    const mo = new MutationObserver(sync);
    screens.forEach((el) => mo.observe(el, { attributes: true, attributeFilter: ['class'] }));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || openScreen() !== $('picker') || !(state.profile && state.ready)) return;
      $('picker').classList.add('hidden');
    });
    sync();
  })();

  init();
})();

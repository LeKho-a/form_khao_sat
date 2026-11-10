// Tiện ích giao diện dùng chung. Luôn dựng DOM bằng textContent -> chống XSS.
const $ = (sel, root = document) => root.querySelector(sel);

function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
        if (v === undefined || v === null || v === false || k === 'value') continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (c) => {
        if (Array.isArray(c)) c.forEach(add);
        else if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    if (props && props.value !== undefined && props.value !== null) el.value = props.value; // sau khi có <option>
    return el;
}

/* ---------- Giao diện sáng/tối ---------- */
document.documentElement.dataset.theme = localStorage.getItem('tm_theme')
    || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); // theo cài đặt hệ thống
function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.classList.add('theme-anim');                          // màu chuyển mượt trong ~0.4s
    setTimeout(() => root.classList.remove('theme-anim'), 450);
    window.__themeSpin = true;                                 // icon mặt trăng/mặt trời xoay vào
    root.dataset.theme = next;
    localStorage.setItem('tm_theme', next);
    if (window.redrawTopbar) window.redrawTopbar();   // đổi biểu tượng mặt trăng / mặt trời
}

/* ---------- Nhãn & định dạng ---------- */
const STATUS_LABEL = { todo: 'Cần làm', in_progress: 'Đang làm', review: 'Đang review', done: 'Hoàn thành' };
// Màu đã kiểm tra: chữ trắng trên các màu này đạt tỉ lệ tương phản >= 4.5:1 (chuẩn WCAG AA)
const STATUS_COLOR = { todo: '#5a6a85', in_progress: '#2b66d9', review: '#7048d9', done: '#1b7f3f' };
const STATUS_ICON = { todo: 'circle-dashed', in_progress: 'clock', review: 'eye', done: 'check-circle' };
const PRIORITY_LABEL = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', urgent: 'Khẩn cấp' };
const ROLE_LABEL = { owner: 'Chủ dự án', leader: 'Trưởng nhóm', member: 'Thành viên' };

const pad2 = (n) => String(n).padStart(2, '0');
function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${fmtDate(iso)}`;
}
// 'overdue' (quá hạn), 'soon' (còn <= 2 ngày) hoặc ''
function dueState(iso, status) {
    if (!iso || status === 'done') return '';
    const diff = new Date(iso) - new Date();
    if (diff < 0) return 'overdue';
    return diff < 2 * 86400000 ? 'soon' : '';
}
function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
const assetUrl = (u) => (!u ? '' : /^https?:/.test(u) ? u : API_BASE + u);
const avatar = (name, big, url) => url
    ? h('img', { class: 'avatar img' + (big ? ' lg' : ''), src: assetUrl(url), alt: name || '', title: name || '' })
    : h('span', { class: 'avatar' + (big ? ' lg' : ''), title: name || '', text: initials(name) });
const roleBadge = (role) => h('span', { class: 'badge b-' + role, text: ROLE_LABEL[role] || role });
const priorityBadge = (p) => h('span', { class: 'badge p-' + p }, icon('flag', 12), PRIORITY_LABEL[p] || p); // có icon + chữ: không chỉ dựa vào màu
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- Toast ---------- */
function toast(message, type = 'info') {
    let box = $('#toasts');
    if (!box) { box = h('div', { id: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
    const el = h('div', { class: 'toast ' + type }, icon(type === 'success' ? 'check-circle' : type === 'error' ? 'warning' : 'info', 20), h('span', { text: message }));
    box.append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), reducedMotion() ? 0 : 260); }, 3500);
}

/* ---------- Modal ---------- */
function openModal(title, body, { wide = false } = {}) {
    let closing = false;
    const close = () => {
        if (closing) return;
        closing = true;
        document.removeEventListener('keydown', onKey);
        backdrop.classList.add('closing');                       // phát hiệu ứng đóng rồi mới gỡ
        setTimeout(() => backdrop.remove(), reducedMotion() ? 0 : 160);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const backdrop = h('div', { class: 'backdrop', onmousedown: (e) => { if (e.target === backdrop) close(); } },
        h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' },
            h('div', { class: 'modal-head' }, h('h3', { text: title, style: 'margin:0' }),
                h('button', { class: 'x', type: 'button', 'aria-label': 'Đóng', title: 'Đóng', onclick: close }, icon('x', 20))),
            h('div', { class: 'modal-body' }, body)));
    document.addEventListener('keydown', onKey);
    document.body.append(backdrop);
    return { close, el: backdrop };
}

function confirmBox(message, okText = 'Xác nhận') {
    return new Promise((resolve) => {
        let done = false;
        const finish = (v) => { if (!done) { done = true; m.close(); resolve(v); } };
        const m = openModal('Xác nhận', h('div', null,
            h('p', { text: message }),
            h('div', { class: 'modal-actions', style: 'justify-content:flex-end' },
                h('button', { class: 'btn', type: 'button', onclick: () => finish(false), text: 'Hủy' }),
                h('button', { class: 'btn danger', type: 'button', onclick: () => finish(true), text: okText }))));
        m.el.addEventListener('mousedown', (e) => { if (e.target === m.el) finish(false); });
    });
}

/* ---------- Ngày giờ, màu dự án, bộ lọc "Việc của tôi" ---------- */
const DAYS_VI = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const PROJECT_COLORS = ['#4f6ef7', '#12b5b0', '#f59f00', '#e5484d', '#8b5cf6', '#2fb344', '#ec4899', '#0ea5e9'];
const projectColor = (id) => PROJECT_COLORS[(Number(id) || 0) % PROJECT_COLORS.length];
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const TASK_TABS = [
    { key: 'open', label: 'Đang mở', test: (t) => t.status !== 'done' },
    { key: 'overdue', label: 'Quá hạn', test: (t) => dueState(t.due_date, t.status) === 'overdue' },
    { key: 'today', label: 'Hôm nay', test: (t) => t.status !== 'done' && t.due_date && sameDay(new Date(t.due_date), new Date()) },
    { key: 'week', label: 'Tuần này', test: (t) => {
        if (t.status === 'done' || !t.due_date) return false;
        const d = new Date(t.due_date), start = new Date(); start.setHours(0, 0, 0, 0);
        return d >= start && d - start <= 7 * 86400000;
    } },
    { key: 'done', label: 'Hoàn thành', test: (t) => t.status === 'done' },
    { key: 'all', label: 'Tất cả', test: () => true }
];

// Thanh tab có số đếm: onPick(key) được gọi khi bấm
function tabBar(tasks, active, onPick) {
    return h('div', { class: 'tabs2' }, TASK_TABS.map((tab) =>
        h('button', { type: 'button', class: tab.key === active ? 'active' : '', 'data-tab': tab.key, onclick: () => onPick(tab.key),
            text: `${tab.label} (${tasks.filter(tab.test).length})` })));
}

/* ---------- Bảng công việc dùng chung ---------- */
const statusBadge = (s) => h('span', { class: 'badge s-' + s }, icon(STATUS_ICON[s] || 'circle-dashed', 12), STATUS_LABEL[s] || s);

function taskTable(tasks, cols, onOpen) {
    const defs = {
        id: { th: 'ID', td: (t) => h('span', { class: 't-id', text: '#' + t.id }) },
        title: { th: 'Công việc', td: (t) => h('div', { class: 't-title', text: t.title }) },
        project: { th: 'Dự án', td: (t) => h('span', { class: 'small', text: t.project_name || '' }) },
        priority: { th: 'Ưu tiên', td: (t) => priorityBadge(t.priority) },
        status: { th: 'Trạng thái', td: (t) => statusBadge(t.status) },
        assignee: { th: 'Người làm', td: (t) => t.assignee_name
            ? h('span', { style: 'display:inline-flex;gap:8px;align-items:center' }, avatar(t.assignee_name, false, t.assignee_avatar), t.assignee_name)
            : h('span', { class: 'muted', text: 'Chưa giao' }) },
        due: { th: 'Hạn chót', td: (t) => {
            const ds = dueState(t.due_date, t.status);
            return t.due_date ? h('span', { class: 'due ' + ds, text: fmtDate(t.due_date) + (ds === 'overdue' ? ' · quá hạn' : '') })
                : h('span', { class: 'muted', text: '—' });
        } }
    };
    if (!tasks.length) return emptyState('tray', 'Không có công việc nào', 'Khi có công việc phù hợp, chúng sẽ xuất hiện ở đây.', null, true);
    return h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, cols.map((c) => h('th', { text: defs[c].th })))),
        h('tbody', null, stagger(tasks.map((t) =>
            h('tr', { class: 'trow', tabindex: '0', onclick: () => onOpen(t), onkeydown: (e) => { if (e.key === 'Enter') onOpen(t); } },
                cols.map((c) => h('td', null, defs[c].td(t))))), 9, 'row-enter'))));
}

/* ---------- Biểu đồ vành khuyên (SVG) ---------- */
function donut(segments, big, small) {
    const NS = 'http://www.w3.org/2000/svg';
    const total = segments.reduce((a, s) => a + s.value, 0);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 42 42');
    const ring = (color, dash, offset) => {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', 21); c.setAttribute('cy', 21); c.setAttribute('r', 15.9155);
        c.setAttribute('fill', 'none'); c.setAttribute('stroke-width', 5);
        c.setAttribute('stroke-dasharray', `${dash} ${100 - dash}`); c.setAttribute('stroke-dashoffset', offset);
        c.style.stroke = color;
        return c;
    };
    svg.append(ring('var(--panel2)', 100, 0));
    let cum = 0;
    const arcs = [];
    if (total > 0) segments.forEach((s) => {
        if (s.value <= 0) return;
        const pct = (s.value / total) * 100;
        const c = ring(s.color, pct, -cum);
        arcs.push([c, pct]); svg.append(c); cum += pct;
    });
    if (!reducedMotion()) {                                    // cung vòng "vẽ" dần từ 0
        arcs.forEach(([c]) => { c.style.transition = 'stroke-dasharray .9s cubic-bezier(.22,1,.36,1)'; c.style.strokeDasharray = '0 100'; });
        requestAnimationFrame(() => requestAnimationFrame(() => arcs.forEach(([c, pct]) => { c.style.strokeDasharray = `${pct} ${100 - pct}`; })));
    }
    return h('div', { class: 'donut' }, svg, h('div', { class: 'center' }, h('div', null, h('b', { text: big }), h('div', { class: 'muted small', text: small }))));
}

/* ---------- Tạo dự án (dùng ở thanh bên + bảng điều khiển) ---------- */
function openCreateProject() {
    const name = h('input', { type: 'text', maxlength: 150, placeholder: 'Ví dụ: Hệ thống Quản lý Bán hàng' });
    const desc = h('textarea', { rows: 3, placeholder: 'Mô tả ngắn về dự án' });
    const err = h('div', { class: 'error-text' });
    const btn = h('button', { class: 'btn primary', type: 'button', text: 'Tạo dự án' });
    const m = openModal('Tạo dự án mới', h('div', null,
        h('label', { text: 'Tên dự án *' }), name,
        h('label', { text: 'Mô tả' }), desc, err,
        h('div', { class: 'modal-actions', style: 'justify-content:flex-end' },
            h('button', { class: 'btn', type: 'button', onclick: () => m.close(), text: 'Hủy' }), btn)));
    name.focus();
    btn.onclick = async () => {
        if (!name.value.trim()) { err.textContent = 'Vui lòng nhập tên dự án.'; return; }
        btn.disabled = true;
        try {
            const r = await api('/projects', { method: 'POST', body: { name: name.value.trim(), description: desc.value.trim() } });
            go('board.html?project=' + r.projectId);
        } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    };
}

/* ---------- Khung giao diện: thanh bên + thanh trên ---------- */
const PAGE = (() => {
    const file = location.pathname.split('/').pop();
    if (file === 'my-tasks.html') return 'mytasks';
    if (file === 'board.html') return 'project:' + new URLSearchParams(location.search).get('project');
    return 'dashboard';
})();

const openProfile = () => { if (typeof openProfileModal === 'function') openProfileModal(); };
const navItem = (ico, label, href, active) =>
    h('a', { class: 'side-link' + (active ? ' active' : ''), href, 'aria-current': active ? 'page' : null }, icon(ico, 20), label);

function toggleSidebar() {
    const side = $('#sidebar');
    const open = side.classList.toggle('open');
    const old = $('#scrim'); if (old) old.remove();
    if (open) document.body.append(h('div', { class: 'scrim', id: 'scrim', onclick: toggleSidebar }));
}

function drawSidebar() {
    const side = $('#sidebar');
    if (!side) return;
    const u = Auth.user || {};
    const projects = window.__projects || [];
    side.replaceChildren(
        h('a', { class: 'side-brand', href: 'dashboard.html', 'aria-label': 'Task Manager - về bảng điều khiển' },
            h('img', { class: 'logo-img', src: 'img/logo.svg', alt: '', width: 38, height: 38 }), h('span', null, 'Task', h('b', { text: 'Manager' }))),
        h('button', { class: 'side-user', id: 'btn-profile', type: 'button', title: 'Hồ sơ cá nhân', onclick: openProfile },
            avatar(u.full_name, true, u.avatar_url),
            h('div', { class: 'who' }, h('div', { class: 'name', text: u.full_name || '' }), h('div', { class: 'mail', text: u.email || '' }))),
        navItem('dashboard', 'Bảng điều khiển', 'dashboard.html', PAGE === 'dashboard'),
        navItem('mytasks', 'Việc của tôi', 'my-tasks.html', PAGE === 'mytasks'),
        h('div', { class: 'side-title' }, h('span', { text: 'DỰ ÁN' }),
            h('button', { class: 'side-add', id: 'btn-side-add', type: 'button', title: 'Dự án mới', 'aria-label': 'Tạo dự án mới', onclick: openCreateProject }, icon('plus', 14))),
        h('div', { class: 'side-projects' }, projects.length
            ? projects.map((p) => h('a', { class: 'side-link' + (PAGE === 'project:' + p.id ? ' active' : ''), href: 'board.html?project=' + p.id, title: p.name },
                h('span', { class: 'pdot', style: 'background:' + projectColor(p.id) }),
                h('span', { style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis', text: p.name })))
            : h('div', { class: 'side-empty', text: 'Chưa có dự án' })),
        h('div', { class: 'side-spacer' }),
        h('button', { class: 'side-link', type: 'button', onclick: openProfile }, icon('settings', 20), 'Hồ sơ & cài đặt'),
        h('button', { class: 'side-link', type: 'button', onclick: () => Auth.logout() }, icon('logout', 20), 'Đăng xuất'));
}

function drawTopbar() {
    const bar = $('#topbar');
    if (!bar) return;
    const u = Auth.user || {};
    const now = new Date();
    bar.className = 'topbar';
    bar.replaceChildren(
        h('button', { class: 'btn icon-btn menu-btn', type: 'button', title: 'Mở menu', 'aria-label': 'Mở menu', onclick: toggleSidebar }, icon('menu', 22)),
        h('form', { class: 'search', onsubmit: (e) => {
            e.preventDefault();
            const v = $('#global-search').value.trim();
            go('my-tasks.html' + (v ? '?q=' + encodeURIComponent(v) : ''));
        } }, icon('search', 18),
            h('input', { id: 'global-search', type: 'search', 'aria-label': 'Tìm công việc của tôi', placeholder: 'Tìm công việc của tôi...',
                value: PAGE === 'mytasks' ? new URLSearchParams(location.search).get('q') || '' : '' })),
        h('div', { class: 'grow' }),
        h('div', { class: 'date-chip' }, h('b', { text: DAYS_VI[now.getDay()] }), fmtDate(now)),
        h('div', { id: 'bell-slot' }),
        h('button', { class: 'btn icon-btn ghost', type: 'button', title: 'Đổi giao diện sáng/tối', 'aria-label': 'Đổi giao diện sáng hoặc tối', onclick: toggleTheme },
            icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 22, window.__themeSpin ? 'spin-in' : '')),
        h('button', { class: 'btn ghost', id: 'btn-profile-top', type: 'button', title: 'Hồ sơ cá nhân', 'aria-label': 'Hồ sơ cá nhân', style: 'padding:2px;border-radius:50%', onclick: openProfile },
            avatar(u.full_name, true, u.avatar_url)));
    window.__themeSpin = false;
    if (typeof mountBell === 'function') mountBell();
}

function renderTopbar() {
    if (!$('#topbar')) return;
    const main = $('main.container');
    if (main && !main.id) main.id = 'main';
    if (!$('.skip-link')) document.body.prepend(h('a', { class: 'skip-link', href: '#main', text: 'Bỏ qua điều hướng, đến nội dung chính' }));
    const draw = () => { drawSidebar(); drawTopbar(); };
    window.redrawTopbar = draw;
    draw();
    // Làm mới hồ sơ (ảnh đại diện...) + danh sách dự án cho thanh bên; bật kênh thông báo thời gian thực
    api('/users/me').then((me) => { Auth.save(Auth.token, { ...Auth.user, ...me }); draw(); }).catch(() => {});
    api('/projects').then((list) => { window.__projects = list; drawSidebar(); }).catch(() => {});
    if (typeof startRealtime === 'function') startRealtime();
}

/* ---------- Trạng thái rỗng thân thiện + lời chào theo giờ ---------- */
function emptyState(iconName, title, text, action, small) {
    return h('div', { class: 'empty-state' + (small ? ' sm' : '') },
        h('div', { class: 'es-ic' }, icon(iconName, small ? 24 : 32)),
        h('b', { text: title }),
        text ? h('div', { class: 'muted small', text }) : null,
        action || null);
}
function greeting() {
    const hr = new Date().getHours();
    return hr < 11 ? 'Chào buổi sáng' : hr < 13 ? 'Chào buổi trưa' : hr < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}
const skeletons = (n, cls) => Array.from({ length: n }, () => h('div', { class: 'skeleton ' + cls }));

/* ---------- Chuyển trang mượt ---------- */
function go(url) {
    if (reducedMotion()) { location.href = url; return; }
    document.body.classList.add('leaving');
    setTimeout(() => { location.href = url; }, 130);
}
document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/\.html$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search) return;   // cùng trang / chỉ đổi #hash
    e.preventDefault();
    go(url.href);
});
window.addEventListener('pageshow', (e) => { if (e.persisted) document.body.classList.remove('leaving'); }); // quay lại bằng nút Back

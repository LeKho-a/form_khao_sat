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
document.documentElement.dataset.theme = localStorage.getItem('tm_theme') || 'dark';
function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('tm_theme', next);
}

/* ---------- Nhãn & định dạng ---------- */
const STATUS_LABEL = { todo: 'Cần làm', in_progress: 'Đang làm', review: 'Đang review', done: 'Hoàn thành' };
const STATUS_COLOR = { todo: '#8b949e', in_progress: '#2f81f7', review: '#d29922', done: '#3fb950' };
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
const avatar = (name, big) => h('span', { class: 'avatar' + (big ? ' lg' : ''), title: name || '', text: initials(name) });
const roleBadge = (role) => h('span', { class: 'badge b-' + role, text: ROLE_LABEL[role] || role });
const priorityBadge = (p) => h('span', { class: 'badge p-' + p, text: PRIORITY_LABEL[p] || p });
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- Toast ---------- */
function toast(message, type = 'info') {
    let box = $('#toasts');
    if (!box) { box = h('div', { id: 'toasts' }); document.body.append(box); }
    const el = h('div', { class: 'toast ' + type, text: message });
    box.append(el);
    setTimeout(() => el.remove(), 3500);
}

/* ---------- Modal ---------- */
function openModal(title, body, { wide = false } = {}) {
    const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const backdrop = h('div', { class: 'backdrop', onmousedown: (e) => { if (e.target === backdrop) close(); } },
        h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' },
            h('div', { class: 'modal-head' }, h('h3', { text: title, style: 'margin:0' }),
                h('button', { class: 'x', type: 'button', 'aria-label': 'Đóng', onclick: close, text: '×' })),
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

/* ---------- Thanh điều hướng ---------- */
function renderTopbar() {
    const u = Auth.user || {};
    const bar = $('#topbar');
    if (!bar) return;
    bar.className = 'topbar';
    bar.replaceChildren(
        h('a', { class: 'brand', href: 'dashboard.html' }, '✅ Task', h('span', { text: 'Manager' })),
        h('div', { class: 'right' },
            h('div', { class: 'userchip' }, avatar(u.full_name), h('span', { class: 'muted', text: u.full_name || '' })),
            h('button', { class: 'btn sm ghost', type: 'button', title: 'Đổi giao diện sáng/tối', onclick: toggleTheme, text: '🌓' }),
            h('button', { class: 'btn sm', type: 'button', onclick: () => Auth.logout(), text: 'Đăng xuất' })));
}

// Chuông thông báo + kênh thời gian thực (Server-Sent Events qua fetch, gửi token bằng header)
const Notify = { items: [], unread: 0, open: false, started: false, backoff: 2000 };

function mountBell() {
    const slot = $('#bell-slot');
    if (!slot) return;
    const btn = h('button', {
        class: 'btn sm ghost bell', type: 'button', id: 'btn-bell', title: 'Thông báo', 'aria-label': 'Thông báo',
        onclick: (e) => { e.stopPropagation(); Notify.open = !Notify.open; Notify.animate = Notify.open; mountBell(); }
    }, icon('bell', 22), Notify.unread > 0 ? h('span', { class: 'dot-badge' + (Notify.bump ? ' bump' : ''), id: 'bell-count' }, h('span', { class: 'sr-only', text: Notify.unread > 99 ? '99+' : Notify.unread })) : null);
    btn.title = Notify.unread > 0 ? `Thông báo (${Notify.unread} chưa đọc)` : 'Thông báo';
    if (Notify.bump) btn.classList.add('ring');                    // chuông rung khi có thông báo mới
    Notify.bump = false;
    slot.replaceChildren(...[btn, Notify.open ? notifPanel() : null].filter(Boolean)); // replaceChildren(null) sẽ in chữ "null"
}

function notifPanel() {
    const list = Notify.items.length
        ? Notify.items.map((n) => h('div', { class: 'notif-item' + (n.is_read ? '' : ' unread'), onclick: () => openNotification(n) },
            h('div', { text: n.message }),
            h('div', { class: 'muted small', text: fmtDateTime(n.created_at) })))
        : [emptyState('bell', 'Chưa có thông báo nào', 'Bạn sẽ thấy thông báo ở đây khi có việc mới.', null, true)];
    const anim = Notify.animate; Notify.animate = false;          // chỉ phát hiệu ứng lúc vừa mở
    return h('div', { class: 'notif-panel' + (anim ? ' pop-in' : ''), onclick: (e) => e.stopPropagation() },
        h('div', { class: 'notif-head' }, h('b', { text: 'Thông báo' }),
            h('button', { class: 'btn sm ghost', type: 'button', id: 'btn-read-all', text: 'Đọc tất cả', onclick: markAllRead })),
        h('div', { class: 'notif-list' }, list));
}

async function markAllRead() {
    try {
        await api('/notifications/read-all', { method: 'PATCH' });
        Notify.items.forEach((n) => { n.is_read = 1; });
        Notify.unread = 0; mountBell();
    } catch (e) { toast(e.message, 'error'); }
}

function openNotification(n) {
    if (!n.is_read) {
        n.is_read = 1; Notify.unread = Math.max(0, Notify.unread - 1);
        api('/notifications/' + n.id + '/read', { method: 'PATCH' }).catch(() => {});
    }
    Notify.open = false; mountBell();
    if (n.project_id) go('board.html?project=' + n.project_id);
}

async function loadNotifications() {
    try {
        const data = await api('/notifications');
        Notify.items = data.items; Notify.unread = data.unread; mountBell();
    } catch (e) { /* bỏ qua */ }
}

function handleSse(block) {
    let name = 'message', data = '';
    block.split('\n').forEach((line) => {
        if (line.startsWith('event:')) name = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
    });
    if (!data) return;
    let payload; try { payload = JSON.parse(data); } catch (e) { return; }
    if (name === 'notification') {
        Notify.items.unshift(payload); Notify.unread += 1; Notify.bump = true; mountBell();
        toast(payload.message, 'info');
    } else if (name === 'project_update') {
        window.dispatchEvent(new CustomEvent('tm:project_update', { detail: payload }));
    }
}

async function connectStream() {
    if (!Auth.token) return;
    try {
        const res = await fetch(API_BASE + '/api/notifications/stream', {
            headers: { Authorization: 'Bearer ' + Auth.token, Accept: 'text/event-stream' }
        });
        if (res.status === 401 || res.status === 403) return;      // token hết hạn -> thôi
        if (!res.ok || !res.body) throw new Error('stream');
        Notify.backoff = 2000;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf('\n\n')) >= 0) { handleSse(buf.slice(0, i)); buf = buf.slice(i + 2); }
        }
    } catch (e) { /* mất kết nối */ }
    setTimeout(connectStream, Notify.backoff);                      // tự kết nối lại, giãn dần
    Notify.backoff = Math.min(Notify.backoff * 2, 30000);
}

function startRealtime() {
    if (Notify.started) return;
    Notify.started = true;
    document.addEventListener('click', () => { if (Notify.open) { Notify.open = false; mountBell(); } });
    loadNotifications();
    connectStream();
}

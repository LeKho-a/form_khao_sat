Auth.require();
renderTopbar();
$('#hello').textContent = 'Xin chào, ' + ((Auth.user && Auth.user.full_name) || 'bạn') + ' 👋';

function renderStats(s) {
    const items = [
        { icon: '📁', label: 'Dự án tham gia', value: s.projects },
        { icon: '📝', label: 'Tổng công việc', value: s.total },
        { icon: '🙋', label: 'Được giao cho tôi', value: s.assigned_to_me },
        { icon: '⏰', label: 'Quá hạn', value: s.overdue, danger: s.overdue > 0 }
    ];
    $('#stats').replaceChildren(...items.map((i) =>
        h('div', { class: 'card stat' + (i.danger ? ' danger' : '') },
            h('div', { class: 'icon', text: i.icon }),
            h('div', null, h('div', { class: 'num', text: i.value }), h('div', { class: 'muted small', text: i.label })))));
}

function renderProgress(s) {
    const total = s.total;
    if (!total) {
        $('#progress').replaceChildren(h('div', { class: 'empty', text: 'Chưa có công việc nào.' }));
        return;
    }
    const keys = ['todo', 'in_progress', 'review', 'done'];
    const pct = Math.round((s.by_status.done / total) * 100);
    $('#progress').replaceChildren(
        h('div', { style: 'font-size:1.4rem;font-weight:700;margin-bottom:8px', text: pct + '% hoàn thành' }),
        h('div', { class: 'progress' }, keys.map((k) =>
            h('i', { title: STATUS_LABEL[k], style: `width:${(s.by_status[k] / total) * 100}%;background:${STATUS_COLOR[k]}` }))),
        h('div', { class: 'legend' }, keys.map((k) =>
            h('span', null, h('span', { class: 'dot', style: 'background:' + STATUS_COLOR[k] }),
                STATUS_LABEL[k] + ': ', h('b', { text: s.by_status[k] })))));
}

function renderUpcoming(list) {
    if (!list.length) {
        $('#upcoming').replaceChildren(h('div', { class: 'empty', text: '🎉 Bạn không có việc nào đang chờ.' }));
        return;
    }
    $('#upcoming').replaceChildren(...list.map((t) => {
        const ds = dueState(t.due_date, t.status);
        return h('a', { class: 'list-row', href: 'board.html?project=' + t.project_id, style: 'color:inherit' },
            h('div', { style: 'min-width:0' },
                h('div', { style: 'font-weight:600', text: t.title }),
                h('div', { class: 'muted small', text: t.project_name + ' · ' + STATUS_LABEL[t.status] })),
            h('span', { class: 'due small ' + ds, text: t.due_date ? '📅 ' + fmtDate(t.due_date) : 'Không hạn' }));
    }));
}

function renderProjects(list) {
    const box = $('#projects');
    if (!list.length) {
        box.replaceChildren(h('div', { class: 'card empty', style: 'grid-column:1/-1', text: 'Bạn chưa có dự án nào. Hãy tạo dự án đầu tiên!' }));
        return;
    }
    box.replaceChildren(...list.map((p) => {
        const total = Number(p.task_count || 0), done = Number(p.done_count || 0);
        const pct = total ? Math.round((done / total) * 100) : 0;
        return h('div', { class: 'card project-card', onclick: () => { location.href = 'board.html?project=' + p.id; } },
            h('div', { class: 'row' }, h('h3', { text: p.name, style: 'margin:0' }), roleBadge(p.project_role)),
            h('p', { text: p.description || 'Chưa có mô tả' }),
            h('div', { class: 'progress' }, h('i', { style: `width:${pct}%;background:var(--ok)` })),
            h('div', { class: 'muted small', style: 'display:flex;justify-content:space-between' },
                h('span', { text: `${done}/${total} việc hoàn thành` }),
                h('span', { text: '👥 ' + (p.member_count || 1) })));
    }));
}

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
            location.href = 'board.html?project=' + r.projectId;
        } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    };
}
$('#btn-new-project').onclick = openCreateProject;

(async () => {
    try {
        const [stats, projects] = await Promise.all([api('/dashboard'), api('/projects')]);
        renderStats(stats); renderProgress(stats); renderUpcoming(stats.upcoming); renderProjects(projects);
    } catch (e) { toast(e.message, 'error'); }
})();

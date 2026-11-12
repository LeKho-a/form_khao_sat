Auth.require();
renderTopbar();
setPageHead({ crumb: [{ text: 'Dự án', href: 'dashboard.html#du-an' }, 'Đang tải...'], title: 'Đang tải...',
    action: { id: 'btn-add', label: 'Tạo công việc', icon: 'plus', onClick: () => openTaskModal(null) } });

const projectId = Number(new URLSearchParams(location.search).get('project'));
if (!projectId) location.replace('dashboard.html');

const me = Auth.user || {};
const COLS = ['todo', 'in_progress', 'review', 'done'];
const state = { project: null, role: null, members: [], tasks: [], filter: { q: '', priority: '', assignee: '' }, view: localStorage.getItem('tm_view') || 'kanban' };

const isManager = () => ['owner', 'leader'].includes(state.role);
const canEdit = (t) => isManager() || t.creator_id === me.id || t.assignee_id === me.id;
const canDelete = (t) => isManager() || t.creator_id === me.id;

/* ================= Lọc & hiển thị bảng ================= */
function visibleTasks() {
    const { q, priority, assignee } = state.filter;
    const kw = q.trim().toLowerCase();
    return state.tasks.filter((t) => {
        if (kw && !((t.title || '') + ' ' + (t.description || '')).toLowerCase().includes(kw)) return false;
        if (priority && t.priority !== priority) return false;
        if (assignee === 'me' && t.assignee_id !== me.id) return false;
        if (assignee === 'none' && t.assignee_id) return false;
        if (assignee && assignee !== 'me' && assignee !== 'none' && String(t.assignee_id) !== assignee) return false;
        return true;
    });
}

function taskCard(t) {
    const ds = dueState(t.due_date, t.status);
    const days = ds === 'overdue' ? Math.max(1, Math.ceil((Date.now() - new Date(t.due_date)) / 86400000)) : 0;
    const isDone = t.status === 'done';
    const card = h('div', { class: 'task' + (isDone ? ' is-done' : ''), draggable: 'true', tabindex: '0', 'data-id': t.id },
        h('div', { class: 't-head' },
            h('div', { class: 'title', text: t.title }),
            isDone ? h('span', { class: 'done-check', role: 'img', 'aria-label': 'Hoàn thành', title: 'Hoàn thành' }, icon('check', 15)) : priorityBadge(t.priority)),
        t.description ? h('div', { class: 'desc', text: t.description }) : null,
        h('div', { class: 'chips' }, h('span', { class: 'chip task-id', text: '#' + t.id })),
        Number(t.comment_count) ? h('div', { class: 'meta-line with-ic', title: t.comment_count + ' bình luận' }, icon('comment', 15), t.comment_count) : null,
        h('div', { class: 'meta' },
            t.due_date
                ? h('span', { class: 'with-ic due ' + ds }, icon('clock', 15), fmtShort(t.due_date) + (days ? ` · quá hạn ${days} ngày` : ''))
                : h('span', { class: 'muted', text: 'Chưa đặt hạn' }),
            t.assignee_name ? avatar(t.assignee_name, false, t.assignee_avatar) : h('span', { class: 'muted', text: 'Chưa giao' })));
    card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(t.id));
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('click', () => openTaskModal(t));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openTaskModal(t); });
    return card;
}

function renderTeam() {
    const m = state.members;
    $('#p-team').replaceChildren(...stagger(m.slice(0, 5).map((u) => avatar(u.full_name, true, u.avatar_url)), 5, 'pop'),
        ...(m.length > 5 ? [h('span', { class: 'avatar more', text: '+' + (m.length - 5) })] : []));
}

function renderBoard() {
    const shown = visibleTasks();
    const snap = state.rendered && state.view === 'kanban' ? flipSnapshot('#board .task') : null; // vị trí cũ (cho FLIP)
    const viewChanged = state.lastView !== state.view;
    state.lastView = state.view;
    $('#f-count').textContent = `Hiển thị ${shown.length}/${state.tasks.length} task`;
    $('#view-kanban').classList.toggle('active', state.view === 'kanban');
    $('#view-list').classList.toggle('active', state.view === 'list');
    const box = $('#board');

    if (state.view === 'list') {                       // chế độ xem dạng bảng
        box.className = 'list-wrap' + (viewChanged && state.rendered ? ' swap' : '');
        box.replaceChildren(taskTable(shown, ['id', 'title', 'priority', 'status', 'assignee', 'due'], (t) => openTaskModal(t)));
        return;
    }

    box.className = 'board' + (viewChanged && state.rendered ? ' swap' : '');
    box.replaceChildren(...COLS.map((key) => {
        const items = shown.filter((t) => t.status === key);
        const body = h('div', { class: 'col-body', 'data-status': key },
            items.length ? items.map(taskCard) : emptyState('tray', 'Chưa có task nào', 'Kéo task vào đây hoặc bấm + để thêm.', null, true));
        const line = h('div', { class: 'drop-line' }); // vạch báo vị trí sẽ thả
        body.addEventListener('dragover', (e) => {
            e.preventDefault();
            body.classList.add('drag-over');
            const at = dropTarget(body, e.clientY);
            if (at.el) body.insertBefore(line, at.el); else body.append(line);
        });
        body.addEventListener('dragleave', (e) => {
            if (!body.contains(e.relatedTarget)) { body.classList.remove('drag-over'); line.remove(); }
        });
        body.addEventListener('drop', (e) => {
            e.preventDefault();
            body.classList.remove('drag-over');
            const at = dropTarget(body, e.clientY);
            line.remove();
            const id = Number(e.dataTransfer.getData('text/plain'));
            if (id) moveTask(id, key, at.id);
        });
        return h('div', { class: 'column', style: `--c:${STATUS_COLOR[key]}` },
            h('div', { class: 'col-head' },
                h('div', { class: 'col-title' }, h('span', { text: STATUS_LABEL[key] }), h('span', { class: 'count', text: `(${items.length})` })),
                h('button', { class: 'btn sm', type: 'button', title: 'Thêm task vào cột này', 'aria-label': 'Thêm task vào cột ' + STATUS_LABEL[key], onclick: () => openTaskModal(null, key) }, icon('plus', 16))),
            body);
    }));
    afterBoardRender(snap);
}

// Sau khi dựng lại bảng: lần đầu cho thẻ hiện lần lượt; các lần sau thẻ trượt về chỗ mới (FLIP), thẻ mới nảy lên
function afterBoardRender(snap) {
    if (!state.rendered) {
        stagger(document.querySelectorAll('#board .task'), 8);
    } else if (snap) {
        flipPlay(snap, '#board .task', (el) => el.classList.add('pop'));
    }
    if (state.lastMoved) {
        const el = document.querySelector(`.task[data-id="${state.lastMoved}"]`);
        if (el) { el.classList.add('settle'); setTimeout(() => el.classList.remove('settle'), 600); }
        state.lastMoved = null;
    }
    state.rendered = true;
}

// Xác định task mà thẻ đang kéo sẽ được chèn TRƯỚC (null = xuống cuối cột) theo vị trí chuột
function dropTarget(body, clientY) {
    const cards = [...body.querySelectorAll('.task:not(.dragging)')];
    for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (clientY < r.top + r.height / 2) return { el: c, id: Number(c.dataset.id) };
    }
    return { el: null, id: null };
}

const columnIds = (status) => state.tasks.filter((x) => x.status === status).map((x) => x.id).join(',');

// Chuyển cột và/hoặc đổi thứ tự trong cột. beforeId = task sẽ đứng ngay sau thẻ này (null = cuối cột)
async function moveTask(id, status, beforeId = null) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    const oldStatus = t.status;
    const oldIndex = state.tasks.indexOf(t);
    const orderBefore = columnIds(status);

    state.tasks.splice(oldIndex, 1);                       // cập nhật ngay (optimistic)
    let at = beforeId ? state.tasks.findIndex((x) => x.id === beforeId && x.status === status) : -1;
    if (at < 0) {
        let last = -1;
        state.tasks.forEach((x, i) => { if (x.status === status) last = i; });
        at = last + 1;
    }
    state.tasks.splice(at, 0, t);
    t.status = status;
    state.lastMoved = id;

    if (oldStatus === status && columnIds(status) === orderBefore) { renderBoard(); return; } // không đổi gì

    renderBoard();
    try {
        await api(`/tasks/${id}/move`, { method: 'PATCH', body: { status, before_id: beforeId } });
        toast(oldStatus === status ? 'Đã sắp xếp lại task' : `Đã chuyển sang "${STATUS_LABEL[status]}"`, 'success');
    } catch (e) {
        state.tasks.splice(state.tasks.indexOf(t), 1);      // lỗi -> hoàn tác
        state.tasks.splice(oldIndex, 0, t);
        t.status = oldStatus;
        renderBoard();
        toast(e.message, 'error');
    }
}

async function reloadTasks() {
    state.tasks = await api(`/projects/${projectId}/tasks`);
    renderBoard();
}

/* ================= Modal task (thêm / sửa / xóa + bình luận) ================= */
function openTaskModal(task, defaultStatus = 'todo') {
    const isNew = !task;
    const editable = isNew || canEdit(task);
    const memberOpts = state.members.map((m) => h('option', { value: m.id, text: m.full_name }));

    const f = {
        title: h('input', { type: 'text', maxlength: 200, placeholder: 'Tiêu đề công việc', value: task ? task.title : '', disabled: !editable }),
        desc: h('textarea', { rows: 4, placeholder: 'Mô tả chi tiết', value: task ? task.description || '' : '', disabled: !editable }),
        priority: h('select', { value: task ? task.priority : 'medium', disabled: !editable },
            ['urgent', 'high', 'medium', 'low'].map((p) => h('option', { value: p, text: PRIORITY_LABEL[p] }))),
        status: h('select', { value: task ? task.status : defaultStatus },
            COLS.map((s) => h('option', { value: s, text: STATUS_LABEL[s] }))),
        assignee: h('select', { value: task && task.assignee_id ? String(task.assignee_id) : '', disabled: !editable },
            h('option', { value: '', text: '— Chưa giao —' }), memberOpts),
        due: h('input', { type: 'date', value: task && task.due_date ? task.due_date.slice(0, 10) : '', disabled: !editable })
    };
    const err = h('div', { class: 'error-text' });
    const saveBtn = h('button', { class: 'btn primary', type: 'button', text: isNew ? 'Tạo task' : 'Lưu thay đổi' });
    const delBtn = !isNew && canDelete(task) ? h('button', { class: 'btn danger', type: 'button', id: 'btn-delete-task' }, icon('trash', 16), 'Xóa') : null;

    const form = h('div', null,
        !editable ? h('div', { class: 'muted small', style: 'margin-top:10px', text: 'Bạn chỉ có thể đổi trạng thái và bình luận task này.' }) : null,
        h('label', { text: 'Tiêu đề *' }), f.title,
        h('label', { text: 'Mô tả' }), f.desc,
        h('div', { class: 'form-row' },
            h('div', null, h('label', { text: 'Mức ưu tiên' }), f.priority),
            h('div', null, h('label', { text: 'Trạng thái' }), f.status)),
        h('div', { class: 'form-row' },
            h('div', null, h('label', { text: 'Người thực hiện' }), f.assignee),
            h('div', null, h('label', { text: 'Hạn chót' }), f.due)),
        err,
        h('div', { class: 'modal-actions' },
            h('div', null, delBtn),
            h('div', { class: 'grp' },
                h('button', { class: 'btn', type: 'button', onclick: () => m.close(), text: editable ? 'Hủy' : 'Đóng' }),
                editable ? saveBtn : null)));

    const m = openModal(isNew ? 'Thêm công việc mới' : 'Chi tiết công việc', form, { wide: true });
    if (isNew) f.title.focus();

    // Thành viên không có quyền sửa: đổi trạng thái là lưu ngay
    if (!editable) f.status.onchange = async () => { await moveTask(task.id, f.status.value); };

    saveBtn.onclick = async () => {
        err.textContent = '';
        const title = f.title.value.trim();
        if (!title) { err.textContent = 'Vui lòng nhập tiêu đề.'; f.title.focus(); return; }
        const payload = {
            title, description: f.desc.value.trim(), priority: f.priority.value,
            assignee_id: f.assignee.value ? Number(f.assignee.value) : null,
            due_date: f.due.value || null
        };
        saveBtn.disabled = true;
        try {
            if (isNew) {
                await api('/tasks', { method: 'POST', body: { ...payload, project_id: projectId, status: f.status.value } });
                toast('Đã tạo task mới', 'success');
            } else {
                await api(`/tasks/${task.id}`, { method: 'PUT', body: payload });
                if (f.status.value !== task.status) {
                    await api(`/tasks/${task.id}/status`, { method: 'PATCH', body: { status: f.status.value } });
                }
                toast('Đã lưu thay đổi', 'success');
            }
            m.close();
            await reloadTasks();
        } catch (ex) { err.textContent = ex.message; saveBtn.disabled = false; }
    };

    if (delBtn) delBtn.onclick = async () => {
        if (!(await confirmBox(`Xóa task "${task.title}"? Bình luận của task cũng bị xóa.`, 'Xóa task'))) return;
        try {
            await api(`/tasks/${task.id}`, { method: 'DELETE' });
            m.close(); toast('Đã xóa task', 'success');
            await animateOut(document.querySelector(`.task[data-id="${task.id}"]`)); // thẻ thu nhỏ rồi biến mất
            await reloadTasks();
        } catch (ex) { toast(ex.message, 'error'); }
    };

    if (!isNew) form.append(commentsSection(task));
}

function commentsSection(task) {
    const list = h('div', null, h('div', { class: 'muted small', text: 'Đang tải bình luận...' }));
    const input = h('textarea', { rows: 2, maxlength: 2000, placeholder: 'Viết bình luận... (Ctrl+Enter để gửi)' });
    const send = h('button', { class: 'btn primary sm', type: 'button', text: 'Gửi' });

    async function load(fresh) {
        try {
            const items = await api(`/tasks/${task.id}/comments`);
            task.comment_count = items.length;
            list.replaceChildren(...(items.length ? items.map((c, i) =>
                h('div', { class: 'comment' + (fresh && i === items.length - 1 ? ' new' : '') }, avatar(c.user_name, true, c.avatar_url),
                    h('div', { class: 'body' },
                        h('div', null, h('b', { text: c.user_name }), h('span', { class: 'muted small', text: '  ' + fmtDateTime(c.created_at) })),
                        h('div', { class: 'content', text: c.content }))))
                : [h('div', { class: 'muted small', text: 'Chưa có bình luận nào.' })]));
        } catch (ex) { list.replaceChildren(h('div', { class: 'error-text', text: ex.message })); }
    }
    async function submit() {
        const content = input.value.trim();
        if (!content) return;
        send.disabled = true;
        try {
            await api(`/tasks/${task.id}/comments`, { method: 'POST', body: { content } });
            input.value = '';
            await load(true); renderBoard();
        } catch (ex) { toast(ex.message, 'error'); }
        send.disabled = false;
    }
    send.onclick = submit;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); });
    load();
    return h('div', null, h('h3', { class: 'section-title with-ic' }, icon('comment', 20), 'Bình luận'), list,
        h('div', { style: 'display:flex;gap:8px;align-items:flex-end;margin-top:10px' }, h('div', { style: 'flex:1' }, input), send));
}

/* ================= Modal thành viên ================= */
function openMembersModal() {
    const listBox = h('div');
    function renderList() {
        listBox.replaceChildren(...state.members.map((u) =>
            h('div', { class: 'list-row' },
                h('div', { style: 'display:flex;gap:10px;align-items:center;min-width:0' }, avatar(u.full_name, true, u.avatar_url),
                    h('div', { style: 'min-width:0' }, h('div', { style: 'font-weight:600', text: u.full_name }),
                        h('div', { class: 'muted small', text: u.email }))),
                roleBadge(u.project_role))));
    }
    renderList();

    const body = h('div', null, listBox);
    if (isManager()) {
        const email = h('input', { type: 'email', placeholder: 'Email thành viên (đã có tài khoản)' });
        const role = h('select', { value: 'member' }, h('option', { value: 'member', text: 'Thành viên' }),
            state.role === 'owner' ? h('option', { value: 'leader', text: 'Trưởng nhóm' }) : null);
        const err = h('div', { class: 'error-text' });
        const btn = h('button', { class: 'btn primary', type: 'button', text: 'Thêm' });
        btn.onclick = async () => {
            err.textContent = '';
            if (!email.value.trim()) { err.textContent = 'Vui lòng nhập email.'; return; }
            btn.disabled = true;
            try {
                await api(`/projects/${projectId}/members`, { method: 'POST', body: { email: email.value.trim(), project_role: role.value } });
                email.value = '';
                state.members = await api(`/projects/${projectId}/members`);
                renderList(); fillAssigneeFilter(); renderTeam();
                toast('Đã thêm thành viên', 'success');
            } catch (ex) { err.textContent = ex.message; }
            btn.disabled = false;
        };
        body.append(h('h3', { class: 'section-title', text: 'Thêm thành viên' }),
            h('div', { style: 'display:grid;grid-template-columns:1fr 150px auto;gap:8px' }, email, role, btn), err);
    } else {
        body.append(h('div', { class: 'muted small', style: 'margin-top:12px', text: 'Chỉ chủ dự án hoặc trưởng nhóm mới thêm được thành viên.' }));
    }
    openModal(`Thành viên (${state.members.length})`, body);
}

/* ================= Khởi tạo ================= */
function fillAssigneeFilter() {
    const sel = $('#f-assignee');
    const keep = state.filter.assignee;
    sel.replaceChildren(h('option', { value: '', text: 'Tất cả người làm' }),
        h('option', { value: 'me', text: 'Của tôi' }), h('option', { value: 'none', text: 'Chưa giao' }),
        state.members.map((m) => h('option', { value: m.id, text: m.full_name })));
    sel.value = keep;
}

function bindFilters() {
    $('#f-q').addEventListener('input', debounce((e) => { state.filter.q = e.target.value; renderBoard(); }, 200));
    $('#f-priority').onchange = (e) => { state.filter.priority = e.target.value; renderBoard(); };
    $('#f-assignee').onchange = (e) => { state.filter.assignee = e.target.value; renderBoard(); };
    $('#f-clear').onclick = () => {
        state.filter = { q: '', priority: '', assignee: '' };
        $('#f-q').value = ''; $('#f-priority').value = ''; $('#f-assignee').value = '';
        renderBoard();
    };
    $('#btn-members').onclick = openMembersModal;
    const setView = (v) => { state.view = v; localStorage.setItem('tm_view', v); renderBoard(); };
    $('#view-kanban').onclick = () => setView('kanban');
    $('#view-list').onclick = () => setView('list');
}

$('#board').replaceChildren(...skeletons(4, 'sk-col'));
(async () => {
    try {
        const [projects, members, tasks] = await Promise.all([
            api('/projects'), api(`/projects/${projectId}/members`), api(`/projects/${projectId}/tasks`)
        ]);
        const p = projects.find((x) => x.id === projectId);
        if (!p) { toast('Không tìm thấy dự án.', 'error'); setTimeout(() => location.replace('dashboard.html'), 1200); return; }
        Object.assign(state, { project: p, role: p.project_role, members, tasks });
        document.title = p.name + ' - Task Manager';
        setPageHead({ crumb: [{ text: 'Dự án', href: 'dashboard.html#du-an' }, p.name], title: p.name, role: p.project_role });
        $('#p-desc').textContent = p.description || '';
        const delBtn = $('#btn-delete-project');                 // chỉ chủ dự án mới thấy nút xóa
        delBtn.classList.toggle('hidden', p.project_role !== 'owner');
        delBtn.onclick = () => deleteProject(p, { redirect: 'dashboard.html' });
        fillAssigneeFilter(); renderTeam(); bindFilters(); renderBoard();
    } catch (e) {
        toast(e.message, 'error');
        setPageHead({ title: 'Không tải được dự án', crumb: [] });
    }
})();

/* ================= Thời gian thực: người khác đổi task -> bảng tự tải lại ================= */
window.addEventListener('tm:project_update', debounce(function refresh(e) {
    if (!e.detail || e.detail.project_id !== projectId) return;
    if (e.detail.action === 'project_deleted') {            // chủ dự án vừa xóa dự án này
        toast('Dự án này vừa bị chủ dự án xóa.', 'error');
        setTimeout(() => go('dashboard.html'), 1500);
        return;
    }
    if (document.querySelector('.task.dragging')) { setTimeout(() => refresh(e), 1000); return; } // đang kéo thì đợi
    reloadTasks().catch(() => {});
}, 300));

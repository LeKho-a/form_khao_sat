Auth.require();
renderTopbar();
$('#hello').replaceChildren(greeting() + ', ' + ((Auth.user && Auth.user.full_name) || 'bạn'));
$('#stats').replaceChildren(...skeletons(4, 'sk-card'));
$('#mine').replaceChildren(...skeletons(3, 'sk-row'));

const dash = { mine: [], tab: 'open' };

// Câu chào phụ: tóm tắt ngắn gọn, tích cực, dễ hiểu
function renderGreeting(mine) {
    const open = mine.filter((t) => t.status !== 'done').length;
    const overdue = mine.filter((t) => dueState(t.due_date, t.status) === 'overdue').length;
    let ico = 'target', text;
    if (!mine.length) { ico = 'sparkle'; text = 'Bạn chưa được giao việc nào. Hãy xem các dự án bên dưới nhé.'; }
    else if (!open) { ico = 'confetti'; text = 'Tuyệt vời! Bạn đã hoàn thành hết việc được giao.'; }
    else if (overdue) { ico = 'alarm'; text = `Bạn đang có ${open} việc đang mở, trong đó ${overdue} việc đã quá hạn.`; }
    else { text = `Bạn đang có ${open} việc đang mở, chưa có việc nào quá hạn.`; }
    $('#hello-sub').replaceChildren(icon(ico, 20), text);
}

function renderStats(s) {
    const items = [
        { ico: 'folders', cls: 'ic-blue', label: 'Dự án tham gia', value: s.projects },
        { ico: 'clipboard', cls: 'ic-teal', label: 'Tổng công việc', value: s.total },
        { ico: 'user-focus', cls: 'ic-orange', label: 'Được giao cho tôi', value: s.assigned_to_me },
        { ico: 'alarm', cls: 'ic-red', label: 'Quá hạn', value: s.overdue, danger: s.overdue > 0 }
    ];
    const cards = items.map((i) => {
        const num = h('div', { class: 'num', text: i.value });
        countUp(num, i.value);                                  // số đếm tăng dần
        return h('div', { class: 'card stat' + (i.danger ? ' danger' : '') },
            h('div', { class: 'icon ' + i.cls }, icon(i.ico, 28)),
            h('div', null, num, h('div', { class: 'muted small', text: i.label })));
    });
    $('#stats').replaceChildren(...stagger(cards, 4));
}

function renderProgress(s) {
    const keys = ['todo', 'in_progress', 'review', 'done'];
    if (!s.total) {
        $('#progress').replaceChildren(emptyState('chart-donut', 'Chưa có công việc nào', 'Tạo task đầu tiên trong một dự án để xem biểu đồ tiến độ.', null, true));
        return;
    }
    const pct = Math.round((s.by_status.done / s.total) * 100);
    $('#progress').replaceChildren(h('div', { class: 'donut-wrap' },
        donut(keys.map((k) => ({ value: s.by_status[k], color: STATUS_COLOR[k] })), pct + '%', 'hoàn thành'),
        h('div', { class: 'legend-list' }, keys.map((k) =>
            h('div', { class: 'legend-row' },
                h('span', null, h('span', { class: 'dot', style: 'background:' + STATUS_COLOR[k] }), STATUS_LABEL[k]),
                h('b', { text: s.by_status[k] }))))));
}

function renderMine() {
    $('#mine-tabs').replaceChildren(tabBar(dash.mine, dash.tab, (k) => { dash.tab = k; renderMine(); }));
    const tab = TASK_TABS.find((t) => t.key === dash.tab);
    const rows = dash.mine.filter(tab.test).slice(0, 8);
    $('#mine').replaceChildren(taskTable(rows, ['title', 'project', 'priority', 'status', 'due'],
        (t) => { go('board.html?project=' + t.project_id); }));
}

function renderProjects(list) {
    const box = $('#projects');
    if (!list.length) {
        box.replaceChildren(h('div', { class: 'card', style: 'grid-column:1/-1' }, emptyState('folders', 'Bạn chưa có dự án nào', 'Tạo dự án đầu tiên để bắt đầu quản lý công việc cùng nhóm.',
            h('button', { class: 'btn primary', type: 'button', onclick: openCreateProject }, icon('plus', 16), 'Tạo dự án'))));
        return;
    }
    box.replaceChildren(...stagger(list.map((p) => {
        const total = Number(p.task_count || 0), done = Number(p.done_count || 0);
        const pct = total ? Math.round((done / total) * 100) : 0;
        return h('div', { class: 'card project-card', style: '--pc:' + projectColor(p.id), onclick: () => { go('board.html?project=' + p.id); } },
            h('div', { class: 'row' }, h('h3', { text: p.name, style: 'margin:0' }), roleBadge(p.project_role)),
            h('p', { text: p.description || 'Chưa có mô tả' }),
            h('div', { class: 'progress' }, h('i', { style: `width:${pct}%;background:${projectColor(p.id)}` })),
            h('div', { class: 'muted small', style: 'display:flex;justify-content:space-between' },
                h('span', { text: `${done}/${total} việc hoàn thành` }),
                h('span', { class: 'with-ic' }, icon('users', 15), p.member_count || 1)));
    }), 8));
}

$('#btn-new-project').onclick = openCreateProject;

(async () => {
    try {
        const [stats, projects, mine] = await Promise.all([api('/dashboard'), api('/projects'), api('/tasks/mine')]);
        dash.mine = mine;
        renderGreeting(mine);
        renderStats(stats); renderProgress(stats); renderMine(); renderProjects(projects);
    } catch (e) { toast(e.message, 'error'); }
})();

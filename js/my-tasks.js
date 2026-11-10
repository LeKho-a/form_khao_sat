Auth.require();
renderTopbar();

const mt = { tasks: [], tab: 'open', q: new URLSearchParams(location.search).get('q') || '', priority: '', project: '' };
$('#mt-q').value = mt.q;

// Lọc theo từ khóa / ưu tiên / dự án (chưa áp dụng tab) -> số đếm trên tab luôn khớp với bộ lọc
function base() {
    const kw = mt.q.trim().toLowerCase();
    return mt.tasks.filter((t) =>
        (!kw || t.title.toLowerCase().includes(kw)) &&
        (!mt.priority || t.priority === mt.priority) &&
        (!mt.project || String(t.project_id) === mt.project));
}

function render() {
    const rows = base();
    $('#mt-tabs').replaceChildren(tabBar(rows, mt.tab, (k) => { mt.tab = k; render(); }));
    const tab = TASK_TABS.find((t) => t.key === mt.tab);
    $('#mt-table').replaceChildren(taskTable(rows.filter(tab.test), ['id', 'title', 'project', 'priority', 'status', 'due'],
        (t) => { go('board.html?project=' + t.project_id); }));
}

function fillProjects() {
    const seen = new Map();
    mt.tasks.forEach((t) => seen.set(t.project_id, t.project_name));
    $('#mt-project').replaceChildren(h('option', { value: '', text: 'Mọi dự án' }),
        [...seen].map(([id, name]) => h('option', { value: id, text: name })));
}

$('#mt-q').addEventListener('input', debounce((e) => { mt.q = e.target.value; render(); }, 200));
$('#mt-priority').onchange = (e) => { mt.priority = e.target.value; render(); };
$('#mt-project').onchange = (e) => { mt.project = e.target.value; render(); };
$('#mt-clear').onclick = () => {
    Object.assign(mt, { q: '', priority: '', project: '' });
    $('#mt-q').value = ''; $('#mt-priority').value = ''; $('#mt-project').value = '';
    render();
};

$('#mt-table').replaceChildren(...skeletons(4, 'sk-row'));
(async () => {
    try {
        mt.tasks = await api('/tasks/mine');
        fillProjects(); render();
    } catch (e) { toast(e.message, 'error'); }
})();

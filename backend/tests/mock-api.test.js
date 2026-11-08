const path = require('path');
const B = path.join(__dirname, '..');

// ---- CSDL giả lập trong bộ nhớ (theo dữ liệu mẫu database.sql) ----
const db = {
  users: [
    { id: 1, full_name: 'Nguyễn Trung Hiếu', email: 'hieu.lead@uth.edu.vn', avatar_url: null },
    { id: 2, full_name: 'Frontend Dev 1', email: 'fe1@uth.edu.vn', avatar_url: null },
    { id: 3, full_name: 'Backend Dev 1', email: 'be1@uth.edu.vn', avatar_url: null },
    { id: 4, full_name: 'Nguyễn Thế Hoàng Bách', email: 'bach@uth.edu.vn', avatar_url: null },
    { id: 5, full_name: 'Người ngoài', email: 'out@uth.edu.vn', avatar_url: null },
    { id: 6, full_name: 'Leader', email: 'lead@uth.edu.vn', avatar_url: null },
  ],
  projects: [{ id: 1, name: 'Dự án Quản lý tác vụ Nhóm 6', description: 'Xây dựng website Kanban Board', created_at: 1 }],
  pm: [
    { project_id: 1, user_id: 1, project_role: 'owner', joined_at: 1 },
    { project_id: 1, user_id: 2, project_role: 'member', joined_at: 2 },
    { project_id: 1, user_id: 3, project_role: 'member', joined_at: 3 },
    { project_id: 1, user_id: 6, project_role: 'leader', joined_at: 4 },
  ],
  tasks: [{ id: 1, project_id: 1, title: 'T1', creator_id: 1, assignee_id: 1, status: 'done' }, { id: 2, project_id: 1, title: 'T2', creator_id: 1, assignee_id: 2, status: 'in_progress' }],
  comments: [{ id: 1, task_id: 1, user_id: 1, content: 'Đã hoàn thành cấu trúc database.sql.', created_at: '2026-11-04T15:00:00' }],
};
const ROLE_ORDER = { owner: 0, leader: 1, member: 2 };

async function query(sql, p = []) {
  const s = sql.replace(/\s+/g, ' ').trim();
  if (s.startsWith('SELECT p.id, pm.project_role FROM projects p')) {
    const [uid, pid] = p; const pr = db.projects.find(x => x.id === pid);
    if (!pr) return [[]];
    const m = db.pm.find(x => x.project_id === pid && x.user_id === uid);
    return [[{ id: pid, project_role: m ? m.project_role : null }]];
  }
  if (s.startsWith('SELECT p.id, p.name, p.description, pm.project_role')) {
    return [db.pm.filter(m => m.user_id === p[0]).map(m => {
      const pr = db.projects.find(x => x.id === m.project_id);
      return { id: pr.id, name: pr.name, description: pr.description, project_role: m.project_role };
    })];
  }
  if (s.startsWith('SELECT id FROM users WHERE email')) {
    const u = db.users.find(x => x.email === p[0]); return [u ? [{ id: u.id }] : []];
  }
  if (s.startsWith('INSERT INTO project_members (project_id, user_id, project_role) VALUES (?, ?, ?)')) {
    if (db.pm.some(m => m.project_id === p[0] && m.user_id === p[1])) { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; }
    db.pm.push({ project_id: p[0], user_id: p[1], project_role: p[2], joined_at: db.pm.length + 1 }); return [{}];
  }
  if (s.startsWith('SELECT u.id, u.full_name, u.email, u.avatar_url, pm.project_role')) {
    return [db.pm.filter(m => m.project_id === p[0])
      .sort((a, b) => ROLE_ORDER[a.project_role] - ROLE_ORDER[b.project_role] || a.joined_at - b.joined_at)
      .map(m => { const u = db.users.find(x => x.id === m.user_id); return { id: u.id, full_name: u.full_name, email: u.email, avatar_url: u.avatar_url, project_role: m.project_role }; })];
  }
  if (s.startsWith('SELECT t.id, pm.project_role FROM tasks t')) {
    const t = db.tasks.find(x => x.id === p[1]); if (!t) return [[]];
    const m = db.pm.find(x => x.project_id === t.project_id && x.user_id === p[0]);
    return [[{ id: t.id, project_role: m ? m.project_role : null }]];
  }
  if (s.startsWith('SELECT c.id, c.user_id')) {
    return [db.comments.filter(c => c.task_id === p[0]).map(c => ({ id: c.id, user_id: c.user_id, user_name: db.users.find(u => u.id === c.user_id).full_name, avatar_url: null, content: c.content, created_at: c.created_at }))];
  }
  if (s.startsWith('INSERT INTO comments')) {
    const id = db.comments.length + 1;
    db.comments.push({ id, task_id: p[0], user_id: p[1], content: p[2], created_at: '2026-11-05T10:00:00' }); return [{ insertId: id }];
  }
  throw new Error('SQL chưa mock: ' + s);
}
let tmp = null;
const pool = {
  query,
  async getConnection() {
    return {
      async beginTransaction() { tmp = { projects: db.projects.length, pm: db.pm.length }; },
      async query(sql, p) {
        const s = sql.replace(/\s+/g, ' ');
        if (s.startsWith('INSERT INTO projects')) { const id = db.projects.length + 1; db.projects.push({ id, name: p[0], description: p[1], created_at: id }); return [{ insertId: id }]; }
        if (s.includes("'owner'")) { db.pm.push({ project_id: p[0], user_id: p[1], project_role: 'owner', joined_at: 9 }); return [{}]; }
        throw new Error('conn SQL chưa mock: ' + s);
      },
      async commit() {}, async rollback() {}, release() {},
    };
  },
};


// ---- bổ sung truy vấn cho Task + Dashboard ----
const baseQuery = pool.query;
pool.query = async (sql, p = []) => {
  const s = sql.replace(/\s+/g, ' ').trim();
  if (s.startsWith('SELECT project_role FROM project_members WHERE project_id = ? AND user_id = ?')) {
    const m = db.pm.find(x => x.project_id === p[0] && x.user_id === p[1]); return [m ? [{ project_role: m.project_role }] : []];
  }
  if (s.startsWith('SELECT t.id, t.project_id, t.creator_id, t.assignee_id, pm.project_role FROM tasks t')) {
    const t = db.tasks.find(x => x.id === p[1]); if (!t) return [[]];
    const m = db.pm.find(x => x.project_id === t.project_id && x.user_id === p[0]);
    return [[{ ...t, project_role: m ? m.project_role : null }]];
  }
  if (s.startsWith('INSERT INTO tasks')) {
    const id = db.tasks.length + 1;
    db.tasks.push({ id, project_id: p[0], title: p[1], description: p[2], status: p[3], priority: p[4], creator_id: p[5], assignee_id: p[6], due_date: p[7] });
    return [{ insertId: id }];
  }
  if (s.startsWith('UPDATE tasks SET ')) {
    const cols = s.slice('UPDATE tasks SET '.length, s.indexOf(' WHERE')).split(', ').map(c => c.replace(' = ?', ''));
    const t = db.tasks.find(x => x.id === p[p.length - 1]); cols.forEach((c, i) => { t[c] = p[i]; }); return [{ affectedRows: 1 }];
  }
  if (s.startsWith('DELETE FROM tasks WHERE id = ?')) { db.tasks = db.tasks.filter(x => x.id !== p[0]); return [{ affectedRows: 1 }]; }
  if (s.startsWith('SELECT t.id, t.project_id, t.title, t.description')) return [db.tasks.filter(t => t.project_id === p[0]).map(t => ({ id: t.id, title: t.title, status: t.status }))];
  if (s.startsWith('SELECT COUNT(*) AS total')) return [[{ total: '3', todo: '1', in_progress: '1', review: '0', done: '1', overdue: '1', assigned_to_me: '2' }]];
  if (s.startsWith('SELECT COUNT(*) AS projects')) return [[{ projects: 1 }]];
  if (s.startsWith('SELECT t.id, t.title, t.status, t.priority, t.project_id, p.name AS project_name')) return [[{ id: 2, title: 'T2', project_name: 'P' }]];
  return baseQuery(sql, p);
};

const Module = require('module');
let current = null;
const routes = {};
const makeRouter = () => {
  const list = []; const r = {};
  for (const m of ['get', 'post', 'put', 'delete', 'patch']) r[m] = (pth, h) => list.push({ method: m.toUpperCase(), path: pth, handler: h });
  r.use = () => {}; r.list = list; return r;
};
const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'express') { const e = () => ({}); e.Router = () => { current = makeRouter(); return current; }; return e; }
  if (request === './db') return pool;
  if (request === './auth.middleware') return (req, res, next) => next();
  return origLoad.apply(this, arguments);
};
for (const n of ['project', 'comment', 'task', 'dashboard']) { require(path.join(B, n + '.routes.js')); routes[n] = current.list; }
Module._load = origLoad;

const call = async (which, method, p, userId, params = {}, body) => {
  const route = routes[which].find(r => r.method === method && r.path === p);
  if (!route) throw new Error('Không có route ' + method + ' ' + p);
  const req = { user: userId ? { id: userId } : undefined, params, body };
  const out = { s: 200, j: null };
  const res = { status(c) { out.s = c; return this; }, json(j) { out.j = j; return this; } };
  await route.handler(req, res);
  return out;
};
const P = (m, p, u, pa, b) => call('project', m, p, u, pa, b);
const C = (m, p, u, pa, b) => call('comment', m, p, u, pa, b);
const T = (m, p, u, pa, b) => call('task', m, p, u, pa, b);

let pass = 0, fail = 0;
const t = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  -> ' + JSON.stringify(extra))); };

(async () => {
  let r;
  // ===== Projects =====
  r = await P('GET', '/', 1); t('3.1 GET projects', r.s === 200 && r.j[0].project_role === 'owner', r);
  r = await P('POST', '/', 1, {}, { name: 'Hệ thống Quản lý Bán hàng', description: 'Đồ án' });
  t('3.2 POST projects 201', r.s === 201 && r.j.projectId === 2, r);
  r = await P('POST', '/', 1, {}, undefined); t('3.2 body undefined -> 400', r.s === 400, r);
  const M = '/:projectId/members';
  r = await P('POST', M, 1, { projectId: '1' }, { email: 'bach@uth.edu.vn', project_role: 'member' }); t('3.3 thêm thành viên 200', r.s === 200, r);
  r = await P('POST', M, 1, { projectId: '1' }, { email: 'bach@uth.edu.vn' }); t('3.3 trùng -> 409', r.s === 409, r);
  r = await P('POST', M, 2, { projectId: '1' }, { email: 'out@uth.edu.vn' }); t('3.3 member thêm người -> 403', r.s === 403, r);
  r = await P('POST', M, 6, { projectId: '1' }, { email: 'out@uth.edu.vn', project_role: 'leader' }); t('3.3 leader gán leader -> 403', r.s === 403, r);
  r = await P('GET', M, 2, { projectId: '1' }); t('3.4 GET members, owner đứng đầu', r.s === 200 && r.j[0].project_role === 'owner', r);
  r = await P('GET', M, 5, { projectId: '1' }); t('3.4 người ngoài -> 403', r.s === 403, r);
  r = await P('GET', '/:projectId/tasks', 2, { projectId: '1' }); t('2.1 GET tasks theo dự án 200', r.s === 200 && r.j.length === 2, r);
  r = await P('GET', '/:projectId/tasks', 5, { projectId: '1' }); t('2.1 người ngoài -> 403', r.s === 403, r);
  r = await P('GET', '/:projectId/tasks', 1, { projectId: '99' }); t('2.1 dự án không có -> 404', r.s === 404, r);
  // ===== Comments =====
  r = await C('GET', '/', 2, { taskId: '1' }); t('4.1 GET comments', r.s === 200 && r.j[0].created_at === '2026-11-04T15:00:00', r);
  r = await C('POST', '/', 2, { taskId: '1' }, { content: 'Xong rồi' }); t('4.2 POST comment 201', r.s === 201 && r.j.commentId, r);
  r = await C('POST', '/', 5, { taskId: '1' }, { content: 'hi' }); t('4.2 người ngoài -> 403', r.s === 403, r);
  r = await C('POST', '/', 2, { taskId: '1' }, undefined); t('4.2 body undefined -> 400', r.s === 400, r);
  // ===== Tasks =====
  r = await T('POST', '/', 2, {}, { project_id: 1, title: 'Làm form thêm mới task', description: 'Thêm deadline, priority', priority: 'medium', assignee_id: 3, due_date: '2026-11-25' });
  t('2.2 POST task 201 + taskId', r.s === 201 && r.j.taskId === 3 && r.j.message === 'Tạo task thành công!', r);
  t('2.2 due_date "2026-11-25" -> 2026-11-25 23:59:59', db.tasks[2].due_date === '2026-11-25 23:59:59' && db.tasks[2].status === 'todo' && db.tasks[2].creator_id === 2, db.tasks[2]);
  r = await T('POST', '/', 2, {}, { project_id: 1, title: '   ' }); t('2.2 tiêu đề rỗng -> 400', r.s === 400, r);
  r = await T('POST', '/', 2, {}, { title: 'x' }); t('2.2 thiếu project_id -> 400', r.s === 400, r);
  r = await T('POST', '/', 2, {}, undefined); t('2.2 body undefined -> 400', r.s === 400, r);
  r = await T('POST', '/', 2, {}, { project_id: 1, title: 'x', priority: 'cao' }); t('2.2 priority sai -> 400', r.s === 400, r);
  r = await T('POST', '/', 2, {}, { project_id: 1, title: 'x', due_date: '2026-02-31' }); t('2.2 ngày 31/02 -> 400', r.s === 400, r);
  r = await T('POST', '/', 2, {}, { project_id: 1, title: 'x', due_date: 'mai' }); t('2.2 due_date chữ -> 400', r.s === 400, r);
  r = await T('POST', '/', 2, {}, { project_id: 1, title: 'x', assignee_id: 5 }); t('2.2 giao cho người ngoài dự án -> 400', r.s === 400, r);
  r = await T('POST', '/', 5, {}, { project_id: 1, title: 'x' }); t('2.2 người ngoài tạo task -> 403', r.s === 403, r);
  r = await T('POST', '/', 2, {}, { project_id: 1, title: 'Task không giao', assignee_id: '' }); t('2.2 không giao -> assignee null', r.s === 201 && db.tasks[db.tasks.length - 1].assignee_id === null, r);
  r = await T('PATCH', '/:id/status', 3, { id: '1' }, { status: 'review' }); t('2.3 PATCH status 200', r.s === 200 && db.tasks[0].status === 'review', r);
  r = await T('PATCH', '/:id/status', 3, { id: '1' }, { status: 'xong' }); t('2.3 status sai -> 400', r.s === 400, r);
  r = await T('PATCH', '/:id/status', 3, { id: '99' }, { status: 'done' }); t('2.3 task không có -> 404', r.s === 404, r);
  r = await T('PATCH', '/:id/status', 5, { id: '1' }, { status: 'done' }); t('2.3 người ngoài -> 403', r.s === 403, r);
  r = await T('PATCH', '/:id/status', 3, { id: '1' }, undefined); t('2.3 body undefined -> 400', r.s === 400, r);
  r = await T('PUT', '/:id', 2, { id: '2' }, { title: 'Tiêu đề mới', priority: 'urgent', due_date: '2026-11-30', assignee_id: 3 });
  t('2.4 assignee sửa task 200 + lưu đúng', r.s === 200 && db.tasks[1].title === 'Tiêu đề mới' && db.tasks[1].priority === 'urgent' && db.tasks[1].due_date === '2026-11-30 23:59:59' && db.tasks[1].assignee_id === 3, [r, db.tasks[1]]);
  r = await T('PUT', '/:id', 3, { id: '1' }, { title: 'hack' }); t('2.4 member không liên quan sửa -> 403', r.s === 403 && db.tasks[0].title === 'T1', r);
  r = await T('PUT', '/:id', 6, { id: '2' }, { description: 'leader sửa' }); t('2.4 leader sửa được 200', r.s === 200 && db.tasks[1].description === 'leader sửa', r);
  r = await T('PUT', '/:id', 1, { id: '2' }, { assignee_id: null, due_date: null }); t('2.4 bỏ giao + bỏ hạn chót', r.s === 200 && db.tasks[1].assignee_id === null && db.tasks[1].due_date === null, db.tasks[1]);
  r = await T('PUT', '/:id', 1, { id: '2' }, {}); t('2.4 body rỗng -> 400', r.s === 400, r);
  r = await T('PUT', '/:id', 1, { id: '2' }, { title: '' }); t('2.4 title rỗng -> 400', r.s === 400, r);
  r = await T('PUT', '/:id', 1, { id: '2' }, { assignee_id: 5 }); t('2.4 giao cho người ngoài -> 400', r.s === 400, r);
  r = await T('DELETE', '/:id', 3, { id: '2' }); t('2.5 member không phải người tạo xóa -> 403', r.s === 403 && db.tasks.some(x => x.id === 2), r);
  r = await T('DELETE', '/:id', 2, { id: '3' }); t('2.5 người tạo xóa 200', r.s === 200 && !db.tasks.some(x => x.id === 3), r);
  r = await T('DELETE', '/:id', 6, { id: '2' }); t('2.5 leader xóa 200', r.s === 200 && !db.tasks.some(x => x.id === 2), r);
  r = await T('DELETE', '/:id', 1, { id: '2' }); t('2.5 xóa task không còn -> 404', r.s === 404, r);
  // ===== Dashboard =====
  r = await call('dashboard', 'GET', '/', 1);
  t('Dashboard: số liệu ép kiểu số + upcoming', r.s === 200 && r.j.total === 3 && r.j.by_status.done === 1 && r.j.overdue === 1 && r.j.projects === 1 && r.j.upcoming.length === 1, r);
  console.log(`\nKẾT QUẢ: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();

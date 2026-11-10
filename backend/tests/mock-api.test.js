const path = require('path');
const B = path.join(__dirname, '..');

// ---- CSDL giả lập trong bộ nhớ (theo dữ liệu mẫu database.sql) ----
const db = {
  users: [
    { id: 1, full_name: 'Nguyễn Trung Hiếu', email: 'hieu.lead@uth.edu.vn', avatar_url: null, password_hash: 'h:123456' },
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
  if (s.startsWith('SELECT p.id, p.name, pm.project_role FROM projects p')) {
    const [uid, pid] = p; const pr = db.projects.find(x => x.id === pid);
    if (!pr) return [[]];
    const m = db.pm.find(x => x.project_id === pid && x.user_id === uid);
    return [[{ id: pid, name: pr.name, project_role: m ? m.project_role : null }]];
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
  if (s.startsWith('SELECT t.id, t.project_id, t.title, t.creator_id, t.assignee_id, pm.project_role FROM tasks t')) {
    const t = db.tasks.find(x => x.id === p[1]); if (!t) return [[]];
    const m = db.pm.find(x => x.project_id === t.project_id && x.user_id === p[0]);
    return [[{ ...t, project_role: m ? m.project_role : null }]];
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
  if (s.startsWith('SELECT t.id, t.project_id, t.title, t.status, t.creator_id, t.assignee_id, pm.project_role FROM tasks t')) {
    const t = db.tasks.find(x => x.id === p[1]); if (!t) return [[]];
    const m = db.pm.find(x => x.project_id === t.project_id && x.user_id === p[0]);
    return [[{ ...t, project_role: m ? m.project_role : null }]];
  }
  if (s.startsWith('INSERT INTO tasks')) {
    const id = Math.max(0, ...db.tasks.map(x => x.id)) + 1;
    db.tasks.push({ id, project_id: p[0], title: p[1], description: p[2], status: p[3], priority: p[4], creator_id: p[5], assignee_id: p[6], due_date: p[7], position: p[8] });
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

  if (s.startsWith('SELECT COALESCE(MAX(position)')) { const pos = Math.max(0, ...db.tasks.filter(x => x.project_id === p[0] && x.status === p[1]).map(x => x.position || 0)); return [[{ pos: pos + 1 }]]; }
  if (s.startsWith('SELECT id FROM tasks WHERE project_id = ? AND status = ? AND id <> ?')) return [db.tasks.filter(x => x.project_id === p[0] && x.status === p[1] && x.id !== p[2]).sort((a, b) => (a.position || 0) - (b.position || 0) || a.id - b.id).map(x => ({ id: x.id }))];
  if (s.startsWith('SELECT full_name FROM users WHERE id = ?')) { const u = db.users.find(x => x.id === p[0]); return [u ? [{ full_name: u.full_name }] : []]; }
  if (s.startsWith('INSERT INTO notifications')) { const id = db.notifs.length + 1; db.notifs.push({ id, user_id: p[0], type: p[1], message: p[2], project_id: p[3], task_id: p[4], is_read: 0 }); return [{ insertId: id }]; }
  if (s.startsWith('SELECT user_id FROM project_members WHERE project_id = ?')) return [db.pm.filter(m => m.project_id === p[0]).map(m => ({ user_id: m.user_id }))];
  if (s.startsWith('SELECT id, type, message, project_id, task_id, is_read')) return [db.notifs.filter(n => n.user_id === p[0]).sort((a, b) => b.id - a.id).map(n => ({ ...n, created_at: '2026-11-05T10:00:00' }))];
  if (s.startsWith('SELECT COUNT(*) AS n FROM notifications')) return [[{ n: db.notifs.filter(n => n.user_id === p[0] && !n.is_read).length }]];
  if (s.startsWith('UPDATE notifications SET is_read = 1 WHERE user_id = ?')) { db.notifs.filter(n => n.user_id === p[0]).forEach(n => { n.is_read = 1; }); return [{}]; }
  if (s.startsWith('UPDATE notifications SET is_read = 1 WHERE id = ?')) { db.notifs.filter(n => n.id === p[0] && n.user_id === p[1]).forEach(n => { n.is_read = 1; }); return [{}]; }
  if (s.startsWith('SELECT id, full_name, email, avatar_url, role')) { const u = db.users.find(x => x.id === p[0]); return [u ? [{ id: u.id, full_name: u.full_name, email: u.email, avatar_url: u.avatar_url, role: 'user', created_at: '2026-01-01T00:00:00' }] : []]; }
  if (s.startsWith('UPDATE users SET full_name = ?')) { db.users.find(x => x.id === p[1]).full_name = p[0]; return [{}]; }
  if (s.startsWith('SELECT password_hash FROM users WHERE id = ?')) { const u = db.users.find(x => x.id === p[0]); return [u ? [{ password_hash: u.password_hash }] : []]; }
  if (s.startsWith('UPDATE users SET password_hash = ? WHERE id = ?')) { db.users.find(x => x.id === p[1]).password_hash = p[0]; return [{}]; }
  if (s.startsWith('UPDATE users SET avatar_url = ? WHERE id = ?')) { db.users.find(x => x.id === p[1]).avatar_url = p[0]; return [{}]; }
  if (s.startsWith('UPDATE users SET avatar_url = NULL WHERE id = ?')) { db.users.find(x => x.id === p[0]).avatar_url = null; return [{}]; }
  if (s.startsWith('DELETE FROM password_resets WHERE user_id = ? AND used = 0')) { db.resets = db.resets.filter(r => !(r.user_id === p[0] && !r.used)); return [{}]; }
  if (s.startsWith('INSERT INTO password_resets')) { db.resets.push({ user_id: p[0], token_hash: p[1], used: 0, expired: false }); return [{}]; }
  if (s.startsWith('SELECT id, user_id FROM password_resets WHERE token_hash = ?')) { const r = db.resets.find(x => x.token_hash === p[0] && !x.used && !x.expired); return [r ? [{ id: 1, user_id: r.user_id }] : []]; }
  if (s.startsWith('UPDATE password_resets SET used = 1 WHERE user_id = ?')) { db.resets.filter(r => r.user_id === p[0]).forEach(r => { r.used = 1; }); return [{}]; }
  if (s.startsWith('SELECT t.id, t.project_id, p.name AS project_name, t.title')) return [db.tasks.filter(x => x.assignee_id === p[1]).map(x => ({ id: x.id, project_id: x.project_id, project_name: 'P', title: x.title, status: x.status }))];
  return baseQuery(sql, p);
};
const origGetConn = pool.getConnection;
pool.getConnection = async () => {
  const c = await origGetConn(); const oq = c.query;
  c.query = (sql, pr) => { const q = sql.replace(/\s+/g, ' ').trim(); return (q.startsWith('SELECT id FROM tasks') || q.startsWith('UPDATE tasks')) ? pool.query(sql, pr) : oq(sql, pr); };
  return c;
};
db.notifs = []; db.resets = [];

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
  if (request === 'bcrypt') return { hash: async (pw) => 'h:' + pw, compare: async (pw, hh) => hh === 'h:' + pw };
  return origLoad.apply(this, arguments);
};
process.env.RESET_SHOW_LINK = 'true';
for (const n of ['project', 'comment', 'task', 'dashboard', 'password', 'user', 'notification']) { require(path.join(B, n + '.routes.js')); routes[n] = current.list; }
Module._load = origLoad;

const call = async (which, method, p, userId, params = {}, body) => {
  const route = routes[which].find(r => r.method === method && r.path === p);
  if (!route) throw new Error('Không có route ' + method + ' ' + p);
  const req = { user: userId ? { id: userId } : undefined, params, body, ip: '9.9.9.9' };
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

  // ===================== Sắp xếp thứ tự trong cột =====================
  const ord = (st) => db.tasks.filter(x => x.status === st && x.title.startsWith('Ord')).sort((a, b) => (a.position || 0) - (b.position || 0) || a.id - b.id).map(x => x.title).join(',');
  const oid = [];
  for (const title of ['Ord A', 'Ord B', 'Ord C']) { r = await T('POST', '/', 2, {}, { project_id: 1, title, status: 'review' }); oid.push(r.j.taskId); }
  t('Thứ tự: task mới nằm cuối cột', ord('review') === 'Ord A,Ord B,Ord C', ord('review'));
  r = await T('PATCH', '/:id/move', 2, { id: String(oid[2]) }, { status: 'review', before_id: oid[0] });
  t('Thứ tự: kéo C lên trước A -> C,A,B', r.s === 200 && ord('review') === 'Ord C,Ord A,Ord B', [r, ord('review')]);
  r = await T('PATCH', '/:id/move', 2, { id: String(oid[1]) }, { status: 'review', before_id: oid[2] });
  t('Thứ tự: kéo B lên trước C -> B,C,A', ord('review') === 'Ord B,Ord C,Ord A', ord('review'));
  r = await T('PATCH', '/:id/move', 2, { id: String(oid[0]) }, { status: 'in_progress', before_id: null });
  t('Thứ tự: đổi cột + xuống cuối cột đích', ord('in_progress') === 'Ord A' && ord('review') === 'Ord B,Ord C' && db.tasks.find(x => x.id === oid[0]).status === 'in_progress', [ord('in_progress'), ord('review')]);
  r = await T('PATCH', '/:id/move', 2, { id: String(oid[2]) }, { status: 'in_progress', before_id: oid[0] });
  t('Thứ tự: đổi cột + chèn lên trước A', ord('in_progress') === 'Ord C,Ord A', ord('in_progress'));
  r = await T('PATCH', '/:id/move', 2, { id: String(oid[1]) }, { status: 'in_progress', before_id: 99999 });
  t('Thứ tự: mốc before_id không có trong cột -> xuống cuối', ord('in_progress') === 'Ord C,Ord A,Ord B', ord('in_progress'));
  r = await T('PATCH', '/:id/status', 2, { id: String(oid[0]) }, { status: 'done' });
  t('PATCH status: task nằm cuối cột đích', db.tasks.find(x => x.id === oid[0]).position === Math.max(...db.tasks.filter(x => x.status === 'done').map(x => x.position || 0)), db.tasks.filter(x => x.status === 'done'));
  r = await T('PATCH', '/:id/move', 2, { id: String(oid[0]) }, { status: 'xong' }); t('move: status sai -> 400', r.s === 400, r);
  r = await T('PATCH', '/:id/move', 2, { id: String(oid[0]) }, { status: 'todo', before_id: 'abc' }); t('move: before_id sai -> 400', r.s === 400, r);
  r = await T('PATCH', '/:id/move', 5, { id: String(oid[0]) }, { status: 'todo' }); t('move: người ngoài -> 403', r.s === 403, r);
  r = await T('PATCH', '/:id/move', 2, { id: '99999' }, { status: 'todo' }); t('move: task không có -> 404', r.s === 404, r);
  r = await T('PATCH', '/:id/move', 2, { id: String(oid[0]) }, undefined); t('move: body undefined -> 400', r.s === 400, r);

  // ===================== Thời gian thực + Thông báo =====================
  const realtime = require(path.join(B, 'realtime.js'));
  const mkClient = (uid) => {
    let closeCb;
    const res = { out: [], writeHead() {}, write(m) { this.out.push(m); }, on(e, cb) { if (e === 'close') closeCb = cb; } };
    const req = { user: { id: uid } };
    routes.notification.find(x => x.method === 'GET' && x.path === '/stream').handler(req, res);
    return { res, close: () => closeCb() };
  };
  const evs = (c, name) => c.res.out.filter(m => m.startsWith('event: ' + name)).map(m => JSON.parse(m.split('data: ')[1]));
  const c2 = mkClient(2), c3 = mkClient(3), c5 = mkClient(5);
  t('SSE: nhận sự kiện ready + 3 client online', c3.res.out.some(m => m.includes('event: ready')) && realtime.onlineCount() === 3, realtime.onlineCount());
  r = await T('POST', '/', 2, {}, { project_id: 1, title: 'Giao cho Khoa', assignee_id: 3 });
  const tid = r.j.taskId;
  t('Thông báo: người được giao nhận ngay (SSE)', evs(c3, 'notification').some(n => n.type === 'task_assigned' && n.message.includes('Giao cho Khoa')), c3.res.out);
  t('Thông báo: người thao tác KHÔNG tự nhận', evs(c2, 'notification').length === 0, c2.res.out);
  t('Thông báo: đã lưu vào CSDL', db.notifs.some(n => n.user_id === 3 && n.type === 'task_assigned'));
  t('Realtime: thành viên khác nhận project_update', evs(c3, 'project_update').some(e => e.project_id === 1 && e.action === 'task_created' && e.task_id === tid));
  t('Realtime: người ngoài dự án không nhận gì', c5.res.out.every(m => m.startsWith('retry') || m.includes('event: ready')), c5.res.out);
  r = await T('PATCH', '/:id/status', 3, { id: String(tid) }, { status: 'done' });
  t('Thông báo: đổi trạng thái -> báo người tạo', evs(c2, 'notification').some(n => n.type === 'task_status' && n.message.includes('Hoàn thành')), c2.res.out);
  r = await C('POST', '/', 2, { taskId: String(tid) }, { content: 'Cảm ơn nhé' });
  t('Thông báo: bình luận -> báo người được giao', evs(c3, 'notification').some(n => n.type === 'comment' && n.message.includes('Giao cho Khoa')), c3.res.out);
  r = await P('POST', '/:projectId/members', 1, { projectId: '1' }, { email: 'out@uth.edu.vn' });
  t('Thông báo: được thêm vào dự án -> báo người mới', evs(c5, 'notification').some(n => n.type === 'project_added'), c5.res.out);
  const N = (m, pth, u, pa, b) => call('notification', m, pth, u, pa, b);
  r = await N('GET', '/', 3);
  t('API thông báo: danh sách + unread', r.s === 200 && r.j.unread >= 2 && r.j.items.length >= 2 && r.j.items[0].id > r.j.items[1].id, r);
  const before3 = r.j.unread, firstId = r.j.items[0].id;
  r = await N('PATCH', '/:id/read', 2, { id: String(firstId) });
  t('API thông báo: user khác không đánh dấu hộ được', db.notifs.find(n => n.id === firstId).is_read === 0, r);
  r = await N('PATCH', '/:id/read', 3, { id: String(firstId) });
  t('API thông báo: đánh dấu đã đọc 1 cái', (await N('GET', '/', 3)).j.unread === before3 - 1);
  r = await N('PATCH', '/:id/read', 3, { id: 'abc' }); t('API thông báo: id sai -> 400', r.s === 400, r);
  r = await N('PATCH', '/read-all', 3); t('API thông báo: đọc tất cả -> unread 0', (await N('GET', '/', 3)).j.unread === 0);
  c3.close(); t('SSE: đóng kết nối thì gỡ client', realtime.onlineCount() === 2, realtime.onlineCount());
  c2.close(); c5.close();

  r = await T('GET', '/mine', 3);
  t('Việc của tôi: chỉ trả task được giao cho mình', r.s === 200 && r.j.length === db.tasks.filter(x => x.assignee_id === 3).length && r.j.length >= 1 && r.j.every(x => x.project_name), r);
  r = await T('GET', '/mine', 5); t('Việc của tôi: người chưa được giao gì -> []', r.s === 200 && r.j.length === 0, r);

  // ===================== Quên / đặt lại mật khẩu =====================
  const PW = (pth, b) => call('password', 'POST', pth, null, {}, b);
  r = await PW('/forgot-password', { email: 'khong-phai-email' }); t('Quên MK: email sai định dạng -> 400', r.s === 400, r);
  const known = await PW('/forgot-password', { email: 'hieu.lead@uth.edu.vn' });
  const unknown = await PW('/forgot-password', { email: 'nguoila@uth.edu.vn' });
  t('Quên MK: email có/không có đều trả CÙNG thông điệp (không lộ tài khoản)', known.s === 200 && unknown.s === 200 && known.j.message === unknown.j.message, [known, unknown]);
  t('Quên MK: chế độ demo trả liên kết, email lạ thì không', /reset\.html\?token=[0-9a-f]{64}$/.test(known.j.dev_reset_link || '') && !unknown.j.dev_reset_link, [known, unknown]);
  t('Quên MK: DB chỉ lưu bản băm, không lưu token gốc', db.resets.length === 1 && db.resets[0].token_hash.length === 64 && !known.j.dev_reset_link.includes(db.resets[0].token_hash));
  const token = known.j.dev_reset_link.split('token=')[1];
  r = await PW('/reset-password', { token: 'sai', password: 'matkhaumoi' }); t('Đặt lại MK: token sai -> 400', r.s === 400, r);
  r = await PW('/reset-password', { token, password: '123' }); t('Đặt lại MK: mật khẩu quá ngắn -> 400', r.s === 400, r);
  r = await PW('/reset-password', { token: '', password: 'matkhaumoi' }); t('Đặt lại MK: thiếu token -> 400', r.s === 400, r);
  r = await PW('/reset-password', { token, password: 'matkhaumoi' });
  t('Đặt lại MK: thành công -> băm mật khẩu mới', r.s === 200 && db.users.find(x => x.id === 1).password_hash === 'h:matkhaumoi', [r, db.users[0]]);
  r = await PW('/reset-password', { token, password: 'matkhackhac' }); t('Đặt lại MK: token chỉ dùng được 1 lần', r.s === 400 && db.users[0].password_hash === 'h:matkhaumoi', r);
  const again = await PW('/forgot-password', { email: 'hieu.lead@uth.edu.vn' });
  db.resets[db.resets.length - 1].expired = true;
  r = await PW('/reset-password', { token: again.j.dev_reset_link.split('token=')[1], password: 'matkhaumoi2' }); t('Đặt lại MK: token hết hạn -> 400', r.s === 400, r);
  let last; for (let i = 0; i < 6; i++) last = await PW('/forgot-password', { email: 'spam@uth.edu.vn' });
  t('Quên MK: gọi dồn dập -> 429', last.s === 429, last);

  // ===================== Hồ sơ + avatar =====================
  const U = (m, pth, u, b) => call('user', m, pth, u, {}, b);
  const fs = require('fs');
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  r = await U('GET', '/me', 1); t('Hồ sơ: GET /me', r.s === 200 && r.j.email === 'hieu.lead@uth.edu.vn' && !('password_hash' in r.j), r);
  r = await U('PUT', '/me', 1, { full_name: '  Hiếu Mới  ' }); t('Hồ sơ: đổi tên (cắt khoảng trắng)', r.s === 200 && db.users[0].full_name === 'Hiếu Mới', r);
  r = await U('PUT', '/me', 1, { full_name: '   ' }); t('Hồ sơ: tên rỗng -> 400', r.s === 400, r);
  r = await U('PUT', '/me', 1, undefined); t('Hồ sơ: body undefined -> 400', r.s === 400, r);
  r = await U('PUT', '/me/password', 1, { current_password: 'saisai', new_password: 'abcdef' }); t('Đổi MK: sai mật khẩu hiện tại -> 400', r.s === 400, r);
  r = await U('PUT', '/me/password', 1, { current_password: 'matkhaumoi', new_password: '12' }); t('Đổi MK: mật khẩu mới ngắn -> 400', r.s === 400, r);
  r = await U('PUT', '/me/password', 1, { current_password: 'matkhaumoi', new_password: 'abcdef' }); t('Đổi MK: thành công', r.s === 200 && db.users[0].password_hash === 'h:abcdef', r);
  r = await U('POST', '/me/avatar', 1, { image: PNG });
  const f1 = r.j && r.j.avatar_url ? path.join(B, r.j.avatar_url) : '';
  t('Avatar: tải PNG hợp lệ -> lưu file + cập nhật CSDL', r.s === 200 && /^\/uploads\/avatars\/1-[0-9a-f]{12}\.png$/.test(r.j.avatar_url) && fs.existsSync(f1) && db.users[0].avatar_url === r.j.avatar_url, r);
  r = await U('POST', '/me/avatar', 1, { image: PNG }); await new Promise(z => setTimeout(z, 150));
  t('Avatar: tải ảnh mới -> xóa file cũ', !fs.existsSync(f1) && fs.existsSync(path.join(B, r.j.avatar_url)), r);
  const f2 = path.join(B, r.j.avatar_url);
  r = await U('POST', '/me/avatar', 1, { image: 'data:image/png;base64,' + Buffer.from('day khong phai anh, chi la text dai hon muoi hai ky tu').toString('base64') });
  t('Avatar: file giả mạo đuôi ảnh -> 400', r.s === 400, r);
  r = await U('POST', '/me/avatar', 1, { image: 'data:image/jpeg;base64,' + PNG.split(',')[1] }); t('Avatar: khai báo jpeg nhưng nội dung png -> 400', r.s === 400, r);
  r = await U('POST', '/me/avatar', 1, { image: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }); t('Avatar: SVG bị từ chối (chống XSS) -> 400', r.s === 400, r);
  r = await U('POST', '/me/avatar', 1, { image: 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024) }); t('Avatar: quá 2MB -> 400', r.s === 400, r);
  r = await U('POST', '/me/avatar', 1, undefined); t('Avatar: không gửi ảnh -> 400', r.s === 400, r);
  r = await U('DELETE', '/me/avatar', 1); await new Promise(z => setTimeout(z, 150));
  t('Avatar: xóa -> avatar_url NULL + xóa file', r.s === 200 && db.users[0].avatar_url === null && !fs.existsSync(f2), r);
  fs.rmSync(path.join(B, 'uploads'), { recursive: true, force: true });

  console.log(`\nKẾT QUẢ: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();

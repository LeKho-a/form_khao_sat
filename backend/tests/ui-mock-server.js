// Máy chủ GIẢ (chỉ dùng để thử giao diện khi chưa có MySQL): phục vụ /frontend + API trong bộ nhớ.
const http = require('http'), fs = require('fs'), path = require('path');
const FRONT = path.join(__dirname, '..', '..', 'frontend');
const me = { id: 1, full_name: 'Nguyễn Trung Hiếu', email: 'hieu.lead@uth.edu.vn', role: 'admin' };
const users = [me, { id: 2, full_name: 'Nguyễn Thế Hoàng Bách', email: 'bach@uth.edu.vn' }, { id: 3, full_name: 'Huỳnh Võ Minh Khoa', email: 'minhkhoa@uth.edu.vn' }];
let projects = [{ id: 1, name: 'Dự án Quản lý tác vụ Nhóm 6', description: 'Xây dựng website Kanban Board', project_role: 'owner' }];
let members = [{ id: 1, full_name: me.full_name, email: me.email, project_role: 'owner' }, { id: 2, full_name: users[1].full_name, email: 'bach@uth.edu.vn', project_role: 'member' }];
let tasks = [
  { id: 1, project_id: 1, title: 'Thiết kế Database Schema', description: 'Tạo bảng', status: 'done', priority: 'high', creator_id: 1, assignee_id: 1, assignee_name: me.full_name, due_date: '2026-11-10T23:59:59', comment_count: 1 },
  { id: 2, project_id: 1, title: 'Dựng giao diện bảng Kanban', description: '4 cột', status: 'in_progress', priority: 'urgent', creator_id: 1, assignee_id: 2, assignee_name: users[1].full_name, due_date: '2026-11-09T23:59:59', comment_count: 0 },
  { id: 3, project_id: 1, title: 'Viết API CRUD Tasks <img src=x onerror=alert(1)>', description: '', status: 'todo', priority: 'medium', creator_id: 1, assignee_id: null, assignee_name: null, due_date: null, comment_count: 0 },
];
let comments = [{ id: 1, task_id: 1, user_id: 1, user_name: me.full_name, content: 'Đã hoàn thành cấu trúc database.sql.', created_at: '2026-11-04T15:00:00' }];
const log = [];
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (!url.startsWith('/api')) {
    const f = path.join(FRONT, url === '/' ? 'index.html' : url);
    if (!f.startsWith(FRONT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'text/plain' }); return res.end(fs.readFileSync(f));
  }
  let raw = ''; req.on('data', (c) => raw += c); req.on('end', () => {
    const b = raw ? JSON.parse(raw) : {}; let m;
    log.push(req.method + ' ' + url + (raw ? ' ' + raw : '')); if (url === '/api/_log') return send(res, 200, log);
    if (url === '/api/auth/login') return b.password === '123456' ? send(res, 200, { token: 'tok', user: me }) : send(res, 401, { message: 'Email hoặc mật khẩu không chính xác!' });
    if (!(req.headers.authorization || '').startsWith('Bearer ')) return send(res, 401, { message: 'Chưa cung cấp mã xác thực (token)!' });
    if (url === '/api/dashboard') { const by = { todo: 0, in_progress: 0, review: 0, done: 0 }; tasks.forEach((t) => by[t.status]++);
      return send(res, 200, { projects: projects.length, total: tasks.length, by_status: by, overdue: 1, assigned_to_me: 1, upcoming: tasks.filter((t) => t.assignee_id === 1 && t.status !== 'done').map((t) => ({ ...t, project_name: projects[0].name })) }); }
    if (url === '/api/projects' && req.method === 'GET') return send(res, 200, projects.map((p) => ({ ...p, task_count: tasks.length, done_count: tasks.filter((t) => t.status === 'done').length, member_count: members.length })));
    if (url === '/api/projects' && req.method === 'POST') { const id = projects.length + 1; projects.push({ id, name: b.name, description: b.description, project_role: 'owner' }); return send(res, 201, { message: 'Tạo dự án thành công!', projectId: id }); }
    if (url === '/api/projects/1/members') { if (req.method === 'GET') return send(res, 200, members);
      const u = users.find((x) => x.email === b.email); if (!u) return send(res, 404, { message: 'Không tìm thấy người dùng với email này!' });
      members.push({ id: u.id, full_name: u.full_name, email: u.email, project_role: b.project_role }); return send(res, 200, { message: 'Đã thêm thành viên vào dự án!' }); }
    if (url === '/api/projects/1/tasks') return send(res, 200, tasks);
    if (url === '/api/tasks' && req.method === 'POST') { const id = tasks.length + 10; const a = members.find((x) => x.id === b.assignee_id);
      tasks.push({ id, project_id: 1, title: b.title, description: b.description, status: b.status || 'todo', priority: b.priority, creator_id: 1, assignee_id: b.assignee_id, assignee_name: a ? a.full_name : null, due_date: b.due_date ? b.due_date + 'T23:59:59' : null, comment_count: 0 });
      return send(res, 201, { message: 'Tạo task thành công!', taskId: id }); }
    if ((m = url.match(/^\/api\/tasks\/(\d+)\/status$/))) { if (b.status === 'review' && req.headers['x-fail']) return send(res, 500, { message: 'x' });
      tasks.find((t) => t.id == m[1]).status = b.status; return send(res, 200, { message: 'Cập nhật trạng thái thành công!' }); }
    if ((m = url.match(/^\/api\/tasks\/(\d+)\/comments$/))) { if (req.method === 'GET') return send(res, 200, comments.filter((c) => c.task_id == m[1]));
      comments.push({ id: comments.length + 1, task_id: +m[1], user_id: 1, user_name: me.full_name, content: b.content, created_at: '2026-11-08T10:00:00' }); tasks.find((t) => t.id == m[1]).comment_count++; return send(res, 201, { message: 'Thêm bình luận thành công!', commentId: 9 }); }
    if ((m = url.match(/^\/api\/tasks\/(\d+)$/))) { const i = tasks.findIndex((t) => t.id == m[1]);
      if (req.method === 'DELETE') { tasks.splice(i, 1); return send(res, 200, { message: 'Xóa task thành công!' }); }
      Object.assign(tasks[i], b, { due_date: b.due_date ? b.due_date + 'T23:59:59' : null, assignee_name: (members.find((x) => x.id === b.assignee_id) || {}).full_name || null }); return send(res, 200, { message: 'Cập nhật công việc thành công!' }); }
    send(res, 404, { message: 'Không tìm thấy API này!' });
  });
}).listen(5000, () => console.log('mock on 5000'));

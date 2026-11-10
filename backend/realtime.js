// Thông báo thời gian thực bằng Server-Sent Events (SSE) - không cần thư viện ngoài.
// - notifyUsers: lưu thông báo vào CSDL + đẩy ngay tới người đang online
// - broadcastProject: báo cho mọi thành viên dự án biết dữ liệu vừa đổi (bảng Kanban tự tải lại)
const db = require('./db');

const clients = new Map(); // userId -> Set(res)

const addClient = (uid, res) => {
    if (!clients.has(uid)) clients.set(uid, new Set());
    clients.get(uid).add(res);
};
const removeClient = (uid, res) => {
    const set = clients.get(uid);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) clients.delete(uid);
};
const push = (uid, event, data) => {
    const set = clients.get(uid);
    if (!set) return;
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of set) {
        try { res.write(msg); } catch (e) { /* kết nối đã đóng */ }
    }
};
const onlineCount = () => clients.size;

const p2 = (n) => String(n).padStart(2, '0');
const localIso = (d = new Date()) =>
    `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;

async function userName(id) {
    try {
        const [rows] = await db.query('SELECT full_name FROM users WHERE id = ?', [id]);
        return rows.length ? rows[0].full_name : 'Ai đó';
    } catch (e) { return 'Ai đó'; }
}

// Không bao giờ ném lỗi: thông báo hỏng không được làm hỏng thao tác chính
async function notifyUsers({ userIds, actorId, type, message, projectId = null, taskId = null }) {
    try {
        const targets = [...new Set(userIds.filter(Boolean))].filter((u) => u !== actorId);
        for (const uid of targets) {
            const [r] = await db.query(
                'INSERT INTO notifications (user_id, type, message, project_id, task_id) VALUES (?, ?, ?, ?, ?)',
                [uid, type, message, projectId, taskId]
            );
            push(uid, 'notification', {
                id: r.insertId, type, message, project_id: projectId, task_id: taskId, is_read: 0, created_at: localIso()
            });
        }
    } catch (err) {
        console.error('notifyUsers:', err.message);
    }
}

async function broadcastProject(projectId, data, exceptUserId) {
    try {
        const [rows] = await db.query('SELECT user_id FROM project_members WHERE project_id = ?', [projectId]);
        for (const r of rows) {
            if (r.user_id !== exceptUserId) push(r.user_id, 'project_update', { project_id: projectId, ...data });
        }
    } catch (err) {
        console.error('broadcastProject:', err.message);
    }
}

module.exports = { addClient, removeClient, push, onlineCount, notifyUsers, broadcastProject, userName };

// Module Quản lý Tác vụ & Kanban (API Contract mục 2)
// Quy tắc phân quyền:
//  - Mọi thành viên của dự án: xem task, tạo task, kéo thả đổi trạng thái
//  - Sửa chi tiết: owner/leader của dự án, người tạo hoặc người được giao
//  - Xóa: owner/leader của dự án hoặc người tạo task
const express = require('express');
const router = express.Router();
const db = require('./db');
const verifyToken = require('./auth.middleware');
const { notifyUsers, broadcastProject, userName } = require('./realtime');

router.use(verifyToken);

const STATUSES = ['todo', 'in_progress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const MANAGER_ROLES = ['owner', 'leader'];
const STATUS_VI = { todo: 'Cần làm', in_progress: 'Đang làm', review: 'Đang review', done: 'Hoàn thành' };

const parseId = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};

// Chuẩn hóa hạn chót: nhận 'YYYY-MM-DD' (=> 23:59:59) hoặc 'YYYY-MM-DD[T ]HH:mm[:ss]'
// Trả về { skip } nếu không gửi, { value } nếu hợp lệ (có thể null), { error } nếu sai
function parseDueDate(v) {
    if (v === undefined) return { skip: true };
    if (v === null || v === '') return { value: null };
    if (typeof v !== 'string') return { error: true };
    const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return { error: true };
    const y = +m[1], mo = +m[2], d = +m[3];
    const hasTime = m[4] !== undefined;
    const hh = hasTime ? +m[4] : 23;
    const mi = hasTime ? +m[5] : 59;
    const ss = hasTime ? +(m[6] || 0) : 59;
    const dt = new Date(y, mo - 1, d, hh, mi, ss);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d || hh > 23 || mi > 59 || ss > 59) {
        return { error: true };
    }
    const p = (n) => String(n).padStart(2, '0');
    return { value: `${y}-${p(mo)}-${p(d)} ${p(hh)}:${p(mi)}:${p(ss)}` };
}

const getRole = async (projectId, userId) => {
    const [rows] = await db.query(
        'SELECT project_role FROM project_members WHERE project_id = ? AND user_id = ?',
        [projectId, userId]
    );
    return rows.length ? rows[0].project_role : null;
};

// Lấy task + vai trò của user trong dự án chứa task
const getTaskContext = async (taskId, userId) => {
    const [rows] = await db.query(
        `SELECT t.id, t.project_id, t.title, t.status, t.creator_id, t.assignee_id, pm.project_role
           FROM tasks t
           LEFT JOIN project_members pm
                  ON pm.project_id = t.project_id AND pm.user_id = ?
          WHERE t.id = ?`,
        [userId, taskId]
    );
    return rows[0];
};

// Vị trí cuối cột (task mới / task đổi cột sẽ nằm cuối cột đích)
const nextPosition = async (projectId, status, conn = db) => {
    const [rows] = await conn.query(
        'SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM tasks WHERE project_id = ? AND status = ?',
        [projectId, status]
    );
    return Number(rows[0].pos) || 1;
};

// Báo cho người liên quan + làm mới bảng Kanban của các thành viên khác
const announceStatus = async (ctx, status, actorId) => {
    if (ctx.status !== status) {
        const name = await userName(actorId);
        await notifyUsers({
            userIds: [ctx.creator_id, ctx.assignee_id], actorId, type: 'task_status',
            message: `${name} chuyển "${ctx.title}" sang "${STATUS_VI[status]}"`,
            projectId: ctx.project_id, taskId: ctx.id
        });
    }
    await broadcastProject(ctx.project_id, { action: 'task_moved', task_id: ctx.id }, actorId);
};

const serverError = (res, err) => {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
};

// 2.0 Việc của tôi: mọi task được giao cho tôi, trên tất cả dự án (GET /api/tasks/mine)
router.get('/mine', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT t.id, t.project_id, p.name AS project_name, t.title, t.status, t.priority,
                    DATE_FORMAT(t.due_date, '%Y-%m-%dT%H:%i:%s') AS due_date,
                    (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count
               FROM tasks t
               JOIN projects p ON p.id = t.project_id
               JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
              WHERE t.assignee_id = ?
              ORDER BY t.status = 'done', t.due_date IS NULL, t.due_date ASC, t.id DESC
              LIMIT 300`,
            [req.user.id, req.user.id]
        );
        return res.status(200).json(rows);
    } catch (err) {
        return serverError(res, err);
    }
});

// 2.2 Tạo công việc mới (POST /api/tasks)
router.post('/', async (req, res) => {
    const b = req.body || {};
    const projectId = parseId(b.project_id);
    if (!projectId) return res.status(400).json({ message: 'project_id không hợp lệ!' });

    const title = typeof b.title === 'string' ? b.title.trim() : '';
    if (!title) return res.status(400).json({ message: 'Tiêu đề công việc không được để trống!' });
    if (title.length > 200) return res.status(400).json({ message: 'Tiêu đề tối đa 200 ký tự!' });

    const description = typeof b.description === 'string' && b.description.trim() ? b.description.trim() : null;
    const priority = b.priority || 'medium';
    if (!PRIORITIES.includes(priority)) {
        return res.status(400).json({ message: "priority chỉ nhận: low, medium, high, urgent!" });
    }
    const status = b.status || 'todo';
    if (!STATUSES.includes(status)) {
        return res.status(400).json({ message: 'status chỉ nhận: todo, in_progress, review, done!' });
    }
    const due = parseDueDate(b.due_date);
    if (due.error) return res.status(400).json({ message: 'due_date không hợp lệ (định dạng YYYY-MM-DD)!' });

    let assigneeId = null;
    if (b.assignee_id !== undefined && b.assignee_id !== null && b.assignee_id !== '') {
        assigneeId = parseId(b.assignee_id);
        if (!assigneeId) return res.status(400).json({ message: 'assignee_id không hợp lệ!' });
    }

    try {
        const role = await getRole(projectId, req.user.id);
        if (!role) return res.status(403).json({ message: 'Bạn không thuộc dự án này hoặc dự án không tồn tại!' });
        if (assigneeId && !(await getRole(projectId, assigneeId))) {
            return res.status(400).json({ message: 'Người được giao phải là thành viên của dự án!' });
        }

        const position = await nextPosition(projectId, status);
        const [result] = await db.query(
            `INSERT INTO tasks (project_id, title, description, status, priority, creator_id, assignee_id, due_date, position)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [projectId, title, description, status, priority, req.user.id, assigneeId, due.value ?? null, position]
        );
        if (assigneeId) {
            await notifyUsers({
                userIds: [assigneeId], actorId: req.user.id, type: 'task_assigned',
                message: `${await userName(req.user.id)} đã giao cho bạn task "${title}"`,
                projectId, taskId: result.insertId
            });
        }
        await broadcastProject(projectId, { action: 'task_created', task_id: result.insertId }, req.user.id);
        return res.status(201).json({ message: 'Tạo task thành công!', taskId: result.insertId });
    } catch (err) {
        return serverError(res, err);
    }
});

// 2.3 Kéo thả cập nhật trạng thái (PATCH /api/tasks/:id/status)
router.patch('/:id/status', async (req, res) => {
    const taskId = parseId(req.params.id);
    if (!taskId) return res.status(400).json({ message: 'ID task không hợp lệ!' });

    const status = (req.body || {}).status;
    if (!STATUSES.includes(status)) {
        return res.status(400).json({ message: 'status chỉ nhận: todo, in_progress, review, done!' });
    }

    try {
        const ctx = await getTaskContext(taskId, req.user.id);
        if (!ctx) return res.status(404).json({ message: 'Không tìm thấy task!' });
        if (!ctx.project_role) return res.status(403).json({ message: 'Bạn không thuộc dự án chứa task này!' });

        if (ctx.status !== status) {
            const position = await nextPosition(ctx.project_id, status);
            await db.query('UPDATE tasks SET status = ?, position = ? WHERE id = ?', [status, position, taskId]);
        }
        await announceStatus(ctx, status, req.user.id);
        return res.status(200).json({ message: 'Cập nhật trạng thái thành công!' });
    } catch (err) {
        return serverError(res, err);
    }
});

// 2.3b Kéo thả có thứ tự: đổi cột và/hoặc chèn vào trước task khác (PATCH /api/tasks/:id/move)
// Body: { "status": "review", "before_id": 7 }   (before_id = null -> xuống cuối cột)
router.patch('/:id/move', async (req, res) => {
    const taskId = parseId(req.params.id);
    if (!taskId) return res.status(400).json({ message: 'ID task không hợp lệ!' });

    const b = req.body || {};
    if (!STATUSES.includes(b.status)) {
        return res.status(400).json({ message: 'status chỉ nhận: todo, in_progress, review, done!' });
    }
    let beforeId = null;
    if (b.before_id !== undefined && b.before_id !== null && b.before_id !== '') {
        beforeId = parseId(b.before_id);
        if (!beforeId) return res.status(400).json({ message: 'before_id không hợp lệ!' });
    }

    let ctx;
    try {
        ctx = await getTaskContext(taskId, req.user.id);
        if (!ctx) return res.status(404).json({ message: 'Không tìm thấy task!' });
        if (!ctx.project_role) return res.status(403).json({ message: 'Bạn không thuộc dự án chứa task này!' });
    } catch (err) {
        return serverError(res, err);
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
            `SELECT id FROM tasks WHERE project_id = ? AND status = ? AND id <> ?
              ORDER BY position ASC, id ASC FOR UPDATE`,
            [ctx.project_id, b.status, taskId]
        );
        const ids = rows.map((r) => r.id);
        let idx = beforeId ? ids.indexOf(beforeId) : -1;
        if (idx < 0) idx = ids.length;           // không tìm thấy mốc -> cuối cột
        ids.splice(idx, 0, taskId);
        for (let i = 0; i < ids.length; i++) {
            if (ids[i] === taskId) {
                await conn.query('UPDATE tasks SET status = ?, position = ? WHERE id = ?', [b.status, i + 1, taskId]);
            } else {
                await conn.query('UPDATE tasks SET position = ? WHERE id = ?', [i + 1, ids[i]]);
            }
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        return serverError(res, err);
    } finally {
        conn.release();
    }

    try { await announceStatus(ctx, b.status, req.user.id); } catch (e) { console.error(e); }
    return res.status(200).json({ message: 'Đã sắp xếp lại task!' });
});

// 2.4 Cập nhật chi tiết công việc (PUT /api/tasks/:id) - chỉ cập nhật các trường được gửi
router.put('/:id', async (req, res) => {
    const taskId = parseId(req.params.id);
    if (!taskId) return res.status(400).json({ message: 'ID task không hợp lệ!' });
    const b = req.body || {};

    try {
        const ctx = await getTaskContext(taskId, req.user.id);
        if (!ctx) return res.status(404).json({ message: 'Không tìm thấy task!' });
        if (!ctx.project_role) return res.status(403).json({ message: 'Bạn không thuộc dự án chứa task này!' });

        const canEdit = MANAGER_ROLES.includes(ctx.project_role)
            || ctx.creator_id === req.user.id
            || ctx.assignee_id === req.user.id;
        if (!canEdit) {
            return res.status(403).json({ message: 'Bạn không có quyền sửa task này!' });
        }

        const sets = [];
        const vals = [];
        let newAssigneeId;

        if (b.title !== undefined) {
            const t = typeof b.title === 'string' ? b.title.trim() : '';
            if (!t || t.length > 200) return res.status(400).json({ message: 'Tiêu đề phải từ 1 đến 200 ký tự!' });
            sets.push('title = ?'); vals.push(t);
        }
        if (b.description !== undefined) {
            const d = typeof b.description === 'string' && b.description.trim() ? b.description.trim() : null;
            sets.push('description = ?'); vals.push(d);
        }
        if (b.priority !== undefined) {
            if (!PRIORITIES.includes(b.priority)) return res.status(400).json({ message: 'priority không hợp lệ!' });
            sets.push('priority = ?'); vals.push(b.priority);
        }
        if (b.status !== undefined) {
            if (!STATUSES.includes(b.status)) return res.status(400).json({ message: 'status không hợp lệ!' });
            sets.push('status = ?'); vals.push(b.status);
        }
        const due = parseDueDate(b.due_date);
        if (due.error) return res.status(400).json({ message: 'due_date không hợp lệ (định dạng YYYY-MM-DD)!' });
        if (!due.skip) { sets.push('due_date = ?'); vals.push(due.value); }

        if (b.assignee_id !== undefined) {
            if (b.assignee_id === null || b.assignee_id === '') {
                sets.push('assignee_id = ?'); vals.push(null);
            } else {
                const aid = parseId(b.assignee_id);
                if (!aid) return res.status(400).json({ message: 'assignee_id không hợp lệ!' });
                if (!(await getRole(ctx.project_id, aid))) {
                    return res.status(400).json({ message: 'Người được giao phải là thành viên của dự án!' });
                }
                sets.push('assignee_id = ?'); vals.push(aid); newAssigneeId = aid;
            }
        }

        if (sets.length === 0) return res.status(400).json({ message: 'Không có dữ liệu nào để cập nhật!' });

        await db.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, [...vals, taskId]);
        if (newAssigneeId && newAssigneeId !== ctx.assignee_id) {
            await notifyUsers({
                userIds: [newAssigneeId], actorId: req.user.id, type: 'task_assigned',
                message: `${await userName(req.user.id)} đã giao cho bạn task "${ctx.title}"`,
                projectId: ctx.project_id, taskId
            });
        }
        await broadcastProject(ctx.project_id, { action: 'task_changed', task_id: taskId }, req.user.id);
        return res.status(200).json({ message: 'Cập nhật công việc thành công!' });
    } catch (err) {
        return serverError(res, err);
    }
});

// 2.5 Xóa công việc (DELETE /api/tasks/:id)
router.delete('/:id', async (req, res) => {
    const taskId = parseId(req.params.id);
    if (!taskId) return res.status(400).json({ message: 'ID task không hợp lệ!' });

    try {
        const ctx = await getTaskContext(taskId, req.user.id);
        if (!ctx) return res.status(404).json({ message: 'Không tìm thấy task!' });
        if (!ctx.project_role) return res.status(403).json({ message: 'Bạn không thuộc dự án chứa task này!' });
        if (!MANAGER_ROLES.includes(ctx.project_role) && ctx.creator_id !== req.user.id) {
            return res.status(403).json({ message: 'Chỉ owner, leader hoặc người tạo task mới được xóa!' });
        }

        await db.query('DELETE FROM tasks WHERE id = ?', [taskId]);
        await broadcastProject(ctx.project_id, { action: 'task_deleted', task_id: taskId }, req.user.id);
        return res.status(200).json({ message: 'Xóa task thành công!' });
    } catch (err) {
        return serverError(res, err);
    }
});

module.exports = router;

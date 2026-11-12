const express = require('express');
const router = express.Router();
const pool = require('./db');
const verifyToken = require('./auth.middleware');
const { notifyUsers, push, userName } = require('./realtime');

// Mọi API dự án đều yêu cầu đăng nhập
router.use(verifyToken);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseId = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};

// Lấy vai trò của user trong dự án
//  undefined -> dự án không tồn tại | project_role = null -> không phải thành viên
const getProjectAccess = async (projectId, userId) => {
    const [rows] = await pool.query(
        `SELECT p.id, p.name, pm.project_role
           FROM projects p
           LEFT JOIN project_members pm
                  ON pm.project_id = p.id AND pm.user_id = ?
          WHERE p.id = ?`,
        [userId, projectId]
    );
    return rows[0];
};

// 3.1 Lấy danh sách dự án của tôi (GET /api/projects)
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT p.id, p.name, p.description, pm.project_role,
                    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
                    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count,
                    (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS member_count
               FROM project_members pm
               JOIN projects p ON p.id = pm.project_id
              WHERE pm.user_id = ?
              ORDER BY p.created_at DESC, p.id DESC`,
            [req.user.id]
        );
        return res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    }
});

// 3.2 Tạo dự án mới (POST /api/projects) - người tạo tự động là owner
router.post('/', async (req, res) => {
    const body = req.body || {}; // Express 5: req.body có thể là undefined
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : null;

    if (!name) return res.status(400).json({ message: 'Tên dự án không được để trống!' });
    if (name.length > 150) return res.status(400).json({ message: 'Tên dự án tối đa 150 ký tự!' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query(
            'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
            [name, description || null, req.user.id]
        );
        const projectId = result.insertId;
        await conn.query(
            "INSERT INTO project_members (project_id, user_id, project_role) VALUES (?, ?, 'owner')",
            [projectId, req.user.id]
        );
        await conn.commit();
        return res.status(201).json({ message: 'Tạo dự án thành công!', projectId });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    } finally {
        conn.release();
    }
});

// 3.3 Thêm thành viên vào dự án (POST /api/projects/:projectId/members)
router.post('/:projectId/members', async (req, res) => {
    const projectId = parseId(req.params.projectId);
    if (!projectId) return res.status(400).json({ message: 'projectId không hợp lệ!' });

    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const projectRole = body.project_role || 'member';

    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Email không hợp lệ!' });
    if (!['leader', 'member'].includes(projectRole)) {
        return res.status(400).json({ message: "project_role chỉ nhận 'leader' hoặc 'member'!" });
    }

    try {
        const access = await getProjectAccess(projectId, req.user.id);
        if (!access) return res.status(404).json({ message: 'Không tìm thấy dự án!' });

        const myRole = access.project_role;
        if (!['owner', 'leader'].includes(myRole)) {
            return res.status(403).json({ message: 'Chỉ owner hoặc leader mới được thêm thành viên!' });
        }
        if (projectRole === 'leader' && myRole !== 'owner') {
            return res.status(403).json({ message: 'Chỉ owner mới được thêm leader!' });
        }

        const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng với email này!' });
        }

        await pool.query(
            'INSERT INTO project_members (project_id, user_id, project_role) VALUES (?, ?, ?)',
            [projectId, users[0].id, projectRole]
        );
        await notifyUsers({
            userIds: [users[0].id], actorId: req.user.id, type: 'project_added',
            message: `${await userName(req.user.id)} đã thêm bạn vào dự án "${access.name}"`,
            projectId
        });
        return res.status(200).json({ message: 'Đã thêm thành viên vào dự án!' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Người dùng đã là thành viên của dự án!' });
        }
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    }
});

// 3.4 Lấy danh sách thành viên (GET /api/projects/:projectId/members)
router.get('/:projectId/members', async (req, res) => {
    const projectId = parseId(req.params.projectId);
    if (!projectId) return res.status(400).json({ message: 'projectId không hợp lệ!' });

    try {
        const access = await getProjectAccess(projectId, req.user.id);
        if (!access) return res.status(404).json({ message: 'Không tìm thấy dự án!' });
        if (!access.project_role) {
            return res.status(403).json({ message: 'Bạn không thuộc dự án này!' });
        }

        const [rows] = await pool.query(
            `SELECT u.id, u.full_name, u.email, u.avatar_url, pm.project_role
               FROM project_members pm
               JOIN users u ON u.id = pm.user_id
              WHERE pm.project_id = ?
              ORDER BY FIELD(pm.project_role, 'owner', 'leader', 'member'), pm.joined_at ASC`,
            [projectId]
        );
        return res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    }
});

// 2.1 Lấy danh sách task theo dự án - hiển thị Kanban (GET /api/projects/:projectId/tasks)
router.get('/:projectId/tasks', async (req, res) => {
    const projectId = parseId(req.params.projectId);
    if (!projectId) return res.status(400).json({ message: 'projectId không hợp lệ!' });

    try {
        const access = await getProjectAccess(projectId, req.user.id);
        if (!access) return res.status(404).json({ message: 'Không tìm thấy dự án!' });
        if (!access.project_role) {
            return res.status(403).json({ message: 'Bạn không thuộc dự án này!' });
        }

        const [rows] = await pool.query(
            `SELECT t.id, t.project_id, t.title, t.description, t.status, t.priority,
                    t.creator_id, cu.full_name AS creator_name,
                    t.assignee_id, au.full_name AS assignee_name, au.avatar_url AS assignee_avatar,
                    DATE_FORMAT(t.due_date, '%Y-%m-%dT%H:%i:%s') AS due_date,
                    DATE_FORMAT(t.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
                    (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count
               FROM tasks t
               JOIN users cu ON cu.id = t.creator_id
               LEFT JOIN users au ON au.id = t.assignee_id
              WHERE t.project_id = ?
              ORDER BY t.position ASC, t.id ASC`,
            [projectId]
        );
        return res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    }
});

// 3.5 Xóa dự án (DELETE /api/projects/:projectId) - chỉ owner
// Task, bình luận, thành viên bị xóa theo (ON DELETE CASCADE); thông báo cũ của dự án cũng được dọn.
router.delete('/:projectId', async (req, res) => {
    const projectId = parseId(req.params.projectId);
    if (!projectId) return res.status(400).json({ message: 'projectId không hợp lệ!' });

    let conn;
    try {
        const access = await getProjectAccess(projectId, req.user.id);
        if (!access) return res.status(404).json({ message: 'Không tìm thấy dự án!' });
        if (access.project_role !== 'owner') {
            return res.status(403).json({ message: 'Chỉ chủ dự án (owner) mới được xóa dự án!' });
        }

        // Lấy danh sách thành viên TRƯỚC khi xóa để còn báo cho họ
        const [members] = await pool.query('SELECT user_id FROM project_members WHERE project_id = ?', [projectId]);
        const memberIds = members.map((m) => m.user_id);

        conn = await pool.getConnection();
        await conn.beginTransaction();
        // Xóa tường minh theo thứ tự con -> cha: vẫn chạy đúng cả khi CSDL cũ thiếu ON DELETE CASCADE
        await conn.query('DELETE FROM comments WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)', [projectId]);
        await conn.query('DELETE FROM tasks WHERE project_id = ?', [projectId]);
        await conn.query('DELETE FROM project_members WHERE project_id = ?', [projectId]);
        await conn.query('DELETE FROM notifications WHERE project_id = ?', [projectId]); // tránh thông báo trỏ vào dự án đã mất
        await conn.query('DELETE FROM projects WHERE id = ?', [projectId]);
        await conn.commit();

        // Báo cho các thành viên khác: bảng đang mở sẽ tự thoát, thông báo không gắn project_id (dự án không còn)
        for (const uid of memberIds) {
            if (uid !== req.user.id) {
                push(uid, 'project_update', { project_id: projectId, action: 'project_deleted' });
            }
        }
        await notifyUsers({
            userIds: memberIds, actorId: req.user.id, type: 'project_deleted',
            message: `${await userName(req.user.id)} đã xóa dự án "${access.name}"`
        });
        return res.status(200).json({ message: 'Đã xóa dự án!' });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch (e) { /* bỏ qua */ } }
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;

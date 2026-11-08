// Mount tại: app.use('/api/tasks/:taskId/comments', commentRoutes)
const express = require('express');
const router = express.Router({ mergeParams: true }); // để đọc được :taskId
const pool = require('./db');
const verifyToken = require('./auth.middleware');

router.use(verifyToken);

const MAX_CONTENT = 2000;

const parseId = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};

// Task phải tồn tại và user phải thuộc dự án chứa task đó
const checkTaskAccess = async (taskId, userId) => {
    const [rows] = await pool.query(
        `SELECT t.id, pm.project_role
           FROM tasks t
           LEFT JOIN project_members pm
                  ON pm.project_id = t.project_id AND pm.user_id = ?
          WHERE t.id = ?`,
        [userId, taskId]
    );
    if (rows.length === 0) return { error: { status: 404, message: 'Không tìm thấy task!' } };
    if (!rows[0].project_role) {
        return { error: { status: 403, message: 'Bạn không thuộc dự án chứa task này!' } };
    }
    return { ok: true };
};

// 4.1 Lấy danh sách bình luận của 1 task (GET /api/tasks/:taskId/comments)
router.get('/', async (req, res) => {
    const taskId = parseId(req.params.taskId);
    if (!taskId) return res.status(400).json({ message: 'taskId không hợp lệ!' });

    try {
        const { error } = await checkTaskAccess(taskId, req.user.id);
        if (error) return res.status(error.status).json({ message: error.message });

        const [rows] = await pool.query(
            `SELECT c.id,
                    c.user_id,
                    u.full_name AS user_name,
                    u.avatar_url,
                    c.content,
                    DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
               FROM comments c
               JOIN users u ON u.id = c.user_id
              WHERE c.task_id = ?
              ORDER BY c.created_at ASC, c.id ASC`,
            [taskId]
        );
        return res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    }
});

// 4.2 Thêm bình luận vào task (POST /api/tasks/:taskId/comments)
router.post('/', async (req, res) => {
    const taskId = parseId(req.params.taskId);
    if (!taskId) return res.status(400).json({ message: 'taskId không hợp lệ!' });

    const body = req.body || {};
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return res.status(400).json({ message: 'Nội dung bình luận không được để trống!' });
    if (content.length > MAX_CONTENT) {
        return res.status(400).json({ message: `Bình luận tối đa ${MAX_CONTENT} ký tự!` });
    }

    try {
        const { error } = await checkTaskAccess(taskId, req.user.id);
        if (error) return res.status(error.status).json({ message: error.message });

        const [result] = await pool.query(
            'INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)',
            [taskId, req.user.id, content]
        );
        return res.status(201).json({ message: 'Thêm bình luận thành công!', commentId: result.insertId });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    }
});

module.exports = router;

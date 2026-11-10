// Bảng điều khiển (Dashboard): thống kê tổng hợp trên mọi dự án mà user tham gia
const express = require('express');
const router = express.Router();
const db = require('./db');
const verifyToken = require('./auth.middleware');

router.use(verifyToken);

// GET /api/dashboard
router.get('/', async (req, res) => {
    const uid = req.user.id;
    try {
        const [sumRows] = await db.query(
            `SELECT COUNT(*) AS total,
                    COALESCE(SUM(t.status = 'todo'), 0) AS todo,
                    COALESCE(SUM(t.status = 'in_progress'), 0) AS in_progress,
                    COALESCE(SUM(t.status = 'review'), 0) AS review,
                    COALESCE(SUM(t.status = 'done'), 0) AS done,
                    COALESCE(SUM(t.status <> 'done' AND t.due_date IS NOT NULL AND t.due_date < NOW()), 0) AS overdue,
                    COALESCE(SUM(t.assignee_id = ?), 0) AS assigned_to_me
               FROM tasks t
               JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?`,
            [uid, uid]
        );
        const [projRows] = await db.query(
            'SELECT COUNT(*) AS projects FROM project_members WHERE user_id = ?',
            [uid]
        );
        const [upcoming] = await db.query(
            `SELECT t.id, t.title, t.status, t.priority, t.project_id, p.name AS project_name,
                    DATE_FORMAT(t.due_date, '%Y-%m-%dT%H:%i:%s') AS due_date
               FROM tasks t
               JOIN projects p ON p.id = t.project_id
               JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
              WHERE t.assignee_id = ? AND t.status <> 'done'
              ORDER BY t.due_date IS NULL, t.due_date ASC, t.id DESC
              LIMIT 8`,
            [uid, uid]
        );

        const s = sumRows[0] || {};
        const n = (v) => Number(v || 0);
        return res.status(200).json({
            projects: n(projRows[0] && projRows[0].projects),
            total: n(s.total),
            by_status: { todo: n(s.todo), in_progress: n(s.in_progress), review: n(s.review), done: n(s.done) },
            overdue: n(s.overdue),
            assigned_to_me: n(s.assigned_to_me),
            upcoming
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    }
});

module.exports = router;

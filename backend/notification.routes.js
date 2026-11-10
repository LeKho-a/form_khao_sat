const express = require('express');
const router = express.Router();
const db = require('./db');
const verifyToken = require('./auth.middleware');
const { addClient, removeClient } = require('./realtime');

router.use(verifyToken);

const parseId = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

// GET /api/notifications/stream - kênh SSE thời gian thực (client gửi token qua header Authorization)
router.get('/stream', (req, res) => {
    const uid = req.user.id;
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.write('retry: 5000\n\n');
    res.write('event: ready\ndata: {}\n\n');
    addClient(uid, res);
    const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { /* đóng */ } }, 25000);
    // Dùng res 'close' (kết nối thật sự đóng); req 'close' có thể bắn ngay khi request kết thúc ở Node mới
    res.on('close', () => { clearInterval(heartbeat); removeClient(uid, res); });
});

// GET /api/notifications - 30 thông báo mới nhất + số chưa đọc
router.get('/', async (req, res) => {
    try {
        const [items] = await db.query(
            `SELECT id, type, message, project_id, task_id, is_read,
                    DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
               FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30`,
            [req.user.id]
        );
        const [cnt] = await db.query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
        return res.status(200).json({ unread: Number(cnt[0].n || 0), items });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    }
});

// PATCH /api/notifications/read-all  (đặt TRƯỚC /:id/read)
router.patch('/read-all', async (req, res) => {
    try {
        await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
        return res.status(200).json({ message: 'Đã đánh dấu đọc tất cả!' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID không hợp lệ!' });
    try {
        await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.user.id]);
        return res.status(200).json({ message: 'Đã đánh dấu đã đọc!' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    }
});

module.exports = router;

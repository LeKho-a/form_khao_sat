// Quên mật khẩu / đặt lại mật khẩu (mount thêm tại /api/auth, không sửa file của Hiếu)
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('./db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const GENERIC = 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.';

// Giới hạn tần suất (trong bộ nhớ): tối đa 5 lần/15 phút cho mỗi cặp IP+email, 20 lần cho mỗi IP
const hits = new Map();
function limited(key, max) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
    if (arr.length >= max) { hits.set(key, arr); return true; }
    arr.push(now); hits.set(key, arr);
    return false;
}

// Gửi email nếu đã cấu hình SMTP và cài nodemailer (tùy chọn): npm i nodemailer
async function sendResetEmail(to, link) {
    if (!process.env.SMTP_HOST) return false;
    let nodemailer;
    try { nodemailer = require('nodemailer'); } catch (e) {
        console.warn('[password] Chưa cài nodemailer -> chạy: npm i nodemailer');
        return false;
    }
    const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
    await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: 'Đặt lại mật khẩu - Task Manager',
        text: `Bạn vừa yêu cầu đặt lại mật khẩu.\nNhấp vào liên kết sau (hiệu lực 1 giờ):\n${link}\n\nNếu không phải bạn, hãy bỏ qua email này.`
    });
    return true;
}

// POST /api/auth/forgot-password  { email }
router.post('/forgot-password', async (req, res) => {
    const email = typeof (req.body || {}).email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Email không hợp lệ!' });

    if (limited(`ip:${req.ip}`, 20) || limited(`ip:${req.ip}|${email}`, 5)) {
        return res.status(429).json({ message: 'Bạn thử quá nhiều lần, vui lòng đợi 15 phút rồi thử lại!' });
    }

    try {
        const out = { message: GENERIC };
        const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length) {
            const token = crypto.randomBytes(32).toString('hex');
            await db.query('DELETE FROM password_resets WHERE user_id = ? AND used = 0', [users[0].id]);
            await db.query(
                'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))',
                [users[0].id, sha256(token)]
            );
            const base = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
            const link = `${base}/reset.html?token=${token}`;
            let sent = false;
            try { sent = await sendResetEmail(email, link); } catch (e) { console.error('[password] gửi mail lỗi:', e.message); }
            if (!sent) console.log(`[password] Liên kết đặt lại cho ${email}: ${link}`);
            // Chế độ DEMO (chưa có SMTP): trả liên kết về để dùng thử. TẮT khi chạy thật.
            if (process.env.RESET_SHOW_LINK === 'true') out.dev_reset_link = link;
        }
        return res.status(200).json(out); // luôn trả cùng một thông điệp -> không lộ email nào tồn tại
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    }
});

// POST /api/auth/reset-password  { token, password }
router.post('/reset-password', async (req, res) => {
    const b = req.body || {};
    const token = typeof b.token === 'string' ? b.token.trim() : '';
    const password = typeof b.password === 'string' ? b.password : '';
    if (!token) return res.status(400).json({ message: 'Thiếu mã đặt lại mật khẩu!' });
    if (password.length < 6 || password.length > 72) {
        return res.status(400).json({ message: 'Mật khẩu phải từ 6 đến 72 ký tự!' });
    }

    try {
        const [rows] = await db.query(
            'SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > NOW()',
            [sha256(token)]
        );
        if (!rows.length) {
            return res.status(400).json({ message: 'Liên kết đặt lại không hợp lệ hoặc đã hết hạn!' });
        }
        const hash = await bcrypt.hash(password, 10);
        await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, rows[0].user_id]);
        await db.query('UPDATE password_resets SET used = 1 WHERE user_id = ?', [rows[0].user_id]);
        return res.status(200).json({ message: 'Đặt lại mật khẩu thành công! Hãy đăng nhập bằng mật khẩu mới.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
    }
});

module.exports = router;

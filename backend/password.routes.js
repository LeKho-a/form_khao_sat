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

// ---------- Gửi email đặt lại mật khẩu ----------
// Ưu tiên 1: Brevo qua HTTPS (BREVO_API_KEY)  - dùng được trên Render miễn phí (không bị chặn cổng SMTP)
// Ưu tiên 2: SMTP qua nodemailer (SMTP_HOST...) - ví dụ Gmail + Mật khẩu ứng dụng
const escHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SUBJECT = 'Đặt lại mật khẩu - Task Manager';

function buildMail(link) {
    const text = `Bạn vừa yêu cầu đặt lại mật khẩu Task Manager.\nNhấp vào liên kết sau (hiệu lực 1 giờ, chỉ dùng được 1 lần):\n${link}\n\nNếu không phải bạn, hãy bỏ qua email này - mật khẩu hiện tại vẫn an toàn.`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#161b2e">
  <h2 style="margin:0 0 12px">Đặt lại mật khẩu</h2>
  <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản <b>Task Manager</b>. Bấm nút bên dưới để chọn mật khẩu mới (liên kết có hiệu lực <b>1 giờ</b> và chỉ dùng được 1 lần).</p>
  <p style="margin:24px 0"><a href="${escHtml(link)}" style="background:#4040f0;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block">Đặt lại mật khẩu</a></p>
  <p style="font-size:13px;color:#5b657b">Nếu nút không bấm được, hãy dán liên kết này vào trình duyệt:<br><a href="${escHtml(link)}">${escHtml(link)}</a></p>
  <p style="font-size:13px;color:#5b657b">Nếu không phải bạn yêu cầu, hãy bỏ qua email này - mật khẩu hiện tại vẫn an toàn.</p>
</div>`;
    return { text, html };
}

async function sendViaBrevo(to, mail) {
    const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
    if (!fromEmail) throw new Error('Thiếu MAIL_FROM_EMAIL (email người gửi đã xác minh trên Brevo)');
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
            sender: { name: process.env.MAIL_FROM_NAME || 'Task Manager', email: fromEmail },
            to: [{ email: to }], subject: SUBJECT, htmlContent: mail.html, textContent: mail.text
        })
    });
    if (!res.ok) throw new Error(`Brevo trả lỗi ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return true;
}

async function sendViaSmtp(to, mail) {
    let nodemailer;
    try { nodemailer = require('nodemailer'); } catch (e) {
        throw new Error('Chưa cài nodemailer -> chạy "npm install" trong thư mục backend');
    }
    const port = Number(process.env.SMTP_PORT) || 587;
    const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: String(process.env.SMTP_PASS || '').replace(/\s+/g, '') } : undefined, // Gmail hiển thị mật khẩu ứng dụng có dấu cách
        connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000
    });
    await transport.sendMail({
        from: process.env.SMTP_FROM || `"${process.env.MAIL_FROM_NAME || 'Task Manager'}" <${process.env.SMTP_USER}>`,
        to, subject: SUBJECT, text: mail.text, html: mail.html
    });
    return true;
}

// Trả về true nếu đã gửi; false nếu chưa cấu hình dịch vụ email. Ném lỗi nếu cấu hình nhưng gửi thất bại.
async function sendResetEmail(to, link) {
    const mail = buildMail(link);
    if (process.env.BREVO_API_KEY) return sendViaBrevo(to, mail);
    if (process.env.SMTP_HOST) return sendViaSmtp(to, mail);
    return false;
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
            try {
                sent = await sendResetEmail(email, link);
                if (sent) console.log(`[password] Đã gửi email đặt lại mật khẩu tới ${email}`);
            } catch (e) { console.error(`[password] GỬI EMAIL THẤT BẠI tới ${email}:`, e.message); }
            if (!sent) console.log(`[password] (chưa gửi được email) Liên kết đặt lại cho ${email}: ${link}`);
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

if (!process.env.BREVO_API_KEY && !process.env.SMTP_HOST) {
    console.warn('[password] Chưa cấu hình gửi email (SMTP_HOST hoặc BREVO_API_KEY trong .env) -> quên mật khẩu sẽ KHÔNG gửi thư, chỉ in liên kết ra console.');
}

module.exports = router;
module.exports.sendResetEmail = sendResetEmail; // dùng cho "npm run test-mail"


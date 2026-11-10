// Hồ sơ cá nhân: xem/sửa tên, đổi mật khẩu, tải ảnh đại diện (không cần multer: ảnh gửi dạng base64)
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('./db');
const verifyToken = require('./auth.middleware');

router.use(verifyToken);

const AVATAR_DIR = path.join(__dirname, 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });
const MAX_AVATAR = 2 * 1024 * 1024; // 2MB

const serverError = (res, err) => {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
};

const getUser = async (id) => {
    const [rows] = await db.query(
        `SELECT id, full_name, email, avatar_url, role,
                DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
           FROM users WHERE id = ?`, [id]);
    return rows[0];
};

// Nhận dạng định dạng ảnh bằng "chữ ký" đầu file, không tin vào phần khai báo của client
function sniffImage(buf) {
    if (buf.length > 12 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
    if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
    if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
    return null;
}

const removeOldFile = (url) => {
    if (typeof url === 'string' && url.startsWith('/uploads/avatars/')) {
        fs.unlink(path.join(AVATAR_DIR, path.basename(url)), () => {});
    }
};

// GET /api/users/me
router.get('/me', async (req, res) => {
    try {
        const u = await getUser(req.user.id);
        if (!u) return res.status(404).json({ message: 'Không tìm thấy người dùng!' });
        return res.status(200).json(u);
    } catch (err) { return serverError(res, err); }
});

// PUT /api/users/me  { full_name }
router.put('/me', async (req, res) => {
    const name = typeof (req.body || {}).full_name === 'string' ? req.body.full_name.trim() : '';
    if (!name || name.length > 100) return res.status(400).json({ message: 'Họ tên phải từ 1 đến 100 ký tự!' });
    try {
        await db.query('UPDATE users SET full_name = ? WHERE id = ?', [name, req.user.id]);
        return res.status(200).json({ message: 'Cập nhật hồ sơ thành công!', user: await getUser(req.user.id) });
    } catch (err) { return serverError(res, err); }
});

// PUT /api/users/me/password  { current_password, new_password }
router.put('/me/password', async (req, res) => {
    const b = req.body || {};
    const cur = typeof b.current_password === 'string' ? b.current_password : '';
    const next = typeof b.new_password === 'string' ? b.new_password : '';
    if (!cur) return res.status(400).json({ message: 'Vui lòng nhập mật khẩu hiện tại!' });
    if (next.length < 6 || next.length > 72) return res.status(400).json({ message: 'Mật khẩu mới phải từ 6 đến 72 ký tự!' });
    try {
        const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy người dùng!' });
        if (!(await bcrypt.compare(cur, rows[0].password_hash))) {
            return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng!' });
        }
        await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(next, 10), req.user.id]);
        return res.status(200).json({ message: 'Đổi mật khẩu thành công!' });
    } catch (err) { return serverError(res, err); }
});

// POST /api/users/me/avatar  { image: "data:image/png;base64,...." }  (png | jpeg | webp, tối đa 2MB)
router.post('/me/avatar', async (req, res) => {
    const image = (req.body || {}).image;
    const m = typeof image === 'string' && image.match(/^data:image\/(png|jpeg|webp);base64,/);
    if (!m) return res.status(400).json({ message: 'Ảnh phải là PNG, JPEG hoặc WEBP (dạng base64)!' });

    const b64 = image.slice(m[0].length);
    if (b64.length > Math.ceil(MAX_AVATAR * 4 / 3) + 8) return res.status(400).json({ message: 'Ảnh quá lớn (tối đa 2MB)!' });
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length || buf.length > MAX_AVATAR) return res.status(400).json({ message: 'Ảnh quá lớn hoặc rỗng (tối đa 2MB)!' });
    const real = sniffImage(buf);
    if (!real || real !== m[1]) return res.status(400).json({ message: 'File không phải ảnh hợp lệ!' });

    try {
        const old = (await getUser(req.user.id) || {}).avatar_url;
        const file = `${req.user.id}-${crypto.randomBytes(6).toString('hex')}.${real === 'jpeg' ? 'jpg' : real}`;
        await fs.promises.writeFile(path.join(AVATAR_DIR, file), buf);
        const url = `/uploads/avatars/${file}`;
        await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [url, req.user.id]);
        removeOldFile(old);
        return res.status(200).json({ message: 'Cập nhật ảnh đại diện thành công!', avatar_url: url });
    } catch (err) { return serverError(res, err); }
});

// DELETE /api/users/me/avatar
router.delete('/me/avatar', async (req, res) => {
    try {
        const old = (await getUser(req.user.id) || {}).avatar_url;
        await db.query('UPDATE users SET avatar_url = NULL WHERE id = ?', [req.user.id]);
        removeOldFile(old);
        return res.status(200).json({ message: 'Đã xóa ảnh đại diện!' });
    } catch (err) { return serverError(res, err); }
});

module.exports = router;

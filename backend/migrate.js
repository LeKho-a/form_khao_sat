// Tự nâng cấp CSDL khi khởi động server (chạy lặp lại nhiều lần vẫn an toàn),
// nên bạn KHÔNG phải import lại database.sql nếu đã có dữ liệu.
const pool = require('./db');

async function ensureSchema() {
    // 1. Thứ tự task trong cột Kanban
    const [cols] = await pool.query("SHOW COLUMNS FROM tasks LIKE 'position'");
    if (cols.length === 0) {
        await pool.query('ALTER TABLE tasks ADD COLUMN position INT NOT NULL DEFAULT 0');
        await pool.query('UPDATE tasks SET position = id');
    }

    // 2. Thông báo
    await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type VARCHAR(30) NOT NULL,
        message VARCHAR(300) NOT NULL,
        project_id INT NULL,
        task_id INT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_read (user_id, is_read),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // 3. Mã đặt lại mật khẩu (chỉ lưu bản băm SHA-256 của token)
    await pool.query(`CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        used TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (token_hash),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
}

module.exports = { ensureSchema };

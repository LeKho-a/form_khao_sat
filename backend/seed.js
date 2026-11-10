// Nạp dữ liệu mẫu CHUẨN (mật khẩu bcrypt thật = 123456) cho cả nhóm.
// Chạy sau khi đã import database.sql:   npm run seed
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcrypt');
const pool = require('./db');

const PASSWORD = '123456';
// LƯU Ý: email của 5 thành viên sau là SUY RA theo mẫu bach@uth.edu.vn -> sửa lại cho đúng nếu cần
const USERS = [
    ['Nguyễn Trung Hiếu', 'hieu.lead@uth.edu.vn', 'admin'],
    ['Frontend Dev 1', 'fe1@uth.edu.vn', 'user'],
    ['Backend Dev 1', 'be1@uth.edu.vn', 'user'],
    ['Nguyễn Thế Hoàng Bách', 'bach@uth.edu.vn', 'user'],
    ['Huỳnh Võ Minh Khoa', 'minhkhoa@uth.edu.vn', 'user'],
    ['Trần Quốc Bảo', 'bao@uth.edu.vn', 'user'],
    ['Lê Đăng Khoa', 'dangkhoa@uth.edu.vn', 'user'],
    ['Nguyễn Trọng Kim', 'kim@uth.edu.vn', 'user']
];

(async () => {
    try {
        const hash = await bcrypt.hash(PASSWORD, 10);

        for (const [name, email, role] of USERS) {
            await pool.query(
                `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
                [name, email, hash, role]
            );
        }

        // Dự án mẫu id=1: thêm toàn bộ thành viên (bỏ qua nếu đã có)
        const [projects] = await pool.query('SELECT id FROM projects WHERE id = 1');
        if (projects.length) {
            await pool.query(
                `INSERT IGNORE INTO project_members (project_id, user_id, project_role)
                 SELECT 1, id, 'member' FROM users WHERE email IN (?)`,
                [USERS.map((u) => u[1])]
            );

            // Thêm vài task mẫu nếu board còn ít task, để giao diện Kanban có dữ liệu
            const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM tasks WHERE project_id = 1');
            if (n < 6) {
                const uid = async (email) => (await pool.query('SELECT id FROM users WHERE email = ?', [email]))[0][0].id;
                const [hieu, bach, khoa, bao] = await Promise.all([
                    uid('hieu.lead@uth.edu.vn'), uid('bach@uth.edu.vn'), uid('minhkhoa@uth.edu.vn'), uid('bao@uth.edu.vn')
                ]);
                await pool.query(
                    `INSERT INTO tasks (project_id, title, description, status, priority, creator_id, assignee_id, due_date) VALUES
                     (1, 'Làm form thêm/sửa/xóa task', 'Có đủ deadline, priority, người được giao', 'todo', 'medium', ?, ?, '2026-11-25 23:59:59'),
                     (1, 'Viết kịch bản kiểm thử (Test Cases)', 'Bao phủ Auth, Project, Task, Comment', 'review', 'high', ?, ?, '2026-11-20 23:59:59'),
                     (1, 'Thiết kế Wireframe trên Figma', 'Dashboard + Kanban + Form', 'done', 'low', ?, ?, '2026-11-08 23:59:59')`,
                    [hieu, khoa, hieu, bao, hieu, bach]
                );
            }
        }

        console.log('Seed xong! Đăng nhập bằng bất kỳ email nào trong danh sách, mật khẩu: ' + PASSWORD);
        USERS.forEach((u) => console.log(' - ' + u[1]));
        process.exit(0);
    } catch (err) {
        console.error('Seed lỗi:', err.message);
        process.exit(1);
    }
})();

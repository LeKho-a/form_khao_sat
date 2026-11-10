const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { ensureSchema } = require('./migrate');
const authRoutes = require('./auth.routes');
const passwordRoutes = require('./password.routes');
const userRoutes = require('./user.routes');
const notificationRoutes = require('./notification.routes');
const taskRoutes = require('./task.routes');
const projectRoutes = require('./project.routes');
const commentRoutes = require('./comment.routes');
const dashboardRoutes = require('./dashboard.routes');
const authenticateToken = require('./auth.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Cấu hình Middleware
app.use(cors());
app.use('/api/users/me/avatar', express.json({ limit: '3mb' })); // ảnh base64 lớn: parser riêng, đặt TRƯỚC parser mặc định
app.use(express.json());

// Nạp đầy đủ các module API
app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordRoutes);                    // quên / đặt lại mật khẩu
app.use('/api/users', userRoutes);                       // hồ sơ + ảnh đại diện
app.use('/api/notifications', notificationRoutes);       // thông báo + kênh SSE thời gian thực
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks/:taskId/comments', commentRoutes);   // Bình luận lồng theo task (đặt TRƯỚC /api/tasks)
app.use('/api/tasks', taskRoutes);

// Route kiểm tra kết nối server
app.get('/api/health', (req, res) => {
    res.json({ message: 'Máy chủ Backend Task Management đang chạy bình thường!' });
});

// Route mẫu kiểm tra token bảo mật
app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({
        message: 'Bạn đã truy cập thành công vào route bảo mật!',
        user: req.user
    });
});

// API không tồn tại -> trả JSON 404 (không rơi vào trang HTML)
app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Không tìm thấy API này!' });
});

// Ảnh đại diện đã tải lên
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
}));

// Phục vụ giao diện Frontend (thư mục /frontend) cùng cổng với API -> không lo CORS
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Bắt lỗi chung
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Dữ liệu JSON gửi lên không hợp lệ!' });
    }
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ message: 'Dữ liệu gửi lên quá lớn!' });
    }
    console.error(err);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
});

// Nâng cấp CSDL (nếu cần) rồi mới khởi chạy server
ensureSchema()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server dang chay tai: http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Không thể khởi tạo CSDL. Kiểm tra MySQL và file .env:', err.message);
        process.exit(1);
    });

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./auth.routes');
const taskRoutes = require('./task.routes');
const projectRoutes = require('./project.routes');
const commentRoutes = require('./comment.routes');
const dashboardRoutes = require('./dashboard.routes');
const authenticateToken = require('./auth.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Cấu hình Middleware
app.use(cors());
app.use(express.json());

// Nạp đầy đủ các module API
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks/:taskId/comments', commentRoutes); // Bình luận lồng theo task (đặt TRƯỚC /api/tasks)
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

// Phục vụ giao diện Frontend (thư mục /frontend) cùng cổng với API -> không lo CORS
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Bắt lỗi chung (ví dụ JSON gửi lên bị sai cú pháp)
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Dữ liệu JSON gửi lên không hợp lệ!' });
    }
    console.error(err);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ!' });
});

// Khởi chạy server
app.listen(PORT, () => {
    console.log(`Server dang chay tai: http://localhost:${PORT}`);
});

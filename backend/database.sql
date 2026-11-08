-- =====================================================
-- ĐỒ ÁN: WEBSITE QUẢN LÝ TÁC VỤ (TASK MANAGEMENT)
-- Nhóm: 06 | Trường Đại học Giao thông Vận tải TP.HCM (UTH)
-- Phụ trách thiết kế CSDL: Nguyễn Trung Hiếu
-- Hệ quản trị CSDL: MySQL / MariaDB
-- =====================================================

-- 1. Khởi tạo cơ sở dữ liệu
CREATE DATABASE IF NOT EXISTS task_management_db
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE task_management_db;

-- 2. Bảng Users (Quản lý tài khoản & phân quyền hệ thống)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255) NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Projects (Quản lý các không gian làm việc/dự án)
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    owner_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Bảng Project Members (Thành viên & phân quyền trong từng dự án)
CREATE TABLE IF NOT EXISTS project_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    user_id INT NOT NULL,
    project_role ENUM('owner', 'leader', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_member (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Bảng Tasks (Các công việc/thẻ Kanban)
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    status ENUM('todo', 'in_progress', 'review', 'done') DEFAULT 'todo',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    creator_id INT NOT NULL,
    assignee_id INT NULL,
    due_date DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 6. Bảng Comments (Bình luận trao đổi dưới từng task)
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- 7. Dữ liệu mẫu ban đầu (Mock Data) để kiểm thử
-- Mật khẩu mặc định của các tài khoản: 123456 (đã hash bcrypt)
-- =====================================================

INSERT INTO users (full_name, email, password_hash, role) VALUES
('Nguyễn Trung Hiếu', 'hieu.lead@uth.edu.vn', '$2b$10$wT5aV3n8i9f4yN8N3eW4g.i8lJqQkM1jK8F3yM4aU9O7xV5fB7y7C', 'admin'),
('Frontend Dev 1', 'fe1@uth.edu.vn', '$2b$10$wT5aV3n8i9f4yN8N3eW4g.i8lJqQkM1jK8F3yM4aU9O7xV5fB7y7C', 'user'),
('Backend Dev 1', 'be1@uth.edu.vn', '$2b$10$wT5aV3n8i9f4yN8N3eW4g.i8lJqQkM1jK8F3yM4aU9O7xV5fB7y7C', 'user');

INSERT INTO projects (name, description, owner_id) VALUES
('Dự án Quản lý tác vụ Nhóm 6', 'Xây dựng website Kanban Board và phân quyền người dùng', 1);

INSERT INTO project_members (project_id, user_id, project_role) VALUES
(1, 1, 'owner'),
(1, 2, 'member'),
(1, 3, 'member');

INSERT INTO tasks (project_id, title, description, status, priority, creator_id, assignee_id, due_date) VALUES
(1, 'Thiết kế Database Schema', 'Tạo các bảng users, projects, tasks, comments', 'done', 'high', 1, 1, '2026-11-10 23:59:59'),
(1, 'Dựng giao diện bảng Kanban', 'Thiết kế 4 cột To Do, In Progress, Review, Done bằng HTML/CSS/JS', 'in_progress', 'high', 1, 2, '2026-11-15 23:59:59'),
(1, 'Viết API CRUD Tasks', 'Xây dựng các endpoint lấy danh sách và cập nhật trạng thái task', 'todo', 'urgent', 1, 3, '2026-11-16 23:59:59');

INSERT INTO comments (task_id, user_id, content) VALUES
(1, 1, 'Đã hoàn thành cấu trúc database.sql cho toàn bộ dự án.'),
(2, 2, 'Đang tiến hành dựng khung CSS Dark Mode cho các cột task.');

# BẢNG ĐẶC TẢ API (API CONTRACT) - WEBSITE QUẢN LÝ TÁC VỤ
> Dự án: Website Quản lý tác vụ (Task Management)
> Nhóm: 06 - UTH | Tài liệu dùng chung: Frontend & Backend

---

## 1. Module Xác thực & Phân quyền (Auth)
> Phụ trách: Nguyễn Trung Hiếu

### 1.1 Đăng ký tài khoản
* URL: POST /api/auth/register
* Header: Content-Type: application/json
* Body (JSON):
{
  "full_name": "Nguyễn Văn A",
  "email": "user@uth.edu.vn",
  "password": "mypassword123"
}
* Response:
  - 201 Created:
    { "message": "Đăng ký tài khoản thành công!" }
  - 400 Bad Request:
    { "message": "Email đã tồn tại hoặc thiếu thông tin!" }

### 1.2 Đăng nhập hệ thống
* URL: POST /api/auth/login
* Header: Content-Type: application/json
* Body (JSON):
{
  "email": "user@uth.edu.vn",
  "password": "mypassword123"
}
* Response:
  - 200 OK:
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": 1,
        "full_name": "Nguyễn Văn A",
        "email": "user@uth.edu.vn",
        "role": "user"
      }
    }
  - 401 Unauthorized:
    { "message": "Sai email hoặc mật khẩu!" }

---

## 2. Module Quản lý Tác vụ & Kanban (Tasks)
> Phụ trách: Trần Quốc Bảo
> Lưu ý: Mọi API từ mục 2 trở đi bắt buộc gửi kèm Header: Authorization: Bearer <token>

### 2.1 Lấy danh sách task theo dự án (Hiển thị Kanban)
* URL: GET /api/projects/:projectId/tasks
* Response (200 OK):
[
  {
    "id": 1,
    "project_id": 1,
    "title": "Thiết kế giao diện Kanban",
    "description": "Dựng 4 cột Todo, In Progress, Review, Done",
    "status": "in_progress",
    "priority": "high",
    "assignee_id": 2,
    "assignee_name": "Nguyễn Thế Hoàng Bách",
    "due_date": "2026-11-20T23:59:59"
  }
]

### 2.2 Tạo công việc mới
* URL: POST /api/tasks
* Body (JSON):
{
  "project_id": 1,
  "title": "Làm form thêm mới task",
  "description": "Thêm các trường deadline, priority",
  "priority": "medium",
  "assignee_id": 3,
  "due_date": "2026-11-25"
}
* Response (201 Created):
{
  "message": "Tạo task thành công!",
  "taskId": 5
}

### 2.3 Kéo thả cập nhật trạng thái (Kanban Status)
* URL: PATCH /api/tasks/:id/status
* Body (JSON):
{
  "status": "done"
}
(Giá trị hợp lệ: todo, in_progress, review, done)
* Response (200 OK):
{
  "message": "Cập nhật trạng thái thành công!"
}

### 2.4 Cập nhật chi tiết công việc
* URL: PUT /api/tasks/:id
* Body (JSON):
{
  "title": "Tiêu đề mới",
  "description": "Nội dung cập nhật",
  "priority": "urgent",
  "assignee_id": 2,
  "due_date": "2026-11-30"
}
* Response (200 OK):
{
  "message": "Cập nhật công việc thành công!"
}

### 2.5 Xóa công việc
* URL: DELETE /api/tasks/:id
* Response (200 OK):
{
  "message": "Xóa task thành công!"
}

---

## 3. Module Dự án & Nhóm (Projects & Members)
> Phụ trách: Lê Đăng Khoa
> Header: Authorization: Bearer <token>

### 3.1 Lấy danh sách dự án của tôi
* URL: GET /api/projects
* Response (200 OK):
[
  {
    "id": 1,
    "name": "Dự án Quản lý tác vụ Nhóm 6",
    "description": "Xây dựng website Kanban Board",
    "project_role": "owner"
  }
]

### 3.2 Tạo dự án mới
* URL: POST /api/projects
* Body (JSON):
{
  "name": "Hệ thống Quản lý Bán hàng",
  "description": "Đồ án môn Lập trình Web"
}
* Response (201 Created):
{
  "message": "Tạo dự án thành công!",
  "projectId": 2
}

### 3.3 Thêm thành viên vào dự án
* URL: POST /api/projects/:projectId/members
* Body (JSON):
{
  "email": "bach@uth.edu.vn",
  "project_role": "member"
}
* Response (200 OK):
{
  "message": "Đã thêm thành viên vào dự án!"
}

### 3.4 Lấy danh sách thành viên trong dự án
* URL: GET /api/projects/:projectId/members
* Response (200 OK):
[
  {
    "id": 2,
    "full_name": "Nguyễn Thế Hoàng Bách",
    "email": "bach@uth.edu.vn",
    "project_role": "member"
  }
]

---

## 4. Module Bình luận (Comments)
> Phụ trách: Lê Đăng Khoa
> Header: Authorization: Bearer <token>

### 4.1 Lấy danh sách bình luận của 1 task
* URL: GET /api/tasks/:taskId/comments
* Response (200 OK):
[
  {
    "id": 1,
    "user_name": "Nguyễn Trung Hiếu",
    "content": "Nhớ kiểm tra kỹ deadline nhé!",
    "created_at": "2026-11-04T15:00:00"
  }
]

### 4.2 Thêm bình luận vào task
* URL: POST /api/tasks/:taskId/comments
* Body (JSON):
{
  "content": "Giao diện phần này đã hoàn thành xong."
}
* Response (201 Created):
{
  "message": "Thêm bình luận thành công!"
}

---

## 5. Module Bảng điều khiển (Dashboard) - bổ sung
> Header: Authorization: Bearer <token>

### 5.1 Thống kê tổng hợp của tôi
* URL: GET /api/dashboard
* Response (200 OK):
{
  "projects": 1,
  "total": 3,
  "by_status": { "todo": 1, "in_progress": 1, "review": 0, "done": 1 },
  "overdue": 1,
  "assigned_to_me": 2,
  "upcoming": [ { "id": 2, "title": "...", "status": "in_progress", "priority": "high", "project_id": 1, "project_name": "...", "due_date": "2026-11-15T23:59:59" } ]
}

## 6. Trường bổ sung & quy tắc phân quyền (so với bản đặc tả gốc)
* GET /api/projects: thêm `task_count`, `done_count`, `member_count`.
* GET /api/projects/:projectId/members: thêm `avatar_url`.
* GET /api/projects/:projectId/tasks: thêm `creator_id`, `creator_name`, `created_at`, `comment_count`.
* GET /api/tasks/:taskId/comments: thêm `user_id`, `avatar_url`. POST trả thêm `commentId`.
* POST /api/tasks: `status` (tùy chọn, mặc định `todo`), `assignee_id` phải là thành viên dự án; `due_date` nhận `YYYY-MM-DD`.
* PUT /api/tasks/:id: chỉ cập nhật trường được gửi; gửi `assignee_id: null` / `due_date: null` để bỏ.
* Mã lỗi chung: 400 dữ liệu sai · 401/403 token sai/hết hạn · 403 không đủ quyền · 404 không tồn tại · 409 trùng thành viên.

| Hành động | owner | leader | member |
|---|:-:|:-:|:-:|
| Xem task / bình luận / thành viên | ✔ | ✔ | ✔ |
| Tạo task, kéo thả đổi trạng thái, bình luận | ✔ | ✔ | ✔ |
| Sửa chi tiết task | ✔ | ✔ | chỉ task mình tạo/được giao |
| Xóa task | ✔ | ✔ | chỉ task mình tạo |
| Thêm thành viên (member) | ✔ | ✔ | ✖ |
| Thêm leader | ✔ | ✖ | ✖ |

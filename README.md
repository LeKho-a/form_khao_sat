# ĐỒ ÁN: WEBSITE QUẢN LÝ TÁC VỤ (TASK MANAGEMENT)
> **Trường Đại học Giao thông Vận tải TP.HCM (UTH)**  
> **Lớp / Khóa:** K24 | **Nhóm:** 06  

---

## 👥 Danh sách thành viên & Phân công nhiệm vụ

| STT | Họ và tên | MSSV | Vai trò chính | Nhiệm vụ cụ thể |
| :---: | :--- | :---: | :--- | :--- |
| 1 | **Nguyễn Trung Hiếu** | 080206003109 | **Trưởng nhóm** & System Architect | Quản trị Git, thiết kế CSDL (MySQL), luồng Xác thực (JWT Auth) & Phân quyền |
| 2 | **Nguyễn Thế Hoàng Bách** | ... | Frontend Developer 1 | Xây dựng Bảng điều khiển (Dashboard) & Giao diện bảng Kanban kéo thả |
| 3 | **Huỳnh Võ Minh Khoa** | ... | Frontend Developer 2 | Form thêm/sửa/xóa task, Bộ lọc tìm kiếm & Quản lý danh sách thành viên |
| 4 | **Trần Quốc Bảo** | ... | Backend Developer 1 | Xây dựng API CRUD Tác vụ (`/tasks`), gán người làm & cập nhật trạng thái |
| 5 | **Lê Đăng Khoa** | 080206014903 | Backend Developer 2 | Xây dựng API Dự án (`/projects`), Nhóm làm việc & Bình luận (`/comments`) |
| 6 | **Nguyễn Trọng Kim** | 22511202299 | Tester & Tài liệu | Thiết kế Wireframe/Figma UI/UX, lập kịch bản kiểm thử (Test Cases) & Viết báo cáo đồ án |

---

## 🛠️ Công nghệ sử dụng
- **Frontend:** HTML5, CSS3, JavaScript (hoặc React/Vue)
- **Backend:** Node.js (Express) / Java / Python
- **Database:** MySQL Server (`task_management_db`)
- **Version Control:** Git & GitHub

---

## 📂 Cấu trúc thư mục dự án
- `/frontend`: Mã nguồn giao diện người dùng (Dashboard, Kanban, Forms).
- `/backend`: Mã nguồn API máy chủ, file `database.sql` và cấu hình server.
- `/docs`: Tài liệu kiểm thử, liên kết Figma và file báo cáo đồ án Word/PDF.

---

## 🚀 Hướng dẫn chạy dự án (Fullstack)

**Yêu cầu:** Node.js ≥ 18, MySQL/MariaDB.

```bash
# 1. Tạo CSDL + bảng + dữ liệu mẫu (chạy trong MySQL Workbench hoặc terminal)
mysql -u root -p < backend/database.sql

# 2. Cài thư viện và cấu hình
cd backend
npm install
cp .env.example .env        # rồi sửa DB_PASSWORD, JWT_SECRET trong file .env

# 3. Nạp tài khoản mẫu chuẩn (mật khẩu bcrypt thật) + vài task demo
npm run seed

# 4. Chạy server (API + giao diện cùng cổng)
npm start                   # mở http://localhost:5000
```

Đăng nhập thử: `hieu.lead@uth.edu.vn` / mật khẩu `123456` (email các thành viên khác xem trong `backend/seed.js` — cần sửa cho đúng email thật của nhóm).

## ✨ Chức năng
- **Xác thực:** đăng ký, đăng nhập (JWT, hết hạn 1 ngày), tự đăng xuất khi token hết hạn.
- **Dashboard:** thống kê tổng task / quá hạn / giao cho tôi, tiến độ theo trạng thái, việc sắp đến hạn, danh sách dự án + tạo dự án.
- **Kanban:** 4 cột, **kéo thả** đổi trạng thái (cập nhật tức thì, tự hoàn tác nếu lỗi), thêm/sửa/xóa task, deadline, độ ưu tiên, người thực hiện.
- **Bộ lọc:** tìm theo từ khóa, mức ưu tiên, người thực hiện.
- **Nhóm làm việc:** xem/thêm thành viên theo email, phân quyền owner / leader / member.
- **Bình luận** dưới từng task.
- Giao diện **sáng/tối**, responsive điện thoại.

## 🧱 Cấu trúc mã nguồn
```
backend/
  server.js  db.js  seed.js
  auth.routes.js  auth.middleware.js       # Hiếu
  task.routes.js                           # Tasks (Bảo) - API contract mục 2
  project.routes.js  comment.routes.js     # Khoa - mục 3, 4 (+ GET /projects/:id/tasks)
  dashboard.routes.js                      # Dashboard
  tests/  mock-api.test.js  ui-mock-server.js  ui.e2e.py
frontend/
  login.html  dashboard.html  board.html  index.html
  css/style.css  js/{api,ui,login,dashboard,board}.js
docs/screenshots/                          # ảnh giao diện cho báo cáo
```

## 🧪 Kiểm thử
- `node backend/tests/mock-api.test.js` — 44 ca kiểm thử logic API (CSDL giả lập trong bộ nhớ, không cần MySQL).
- `node backend/tests/ui-mock-server.js` rồi `python backend/tests/ui.e2e.py` — 26 ca kiểm thử giao diện bằng Playwright (cần `pip install playwright`).

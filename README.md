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
                            # (CSDL cũ tự được nâng cấp khi server khởi động - không cần import lại database.sql)

# 2b. Bật gửi email quên mật khẩu: mở backend/.env, điền SMTP_USER + SMTP_PASS (Mật khẩu ứng dụng Gmail),
#     APP_URL, và đặt RESET_SHOW_LINK=false. Thử ngay:  npm run test-mail -- email_cua_ban@gmail.com

# 3. Nạp tài khoản mẫu chuẩn (mật khẩu bcrypt thật) + vài task demo
npm run seed

# 4. Chạy server (API + giao diện cùng cổng)
npm start                   # mở http://localhost:5000
```

Đăng nhập thử: `hieu.lead@uth.edu.vn` / mật khẩu `123456` (email các thành viên khác xem trong `backend/seed.js` — cần sửa cho đúng email thật của nhóm).

## ✨ Chức năng
- **Xác thực:** đăng ký, đăng nhập (JWT, hết hạn 1 ngày), tự đăng xuất khi token hết hạn.
- **Giao diện kiểu ứng dụng:** thanh bên tối (hồ sơ, điều hướng, danh sách dự án có màu, nút tạo dự án), thanh trên có ô tìm kiếm, ngày, chuông thông báo, đổi sáng/tối; trên điện thoại thanh bên là ngăn kéo (nút ☰).
- **Dashboard:** 4 thẻ thống kê màu, biểu đồ vành khuyên tiến độ theo trạng thái, bảng "Việc của tôi" có tab (Đang mở / Quá hạn / Hôm nay / Tuần này / Hoàn thành / Tất cả) kèm số đếm, lưới dự án.
- **Trang "Việc của tôi":** mọi task được giao cho bạn trên tất cả dự án, lọc theo từ khóa / ưu tiên / dự án.
- **Kanban:** 4 cột có tiêu đề màu, thẻ có dải màu theo độ ưu tiên, dải đỏ "Quá hạn N ngày", mã #id, nhóm avatar thành viên, chuyển **Kanban ⇄ Danh sách (dạng bảng)**; **kéo thả** đổi trạng thái (cập nhật tức thì, tự hoàn tác nếu lỗi), thêm/sửa/xóa task, deadline, độ ưu tiên, người thực hiện.
- **Bộ lọc:** tìm theo từ khóa, mức ưu tiên, người thực hiện.
- **Nhóm làm việc:** xem/thêm thành viên theo email, phân quyền owner / leader / member.
- **Bình luận** dưới từng task.
- **Sắp xếp thứ tự task trong cột:** kéo thả để đổi cột *và* chèn đúng vị trí (vạch xanh báo chỗ thả); thứ tự được lưu và giữ nguyên sau khi tải lại.
- **Thông báo thời gian thực** (Server-Sent Events, không cần thư viện ngoài): chuông 🔔 + số chưa đọc + toast khi được giao việc, task đổi trạng thái, có bình luận mới, được thêm vào dự án. Bảng Kanban của các thành viên khác **tự cập nhật** khi có người thay đổi task.
- **Hồ sơ cá nhân:** tải **ảnh đại diện** (tự cắt vuông + nén ở trình duyệt, server kiểm tra "chữ ký" file, chặn SVG), đổi họ tên, đổi mật khẩu.
- **Quên mật khẩu:** liên kết đặt lại dùng 1 lần, hết hạn sau 1 giờ, DB chỉ lưu bản băm SHA-256 của token, giới hạn 5 lần/15 phút, không lộ email nào tồn tại. Gửi email thật (có nút bấm) qua Gmail SMTP hoặc Brevo (HTTPS); có chế độ demo (hiện liên kết ngay trên trang) khi `RESET_SHOW_LINK=true`.
- **Logo + bộ icon SVG riêng** (không dùng emoji): logo thiết kế riêng (3 cột Kanban + dấu tick), icon Phosphor Icons (MIT) kiểu hai tông màu, tự đổi màu theo giao diện sáng/tối.
- **Thân thiện với người dùng:** lời chào theo giờ + tóm tắt việc hôm nay, trạng thái rỗng có hướng dẫn, khung chờ (skeleton) khi tải, huy hiệu có icon kèm chữ (không chỉ dựa vào màu), giao diện tự theo chế độ sáng/tối của hệ điều hành.
- **Trợ năng (WCAG AA):** màu chữ/nút đạt tỉ lệ tương phản ≥ 4.5:1 ở cả hai giao diện (có test tự động), vòng focus rõ khi dùng bàn phím, liên kết "Bỏ qua điều hướng", nút bấm ≥ 40px, tôn trọng `prefers-reduced-motion`.
- **Animation & transition:** trang vào mượt (nội dung trượt lên, thẻ/dòng bảng hiện lần lượt), chuyển trang mờ dần; số thống kê **đếm tăng dần**, biểu đồ vành khuyên và thanh tiến độ **vẽ dần**; hộp thoại/toast/panel thông báo trượt vào và thoát ra mượt; chuông **rung** khi có thông báo mới; Kanban kéo thả có **thẻ trượt về vị trí mới (FLIP)**, thẻ vừa thả "lún" nhẹ, thẻ bị xóa thu nhỏ rồi biến mất; đổi sáng/tối chuyển màu mượt. Chỉ animate `transform`/`opacity` nên nhẹ; **tự tắt hết khi người dùng bật "giảm chuyển động"** trong hệ điều hành (`prefers-reduced-motion`).
- Giao diện **sáng/tối**, responsive điện thoại.

## 🧱 Cấu trúc mã nguồn
```
backend/
  server.js  db.js  seed.js
  auth.routes.js  auth.middleware.js       # Hiếu
  task.routes.js                           # Tasks (Bảo) - API contract mục 2
  project.routes.js  comment.routes.js     # Khoa - mục 3, 4 (+ GET /projects/:id/tasks)
  dashboard.routes.js                      # Dashboard
  password.routes.js  user.routes.js       # Quên mật khẩu · Hồ sơ + avatar
  notification.routes.js  realtime.js      # Thông báo + kênh SSE
  migrate.js                               # Tự nâng cấp CSDL khi khởi động
  uploads/avatars/                         # ảnh đại diện (tự tạo, không đưa lên Git)
  tests/  mock-api.test.js  ui-mock-server.js  ui.e2e.py
frontend/
  login.html  reset.html  dashboard.html  my-tasks.html  board.html  index.html
  css/style.css  js/{api,icons-data,icon,motion,ui,login,reset,dashboard,my-tasks,board,notify,profile}.js
  img/logo.svg  img/favicon.svg            # logo + biểu tượng tab trình duyệt
  icons/*.svg                              # 47 icon (Phosphor Icons, MIT) - nguồn của js/icons-data.js
tools/build-icons.js                       # gom icons/*.svg -> js/icons-data.js
docs/screenshots/                          # ảnh giao diện cho báo cáo
```

## 🧪 Kiểm thử
- `node backend/tests/mock-api.test.js` — 99 ca kiểm thử logic API (CSDL giả lập trong bộ nhớ, không cần MySQL).
- `node backend/tests/ui-mock-server.js` rồi `python backend/tests/ui.e2e.py` — 100 ca kiểm thử giao diện bằng Playwright (cần `pip install playwright`).

## 🎨 Logo & icon — cách thay bằng icon từ Flaticon / Magnific / Icons8...
Mọi icon nằm trong `frontend/icons/` (mỗi file một icon, tên file = tên icon trong code, vd `bell.svg`, `kanban.svg`).
Để thay một icon bằng icon bạn tải từ Flaticon/Magnific (định dạng **SVG**):
1. Đặt file SVG vào `frontend/icons/` với đúng tên file cần thay.
2. Chạy `node tools/build-icons.js` (không cần cài thêm gì) rồi tải lại trang (Ctrl+F5).
3. Icon một màu nên để `fill="currentColor"` để tự đổi theo giao diện sáng/tối; icon nhiều màu giữ nguyên màu gốc.
4. **Ghi nguồn trong báo cáo/README** nếu giấy phép yêu cầu (Flaticon bản miễn phí bắt buộc ghi tác giả).
Logo: sửa `frontend/img/logo.svg` (và `favicon.svg`).

**Nguồn icon đang dùng:** [Phosphor Icons](https://phosphoricons.com) — giấy phép MIT, xem `frontend/icons/LICENSE-phosphor.txt`.

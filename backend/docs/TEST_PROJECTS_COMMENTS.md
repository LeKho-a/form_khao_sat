# Test nhanh (thay <TOKEN> bằng JWT lấy từ API đăng nhập)

```bash
# 3.1
curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/projects

# 3.2
curl -X POST http://localhost:5000/api/projects \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"name":"Hệ thống Quản lý Bán hàng","description":"Đồ án môn Lập trình Web"}'

# 3.3
curl -X POST http://localhost:5000/api/projects/1/members \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"email":"bach@uth.edu.vn","project_role":"member"}'

# 3.4
curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/projects/1/members

# 4.1
curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/tasks/1/comments

# 4.2
curl -X POST http://localhost:5000/api/tasks/1/comments \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"content":"Giao diện phần này đã hoàn thành xong."}'
```

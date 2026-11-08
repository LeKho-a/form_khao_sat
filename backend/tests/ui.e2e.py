from playwright.sync_api import sync_playwright
import json, os, urllib.request
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","docs","screenshots"); os.makedirs(OUT,exist_ok=True)
res=[]
def t(name, cond, extra=""):
    res.append(cond); print(("PASS " if cond else "FAIL ")+name+("" if cond else "  -> "+str(extra)))

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1366,'height':800}); pg=ctx.new_page()
    dialogs=[]; pg.on("dialog", lambda d:(dialogs.append(d.message), d.dismiss()))
    errors=[]; pg.on("pageerror", lambda e: errors.append(str(e)))
    B="http://localhost:5000/"
    # --- Đăng nhập ---
    pg.goto(B+"login.html")
    pg.fill("#l-email","hieu.lead@uth.edu.vn"); pg.fill("#l-pass","sai"); pg.click("#l-btn")
    pg.wait_for_selector("#l-err:not(:empty)")
    t("Login sai mật khẩu hiện lỗi", "không chính xác" in pg.inner_text("#l-err"))
    pg.fill("#l-email","abc"); pg.click("#l-btn")
    t("Login email sai định dạng bị chặn ở client", "Email không hợp lệ" in pg.inner_text("#l-err"))
    pg.click("#tab-register"); pg.fill("#r-name","A"); pg.fill("#r-email","a@uth.edu.vn"); pg.fill("#r-pass","123"); pg.click("#r-btn")
    t("Đăng ký mật khẩu <6 ký tự bị chặn", "tối thiểu 6" in pg.inner_text("#r-err"))
    pg.screenshot(path=OUT+"/1_login.png")
    pg.click("#tab-login"); pg.fill("#l-email","hieu.lead@uth.edu.vn"); pg.fill("#l-pass","123456"); pg.click("#l-btn")
    pg.wait_for_url("**/dashboard.html")
    # --- Dashboard ---
    pg.wait_for_selector(".project-card")
    t("Dashboard: 4 thẻ thống kê", pg.locator("#stats .stat").count()==4)
    t("Dashboard: có thẻ dự án + vai trò Chủ dự án", "Chủ dự án" in pg.inner_text(".project-card"))
    t("Dashboard: lời chào có tên", "Nguyễn Trung Hiếu" in pg.inner_text("#hello"))
    pg.screenshot(path=OUT+"/2_dashboard.png")
    # --- Board ---
    pg.click(".project-card"); pg.wait_for_url("**/board.html?project=1"); pg.wait_for_selector(".task")
    t("Board: 4 cột", pg.locator(".column").count()==4)
    t("Board: 3 task hiển thị", pg.locator(".task").count()==3)
    t("XSS: tiêu đề chứa HTML hiển thị như chữ, không chạy script", any("<img" in x for x in pg.locator(".task .title").all_inner_texts()) and not dialogs, dialogs)
    # kéo thả
    card=pg.locator(".task", has_text="Viết API CRUD"); target=pg.locator('.col-body[data-status="in_progress"]')
    card.drag_to(target); pg.wait_for_timeout(400)
    t("Kéo thả: task 3 sang cột Đang làm", pg.locator('.col-body[data-status="in_progress"] .task').count()==2)
    log=json.load(urllib.request.urlopen(B+"api/_log"))
    t("Kéo thả: gọi PATCH /api/tasks/3/status {in_progress}", any(l.startswith('PATCH /api/tasks/3/status') and 'in_progress' in l for l in log), log[-4:])
    # lỗi server -> hoàn tác
    pg.route("**/api/tasks/2/status", lambda r: r.fulfill(status=500, content_type="application/json", body='{"message":"Lỗi giả lập"}'))
    pg.locator(".task", has_text="Dựng giao diện").drag_to(pg.locator('.col-body[data-status="review"]')); pg.wait_for_timeout(500)
    t("Kéo thả lỗi -> hoàn tác về cột cũ + toast lỗi", pg.locator('.col-body[data-status="in_progress"] .task', has_text="Dựng giao diện").count()==1 and "Lỗi giả lập" in pg.inner_text("#toasts"))
    pg.unroute("**/api/tasks/2/status")
    # lọc
    pg.fill("#f-q","database"); pg.wait_for_timeout(400)
    t("Lọc theo từ khóa", pg.locator(".task").count()==1 and "1/3" in pg.inner_text("#f-count"))
    pg.click("#f-clear"); pg.select_option("#f-priority","urgent")
    t("Lọc theo mức ưu tiên", pg.locator(".task").count()==1)
    pg.click("#f-clear"); pg.select_option("#f-assignee","none")
    t("Lọc 'Chưa giao'", pg.locator(".task").count()==0 or all("Chưa giao" in x for x in pg.locator(".task .meta").all_inner_texts()))
    pg.click("#f-clear")
    # thêm task
    pg.click("#btn-add"); pg.wait_for_selector(".modal")
    pg.click("text=Tạo task"); t("Thêm task: tiêu đề rỗng báo lỗi", "Vui lòng nhập tiêu đề" in pg.inner_text(".modal .error-text"))
    pg.fill(".modal input[type=text]","Làm form thêm mới task"); pg.select_option(".modal select >> nth=0","high")
    pg.select_option(".modal select >> nth=2","2"); pg.fill(".modal input[type=date]","2026-11-25")
    pg.screenshot(path=OUT+"/4_modal_new.png")
    pg.click("text=Tạo task"); pg.wait_for_selector(".task >> text=Làm form thêm mới task")
    t("Thêm task: xuất hiện ở cột Cần làm với người thực hiện", pg.locator('.col-body[data-status="todo"] .task', has_text="Làm form thêm mới").count()==1)
    # mở task + bình luận
    pg.locator(".task", has_text="Thiết kế Database").click(); pg.wait_for_selector(".comment")
    t("Modal: hiện bình luận cũ", "Đã hoàn thành cấu trúc" in pg.inner_text(".modal"))
    pg.fill(".modal textarea >> nth=1","Bình luận mới <b>x</b>"); pg.click(".modal button:has-text('Gửi')"); pg.wait_for_timeout(500)
    t("Bình luận: thêm thành công, HTML được escape", pg.locator(".comment").count()==2 and "<b>x</b>" in pg.inner_text(".modal"))
    pg.screenshot(path=OUT+"/5_modal_edit.png")
    # sửa task
    pg.fill(".modal input[type=text]","Tiêu đề đã sửa"); pg.click("text=Lưu thay đổi"); pg.wait_for_selector(".task >> text=Tiêu đề đã sửa")
    t("Sửa task: tiêu đề cập nhật trên board", True)
    # xóa task
    pg.locator(".task", has_text="Tiêu đề đã sửa").click(); pg.click("text=🗑 Xóa"); pg.click("button:has-text('Xóa task')"); pg.wait_for_timeout(500)
    t("Xóa task: có hộp xác nhận và task biến mất", pg.locator(".task", has_text="Tiêu đề đã sửa").count()==0)
    # thành viên
    pg.click("#btn-members"); pg.wait_for_selector(".modal .list-row")
    pg.fill(".modal input[type=email]","khongco@uth.edu.vn"); pg.click(".modal button:has-text('Thêm')"); pg.wait_for_timeout(300)
    t("Thành viên: email không tồn tại báo lỗi", "Không tìm thấy" in pg.inner_text(".modal .error-text"))
    pg.fill(".modal input[type=email]","minhkhoa@uth.edu.vn"); pg.click(".modal button:has-text('Thêm')"); pg.wait_for_timeout(400)
    t("Thành viên: thêm thành công (3 người)", pg.locator(".modal .list-row").count()==3)
    pg.screenshot(path=OUT+"/6_members.png"); pg.keyboard.press("Escape")
    pg.screenshot(path=OUT+"/3_board.png")
    # giao diện sáng + mobile
    pg.click("button[title^='Đổi giao diện']"); t("Đổi giao diện sáng", pg.evaluate("document.documentElement.dataset.theme")=="light")
    pg.set_viewport_size({'width':390,'height':800}); pg.screenshot(path=OUT+"/7_mobile_light.png")
    # đăng xuất
    pg.set_viewport_size({'width':1366,'height':800}); pg.click("text=Đăng xuất"); pg.wait_for_url("**/login.html")
    pg.goto(B+"dashboard.html"); pg.wait_for_url("**/login.html"); t("Chưa đăng nhập vào dashboard -> về login", True)
    t("Không có lỗi JavaScript nào trên trang", not errors, errors)
    b.close()
print(f"\nKẾT QUẢ UI: {sum(res)}/{len(res)} PASS")

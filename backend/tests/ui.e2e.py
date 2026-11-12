from playwright.sync_api import sync_playwright
import json, os, urllib.request
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","docs","screenshots"); os.makedirs(OUT,exist_ok=True)
res=[]
import re
EMOJI=re.compile("[\U0001F300-\U0001FAFF\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF\uFF0B\u2630\u25A6\uFE0F]")
CONTRAST_JS = """([sel, bgSel]) => {
  const parse = c => (c.match(/[\\d.]+/g) || []).map(Number);
  const blend = (fg, bg) => { const a = fg.length > 3 ? fg[3] : 1; return [0,1,2].map(i => fg[i]*a + bg[i]*(1-a)); };
  const lum = ([r,g,b]) => { const f = c => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const el = document.querySelector(sel); const cs = getComputedStyle(el);
  let bg = parse(getComputedStyle(document.querySelector(bgSel)).backgroundColor).slice(0,3);
  const own = parse(cs.backgroundColor); if (own.length === 3 || own[3] > 0) bg = blend(own, bg);
  const fg = blend(parse(cs.color), bg);
  const a = lum(fg), b = lum(bg); return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}"""
import zlib, struct
def make_png(w, h):
    raw=b"".join(b"\x00"+b"".join(bytes([x*255//w, y*255//h, 160]) for x in range(w)) for y in range(h))
    def chunk(tag, data): c=struct.pack(">I", len(data))+tag+data; return c+struct.pack(">I", zlib.crc32(tag+data)&0xffffffff)
    return b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))+chunk(b"IDAT", zlib.compress(raw))+chunk(b"IEND", b"")
def emit(body):
    urllib.request.urlopen(urllib.request.Request("http://localhost:5000/api/_emit", data=body.encode(), method="POST", headers={"Content-Type":"application/json"}))
def t(name, cond, extra=""):
    res.append(cond); print(("PASS " if cond else "FAIL ")+name+("" if cond else "  -> "+str(extra)))

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1366,'height':800}); pg=ctx.new_page()
    pg.add_init_script("window.__anim=0; const __o=Element.prototype.animate; Element.prototype.animate=function(...a){window.__anim++; return __o.apply(this,a)}")
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
    t("Dashboard: thanh bên có các mục điều hướng + danh sách dự án", all(x in pg.inner_text("#sidebar") for x in ["Bảng điều khiển","Dự án","Việc của tôi","Cài đặt"]) and pg.locator("#sidebar .side-projects a").count()==1)
    t("Chuyển động: thẻ thống kê + nội dung trang có animation vào", pg.evaluate("getComputedStyle(document.querySelector('#stats .stat')).animationName")=="fadeUp" and pg.evaluate("getComputedStyle(document.querySelector('main.container')).animationName")=="fadeUp")
    pg.wait_for_timeout(1200)
    t("Chuyển động: số thống kê đếm tăng dần rồi dừng đúng giá trị", pg.locator("#stats .num").all_inner_texts()==["1","3","1","1"], pg.locator("#stats .num").all_inner_texts())
    t("Chuyển động: biểu đồ vành khuyên vẽ dần tới đúng tỉ lệ", pg.evaluate("[...document.querySelectorAll('#progress .donut circle')].slice(1).every(c => !c.style.strokeDasharray.startsWith('0 '))"))
    t("Logo: ảnh logo SVG tải được ở thanh bên + favicon", pg.evaluate("document.querySelector('#sidebar img.logo-img').naturalWidth")>0 and pg.evaluate("document.querySelector('link[rel=icon]').getAttribute('href')").endswith("favicon.svg"))
    t("Icon: thanh bên dùng icon SVG (>=5), không dùng emoji", pg.locator("#sidebar svg.ic").count()>=5 and not EMOJI.search(pg.inner_text("body")))
    t("Icon: thẻ thống kê có icon SVG trắng trong vòng tròn màu", pg.locator("#stats .icon svg.ic").count()==4)
    t("Icon: huy hiệu ưu tiên/trạng thái có icon kèm chữ (không chỉ dựa vào màu)", pg.locator("#mine .badge svg.ic").count()>=2 and pg.locator("#mine .badge", has_text="Đang làm").count()==1)
    t("Thân thiện: lời chào theo giờ + câu tóm tắt công việc", any(x in pg.inner_text("#hello") for x in ["Chào buổi sáng","Chào buổi trưa","Chào buổi chiều","Chào buổi tối"]) and "việc đang mở" in pg.inner_text("#hello-sub"))
    pg.keyboard.press("Tab")
    t("Trợ năng: phím Tab đầu tiên rơi vào liên kết 'Bỏ qua điều hướng'", pg.evaluate("document.activeElement.className")=="skip-link")
    ctx2=b.new_context(color_scheme="dark"); p2=ctx2.new_page(); p2.goto(B+"login.html")
    t("Giao diện tự theo cài đặt tối của hệ thống", p2.evaluate("document.documentElement.dataset.theme")=="dark"); ctx2.close()
    t("Desktop: nút ☰ bị ẩn (chỉ hiện trên mobile)", not pg.locator(".menu-btn").is_visible())
    t("Dashboard: mục 'Bảng điều khiển' đang được tô sáng", "Bảng điều khiển" in pg.inner_text("#sidebar .side-link.active"))
    t("Dashboard: biểu đồ vành khuyên SVG + chú thích 4 trạng thái", pg.locator("#progress svg circle").count()>=2 and pg.locator("#progress .legend-row").count()==4)
    t("Dashboard: bảng 'Việc của tôi' có 6 tab kèm số đếm", pg.locator("#mine-tabs .tabs2 button").count()==6 and "(" in pg.inner_text("#mine-tabs"))
    pg.click("#mine-tabs button[data-tab='overdue']"); pg.wait_for_timeout(200)
    t("Dashboard: tab 'Quá hạn' chỉ hiện task quá hạn", pg.locator("#mine tbody tr").count()==1 and "Viết API" in pg.inner_text("#mine"))
    pg.click("#mine-tabs button[data-tab='open']")
    pg.screenshot(path=OUT+"/2_dashboard.png")
    # --- Board ---
    pg.click(".project-card"); pg.wait_for_url("**/board.html?project=1"); pg.wait_for_selector(".task")
    t("Board: 4 cột", pg.locator(".column").count()==4)
    t("Board: 3 task hiển thị", pg.locator(".task").count()==3)
    t("XSS: tiêu đề chứa HTML hiển thị như chữ, không chạy script", any("<img" in x for x in pg.locator(".task .title").all_inner_texts()) and not dialogs, dialogs)
    t("Board: cột có tiêu đề màu + thanh dự án ở sidebar được tô sáng", pg.locator(".col-head").count()==4 and "Nhóm 6" in pg.inner_text("#sidebar .side-projects .side-link.active"))
    t("Board: hiện nhóm avatar thành viên (2 người)", pg.locator("#p-team .avatar").count()==2)
    def contrast_ok(label):
        pairs=[("#btn-add","body"),(".col-head >> nth=0","body"),(".col-head >> nth=1","body"),(".col-head >> nth=2","body"),(".col-head >> nth=3","body"),
               (".badge.p-urgent",".task"),(".badge.p-medium",".task"),(".task .task-id",".task"),("#p-desc","body"),("#sidebar .side-link:not(.active)","#sidebar"),("#sidebar .side-link.active","#sidebar"),(".due.overdue",".task")]
        bad=[]
        for sel,bgs in pairs:
            sel2=sel.replace(" >> nth=",":nth-of-type(") if False else sel
            try:
                loc=pg.locator(sel).first
                r=loc.evaluate(CONTRAST_JS.replace("document.querySelector(sel)","arguments[0]") if False else "(el,[bgSel]) => { const parse=c=>(c.match(/[\\d.]+/g)||[]).map(Number); const blend=(fg,bg)=>{const a=fg.length>3?fg[3]:1;return [0,1,2].map(i=>fg[i]*a+bg[i]*(1-a));}; const lum=([r,g,b])=>{const f=c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)}; const cs=getComputedStyle(el); let bg=parse(getComputedStyle(document.querySelector(bgSel)).backgroundColor).slice(0,3); const own=parse(cs.backgroundColor); if(own.length===3||own[3]>0) bg=blend(own,bg); const fg=blend(parse(cs.color),bg); const a=lum(fg),b=lum(bg); return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05); }", [bgs])
            except Exception as e:
                r=0
            if r<4.5: bad.append((sel,round(r,2)))
        t("Tương phản WCAG AA (>=4.5) - "+label, not bad, bad)
    contrast_ok("giao diện sáng")
    pg.click("button[title^='Đổi giao diện']")
    t("Chuyển động: đổi sáng/tối bật chuyển màu mượt + công tắc ở thanh bên", pg.evaluate("document.documentElement.classList.contains('theme-anim')") and pg.locator("#theme-switch[aria-checked]").count()==1)
    pg.wait_for_timeout(600)
    t("Chuyển động: chuyển màu mượt tự tắt sau khi xong (không tốn hiệu năng)", not pg.evaluate("document.documentElement.classList.contains('theme-anim')"))
    contrast_ok("giao diện tối")
    pg.screenshot(path=OUT+"/14_dark_board.png")
    pg.click("button[title^='Đổi giao diện']"); pg.wait_for_timeout(200)
    t("Board: thẻ quá hạn có ngày đỏ 'Quá hạn N ngày' + hiện mã #id", pg.locator(".task .due.overdue").count()==1 and "quá hạn" in pg.inner_text(".task .due.overdue") and "#3" in pg.inner_text(".task >> nth=0"))
    pg.click("#btn-add"); pg.wait_for_selector(".backdrop:not(.closing) .modal")
    t("Chuyển động: hộp thoại mở có hiệu ứng trượt/phóng nhẹ", pg.evaluate("getComputedStyle(document.querySelector('.backdrop:not(.closing) .modal')).animationName")=="modalIn" and pg.evaluate("getComputedStyle(document.querySelector('.backdrop')).animationName")=="fadeIn")
    pg.keyboard.press("Escape")
    t("Chuyển động: đóng hộp thoại phát hiệu ứng rồi mới gỡ khỏi trang", pg.locator(".backdrop.closing").count()==1 and pg.evaluate("getComputedStyle(document.querySelector('.backdrop.closing')).pointerEvents")=="none")
    pg.wait_for_selector(".backdrop", state="detached", timeout=2000)
    t("Chuyển động: hộp thoại đã được gỡ sau khi đóng", pg.locator(".backdrop").count()==0)
    # kéo thả
    card=pg.locator(".task", has_text="Viết API CRUD"); target=pg.locator('.col-body[data-status="in_progress"]')
    a0=pg.evaluate('window.__anim'); card.drag_to(target); pg.wait_for_timeout(400)
    t('Chuyển động: kéo thả kích hoạt hiệu ứng trượt mượt (FLIP) cho thẻ', pg.evaluate('window.__anim')>a0, [a0, pg.evaluate('window.__anim')])
    t("Kéo thả: task 3 sang cột Đang làm", pg.locator('.col-body[data-status="in_progress"] .task').count()==2)
    log=json.load(urllib.request.urlopen(B+"api/_log"))
    t("Kéo thả: gọi PATCH /api/tasks/3/move {in_progress}", any(l.startswith('PATCH /api/tasks/3/move') and 'in_progress' in l for l in log), log[-4:])
    # lỗi server -> hoàn tác
    pg.route("**/api/tasks/2/move", lambda r: r.fulfill(status=500, content_type="application/json", body='{"message":"Lỗi giả lập"}'))
    pg.locator(".task", has_text="Dựng giao diện").drag_to(pg.locator('.col-body[data-status="review"]')); pg.wait_for_timeout(500)
    t("Kéo thả lỗi -> hoàn tác về cột cũ + toast lỗi", pg.locator('.col-body[data-status="in_progress"] .task', has_text="Dựng giao diện").count()==1 and "Lỗi giả lập" in pg.inner_text("#toasts"))
    pg.unroute("**/api/tasks/2/move")
    # lọc
    pg.fill("#f-q","database"); pg.wait_for_timeout(400)
    t("Lọc theo từ khóa", pg.locator(".task").count()==1 and "1/3" in pg.inner_text("#f-count"))
    pg.click("#f-clear"); pg.select_option("#f-priority","urgent")
    t("Lọc theo mức ưu tiên", pg.locator(".task").count()==1)
    pg.click("#f-clear"); pg.select_option("#f-assignee","none")
    t("Lọc 'Chưa giao'", pg.locator(".task").count()==0 or all("Chưa giao" in x for x in pg.locator(".task .meta").all_inner_texts()))
    pg.click("#f-clear")
    # thêm task
    pg.click("#btn-add"); pg.wait_for_selector(".backdrop:not(.closing) .modal")
    pg.click("text=Tạo task"); t("Thêm task: tiêu đề rỗng báo lỗi", "Vui lòng nhập tiêu đề" in pg.inner_text(".backdrop:not(.closing) .modal .error-text"))
    pg.fill(".backdrop:not(.closing) .modal input[type=text]","Làm form thêm mới task"); pg.select_option(".backdrop:not(.closing) .modal select >> nth=0","high")
    pg.select_option(".backdrop:not(.closing) .modal select >> nth=2","2"); pg.fill(".backdrop:not(.closing) .modal input[type=date]",(__import__("datetime").date.today()+__import__("datetime").timedelta(days=30)).isoformat())
    pg.screenshot(path=OUT+"/4_modal_new.png")
    pg.click("text=Tạo task"); pg.wait_for_selector(".task >> text=Làm form thêm mới task")
    t("Thêm task: xuất hiện ở cột Cần làm với người thực hiện", pg.locator('.col-body[data-status="todo"] .task', has_text="Làm form thêm mới").count()==1)
    # mở task + bình luận
    pg.locator(".task", has_text="Thiết kế Database").click(); pg.wait_for_selector(".comment")
    t("Modal: hiện bình luận cũ", "Đã hoàn thành cấu trúc" in pg.inner_text(".backdrop:not(.closing) .modal"))
    pg.fill(".backdrop:not(.closing) .modal textarea >> nth=1","Bình luận mới <b>x</b>"); pg.click(".backdrop:not(.closing) .modal button:has-text('Gửi')"); pg.wait_for_timeout(500)
    t("Bình luận: thêm thành công, HTML được escape", pg.locator(".comment").count()==2 and "<b>x</b>" in pg.inner_text(".backdrop:not(.closing) .modal"))
    pg.screenshot(path=OUT+"/5_modal_edit.png")
    # sửa task
    pg.fill(".backdrop:not(.closing) .modal input[type=text]","Tiêu đề đã sửa"); pg.click("text=Lưu thay đổi"); pg.wait_for_selector(".task >> text=Tiêu đề đã sửa")
    t("Sửa task: tiêu đề cập nhật trên board", True)
    # xóa task
    pg.locator(".task", has_text="Tiêu đề đã sửa").click(); pg.click("#btn-delete-task"); pg.click("button:has-text('Xóa task')"); pg.wait_for_timeout(500)
    t("Xóa task: có hộp xác nhận và task biến mất", pg.locator(".task", has_text="Tiêu đề đã sửa").count()==0)
    # thành viên
    pg.click("#btn-members"); pg.wait_for_selector(".backdrop:not(.closing) .modal .list-row")
    pg.fill(".backdrop:not(.closing) .modal input[type=email]","khongco@uth.edu.vn"); pg.click(".backdrop:not(.closing) .modal button:has-text('Thêm')"); pg.wait_for_timeout(300)
    t("Thành viên: email không tồn tại báo lỗi", "Không tìm thấy" in pg.inner_text(".backdrop:not(.closing) .modal .error-text"))
    pg.fill(".backdrop:not(.closing) .modal input[type=email]","minhkhoa@uth.edu.vn"); pg.click(".backdrop:not(.closing) .modal button:has-text('Thêm')"); pg.wait_for_timeout(400)
    t("Thành viên: thêm thành công (3 người)", pg.locator(".backdrop:not(.closing) .modal .list-row").count()==3)
    pg.screenshot(path=OUT+"/6_members.png"); pg.keyboard.press("Escape")
    pg.screenshot(path=OUT+"/3_board.png")
    # --- Chế độ xem danh sách ---
    pg.click("#view-list"); pg.wait_for_selector("table.tbl")
    t("Danh sách: chuyển sang dạng bảng, không còn thẻ Kanban", pg.locator(".task").count()==0 and pg.locator("table.tbl tbody tr").count()==3 and "trạng thái" in pg.inner_text("table.tbl thead").lower())
    pg.screenshot(path=OUT+"/11_board_list.png")
    pg.reload(); pg.wait_for_selector("table.tbl")
    t("Danh sách: ghi nhớ chế độ xem sau khi tải lại", pg.locator("table.tbl").count()==1)
    pg.locator("table.tbl tbody tr", has_text="Dựng giao diện").click(); pg.wait_for_selector(".backdrop:not(.closing) .modal")
    t("Danh sách: bấm dòng mở chi tiết task", "Chi tiết công việc" in pg.inner_text(".backdrop:not(.closing) .modal"))
    pg.keyboard.press("Escape")
    pg.fill("#f-q","kanban"); pg.wait_for_timeout(400)
    t("Danh sách: bộ lọc vẫn hoạt động", pg.locator("table.tbl tbody tr").count()==1)
    pg.click("#f-clear"); pg.click("#view-kanban"); pg.wait_for_selector(".task")
    t("Danh sách: quay lại Kanban", pg.locator(".column").count()==4)

    # --- Trang "Việc của tôi" + tìm kiếm trên thanh trên ---
    pg.fill("#global-search","kanban"); pg.press("#global-search","Enter"); pg.wait_for_url("**/my-tasks.html?q=kanban")
    pg.wait_for_selector("table.tbl")
    t("Việc của tôi: ô tìm kiếm trên thanh trên chuyển sang trang và lọc đúng", pg.input_value("#mt-q")=="kanban" and pg.locator("table.tbl tbody tr").count()==1, pg.locator("table.tbl tbody tr").count())
    pg.click("#mt-clear"); pg.wait_for_timeout(200)
    t("Việc của tôi: xóa bộ lọc -> thấy các task đang mở", pg.locator("table.tbl tbody tr").count()>=3 and "Việc của tôi" in pg.inner_text("#sidebar .side-link.active"))
    pg.select_option("#mt-priority","urgent"); pg.wait_for_timeout(200)
    t("Việc của tôi: lọc theo mức ưu tiên", pg.locator("table.tbl tbody tr").count()==1)
    pg.click("#mt-clear"); pg.click("#mt-tabs button[data-tab='all']"); pg.wait_for_timeout(200)
    t("Việc của tôi: tab 'Tất cả' hiện đủ task", pg.locator("table.tbl tbody tr").count()==3)
    pg.screenshot(path=OUT+"/12_my_tasks.png")
    pg.locator("table.tbl tbody tr").first.click(); pg.wait_for_url("**/board.html?project=1"); pg.wait_for_selector(".task")
    t("Việc của tôi: bấm dòng -> mở bảng Kanban của dự án", True)

    # --- Sắp xếp thứ tự trong cột (thả lên nửa trên của thẻ khác) ---
    names=lambda st: [x.split("\n")[1] if "\n" in x else x for x in pg.locator(f'.col-body[data-status="{st}"] .task').all_inner_texts()]
    ip=lambda: [i for i,x in enumerate(pg.locator('.col-body[data-status="in_progress"] .task .title').all_inner_texts())]
    titles=lambda: pg.locator('.col-body[data-status="in_progress"] .task .title').all_inner_texts()
    pos=lambda key: next(i for i,x in enumerate(titles()) if key in x)
    pg.locator(".task", has_text="Viết API CRUD").drag_to(pg.locator(".task", has_text="Dựng giao diện"), target_position={'x':60,'y':4}); pg.wait_for_timeout(400)
    t("Sắp xếp: thả lên nửa trên thẻ khác -> đứng trước nó", pos("Viết API") < pos("Dựng giao diện"), titles())
    log=json.load(urllib.request.urlopen(B+"api/_log"))
    t("Sắp xếp: gửi PATCH /move kèm before_id=2", any(l.startswith('PATCH /api/tasks/3/move') and '"before_id":2' in l for l in log), log[-3:])
    pg.locator(".task", has_text="Dựng giao diện").drag_to(pg.locator(".task", has_text="Viết API"), target_position={'x':60,'y':4}); pg.wait_for_timeout(400)
    t("Sắp xếp: kéo ngược lại -> đổi thứ tự lần nữa", pos("Dựng giao diện") < pos("Viết API"), titles())
    cnt=lambda: len([l for l in json.load(urllib.request.urlopen(B+"api/_log")) if "_log" not in l])
    n_before=cnt()
    pg.locator(".task", has_text="Dựng giao diện").drag_to(pg.locator(".task", has_text="Dựng giao diện"), target_position={'x':60,'y':4}); pg.wait_for_timeout(300)
    t("Sắp xếp: thả đúng chỗ cũ -> không gọi API thừa", cnt()==n_before)
    pg.reload(); pg.wait_for_selector(".task")
    t("Sắp xếp: thứ tự được giữ sau khi tải lại trang", pos("Dựng giao diện") < pos("Viết API"), titles())

    # --- Thời gian thực: người khác thêm task -> bảng tự cập nhật ---
    urllib.request.urlopen(urllib.request.Request(B+"api/_mutate", data=b"{}", method="POST", headers={"Content-Type":"application/json"}))
    pg.wait_for_selector(".task >> text=Task từ người khác", timeout=5000)
    t("Realtime: task do người khác tạo tự xuất hiện, không cần tải lại", True)

    # --- Thông báo (chuông) ---
    t("Chuông: hiện số chưa đọc ban đầu = 2", pg.inner_text("#bell-count")=="2")
    emit(json.dumps({"event":"notification","data":{"id":99,"type":"task_assigned","message":"Bách đã giao cho bạn task \"Test realtime\"","project_id":1,"task_id":3,"is_read":0,"created_at":"2026-11-08T10:00:00"}}))
    pg.wait_for_selector("#btn-bell.ring", timeout=3000)
    t("Chuyển động: có thông báo mới -> chuông rung + huy hiệu nảy", pg.locator(".dot-badge.bump").count()==1)
    pg.wait_for_selector("#toasts >> text=Test realtime", timeout=5000)
    t("Thông báo realtime: hiện toast ngay lập tức", True)
    t("Thông báo realtime: số trên chuông tăng 2 -> 3", pg.inner_text("#bell-count")=="3", pg.inner_text("#bell-count"))
    pg.click("#btn-bell"); pg.wait_for_selector(".notif-panel")
    t("Chuông: mở panel có 4 thông báo, 3 cái chưa đọc", pg.locator(".notif-item").count()==4 and pg.locator(".notif-item.unread").count()==3)
    pg.screenshot(path=OUT+"/8_notifications.png")
    pg.click("#btn-read-all"); pg.wait_for_timeout(300)
    t("Chuông: 'Đọc tất cả' -> mất số đỏ", pg.locator("#bell-count").count()==0 and pg.locator(".notif-item.unread").count()==0)
    pg.click("#p-desc"); pg.wait_for_timeout(200)
    t("Chuông: bấm ra ngoài thì đóng panel, không in chữ \"null\"", pg.locator(".notif-panel").count()==0 and "null" not in pg.inner_text("#bell-slot") and "null" not in pg.inner_text("#topbar"))

    # --- Hồ sơ + ảnh đại diện ---
    pg.click("#btn-profile-top"); pg.wait_for_selector("#avatar-file", state="attached")
    pg.set_input_files("#avatar-file", files=[{"name":"a.png","mimeType":"image/png","buffer":make_png(600,300)}])
    pg.wait_for_selector("#topbar img.avatar", timeout=5000)
    t("Avatar: tải ảnh -> topbar hiện ảnh", "/uploads/avatars/" in pg.get_attribute("#topbar img.avatar","src"))
    log=json.load(urllib.request.urlopen(B+"api/_log"))
    up=[l for l in log if l.startswith('POST /api/users/me/avatar')][-1]
    t("Avatar: trình duyệt tự cắt vuông + nén JPEG trước khi gửi", '"image":"data:image/jpeg;base64,' in up and len(up) < 40000, len(up))
    pg.screenshot(path=OUT+"/9_profile.png")
    pg.fill("#pf-name","Hiếu Đã Đổi Tên"); pg.click("text=Lưu họ tên"); pg.wait_for_timeout(300)
    t("Hồ sơ: đổi tên -> topbar cập nhật", "Hiếu Đã Đổi Tên" in pg.evaluate("document.querySelector('#btn-profile-top .avatar').title"))
    pg.click("text=Xóa ảnh"); pg.wait_for_timeout(300)
    t("Avatar: xóa ảnh -> quay về chữ viết tắt", pg.locator("#topbar img.avatar").count()==0)
    pg.fill("#pw-cur","saimatkhau"); pg.fill("#pw-new","abcdef"); pg.fill("#pw-new2","abcdef"); pg.click("button:has-text('Đổi mật khẩu')"); pg.wait_for_timeout(300)
    t("Đổi mật khẩu: sai mật khẩu hiện tại báo lỗi", "không đúng" in pg.inner_text(".backdrop:not(.closing) .modal"))
    pg.fill("#pw-cur","123456"); pg.click("button:has-text('Đổi mật khẩu')"); pg.wait_for_selector("#toasts >> text=Đã đổi mật khẩu")
    t("Đổi mật khẩu: thành công", True)
    pg.keyboard.press("Escape")

    # giao diện sáng + mobile
    pg.click("button[title^='Đổi giao diện']"); t("Giao diện mặc định sáng, bấm nút -> chuyển tối", pg.evaluate("document.documentElement.dataset.theme")=="dark")
    pg.set_viewport_size({'width':390,'height':800})
    pg.wait_for_timeout(500)
    for url,sel in [("dashboard.html",".project-card"),("my-tasks.html","table.tbl, .empty-state"),("board.html?project=1",".task")]:
        pg.goto(B+url); pg.wait_for_selector(sel); pg.wait_for_timeout(400)
        t("Mobile: "+url+" không bị tràn ngang", pg.evaluate("document.documentElement.scrollWidth")<=pg.evaluate("window.innerWidth")+1, pg.evaluate("document.documentElement.scrollWidth"))
    pg.screenshot(path=OUT+"/13_mobile_board.png")
    t("Mobile: thanh bên ẩn, có nút ☰", pg.locator(".menu-btn").is_visible() and pg.evaluate("document.querySelector('#sidebar').getBoundingClientRect().right")<=0)
    pg.click(".menu-btn"); pg.wait_for_timeout(300)
    t("Mobile: bấm ☰ mở ngăn kéo thanh bên", pg.locator("#sidebar.open").count()==1 and pg.evaluate("document.querySelector('#sidebar').getBoundingClientRect().left")>=0)
    pg.screenshot(path=OUT+"/7_mobile_light.png")
    pg.click("#scrim", position={'x':350,'y':400}); pg.wait_for_timeout(300)
    t("Mobile: bấm nền mờ thì đóng ngăn kéo", pg.locator("#sidebar.open").count()==0)
    # đăng xuất
    pg.set_viewport_size({'width':1366,'height':800}); pg.click("#btn-user-menu"); pg.click("#btn-logout"); pg.wait_for_url("**/login.html")
    pg.goto(B+"dashboard.html"); pg.wait_for_url("**/login.html"); t("Chưa đăng nhập vào dashboard -> về login", True)

    # --- Quên mật khẩu -> đặt lại -> đăng nhập bằng mật khẩu mới ---
    pg.goto(B+"login.html"); pg.click("#link-forgot"); pg.fill("#f-email","khong-hop-le"); pg.click("#f-btn")
    t("Quên MK: email sai định dạng bị chặn", "Email không hợp lệ" in pg.inner_text("#f-err"))
    pg.fill("#f-email","hieu.lead@uth.edu.vn"); pg.click("#f-btn"); pg.wait_for_selector("#dev-link")
    t("Quên MK: hiện thông điệp + liên kết demo", "kiểm tra email" in pg.inner_text("#f-ok") and pg.locator("#dev-link").count()==1)
    pg.screenshot(path=OUT+"/10_forgot.png")
    pg.click("#dev-link"); pg.wait_for_url("**/reset.html?token=abc")
    pg.fill("#p1","newpass1"); pg.fill("#p2","khac"); pg.click("#r-btn"); t("Đặt lại MK: nhập lại không khớp báo lỗi", "không khớp" in pg.inner_text("#r-err"))
    pg.fill("#p2","newpass1"); pg.click("#r-btn"); pg.wait_for_selector("#done:not(.hidden)")
    t("Đặt lại MK: thành công", "thành công" in pg.inner_text("#done-msg"))
    pg.goto(B+"reset.html?token=hong"); pg.fill("#p1","newpass2"); pg.fill("#p2","newpass2"); pg.click("#r-btn"); pg.wait_for_timeout(300)
    t("Đặt lại MK: token sai báo lỗi", "không hợp lệ" in pg.inner_text("#r-err"))
    pg.goto(B+"reset.html"); t("Đặt lại MK: thiếu token báo lỗi, nút bị khóa", "thiếu mã" in pg.inner_text("#r-err") and pg.is_disabled("#r-btn"))
    pg.goto(B+"login.html"); pg.fill("#l-email","hieu.lead@uth.edu.vn"); pg.fill("#l-pass","123456"); pg.click("#l-btn"); pg.wait_for_selector("#l-err:not(:empty)")
    t("Mật khẩu cũ không còn đăng nhập được", "không chính xác" in pg.inner_text("#l-err"))
    pg.fill("#l-pass","newpass1"); pg.click("#l-btn"); pg.wait_for_url("**/dashboard.html")
    t("Đăng nhập được bằng mật khẩu mới", True)
    # --- Người dùng bật "giảm chuyển động": mọi animation/transition phải tắt ---
    ctx3=b.new_context(viewport={'width':1366,'height':800}, reduced_motion="reduce"); p3=ctx3.new_page()
    p3.goto(B+"login.html"); p3.fill("#l-email","hieu.lead@uth.edu.vn"); p3.fill("#l-pass","newpass1"); p3.click("#l-btn"); p3.wait_for_url("**/dashboard.html"); p3.wait_for_selector(".project-card")
    t("Giảm chuyển động: không còn animation trên thẻ & nội dung", p3.evaluate("getComputedStyle(document.querySelector('#stats .stat')).animationName")=="none" and p3.evaluate("getComputedStyle(document.querySelector('main.container')).animationName")=="none")
    t("Giảm chuyển động: không còn transition khi rê chuột", p3.evaluate("getComputedStyle(document.querySelector('.btn')).transitionDuration")=="0s")
    dd=json.load(urllib.request.urlopen(urllib.request.Request(B+"api/dashboard", headers={"Authorization":"Bearer x"})))
    exp=[str(dd["projects"]),str(dd["total"]),str(dd["assigned_to_me"]),str(dd["overdue"])]
    t("Giảm chuyển động: số thống kê hiện đúng ngay, không đếm dần", p3.locator("#stats .num").all_inner_texts()==exp, [p3.locator("#stats .num").all_inner_texts(), exp])
    p3.click("#btn-new-project"); p3.wait_for_selector(".backdrop:not(.closing) .modal"); p3.keyboard.press("Escape")
    t("Giảm chuyển động: hộp thoại đóng tức thì", p3.locator(".backdrop").count()==0 or (p3.wait_for_timeout(120) or p3.locator(".backdrop").count()==0))
    ctx3.close()
    # --- Xóa dự án (chỉ owner) ---
    pg.goto(B+"board.html?project=1"); pg.wait_for_selector("#btn-delete-project:not(.hidden)")
    t("Xóa dự án: owner thấy nút xóa trên bảng", pg.locator("#btn-delete-project").is_visible())
    pg.click("#btn-delete-project"); pg.click(".modal .btn.danger"); pg.wait_for_url("**/dashboard.html"); pg.wait_for_selector(".side-empty")
    t("Xóa dự án: về bảng điều khiển, dự án biến mất khỏi sidebar và danh sách", pg.locator(".project-card").count()==0 and pg.locator(".side-projects a").count()==0)
    t("Không có lỗi JavaScript nào trên trang", not errors, errors)
    b.close()
print(f"\nKẾT QUẢ UI: {sum(res)}/{len(res)} PASS")

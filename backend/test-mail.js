// Thử gửi email đặt lại mật khẩu để kiểm tra cấu hình .env:
//   npm run test-mail -- ban@gmail.com
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { sendResetEmail } = require('./password.routes');

const to = process.argv[2];
if (!to) { console.error('Cách dùng: npm run test-mail -- email_nhan@gmail.com'); process.exit(1); }

(async () => {
    const base = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
    try {
        const sent = await sendResetEmail(to, `${base}/reset.html?token=THU_NGHIEM`);
        if (!sent) { console.error('CHƯA CẤU HÌNH: hãy điền SMTP_* hoặc BREVO_API_KEY trong file backend/.env'); process.exit(1); }
        console.log(`Đã gửi thư thử tới ${to}. Hãy kiểm tra hộp thư (cả mục Spam).`);
        process.exit(0);
    } catch (e) {
        console.error('GỬI THẤT BẠI:', e.message);
        if (/Invalid login|535|Username and Password/i.test(e.message)) console.error('-> Gmail cần "Mật khẩu ứng dụng" (bật xác minh 2 bước), không dùng mật khẩu đăng nhập thường.');
        if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(e.message)) console.error('-> Không kết nối được máy chủ mail: kiểm tra mạng/tường lửa, hoặc nơi deploy chặn cổng SMTP (dùng Brevo).');
        process.exit(1);
    }
})();

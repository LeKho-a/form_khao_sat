// Lớp gọi API + quản lý phiên đăng nhập (JWT lưu trong localStorage)
const API_BASE = (location.protocol === 'file:' || (location.port && location.port !== '5000'))
    ? 'http://localhost:5000' : '';

const Auth = {
    get token() { return localStorage.getItem('tm_token'); },
    get user() {
        try { return JSON.parse(localStorage.getItem('tm_user')); } catch (e) { return null; }
    },
    save(token, user) {
        localStorage.setItem('tm_token', token);
        localStorage.setItem('tm_user', JSON.stringify(user));
    },
    clear() { localStorage.removeItem('tm_token'); localStorage.removeItem('tm_user'); },
    require() { if (!this.token) location.replace('login.html'); },
    logout() { this.clear(); location.replace('login.html'); }
};

async function api(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && Auth.token) headers.Authorization = 'Bearer ' + Auth.token;

    let res;
    try {
        res = await fetch(API_BASE + '/api' + path, {
            method, headers, body: body !== undefined ? JSON.stringify(body) : undefined
        });
    } catch (e) {
        throw new Error('Không kết nối được máy chủ. Hãy kiểm tra backend đã chạy chưa!');
    }

    let data = null;
    try { data = await res.json(); } catch (e) { /* không có body */ }

    const msg = (data && data.message) || '';
    const tokenError = res.status === 401 || (res.status === 403 && /xác thực|token/i.test(msg));
    if (auth && tokenError) {
        Auth.logout();
        throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }
    if (!res.ok) {
        const err = new Error(msg || 'Có lỗi xảy ra (' + res.status + ')');
        err.status = res.status;
        throw err;
    }
    return data;
}

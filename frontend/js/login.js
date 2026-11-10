if (Auth.token) location.replace('dashboard.html');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const forms = { login: $('#form-login'), register: $('#form-register'), forgot: $('#form-forgot') };
const tabs = { login: $('#tab-login'), register: $('#tab-register') };

function showTab(name) {
    Object.keys(forms).forEach((k) => forms[k].classList.toggle('hidden', k !== name));
    const f = forms[name]; f.classList.remove('fade-in'); void f.offsetWidth; f.classList.add('fade-in');
    Object.keys(tabs).forEach((k) => tabs[k].classList.toggle('active', k === name));
}
tabs.login.onclick = () => showTab('login');
tabs.register.onclick = () => showTab('register');
$('#link-forgot').onclick = (e) => { e.preventDefault(); showTab('forgot'); $('#f-email').value = $('#l-email').value; };
$('#link-back').onclick = (e) => { e.preventDefault(); showTab('login'); };

async function doLogin(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    Auth.save(data.token, data.user);
    go('dashboard.html');
}

forms.login.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#l-email').value.trim();
    const pass = $('#l-pass').value;
    const err = $('#l-err'); err.textContent = '';
    if (!EMAIL_RE.test(email)) { err.textContent = 'Email không hợp lệ.'; return; }
    if (!pass) { err.textContent = 'Vui lòng nhập mật khẩu.'; return; }
    const btn = $('#l-btn'); btn.disabled = true;
    try { await doLogin(email, pass); }
    catch (ex) { err.textContent = ex.message; btn.disabled = false; }
});

forms.register.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#r-name').value.trim();
    const email = $('#r-email').value.trim();
    const pass = $('#r-pass').value;
    const err = $('#r-err'); err.textContent = '';
    if (!name) { err.textContent = 'Vui lòng nhập họ tên.'; return; }
    if (!EMAIL_RE.test(email)) { err.textContent = 'Email không hợp lệ.'; return; }
    if (pass.length < 6) { err.textContent = 'Mật khẩu tối thiểu 6 ký tự.'; return; }
    if (pass !== $('#r-pass2').value) { err.textContent = 'Mật khẩu nhập lại không khớp.'; return; }
    const btn = $('#r-btn'); btn.disabled = true;
    try {
        await api('/auth/register', { method: 'POST', body: { full_name: name, email, password: pass }, auth: false });
        await doLogin(email, pass); // đăng ký xong tự đăng nhập
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
});

forms.forgot.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#f-email').value.trim();
    const err = $('#f-err'); err.textContent = '';
    const ok = $('#f-ok'); ok.classList.add('hidden');
    if (!EMAIL_RE.test(email)) { err.textContent = 'Email không hợp lệ.'; return; }
    const btn = $('#f-btn'); btn.disabled = true;
    try {
        const r = await api('/auth/forgot-password', { method: 'POST', body: { email }, auth: false });
        ok.replaceChildren(h('div', { text: r.message }));
        // Chế độ DEMO (server chưa cấu hình SMTP): nhận được liên kết để dùng thử ngay
        if (r.dev_reset_link && /^https?:\/\//.test(r.dev_reset_link)) {
            ok.append(h('div', { class: 'small', style: 'margin-top:8px' },
                h('b', { text: 'Chế độ demo: ' }), h('a', { id: 'dev-link', href: r.dev_reset_link, text: 'Nhấp vào đây để đặt lại mật khẩu' })));
        }
        ok.classList.remove('hidden');
    } catch (ex) { err.textContent = ex.message; }
    btn.disabled = false;
});

if (Auth.token) location.replace('dashboard.html');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const forms = { login: $('#form-login'), register: $('#form-register') };
const tabs = { login: $('#tab-login'), register: $('#tab-register') };

function showTab(name) {
    Object.keys(forms).forEach((k) => {
        forms[k].classList.toggle('hidden', k !== name);
        tabs[k].classList.toggle('active', k === name);
    });
}
tabs.login.onclick = () => showTab('login');
tabs.register.onclick = () => showTab('register');

async function doLogin(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    Auth.save(data.token, data.user);
    location.href = 'dashboard.html';
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

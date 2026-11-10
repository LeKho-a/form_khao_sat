const token = new URLSearchParams(location.search).get('token') || '';
const rErr = $('#r-err');
if (!token) { rErr.textContent = 'Liên kết không hợp lệ: thiếu mã đặt lại. Hãy yêu cầu lại ở trang đăng nhập.'; $('#r-btn').disabled = true; }

$('#form-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    rErr.textContent = '';
    const p1 = $('#p1').value;
    if (p1.length < 6) { rErr.textContent = 'Mật khẩu tối thiểu 6 ký tự.'; return; }
    if (p1 !== $('#p2').value) { rErr.textContent = 'Mật khẩu nhập lại không khớp.'; return; }
    const btn = $('#r-btn'); btn.disabled = true;
    try {
        const r = await api('/auth/reset-password', { method: 'POST', body: { token, password: p1 }, auth: false });
        $('#form-reset').classList.add('hidden');
        $('#done-msg').textContent = r.message;
        $('#done').classList.remove('hidden');
    } catch (ex) { rErr.textContent = ex.message; btn.disabled = false; }
});

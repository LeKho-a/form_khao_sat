// Hồ sơ cá nhân: ảnh đại diện, họ tên, đổi mật khẩu
function resizeToJpeg(file, max = 256) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) return reject(new Error('Vui lòng chọn một file ảnh.'));
        if (file.size > 10 * 1024 * 1024) return reject(new Error('Ảnh quá lớn (tối đa 10MB).'));
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const side = Math.min(img.width, img.height);               // cắt vuông ở giữa
            const size = Math.min(max, side);
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh này.')); };
        img.src = url;
    });
}

function openProfileModal() {
    const u = Auth.user || {};
    const preview = h('div', { id: 'avatar-preview' });
    const drawPreview = () => {
        const cur = Auth.user || {};
        const a = avatar(cur.full_name, true, cur.avatar_url); a.classList.add('xl');
        preview.replaceChildren(a);
        btnRemove.classList.toggle('hidden', !cur.avatar_url);
    };
    const saveUser = (patch) => { Auth.save(Auth.token, { ...Auth.user, ...patch }); if (window.redrawTopbar) window.redrawTopbar(); drawPreview(); };

    const file = h('input', { type: 'file', id: 'avatar-file', accept: 'image/*', class: 'hidden' });
    const btnPick = h('button', { class: 'btn sm', type: 'button', onclick: () => file.click() }, icon('camera', 16), 'Chọn ảnh');
    const btnRemove = h('button', { class: 'btn sm danger', type: 'button', text: 'Xóa ảnh' });
    const avatarErr = h('div', { class: 'error-text' });

    file.onchange = async () => {
        avatarErr.textContent = '';
        if (!file.files[0]) return;
        try {
            const image = await resizeToJpeg(file.files[0]);
            const r = await api('/users/me/avatar', { method: 'POST', body: { image } });
            saveUser({ avatar_url: r.avatar_url });
            toast('Đã cập nhật ảnh đại diện', 'success');
        } catch (e) { avatarErr.textContent = e.message; }
        file.value = '';
    };
    btnRemove.onclick = async () => {
        try { await api('/users/me/avatar', { method: 'DELETE' }); saveUser({ avatar_url: null }); toast('Đã xóa ảnh đại diện', 'success'); }
        catch (e) { avatarErr.textContent = e.message; }
    };

    const name = h('input', { type: 'text', id: 'pf-name', maxlength: 100, value: u.full_name || '' });
    const nameErr = h('div', { class: 'error-text' });
    const btnName = h('button', { class: 'btn primary sm', type: 'button', text: 'Lưu họ tên' });
    btnName.onclick = async () => {
        nameErr.textContent = '';
        if (!name.value.trim()) { nameErr.textContent = 'Họ tên không được để trống.'; return; }
        try { const r = await api('/users/me', { method: 'PUT', body: { full_name: name.value.trim() } }); saveUser({ full_name: r.user.full_name }); toast('Đã lưu họ tên', 'success'); }
        catch (e) { nameErr.textContent = e.message; }
    };

    const cur = h('input', { type: 'password', id: 'pw-cur', autocomplete: 'current-password' });
    const nw = h('input', { type: 'password', id: 'pw-new', autocomplete: 'new-password', placeholder: 'Tối thiểu 6 ký tự' });
    const nw2 = h('input', { type: 'password', id: 'pw-new2', autocomplete: 'new-password' });
    const pwErr = h('div', { class: 'error-text' });
    const btnPw = h('button', { class: 'btn sm', type: 'button', text: 'Đổi mật khẩu' });
    btnPw.onclick = async () => {
        pwErr.textContent = '';
        if (nw.value.length < 6) { pwErr.textContent = 'Mật khẩu mới tối thiểu 6 ký tự.'; return; }
        if (nw.value !== nw2.value) { pwErr.textContent = 'Mật khẩu nhập lại không khớp.'; return; }
        try {
            await api('/users/me/password', { method: 'PUT', body: { current_password: cur.value, new_password: nw.value } });
            cur.value = nw.value = nw2.value = '';
            toast('Đã đổi mật khẩu', 'success');
        } catch (e) { pwErr.textContent = e.message; }
    };

    drawPreview();
    openModal('Hồ sơ cá nhân', h('div', null,
        h('div', { style: 'display:flex;align-items:center;gap:16px;margin-top:14px' }, preview,
            h('div', null, h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, btnPick, btnRemove, file),
                h('div', { class: 'muted small', style: 'margin-top:6px', text: 'Ảnh được cắt vuông và thu nhỏ tự động.' }), avatarErr)),
        h('label', { text: 'Email' }), h('input', { type: 'text', value: u.email || '', disabled: true }),
        h('label', { text: 'Họ và tên' }), name, nameErr, h('div', { style: 'margin-top:8px' }, btnName),
        h('h3', { class: 'section-title with-ic' }, icon('lock', 20), 'Đổi mật khẩu'),
        h('label', { text: 'Mật khẩu hiện tại' }), cur,
        h('div', { class: 'form-row' }, h('div', null, h('label', { text: 'Mật khẩu mới' }), nw), h('div', null, h('label', { text: 'Nhập lại' }), nw2)),
        pwErr, h('div', { style: 'margin-top:8px' }, btnPw)));
}

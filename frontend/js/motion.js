// Tiện ích chuyển động. Mọi hàm đều tự bỏ qua hiệu ứng khi người dùng bật "giảm chuyển động" trong hệ điều hành.
const reducedMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// Đếm số từ 0 tới giá trị cuối (ease-out)
function countUp(el, to, ms = 900) {
    to = Number(to) || 0;
    if (reducedMotion() || to === 0) { el.textContent = to; return; }
    const t0 = performance.now();
    el.textContent = '0';
    const step = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

// Cho các phần tử hiện lần lượt (so le nhau 40ms, tối đa `max` bước)
function stagger(nodes, max = 8, cls = 'enter') {
    [...nodes].forEach((n, i) => { n.classList.add(cls); n.style.setProperty('--i', Math.min(i, max)); });
    return nodes;
}

/* FLIP: ghi lại vị trí cũ -> dựng lại giao diện -> trượt mượt từ vị trí cũ sang vị trí mới */
function flipSnapshot(selector, root = document) {
    const map = new Map();
    root.querySelectorAll(selector).forEach((el) => map.set(el.dataset.id, el.getBoundingClientRect()));
    return map;
}
function flipPlay(snap, selector, onNew, root = document) {
    root.querySelectorAll(selector).forEach((el) => {
        const old = snap.get(el.dataset.id);
        if (!old) { if (onNew) onNew(el); return; }          // phần tử mới xuất hiện
        if (reducedMotion()) return;
        const now = el.getBoundingClientRect();
        const dx = old.left - now.left, dy = old.top - now.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
            { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' });
    });
}

// Thêm class chạy hiệu ứng "đi ra", chờ xong mới tiếp tục (dùng trước khi xóa phần tử)
function animateOut(el, cls = 'leaving', ms = 220) {
    return new Promise((resolve) => {
        if (!el || reducedMotion()) return resolve();
        el.classList.add(cls);
        setTimeout(resolve, ms);
    });
}

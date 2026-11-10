// Vẽ icon SVG inline (đổi màu theo chữ nhờ currentColor). Dữ liệu icon nằm trong icons-data.js.
const SVG_NS = 'http://www.w3.org/2000/svg';

function icon(name, size = 20, extraClass = '') {
    const d = ICON_DATA[name];
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('class', ('ic ' + extraClass).trim());
    svg.setAttribute('aria-hidden', 'true');   // icon chỉ để trang trí; nghĩa luôn có chữ đi kèm
    svg.setAttribute('focusable', 'false');
    if (!d) { svg.setAttribute('viewBox', '0 0 24 24'); return svg; }
    svg.setAttribute('viewBox', d.vb);
    Object.entries(d.a).forEach(([k, v]) => svg.setAttribute(k, v));
    svg.innerHTML = d.b;                        // nội dung lấy từ file icon của dự án (tĩnh, đã lọc script)
    return svg;
}

// Thay mọi <i data-icon="ten" data-size="18"></i> trong HTML tĩnh bằng SVG thật
function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
        const svg = icon(el.dataset.icon, Number(el.dataset.size) || 18, el.className);
        el.replaceWith(svg);
    });
}
document.addEventListener('DOMContentLoaded', () => hydrateIcons());

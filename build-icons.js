#!/usr/bin/env node
/**
 * Gom mọi file frontend/icons/*.svg thành frontend/js/icons-data.js (trình duyệt đọc file này).
 *
 * CÁCH THAY ICON BẰNG ICON TẢI TỪ FLATICON / MAGNIFIC / ICONS8...:
 *   1. Tải icon dạng SVG, đặt vào frontend/icons/ với ĐÚNG TÊN file cần thay (vd: kanban.svg, bell.svg).
 *   2. Chạy:  node tools/build-icons.js
 *   3. Tải lại trang (Ctrl+F5).
 * - Icon một màu: nên để fill="currentColor" để tự đổi theo giao diện sáng/tối.
 * - Icon nhiều màu giữ nguyên màu gốc của file.
 * - Nhớ ghi nguồn (attribution) trong README nếu giấy phép yêu cầu (Flaticon bản miễn phí bắt buộc).
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'frontend', 'icons');
const out = path.join(__dirname, '..', 'frontend', 'js', 'icons-data.js');
const KEEP = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule'];

const data = {};
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8').replace(/<\?xml[^>]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
    const open = raw.match(/<svg\b([^>]*)>/i);
    if (!open) { console.warn('Bỏ qua (không phải SVG hợp lệ):', file); continue; }
    if (/<script\b|\son\w+\s*=|javascript:/i.test(raw)) { console.warn('Bỏ qua (chứa mã thực thi - không an toàn):', file); continue; }
    const attrs = {};
    for (const m of open[1].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[m[1]] = m[2];
    let vb = attrs.viewBox;
    if (!vb && attrs.width && attrs.height) vb = `0 0 ${parseFloat(attrs.width)} ${parseFloat(attrs.height)}`;
    if (!vb) { console.warn('Bỏ qua (thiếu viewBox):', file); continue; }
    const a = {};
    KEEP.forEach((k) => { if (attrs[k] !== undefined) a[k] = attrs[k]; });
    const body = raw.replace(/^[\s\S]*?<svg\b[^>]*>/i, '').replace(/<\/svg>\s*$/i, '').trim();
    data[file.replace(/\.svg$/, '')] = { vb, a, b: body };
}

const banner = '// TỰ ĐỘNG SINH bởi tools/build-icons.js từ thư mục frontend/icons - đừng sửa tay.\n';
fs.writeFileSync(out, banner + 'const ICON_DATA = ' + JSON.stringify(data) + ';\n');
console.log(`Đã tạo ${path.relative(process.cwd(), out)} với ${Object.keys(data).length} icon.`);

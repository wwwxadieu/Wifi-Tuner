# build/

Thư mục tài nguyên đóng gói (`buildResources` của electron-builder).

- `icon.ico` — icon ứng dụng Windows (multi-res: 16/24/32/48/64/128/256px), khai báo ở `package.json` (`build.win.icon`).
- `icon.png` (512×512) — icon cửa sổ Electron (`BrowserWindow` config) và nguồn dự phòng cho các nền tảng khác.
- `tray-icon.png` (32×32) — icon khay hệ thống (system tray), dùng ở `electron/main.js`.

Đây là icon placeholder (khối gradient xanh SF Blue/Teal + biểu tượng sóng WiFi), có thể thay bằng logo thương hiệu thật sau — chỉ cần giữ đúng tên file và kích thước tương ứng.

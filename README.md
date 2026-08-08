# WiFi Tuner

Ứng dụng desktop Windows chẩn đoán và tối ưu tốc độ WiFi: speed test, đọc cấu hình mạng, quét WiFi lân cận, kiểm tra driver.

## Kiến trúc

Ứng dụng desktop thuần (không có server/cloud backend, không cần tài khoản):

```
Renderer (Next.js/React UI)
        │ fetch nội bộ (127.0.0.1)
Next.js API routes (Node, trong tiến trình Electron main)
        │ child_process
PowerShell / netsh (chỉ đọc — Get-NetAdapter, Get-NetTCPSetting, Get-DnsClientServerAddress, netsh wlan show networks)
```

- **Speed test**: dùng [`@cloudflare/speedtest`](https://www.npmjs.com/package/@cloudflare/speedtest) (đo qua hạ tầng Cloudflare, chạy hoàn toàn phía client/renderer).
- **Đọc cấu hình hệ thống**: `lib/networkInfo.ts` — chỉ gọi các lệnh PowerShell dạng `Get-*`, trả JSON, không chỉnh sửa gì.
- **Quét WiFi lân cận**: `lib/wifiScan.ts` — parse output của `netsh wlan show networks mode=bssid` (hỗ trợ nhãn tiếng Anh và tiếng Việt).
- **So sánh độ trễ DNS**: `lib/ping.ts` — đo bằng bắt tay TCP tới cổng 53 (không cần quyền ICMP/admin), giới hạn host được phép ở DNS công cộng đã biết + dải IP LAN riêng.
- Khi chạy ngoài Windows (ví dụ máy dev Linux/macOS), các API tự động trả **dữ liệu mẫu** (`lib/mock.ts`) để giao diện vẫn dùng được — có banner cảnh báo rõ trong UI.

## Trạng thái hiện tại — Giai đoạn 1 (MVP, chỉ đọc)

- [x] Speed test (download/upload/ping/jitter) + lịch sử lưu `localStorage`
- [x] Dashboard đọc cấu hình: adapter WiFi, TCP/IP, DNS, power management
- [x] Quét WiFi lân cận + gợi ý kênh 2.4GHz ít nhiễu nhất
- [x] So sánh độ trễ DNS hiện tại vs DNS công cộng
- [ ] **Chưa** chỉnh sửa bất kỳ cấu hình hệ thống nào (đó là Giai đoạn 2)

## Roadmap

| Giai đoạn | Nội dung |
|---|---|
| 1 (xong) | Đọc cấu hình, speed test, quét WiFi — không cần quyền admin |
| 2 | Nút "Tối ưu 1-chạm" (đổi DNS, tắt tiết kiệm điện adapter, TCP tuning) — elevate qua UAC riêng cho từng thao tác, luôn backup giá trị cũ để **Hoàn tác** |
| 3 | Cảnh báo driver cũ + link cập nhật, lịch sử dài hạn (SQLite), lên lịch tự động speed test |
| 4 | Icon/branding, code signing, polish UI |

## Chạy dự án

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000). Trên máy không phải Windows sẽ thấy dữ liệu mẫu (banner màu vàng).

## Build ứng dụng Windows

```bash
npm install
npm run electron:dist:win
```

Kết quả nằm trong `release/` (NSIS installer `.exe` + bản portable). Build có thể chạy trên Linux/macOS/Windows nhờ `electron-builder` (trên Linux cần cài `wine`). File chưa được ký (unsigned) nên Windows SmartScreen sẽ cảnh báo lần chạy đầu — chọn "Run anyway".

App yêu cầu PowerShell (có sẵn trên mọi bản Windows 10/11) để đọc thông tin adapter/TCP/DNS và quét WiFi. Giai đoạn 1 **không cần quyền admin** — mọi lệnh đều chỉ đọc.

# RentMgr - Requirements & Decisions

## Overview
**RentMgr** (Quản lý phòng trọ) — Ứng dụng PWA quản lý phòng trọ, thiết kế cho chủ trọ người Việt. Hoạt động offline hoàn toàn trên mobile, không cần server.

---

## Requirements

### Core Features
- [x] **Room Management** — Thêm, sửa, xóa phòng trọ với tên, giá (đơn vị 1000đ), đặt cọc, và tên người thuê
- [x] **Tenant Management** — Thêm, sửa, xóa người thuê với tên, SĐT, số CCCD/CMND, và ngày hợp đồng
- [x] **Room-Tenant Linking** — Mỗi phòng liên kết 1 người thuê; thêm người thuê tự chuyển phòng sang "occupied", xóa thì tự reset về "vacant"
- [x] **Contract Tracking** — Hiển thị trạng thái hợp đồng: còn hiệu lực, sắp hết hạn (≤30 ngày), đã hết hạn
- [x] **Bill Calculation** — Tính tiền hàng tháng gồm tiền phòng + điện + nước; lưu vào phòng, hiển thị trên card
- [x] **Electricity Meter Readings** — Lưu số điện cũ/mới trên phòng; tự tính kWh = mới - cũ; sau khi tính xong tự cuộn số
- [x] **Bill Image Export** — Xuất hóa đơn ra file JPEG (Canvas API) để gửi cho người thuê
- [x] **Search** — Lọc phòng/người thuê theo tên, SĐT, tên phòng
- [x] **Backup/Restore** — Xuất toàn bộ dữ liệu ra file JSON, nhập lại từ JSON (ghi đè dữ liệu cũ)
- [x] **Voice Feedback** — Thông báo giọng nói tiếng Việt cho các thao tác chính
- [x] **Settings** — Cài giá điện (đ/kWh), giá nước (đ/người), bật/tắt giọng nói
- [x] **PWA / Offline** — Cài được trên điện thoại, hoạt động hoàn toàn offline qua Service Worker

### UI/UX
- [x] Ngôn ngữ tiếng Việt (vi-VN)
- [x] Dark theme
- [x] Mobile-first, portrait orientation
- [x] Side menu navigation (Phòng, Người thuê, Cài đặt, Sao lưu)
- [x] Modal-based forms và detail views
- [x] FAB (floating action button) để thêm nhanh
- [x] Quick backup button trên header
- [x] Toast notifications
- [x] Nút "Tính tiền" trực tiếp trên card phòng

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Pure HTML/CSS/JS — no framework** | Zero build step, dễ host trên GitHub Pages |
| 2 | **IndexedDB for storage** | Offline-first; dung lượng lớn hơn localStorage; hỗ trợ structured data |
| 3 | **Single-page app with JS routing** | Không reload trang; UX mượt hơn trên mobile |
| 4 | **JSON file for backup** | Đơn giản, portable, không cần server |
| 5 | **Vietnamese-only UI** | Target users là chủ trọ người Việt |
| 6 | **One tenant per room** | Model đơn giản cho phiên bản đầu |
| 7 | **No floor field** | Tên phòng đã ngụ ý tầng (VD: "Phòng 201" = tầng 2) |
| 8 | **Price in 1000đ units** | Input đơn giản hơn — nhập 3000 thay vì 3.000.000 |
| 9 | **Tenant name in room form** — | Workflow nhanh — thêm phòng + người thuê 1 bước, status tự cập nhật |
| 10 | **Deposit field on room** | Tiền đặt cọc — dùng khi người thuê bỏ phòng không thông báo |
| 11 | **Settings-driven billing** | Giá điện/nước cài global, dùng chung cho tất cả phòng |
| 12 | **Bill saved per room** | Lưu `lastBill` + `lastBillMonth` vào phòng để hiển thị lại mà không cần tính lại |
| 13 | **Auto month detection** | Nếu ngày ≥ 25 hoặc ≤ 5 → tháng hiện tại; còn lại → tháng trước |
| 14 | **Meter readings on room** | `electricOld` / `electricNew` lưu trên phòng; kWh tính tự động, không cho nhập tay |
| 15 | **Meter roll-over after billing** | Sau khi tính tiền: electricNew → electricOld, electricNew = null; kỳ sau chỉ cần nhập số mới |
| 16 | **Water price in 1000đ** | Đơn vị giá nước là 1000đ/người (giống giá phòng/đặt cọc) để nhập số nhỏ hơn |
| 17 | **Bill export as JPEG** | Dùng Canvas API vẽ hóa đơn, xuất JPEG — không cần thư viện ngoài, hoạt động offline |

---

## Data Model

### Room
```
id            string    Auto-generated (room_<timestamp>_<random>)
name          string    Tên phòng (bắt buộc)
price         number    Giá thuê (đơn vị 1000đ)
deposit       number    Tiền đặt cọc (đơn vị 1000đ)
status        string    'occupied' | 'vacant'
electricOld   number    Chỉ số điện kỳ trước
electricNew   number    Chỉ số điện kỳ này (null sau khi đã tính tiền)
lastBill      number    Tổng tiền lần tính gần nhất (VNĐ)
lastBillMonth string    Tháng tính tiền (VD: "3/2026")
createdAt     string    ISO date
updatedAt     string    ISO date
```

### Tenant
```
id            string    Auto-generated (tenant_<timestamp>_<random>)
name          string    Tên người thuê (bắt buộc)
phone         string    Số điện thoại
idNumber      string    Số CCCD/CMND
roomId        string    Foreign key → Room
contractStart string    ISO date
contractEnd   string    ISO date
createdAt     string    ISO date
updatedAt     string    ISO date
```

### Setting (key-value)
```
voiceEnabled    boolean   Bật/tắt giọng nói
electricPrice   number    Giá điện (đ/kWh)
waterPrice      number    Giá nước (1000đ/người/tháng)
```

---

## Future Considerations
- [ ] Lịch sử thanh toán hàng tháng
- [ ] Ghi số nước theo kỳ (meter readings, tương tự điện)
- [ ] Nhiều người thuê / 1 phòng
- [ ] Đính kèm ảnh (ảnh phòng, ảnh CCCD)
- [ ] Cloud sync

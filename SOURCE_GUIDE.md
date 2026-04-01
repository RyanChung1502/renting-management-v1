# RentMgr - Source Code Guide

Hướng dẫn đọc và hiểu mã nguồn cho dự án **RentMgr**.

---

## Cấu trúc thư mục

```
rent-management/
├── index.html              # Entry point — HTML skeleton + khởi động app
├── manifest.json           # PWA config (tên app, icon, màu theme)
├── sw.js                   # Service Worker — cache offline
│
├── css/
│   └── style.css           # Toàn bộ styling (~710 dòng)
│
├── js/
│   ├── app.js              # Entry point — init, routing, event listeners (~148 dòng)
│   ├── state.js            # Shared state (currentPage, searchQuery, voiceEnabled)
│   ├── helpers.js           # Utility functions (format, $, toast, kWh calc)
│   ├── voice.js            # Text-to-Speech (Web Speech API)
│   ├── ui.js               # Modal, menu, share/copy
│   ├── billing.js          # Tính tiền + xuất text hóa đơn
│   ├── canvas-export.js    # Xuất ảnh (bảng điện, tổng hợp tiền, hóa đơn)
│   ├── db.js               # Database layer — IndexedDB wrapper (~246 dòng)
│   └── pages/
│       ├── rooms.js        # CRUD phòng (list, detail, form, delete)
│       ├── tenants.js      # CRUD người thuê
│       ├── electric.js     # Trang nhập số điện theo tháng
│       ├── settings.js     # Trang cài đặt
│       └── backup.js       # Trang sao lưu / khôi phục
│
├── icon-192.png            # Icon PWA 192x192
├── icon-512.png            # Icon PWA 512x512
├── qr-code.png             # QR code app
├── REQUIREMENTS.md         # Yêu cầu + quyết định thiết kế
└── SOURCE_GUIDE.md         # File này
```

---

## Kiến trúc ES Modules

App dùng ES modules (`import`/`export`). `index.html` chỉ có 1 script tag:

```html
<script type="module" src="js/app.js"></script>
```

### Dependency graph

```
app.js (entry point)
├── state.js
├── helpers.js
├── voice.js
├── ui.js
├── db.js
├── pages/rooms.js
│   ├── billing.js
│   │   ├── canvas-export.js
│   │   └── ui.js
│   └── pages/tenants.js (dynamic import)
├── pages/tenants.js
├── pages/electric.js
│   └── canvas-export.js
├── pages/settings.js
└── pages/backup.js
```

**Tránh circular dependency:** `renderPage()` được lưu vào `state.renderPage` bởi `app.js`, các module khác gọi `state.renderPage()` thay vì import trực tiếp.

---

## js/state.js — Shared State

```javascript
const state = {
    currentPage: 'rooms',      // Trang đang hiển thị
    searchQuery: '',            // Từ khóa tìm kiếm
    voiceEnabled: false,        // Bật/tắt giọng nói
    renderPage: null,           // Set bởi app.js khi init
};
```

---

## js/helpers.js — Utilities

| Function | Mô tả |
|----------|-------|
| `$(sel)` | `document.querySelector(sel)` shorthand |
| `showToast(msg)` | Toast notification 2.5s |
| `formatCurrency(amount)` | Format VNĐ (đơn vị 1000đ → "3.000.000đ") |
| `formatDate(dateStr)` | Format ngày tiếng Việt |
| `getContractStatus(endDate, hasStart)` | Trạng thái hợp đồng (active/expiring/expired) |
| `getBillMonth()` | Auto-detect tháng tính tiền (>=25 hoặc <=5 → tháng này, còn lại → tháng trước) |
| `getPrevMonth(monthKey)` | "3/2026" → "2/2026", "1/2026" → "12/2025" |
| `getKwhForMonth(meters, monthKey)` | Tính kWh = reading[tháng] - reading[tháng trước] |

---

## js/db.js — Database Layer

Wrapper class cho IndexedDB. Toàn bộ code khác chỉ gọi qua class này.

### Database schema
- **Tên DB:** `RentMgrDB` (version 3)
- **Object stores:**

| Store | Key | Index |
|-------|-----|-------|
| `rooms` | `id` | `name`, `status` |
| `tenants` | `id` | `name`, `roomId`, `phone` |
| `electricMeters` | `id` | `roomId`, `month` |
| `settings` | `key` | — |

### API chính

```javascript
// Rooms
db.getAllRooms() / db.getRoom(id) / db.saveRoom(room) / db.deleteRoom(id)

// Tenants
db.getAllTenants() / db.getTenant(id) / db.getTenantsByRoom(roomId)
db.saveTenant(tenant) / db.deleteTenant(id)

// Electric Meters
db.getAllMeters() / db.getMetersByRoom(roomId)
db.saveMeter(meter) / db.deleteMeter(id)

// Settings
db.getSetting(key) / db.saveSetting(key, value)

// Backup
db.exportAll() / db.importAll(backup)
```

---

## js/app.js — Entry Point

Chỉ ~148 dòng. Vai trò:
1. Import tất cả modules
2. Setup event listeners (search, menu, FAB, modal, backup, refresh)
3. Init DB + load settings
4. Routing qua `renderPage()` → gọi render function của từng page

---

## js/voice.js — Text-to-Speech

```javascript
speak(viText, enText)  // Nói tiếng Việt, fallback tiếng Anh
getCachedVoices()       // Lấy danh sách voices đã cache
```

---

## js/ui.js — UI Components

```javascript
openMenu() / closeMenu()       // Side menu
openModal(title, html) / closeModal()  // Modal dialog
shareOrCopy(text, toastMsg)    // Web Share API, fallback clipboard
```

---

## js/pages/rooms.js — Room Management

### renderRoomList()
- Lấy tất cả phòng + tenants
- Filter theo `state.searchQuery`
- Sort: occupied trước → theo tên
- Render cards với event delegation (không dùng inline onclick)

### showRoomDetail(roomId)
- Modal chi tiết phòng + người thuê
- Nút: Tính tiền, Sửa, Xóa, Sửa/Thêm người thuê

### showRoomForm(roomId?)
- Form thêm/sửa phòng
- Fields: Tên phòng*, Giá thuê, Đặt cọc, Tên người thuê (quick-add)
- Auto-update room status based on tenant name

---

## js/billing.js — Bill Calculation

### showBillForm(roomId)
- Modal tính tiền cho 1 phòng
- **Chọn tháng:** dropdown tháng + input năm, mặc định tháng hiện tại
- Auto-hiển thị kWh từ meter readings khi đổi tháng
- Công thức:
  ```
  Tiền phòng = room.price × 1000
  Tiền nước  = sốNgười × waterPrice × 1000
  Tiền điện  = kWh × electricPrice
  ─────────────────────────────────
  Tổng cộng  = phòng + nước + điện
  ```
- Lưu `lastBill`, `lastBillMonth`, `lastBillDetails` vào room

### calculateAllBills()
- Tính tiền tất cả phòng occupied cho tháng hiện tại

### exportBill(roomId)
- Xuất text hóa đơn → Web Share / clipboard

---

## js/pages/electric.js — Electric Meter Page

### renderElectricPage()
- Hiển thị tất cả phòng với **12 ô input** (T1-T12) cho năm hiện tại
- Mỗi ô = chỉ số điện đầu tháng đó
- kWh tự tính = số tháng này - số tháng trước
- Ô "Số người" riêng per room
- Nút "Lưu" per room → save tất cả readings + people count

---

## js/canvas-export.js — Image Export

### exportElectricTable(rooms, meterMap, billMonth)
- Vẽ bảng số điện cả năm lên Canvas → PNG
- Rows: mỗi phòng, Columns: T1-T12 + Tổng
- Mỗi ô: chỉ số + kWh (đỏ)

### exportAllBills()
- Bảng tổng hợp tiền tất cả phòng → PNG

### exportBillImage(data)
- Hóa đơn 1 phòng → JPEG 800×500

---

## js/pages/settings.js — Settings

| Key | Type | Mô tả |
|-----|------|-------|
| `voiceEnabled` | boolean | Bật/tắt giọng nói |
| `electricPrice` | number | Giá điện (đ/kWh) |
| `waterPrice` | number | Giá nước (1000đ/người/tháng) |

---

## js/pages/backup.js — Backup & Restore

- **Export:** Tải JSON (rentmgr-backup-YYYY-MM-DD.json)
- **Import:** Upload JSON → xóa data cũ → import mới (DESTRUCTIVE)

---

## css/style.css — Styling

### CSS Variables (Dark Theme)
```css
:root {
  --bg-primary:    #0f0f1a;
  --bg-secondary:  #1a1a2e;
  --bg-card:       #16213e;
  --accent:        #e94560;
  --success:       #2ecc71;
  --warning:       #f39c12;
  --danger:        #e74c3c;
}
```

### Layout chính
- `<header>`: sticky top, 56px
- `<main>`: padding-bottom 80px (tránh FAB)
- `.modal`: fixed, slide-up, max-height 90vh
- `.fab`: fixed bottom-right

---

## sw.js — Service Worker

Cache-first strategy. Tăng `CACHE_NAME` version khi deploy update.

```javascript
const CACHE_NAME = 'rentmgr-v26';
const ASSETS = [/* tất cả JS modules + CSS + HTML */];
```

---

## Luồng hoạt động

```
User mở app
    │
    ▼
index.html → <script type="module" src="js/app.js">
    │
    ▼
app.js: db.init() → load settings → setupEventListeners() → renderPage('rooms')
    │
    ├── Menu click     → state.currentPage = X → renderPage()
    ├── Room card      → showRoomDetail() → modal
    ├── FAB (+)        → showRoomForm() / showTenantForm()
    ├── Tính tiền      → showBillForm() → chọn tháng → tính → export
    ├── Tab Điện       → renderElectricPage() → nhập số điện T1-T12
    └── Search         → state.searchQuery = X → renderPage()
```

---

## Tips khi đọc code

1. **Tìm feature:** Mỗi page nằm trong `js/pages/<tên>.js`
2. **Tính tiền:** Logic ở `js/billing.js`
3. **Xuất ảnh:** Logic ở `js/canvas-export.js`
4. **Thay đổi style:** Sửa CSS variables trong `:root {}`
5. **Debug DB:** DevTools → Application → IndexedDB → RentMgrDB
6. **Update cache:** Tăng số trong `CACHE_NAME` ở `sw.js`
7. **Tránh circular import:** Dùng `state.renderPage()` hoặc dynamic `import()`

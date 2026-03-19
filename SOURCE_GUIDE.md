# RentMgr - Source Code Guide

Hướng dẫn đọc và hiểu mã nguồn cho dự án **RentMgr**.

---

## Cấu trúc thư mục

```
renting-management-v1/
├── index.html          # Entry point — HTML skeleton + khởi động app
├── manifest.json       # PWA config (tên app, icon, màu theme)
├── sw.js               # Service Worker — cache offline
│
├── css/
│   └── style.css       # Toàn bộ styling (~605 dòng)
│
├── js/
│   ├── db.js           # Database layer — wrapper cho IndexedDB (~216 dòng)
│   └── app.js          # Application logic — toàn bộ UI + business logic (~815 dòng)
│
├── icon-192.png        # Icon PWA 192x192
├── icon-512.png        # Icon PWA 512x512
├── qr-code.png         # QR code app
├── REQUIREMENTS.md     # Yêu cầu + quyết định thiết kế
└── SOURCE_GUIDE.md     # File này
```

---

## index.html

File HTML tối giản — chỉ chứa skeleton, không có nội dung động.

**Vai trò:**
- Load CSS và JS
- Đăng ký Service Worker cho PWA
- Cung cấp các container HTML cố định (header, main, menu, modals)

**Cấu trúc HTML chính:**
```
<header>        — Thanh tiêu đề cố định (title + action buttons)
<div#search-bar>— Thanh tìm kiếm (ẩn/hiện toggle)
<main>          — Vùng nội dung chính (render bởi app.js)
<div#menu>      — Side menu (slide từ trái)
<div#overlay>   — Overlay khi mở menu/modal
```

---

## js/db.js — Database Layer

Wrapper class cho IndexedDB. Toàn bộ code khác chỉ gọi qua class này, không động trực tiếp vào IndexedDB.

### Database schema
- **Tên DB:** `RentMgrDB` (version 2)
- **Object stores:**

| Store | Key | Index |
|-------|-----|-------|
| `rooms` | `id` | `name`, `status` |
| `tenants` | `id` | `name`, `roomId`, `phone` |
| `settings` | `key` | — |

### Khởi tạo
```javascript
const db = new Database();
await db.init();  // Mở IndexedDB, tạo stores nếu chưa có
```

### CRUD chung
```javascript
db.getAll(storeName)              // Lấy tất cả records
db.getById(storeName, id)         // Lấy 1 record theo primary key
db.put(storeName, data)           // Insert hoặc Update
db.delete(storeName, id)          // Xóa record
db.getByIndex(store, index, val)  // Query theo index
```

### Room operations
```javascript
db.getAllRooms()          // Lấy tất cả phòng
db.getRoom(id)           // Lấy 1 phòng
db.saveRoom(room)        // Lưu phòng (auto-generate id nếu mới)
db.deleteRoom(id)        // Xóa phòng + cascade xóa người thuê
```

### Tenant operations
```javascript
db.getAllTenants()              // Lấy tất cả người thuê
db.getTenant(id)               // Lấy 1 người thuê
db.getTenantsByRoom(roomId)    // Lấy người thuê theo phòng
db.saveTenant(tenant)          // Lưu người thuê (auto-generate id)
db.deleteTenant(id)            // Xóa người thuê
```

### Settings operations
```javascript
db.getSetting(key)          // Lấy 1 setting theo key
db.saveSetting(key, value)  // Lưu setting
db.getAllSettings()          // Lấy tất cả settings
```

### Backup/Restore
```javascript
db.exportAll()         // Trả về object { version, exportedAt, data: {rooms, tenants, settings} }
db.importAll(backup)   // Xóa toàn bộ data cũ, import từ backup object
```

### Auto-generate ID
```javascript
// Pattern: prefix_<timestamp>_<random5chars>
// Ví dụ: room_1711234567890_a1b2c
//        tenant_1711234567890_x9y8z
```

---

## js/app.js — Application Logic

File chính chứa toàn bộ UI logic và business logic. ~815 dòng.

### Global state
```javascript
let currentPage = 'rooms';   // Trang đang hiển thị
let searchQuery = '';         // Từ khóa tìm kiếm hiện tại
let voices = [];              // Danh sách voices từ Web Speech API
```

### Khởi động app
Khi DOM load xong:
```
1. db.init()                    — Khởi tạo IndexedDB
2. loadVoiceEnabled()           — Đọc setting voiceEnabled từ DB
3. loadVoices()                 — Tải danh sách voices TTS
4. setupEventListeners()        — Gắn toàn bộ event handlers
5. renderPage()                 — Render trang đầu tiên (rooms)
```

### Routing
Không có URL routing — chỉ dùng biến `currentPage`:
```javascript
function renderPage() {
  switch (currentPage) {
    case 'rooms':    renderRoomList();     break;
    case 'tenants':  renderTenantList();   break;
    case 'settings': renderSettingsPage(); break;
    case 'backup':   renderBackupPage();   break;
  }
}
```

Chuyển trang: cập nhật `currentPage` rồi gọi `renderPage()`.

---

### Room Management

#### renderRoomList()
- Lấy tất cả phòng từ DB
- Apply filter nếu có `searchQuery`
  - Tìm theo tên phòng
  - Tìm theo tên người thuê (load thêm tenants)
- Sort: phòng occupied trước, rồi sort theo tên
- Render từng phòng thành card HTML

#### Card phòng (HTML)
```
┌─────────────────────────────┐
│ [Tên phòng]   [badge status]│
│ [giá/tháng]   [tiền bill]   │
│ [badge HĐ nếu occupied]     │
│ [Tính tiền] [Sửa]           │
└─────────────────────────────┘
```

#### showRoomDetail(roomId)
- Mở modal chi tiết phòng
- Hiển thị thông tin phòng + người thuê
- Nút: Tính tiền, Sửa phòng, Xóa phòng

#### showRoomForm(roomId?)
- Mở form thêm/sửa phòng
- Fields: Tên phòng*, Giá thuê, Đặt cọc, Tên người thuê (quick-add)
- Submit → `saveRoom()`

#### saveRoom()
Logic khi submit form:
```
1. Validate tên phòng (required)
2. Nếu có tên người thuê:
   - Tạo hoặc cập nhật tenant record
   - Liên kết với roomId
   - Set room.status = 'occupied'
3. Nếu xóa tên người thuê (ô để trống khi edit):
   - Xóa tenant cũ khỏi DB
   - Set room.status = 'vacant'
4. db.saveRoom(room)
5. Toast + speak "Đã lưu phòng [tên]"
6. renderPage()
```

#### deleteRoom(roomId)
```
1. Hiển thị modal xác nhận
2. db.deleteRoom(id)  — cascade xóa tenant
3. Toast + speak "Đã xóa phòng"
4. renderPage()
```

---

### Bill Calculation

#### showBillForm(roomId)
- Mở modal tính tiền cho phòng
- Auto-detect tháng:
  ```javascript
  const day = new Date().getDate();
  // day >= 25 hoặc day <= 5 → tháng hiện tại
  // còn lại → tháng trước
  ```
- Fields: Số người, Số kWh điện
- Submit → `calculateBill()`

#### calculateBill()
Công thức:
```
Tiền phòng  = room.price × 1000
Tiền nước   = soNguoi × waterPrice
Tiền điện   = soKwh × electricPrice
──────────────────────────────────
Tổng cộng   = tiền phòng + nước + điện
```

Sau khi tính:
```
1. Lưu room.lastBill = tổng
2. Lưu room.lastBillMonth = "M/YYYY"
3. db.saveRoom(room)
4. Hiển thị breakdown trong modal
5. speak("[Tổng] đồng") nếu voice enabled
6. renderPage()  — cập nhật card hiển thị lastBill
```

---

### Tenant Management

#### renderTenantList()
- Lấy tất cả người thuê từ DB
- Apply filter theo `searchQuery` (tên, SĐT, tên phòng)
- Sort theo tên A-Z
- Render từng người thuê thành card

#### Contract Status Logic
```javascript
function getContractStatus(tenant) {
  if (!contractEnd) → "Không có HĐ" (gray)

  daysLeft = (contractEnd - today) / 86400000

  if (daysLeft < 0)   → "Hết hạn" (red)
  if (daysLeft ≤ 30)  → "Còn N ngày" (yellow)
  else                → "Còn hiệu lực" (green)
}
```

#### saveTenant()
```
1. Validate tên (required)
2. Nếu có roomId mới:
   - Set room.status = 'occupied'
   - db.saveRoom(room)
3. Nếu có roomId cũ khác roomId mới:
   - Set room cũ về 'vacant'
   - db.saveRoom(room cũ)
4. db.saveTenant(tenant)
5. Toast + speak "Đã lưu người thuê [tên]"
6. renderPage()
```

---

### Voice System (Text-to-Speech)

Dùng Web Speech API — hoạt động offline.

#### Khởi tạo
```javascript
function loadVoices() {
  voices = speechSynthesis.getVoices();
  // Lắng nghe voiceschanged event (cần thiết trên Android)
  speechSynthesis.onvoiceschanged = () => {
    voices = speechSynthesis.getVoices();
  };
}
```

#### speak(viText, enText)
```javascript
function speak(viText, enText) {
  if (!voiceEnabled) return;

  speechSynthesis.cancel();  // Hủy speech đang chạy

  // Tìm voice tiếng Việt
  const viVoice = voices.find(v => v.lang.startsWith('vi'));

  const utterance = new SpeechSynthesisUtterance(
    viVoice ? viText : enText  // fallback sang tiếng Anh
  );
  utterance.voice = viVoice || null;
  utterance.rate = 1;
  utterance.volume = 1;

  speechSynthesis.speak(utterance);
}
```

#### Các sự kiện có voice:
| Sự kiện | Tiếng Việt |
|---------|-----------|
| Lưu phòng | "Đã lưu phòng [tên]" |
| Xóa phòng | "Đã xóa phòng" |
| Lưu người thuê | "Đã lưu người thuê [tên]" |
| Xóa người thuê | "Đã xóa người thuê" |
| Tính tiền | "[Số tiền] đồng" |
| Sao lưu | "Đã sao lưu" |
| Lưu cài đặt | "Đã lưu cài đặt" |
| Test voice | "Xin chào, đây là giọng nói của ứng dụng" |

---

### Settings Page

Settings được lưu vào IndexedDB dạng key-value.

| Key | Type | Mô tả |
|-----|------|-------|
| `voiceEnabled` | boolean | Bật/tắt giọng nói |
| `electricPrice` | number | Giá điện (đ/kWh) |
| `waterPrice` | number | Giá nước (đ/người/tháng) |

Settings load lên form khi mở trang Settings, lưu lại khi nhấn "Lưu cài đặt".

---

### Backup & Restore

#### Export
```javascript
// Quick export (header button): rentmgr-latest.json
// Full export (backup page): rentmgr-backup-YYYY-MM-DD.json

const data = await db.exportAll();
// data = { version: 2, exportedAt: "ISO", data: { rooms, tenants, settings } }

// Tạo Blob → download link → click()
```

#### Import
```javascript
// Đọc file JSON → parse → validate structure
// db.importAll(backup) — xóa toàn bộ data cũ, import mới
// DESTRUCTIVE: không thể undo
```

---

## css/style.css — Styling

### CSS Variables (Dark Theme)
```css
:root {
  --bg-primary:    #0f0f1a;   /* Nền chính */
  --bg-secondary:  #1a1a2e;   /* Nền phụ */
  --bg-card:       #16213e;   /* Nền card */
  --accent:        #e94560;   /* Màu nhấn (đỏ/hồng) */
  --accent-light:  #ff6b81;   /* Màu nhấn sáng */
  --success:       #2ecc71;   /* Xanh lá (vacant, active) */
  --warning:       #f39c12;   /* Cam (sắp hết hạn) */
  --danger:        #e74c3c;   /* Đỏ (expired, occupied) */
  --text-primary:  #eee;
  --text-secondary:#aaa;
}
```

### Layout chính
- `<header>`: sticky top, height 56px
- `<main>`: padding-bottom 80px (tránh FAB)
- `.modal`: fixed, slide-up từ bottom, max-height 90vh, scrollable
- `.fab`: fixed bottom-right 20px

### Animations
- Modal slide-up: `transform: translateY(0)` — 0.3s ease
- Menu slide-in: `transform: translateX(0)` — 0.3s ease
- Toast: slide-up 0.3s, auto-dismiss sau 3s
- Card press: `transform: scale(0.98)`

---

## sw.js — Service Worker

Cache-first strategy:

```javascript
const CACHE_NAME = 'rentmgr-v14';  // Tăng số version khi deploy update
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/db.js', './js/app.js', './manifest.json'
];

// Install: cache tất cả assets
// Activate: xóa cache version cũ
// Fetch: trả về từ cache, fallback network nếu miss
```

**Lưu ý khi update:** Tăng `CACHE_NAME` (VD: `rentmgr-v15`) để người dùng nhận bản mới.

---

## Luồng hoạt động tổng thể

```
User mở app
    │
    ▼
index.html load
    │
    ▼
app.js: db.init() → IndexedDB ready
    │
    ▼
setupEventListeners()   ← Gắn click handlers cho tất cả buttons/links
    │
    ▼
renderPage('rooms')     ← Hiển thị danh sách phòng mặc định
    │
    ├── User click menu item → currentPage = X → renderPage()
    ├── User click card      → showRoomDetail() / showTenantDetail()
    ├── User click FAB (+)   → showRoomForm() / showTenantForm()
    ├── User submit form     → saveRoom() / saveTenant() → renderPage()
    ├── User click Tính tiền → showBillForm() → calculateBill()
    └── User search          → searchQuery = X → renderPage()
```

---

## Tips khi đọc code

1. **Tìm feature nào:** Ctrl+F tên function, VD: `showBillForm`, `calculateBill`, `saveRoom`
2. **Thêm field mới cho Room:** Sửa form HTML trong `showRoomForm()`, xử lý trong `saveRoom()`, hiển thị trong `renderRoomCard()` và `showRoomDetail()`
3. **Thay đổi màu/style:** Sửa CSS variables trong `:root {}` ở đầu `style.css`
4. **Debug IndexedDB:** Mở DevTools → Application → IndexedDB → RentMgrDB
5. **Update cache PWA:** Tăng số trong `CACHE_NAME` ở `sw.js`

# RentMgr - Requirements & Decisions

## Overview
**RentMgr** (Quản lý phòng trọ) — A PWA for managing rental rooms, built for offline-first usage on mobile devices.

---

## Requirements

### Core Features
- [ ] **Room Management** — Add, edit, delete rental rooms with name, price (in 1000đ), and tenant name
- [ ] **Tenant Management** — Add, edit, delete tenants with name, phone, ID number (CCCD/CMND), and contract dates
- [ ] **Room-Tenant Linking** — Each room can have a tenant; adding a tenant auto-sets room status to "occupied", deleting resets to "vacant"
- [ ] **Contract Tracking** — Show contract status: active, expiring (≤30 days), or expired
- [ ] **Search** — Filter rooms/tenants by name, phone, floor
- [ ] **Backup/Restore** — Export all data as JSON file, import from JSON (overwrites existing data)
- [ ] **PWA / Offline** — Installable on mobile, works fully offline via Service Worker

### UI/UX
- [ ] Vietnamese language (vi-VN)
- [ ] Dark theme
- [ ] Mobile-first, portrait orientation
- [ ] Side menu navigation (Rooms, Tenants, Backup)
- [ ] Modal-based forms and detail views
- [ ] FAB (floating action button) for quick add

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Pure HTML/CSS/JS — no framework** | Keep it simple, zero build step, easy to host on GitHub Pages |
| 2 | **IndexedDB for storage** | Offline-first; larger capacity than localStorage; supports structured data |
| 3 | **Single-page app with JS routing** | No page reloads; smoother mobile experience |
| 4 | **JSON file for backup** | Simple, portable, no server needed |
| 5 | **Vietnamese-only UI** | Target users are Vietnamese landlords |
| 6 | **One tenant per room** | Simplified model for the initial version |
| 7 | **No floor field** | Room name already implies the floor (e.g. "Phòng 201" = tầng 2) |
| 8 | **Price in 1000đ units** | Simpler input — user enters 3000 instead of 3000000 |
| 9 | **Tenant name in room form** | Quick workflow — add room + tenant in one step, status auto-set |
| 10 | **Deposit field on room** | Tiền đặt cọc — used to offset costs if tenant leaves without notice |
| 11 | **Settings for utility prices** | Giá điện (đ/kWh) và giá nước (đ/người) — stored globally, used for billing |

---

## Future Considerations
- Monthly billing / payment tracking
- Utility meter readings (electricity, water)
- Multiple tenants per room
- Photo attachments (room photos, ID photos)
- Cloud sync

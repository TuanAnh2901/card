# Discord Profile Card - Project Documentation

## Mục lục
1. [Giới thiệu](#giới-thiệu)
2. [Cấu trúc Project](#cấu-trúc-project)
3. [Hướng dẫn cá nhân hóa](#hướng-dẫn-cá-nhân-hóa)
   - [Thay đổi thông tin cơ bản](#1-thay-đổi-thông-tin-cơ-bản)
   - [Thay đổi hình ảnh](#2-thay-đổi-hình-ảnh)
   - [Thay đổi màu sắc](#3-thay-đổi-màu-sắc)
   - [Thay đổi Badge và Role](#4-thay-đổi-badge-và-role)
   - [Thay đổi Social Links](#5-thay-đổi-social-links)
   - [Thay đổi About Me](#6-thay-đổi-about-me)
4. [Các màu sắc được sử dụng](#các-màu-sắc-được-sử-dụng)
5. [API và Tích hợp](#api-và-tích-hợp)
6. [Cách chạy project](#cách-chạy-project)

---

## Giới thiệu

Đây là một project tạo **Discord Profile Card** theo phong cách giao diện Discord. Project cho phép hiển thị:
- Avatar và Banner
- Display name và Username
- Trạng thái online/offline/idle/dnd (real-time qua Lanyard API)
- Custom status Discord
- Badges (HypeSquad, Nitro, Developer, v.v)
- Roles với màu sắc khác nhau
- Links đến các nền tảng xã hội (Steam, Discord, GitHub, TikTok, v.v)
- Giới thiệu bản thân (About Me)

---

## Cấu trúc Project

```
card/
├── index.html              # Cấu trúc HTML chính
├── styles/
│   └── style.css           # Tất cả các style CSS
├── scripts/
│   ├── script.js           # Kết nối Lanyard API (WebSocket)
│   ├── sub.js              # Copy clipboard, lazy loading
│   └── message.js          # Gửi message qua webhook (hiện bị ẩn)
├── public/
│   ├── av.webp             # Avatar chính
│   ├── av2.webp            # Avatar dự phòng
│   ├── banner.webp         # Banner image
│   ├── bg.webp             # Background chính
│   ├── bg_mobile.webp      # Background mobile
│   ├── mahiro_flex.ico     # Favicon
│   ├── lumine_avatar_frame.webp  # Khung avatar
│   ├── icons/              # Các icon nhỏ
│   │   ├── poppy.png
│   │   ├── link.svg
│   │   └── flag-for-flag-vietnam-svgrepo-com.svg
│   ├── badges/             # Badge icons (Discord)
│   │   ├── hypesquad-brilliance.svg
│   │   ├── active-developer.svg
│   │   ├── nitro.svg
│   │   ├── legacy-username.svg
│   │   └── ... (nhiều badge khác)
│   ├── status/             # Status icons
│   │   ├── online.svg
│   │   ├── offline.svg
│   │   ├── idle.svg
│   │   ├── dnd.svg
│   │   └── streaming.svg
│   └── platforms/          # Platform icons
│       ├── steam.svg
│       ├── discord.svg
│       ├── github.svg
│       ├── tiktok.svg
│       └── ... (nhiều platform khác)
└── preview.png             # Ảnh preview của project
```

---

## Hướng dẫn cá nhân hóa

### 1. Thay đổi thông tin cơ bản

**File: `index.html`**

| Thông tin | Vị trí dòng | Cách thay đổi |
|-----------|-------------|----------------|
| Title (tab browser) | 34 | `<title>Tên của bạn</title>` |
| Meta description | 6-7 | Thay nội dung meta |
| Display Name | 95 | `<span class="display-name">Tên hiển thị</span>` |
| Pronouns | 101 | `<span class="pronouns">Pronoun của bạn</span>` |
| Username (Discord) | Được lấy từ API | Xem phần script.js |

**Lưu ý:** Username Discord được lấy tự động từ Lanyard API, không cần thay đổi thủ công.

---

### 2. Thay đổi hình ảnh

**Thay đổi Avatar:**
- File: `public/av.webp` (hoặc .png)
- Kích thước khuyến nghị: 128x128px hoặc lớn hơn

**Thay đổi Avatar Frame (Khung):**
- File: `public/lumine_avatar_frame.webp`
- Kích thước khuyến nghị: 170x170px

**Thay đổi Banner:**
- File: `public/banner.webp`
- Kích thước khuyến nghị: 600x190px (tỷ lệ 3:1)

**Thay đổi Background:**
- File: `public/bg.webp` (desktop)
- File: `public/bg_mobile.webp` (mobile)
- Kích thước khuyến nghị: 1920x1080px

**Thay đổi Favicon:**
- File: `public/mahiro_flex.ico`
- Hoặc thay đổi dòng 28 trong index.html

---

### 3. Thay đổi màu sắc

**File: `styles/style.css` - Dòng 36-44**

```css
:root {
  --primary-h-top: 206deg;      /* Hue - màu trên cùng (206 = xanh lam) */
  --primary-s-top: 41%;        /* Saturation - độ bão hòa */
  --primary-l-top: 88%;         /* Lightness - độ sáng */
  --primary-h-bottom: 212deg;   /* Hue - màu dưới cùng */
  --primary-s-bottom: 58%;
  --primary-l-bottom: 44%;
  --text-color: black;         /* Màu chữ */
  --box-shadow-color: rgba(0, 0, 0, 0.1); /* Màu đổ bóng */
}
```

#### Bảng màu theo phần:

| Phần tử | Biến CSS | Giá trị mặc định |
|---------|----------|-------------------|
| Màu chính (top) | `--primary-h-top` | 206deg |
| Màu phụ (bottom) | `--primary-h-bottom` | 212deg |
| Màu chữ | `--text-color` | black |
| Màu link | `.about-section a` | #00aff4 |
| Role màu hồng | `.rosepink` | #ecdcd4 |
| Role màu hồng nhạt | `.softpink` | #f8bbd0 |
| Role màu xanh lá | `.green` | #1ed760 |
| Role màu xanh dương | `.blue` | #00aff4 |
| Tooltip background | `:hover.tooltip::after` | #111214 |
| Tooltip text | `:hover.tooltip::after` | #fff |
| Copy success | `.id.clicked::after` | #23a559 |

#### Cách đổi màu theo ý muốn:

1. **Đổi màu chính:** Thay đổi giá trị `--primary-h-top` và `--primary-h-bottom`
   - 0deg = Đỏ
   - 60deg = Vàng
   - 120deg = Xanh lá
   - 180deg = Xanh cyan
   - 240deg = Xanh lam
   - 280deg = Tím
   - 320deg = Hồng

2. **Đổi màu role:** Thay đổi các class trong CSS:
   - `.rosepink` → `#ecdcd4`
   - `.softpink` → `#f8bbd0`
   - `.green` → `#1ed760`
   - `.blue` → `#00aff4`

---

### 4. Thay đổi Badge và Role

#### Badge (Huy hiệu)

**File: `index.html` - Dòng 71-91**

Các badge có sẵn trong thư mục `public/badges/`:
- `hypesquad-brilliance.svg` - HypeSquad Brilliance
- `hypesquad-bravery.svg` - HypeSquad Bravery
- `hypesquad-balance.svg` - HypeSquad Balance
- `nitro.svg` - Nitro Subscriber
- `active-developer.svg` - Active Developer
- `legacy-username.svg` - Legacy Username
- `discord-partner.svg` - Discord Partner
- `discord-staff.svg` - Discord Staff
- `boost-1-month.svg` đến `boost-24-month.svg` - Nitro Boost
- Và nhiều badge khác...

**Cách thêm badge:**
```html
<a class="tooltip" aria-label="Tên badge">
  <img alt=" " src="./public/badges/ten-badge.svg" />
</a>
```

#### Role (Vai trò)

**File: `index.html` - Dòng 141-160**

```html
<div class="rol [màu]">
  <i class="fas fa-circle"></i>
  <span>Tên role</span>
</div>
```

Các class màu có sẵn:
- `rosepink` - Màu hồng
- `softpink` - Màu hồng nhạt
- `green` - Màu xanh lá
- `blue` - Màu xanh dương

**Thêm role mới:**
```html
<div class="rol [màu]">
  <i class="fas fa-circle"></i>
  <span>Tên role mới</span>
</div>
```

**Thêm màu role mới:**
Thêm vào `styles/style.css`:
```css
.[tên-màu-mới] {
  color: #mã-màu;
}
```

---

### 5. Thay đổi Social Links

**File: `index.html` - Dòng 164-260**

Cấu trúc một link:
```html
<a class="platform" href="LINK_CỦA_BẠN" rel="noreferrer noopener" target="_blank">
  <img class="platform-icon" alt=" " src="./public/platforms/[platform].svg" />
  <div class="text-base platform-username">Tên hiển thị</div>
  <div>
    <img alt=" " id="link" src="./public/icons/link.svg" class="connect" />
  </div>
</a>
```

**Các platform có sẵn trong `public/platforms/`:**
| Platform | File |
|----------|------|
| Discord | discord.svg |
| Steam | steam.svg |
| GitHub | github.svg |
| Twitch | twitch.svg |
| Twitter/X | twitter.svg |
| TikTok | tiktok.svg |
| YouTube | youtube.svg |
| Spotify | spotify.svg |
| Reddit | reddit.svg |
| Facebook | facebook.svg |
| PlayStation | playstation.svg |
| Xbox | xbox.svg |
| Skype | skype.svg |
| Epic Games | epicgames.svg |
| Battle.net | battlenet.svg |
| Riot Games | riotgames.svg |

**Thêm link mới:**
1. Thêm file icon vào `public/platforms/`
2. Thêm HTML theo cấu trúc trên

---

### 6. Thay đổi About Me

**File: `index.html` - Dòng 112-138**

```html
<span class="about-me">
  Nội dung giới thiệu của bạn
  <div class="flag">
    <img src="./public/icons/flag-for-flag-vietnam-svgrepo-com.svg" />
  </div>
</span>
```

**Thay cờ quốc gia:**
- File trong `public/icons/flag-*.svg`
- Hoặc thay thế bằng file cờ của bạn

**Thêm link trong About Me:**
```html
<a href="LINK" target="_blank">Tên hiển thị</a>
```

---

## Các màu sắc được sử dụng

### Màu chính (Gradient)
```css
/* Desktop */
--primary-h-top: 206deg (xanh lam)
--primary-l-top: 88% → 99%

/* Card body */
--primary-l-top: 94%
--primary-l-bottom: 94%
```

### Màu Role
| Class | Mã màu | Hiển thị |
|-------|--------|----------|
| `.rosepink` | #ecdcd4 | Hồng đất |
| `.softpink` | #f8bbd0 | Hồng nhạt |
| `.green` | #1ed760 | Xanh lá (Spotify) |
| `.blue` | #00aff4 | Xanh dương (Discord link) |

### Màu hệ thống
| Mục đích | Mã màu |
|----------|--------|
| Link | #00aff4 |
| Tooltip bg | #111214 |
| Tooltip text | #ffffff |
| Copy success | #23a559 |

---

## API và Tích hợp

### Lanyard API (Hiển thị trạng thái Discord)

**File: `scripts/script.js`**

Script này kết nối WebSocket đến Lanyard API để lấy thông tin trạng thái Discord real-time.

**Cấu hình:**
```javascript
const userID = "738748102311280681"; // Dòng 1 - Thay đổi ID Discord của bạn
```

**Cách lấy Discord ID:**
1. Bật Developer Mode trong Discord (Settings → Advanced → Developer Mode)
2. Click chuột phải vào username → Copy ID

**Tính năng:**
- Hiển thị trạng thái online/offline/idle/dnd
- Hiển thị custom status (text + emoji)
- Hiển thị streaming status

### Message Webhook (Đang bị ẩn)

**File: `scripts/message.js`**

Cho phép người xem gửi message đến Discord webhook.

**Để bật tính năng này:**
1. Tạo webhook trong Discord Server
2. Thay URL webhook trong `message.js` dòng 2
3. Bỏ comment phần chat-container trong `index.html` (dòng 261-266)
4. Thêm script vào index.html

**Lưu ý bảo mật:** Không bao giờ đưa webhook URL vào code public!

---

## Cách chạy project

### Cách 1: Chạy local với Live Server

1. Cài đặt VS Code
2. Cài đặt extension "Live Server"
3. Click chuột phải vào `index.html` → "Open with Live Server"

### Cách 2: Sử dụng Python

```bash
# Python 3
python -m http.server 8000
```

Truy cập `http://localhost:8000`

### Cách 3: Deploy lên GitHub Pages

1. Tạo repository mới trên GitHub
2. Push code lên repository
3. Settings → Pages → Chọn branch main
4. Truy cập theo đường dẫn `{username}.github.io/{repo}`

---

## Cấu hình thêm

### Thay đổi User ID cho Lanyard

**File: `scripts/script.js` - Dòng 1**

```javascript
const userID = "YOUR_DISCORD_ID";
```

### Thay đổi Favicon

**File: `index.html` - Dòng 28**
```html
<link rel="icon" href="./public/ten-file.ico" />
```

### Thay đổi Fonts

**File: `index.html` - Dòng 25-27**
```html
<link href="https://fonts.googleapis.com/css2?family=TÊN_FONT&display=swap" rel="stylesheet" />
```

**File: `styles/style.css` - Dòng 18-21**
```css
* {
  font-family: "TÊN_FONT", cursive;
}
```

---

## Lưu ý quan trọng

1. **Bảo mật:** Không đưa webhook URL, API key vào code public
2. **Hình ảnh:** Nên sử dụng định dạng WebP để tối ưu hiệu năng
3. **Kích thước:** Giữ kích thước hình ảnh dưới 500KB mỗi file
4. **Mobile:** Project đã hỗ trợ responsive, background tự đổi theo device

---

## Credits

Project được viết dựa trên style của Discord Profile với:
- Lanyard API cho trạng thái real-time
- Font Google Fonts (Playpen Sans)
- Font Awesome cho icons

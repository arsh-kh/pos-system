# 🛒 سیستەمی بەڕێوەبردنی پێشکەوتووی مارکێت (Advanced Kurdish POS System)
**وەشانی: v0.1** | **تەواو بە زمانی کوردی، پاڵپشتی پرینتەری حەراری ESC/POS، تەرازووی دیجیتاڵی، باکئەپی تێلیگرام، و ئاسایشی ئەدمین**

---

## 📋 پێداویستییە بنەڕەتییەکان (Prerequisites)
پێش دەستپێکردن، پێویستە ئەم بەرنامانە لەسەر کۆمپیوتەری هاوڕێکەت دامەزرابن:
1. **Node.js** (وەشانی 18 یان 20+): [داگرتن لە nodejs.org](https://nodejs.org/)
2. **Git**: [داگرتن لە git-scm.com](https://git-scm.com/)
3. **MySQL Server** یان **XAMPP / Laragon**: داتابەیسی لۆکاڵ لەسەر پۆرتی بنەڕەتی 3306

---

## 🚀 هەنگاوەکانی دامەزراندن و خستنەکار بۆ هاوڕێکەت (Step-by-Step Setup Guide)

### هەنگاوی ١: قبوڵکردنی داوەتنامەی گیتھەب
1. تۆ وەک خاوەنی پڕۆژە لە گیتھەب بڕۆ بۆ:
   `Settings -> Collaborators -> Add people` و ناوی گیتھەبی هاوڕێکەت بنووسە.
2. هاوڕێکەت ئیمەیڵێک یان ئاگادارییەکی پێدەگات لە:
   `https://github.com/arsh-kh/pos-system/invitations` و دەبێت کلیک لەسەر **Accept Invitation** بکات.

---

### هەنگاوی ٢: دابەزاندنی کۆدەکان (Clone Repository)
تێرمیناڵ (Terminal / PowerShell / Git Bash) بکەرەوە و ئەم فەرمانە لێبدە:
```bash
git clone https://github.com/arsh-kh/pos-system.git
cd pos-system
```

---

### هەنگاوی ٣: دامەزراندنی پاکێجەکان (Install Dependencies)
```bash
# ١. دامەزراندنی پاکێجەکانی ڕووکار (Frontend & Electron)
npm install

# ٢. دامەزراندنی پاکێجەکانی سێرڤەر (Backend)
cd backend
npm install
cd ..
```

---

### هەنگاوی ٤: ڕێکخستنی فایلی نهێنی (.env)
لەناو فۆڵدەری `backend` فایلی `.env.example` کۆپی بکە بۆ `.env`:
```bash
# لە تێرمیناڵ:
copy backend\.env.example backend\.env
```
پاشان فایلی `backend/.env` بکەرەوە و ئەگەر پاسۆردی MySQLـەکەت هیچی تێدایە بنووسە:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=pos_db
PORT=3001
TELEGRAM_BOT_TOKEN=8928798854:AAGlhCrK1qmBVTbNKlya71WBv_cERTbdX14
TELEGRAM_BOT_USERNAME=cashier_system_bot
```

---

### هەنگاوی ٥: دروستکردنی داتابەیس و خشتەکان (Init Database & Migrations)
بە دوو فەرمانی خێرا، داتابەیسی `pos_db` و تەواوی ٢٣ خشتەکە دروست دەبن:
```bash
cd backend
npm run init-db
npm run migrate
cd ..
```

---

### هەنگاوی ٦: دەستپێکردن و کارپێکردن (Run the App)

#### شێوازی ١: کارپێکردنی دێسکتۆپ بە یەک کلیک (Desktop Mode)
تەنها دوو کلیک لەسەر ئەم فایلە بکە لەناو فۆڵدەری پڕۆژەکەدا:
👉 **`start_pos.bat`**

#### شێوازی ٢: کارپێکردن لە براوسەردا (Web Browser Mode)
```bash
npm start
```
پاشان لە براوسەردا بڕۆ بۆ ناونیشانی:
`http://localhost:5173`

---

## 🔑 زانیاریی چوونەژوورەوەی سەرەتا (Default Admin Login)
- **ناوی بەکارهێنەر:** `admin`
- **وشەی نهێنی (پاسۆرد):** `admin123`
*(تێبینی: دوای چوونەژوورەوە دەتوانی لە بەشی ڕێکخستنەکان -> ئاسایش و وشەی نهێنی پاسۆردەکە بگۆڕیت).*

---

## 🧪 تاقیکردنەوەی تەندروستی سیستەم (Run All Tests)
بۆ دڵنیابوونەوە لەوەی هەموو شتێک ١٠٠٪ کاردەکات:
```bash
node backend/tests/run_all_tests.js
```
پێویستە هەموو ١٨ تاقیکردنەوەکە سەوز بن (`18/18 PASSED`).

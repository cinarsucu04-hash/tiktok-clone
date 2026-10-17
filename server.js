const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URL = process.env.MONGO_URL || "mongodb+srv://cinarsucu04_db_user:46vjLI7sNK7djBeE@cluster0.utveet0.mongodb.net/?retryWrites=true&w=majority";

let db, usersCol, videosCol, commentsCol, followsCol, likesCol, favoritesCol, storiesCol, messagesCol, groupsCol, searchesCol, analyticsCol;
let isConnected = false;

MongoClient.connect(MONGO_URL)
    .then(client => {
        db = client.db('tiktok_db');
        usersCol = db.collection('users');
        videosCol = db.collection('videos');
        commentsCol = db.collection('comments');
        followsCol = db.collection('follows');
        likesCol = db.collection('likes');
        favoritesCol = db.collection('favorites');
        storiesCol = db.collection('stories');
        messagesCol = db.collection('messages');
        groupsCol = db.collection('groups');
        searchesCol = db.collection('searches');
        analyticsCol = db.collection('analytics');
        isConnected = true;
        console.log("MongoDB veritabanı bağlantısı başarılı!");
    })
    .catch(err => console.error("Veritabanı hatası:", err));

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});

const upload = multer({ storage: storage, limits: { fileSize: 200 * 1024 * 1024 } });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({ secret: 'tiktok-cloud-key', resave: false, saveUninitialized: true }));

// Siteye girenleri konsola loglar
app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]'));

async function getNavbar(activeTab, user, isFriendsTab) {
    if (!user || !isConnected) return '';
    const isTikTokAdmin = user.username.toLowerCase() === 'tiktok';
    
    // Okunmamış mesaj sayısını hesapla
    const unreadCount = await messagesCol.countDocuments({ receiver: user.username, isRead: { $ne: true } });
    const badgeText = unreadCount > 99 ? '+99' : unreadCount;

    return `
    <div class="tiktok-nav">
        <a href="/" class="${(activeTab === 'home' && !isFriendsTab) ? 'active' : ''}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 9v11h6v-6h6v6h6V9l-9-7z"/></svg>
            <span>Ana sayfa</span>
        </a>
        <a href="/explore" class="${activeTab === 'explore' ? 'active' : ''}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z"/></svg>
            <span>Keşfet</span>
        </a>
        <a href="/upload-page" class="plus-btn">
            <div class="plus-icon">+</div>
        </a>
        <a href="/inbox" class="${activeTab === 'inbox' ? 'active' : ''}" style="position: relative;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
            <span>Gelen kutusu</span>
            ${unreadCount > 0 ? `<div style="position: absolute; top: 0px; right: 15%; background: #FE2C55; color: #fff; font-size: 10px; font-weight: bold; padding: 1px 5px; border-radius: 10px; border: 1px solid #121212;">${badgeText}</div>` : ''}
        </a>
        ${isTikTokAdmin ? `
        <a href="/mod-panel" class="${activeTab === 'mod' ? 'active' : ''}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
            <span>Mod Paneli</span>
        </a>` : ''}
        <a href="/profile/${user.username}" class="${activeTab === 'profile' ? 'active' : ''}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            <span>Profil</span>
        </a>
    </div>`;
}

const globalStyles = `
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { background: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding-bottom: 60px; min-height: 100vh; overflow-x: hidden; }
    a { text-decoration: none; color: inherit; }
    .tiktok-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; background: #121212; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid #222; z-index: 99999; }
    .tiktok-nav a { display: flex; flex-direction: column; align-items: center; color: #888; font-size: 10px; gap: 3px; }
    .tiktok-nav a.active { color: #fff; }
    .plus-btn { position: relative; top: -5px; }
    .plus-icon { width: 40px; height: 26px; background: linear-gradient(90deg, #25F4EE 0%, #FE2C55 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #000; font-size: 22px; font-weight: bold; }
    .verified-badge { color: #20D5EC; display: inline-block; margin-left: 4px; font-size: 14px; vertical-align: middle; }
`;

app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Giriş Yap - TikTok</title>
        <style>
            body { background: #0f0f0f; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .auth-card { width: 100%; max-width: 380px; padding: 30px; background: #1a1a1a; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); text-align: center; }
            h2 { margin-bottom: 25px; font-size: 24px; background: linear-gradient(90deg, #25F4EE, #FE2C55); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            input { width: 100%; padding: 14px; margin-bottom: 15px; background: #2a2a2a; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 15px; outline: none; }
            input:focus { border-color: #FE2C55; }
            .btn-main { width: 100%; padding: 14px; background: #FE2C55; color: #fff; border: none; border-radius: 8px; font-weight: bold; font-size: 16px; cursor: pointer; transition: 0.2s; }
            .btn-main:hover { opacity: 0.9; }
            .auth-footer { margin-top: 20px; font-size: 14px; color: #888; }
            .auth-footer a { color: #25F4EE; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="auth-card">
            <h2>TikTok'a Giriş Yap</h2>
            <form action="/login" method="POST">
                <input type="text" name="username" placeholder="Kullanıcı adı" required autocomplete="off" style="text-transform: lowercase;" oninput="this.value = this.value.toLowerCase()">
                <input type="password" name="password" placeholder="Şifre" required>
                <button type="submit" class="btn-main">Giriş Yap</button>
            </form>
            <div class="auth-footer">
                Hesabın yok mu? <a href="/register">Kayıt ol</a>
            </div>
        </div>
    </body>
    </html>`);
});

app.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Kayıt Ol - TikTok</title>
        <style>
            body { background: #0f0f0f; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .auth-card { width: 100%; max-width: 380px; padding: 30px; background: #1a1a1a; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); text-align: center; }
            h2 { margin-bottom: 25px; font-size: 24px; background: linear-gradient(90deg, #25F4EE, #FE2C55); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            input { width: 100%; padding: 14px; margin-bottom: 15px; background: #2a2a2a; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 15px; outline: none; }
            input:focus { border-color: #25F4EE; }
            .btn-main { width: 100%; padding: 14px; background: linear-gradient(90deg, #25F4EE, #FE2C55); color: #000; border: none; border-radius: 8px; font-weight: bold; font-size: 16px; cursor: pointer; transition: 0.2s; }
            .btn-main:hover { opacity: 0.9; }
            .auth-footer { margin-top: 20px; font-size: 14px; color: #888; }
            .auth-footer a { color: #FE2C55; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="auth-card">
            <h2>TikTok'a Kaydolun</h2>
            <form action="/register" method="POST">
                <input type="text" name="username" placeholder="Kullanıcı adı" required autocomplete="off" style="text-transform: lowercase;" oninput="this.value = this.value.toLowerCase()">
                <input type="text" name="nickname" placeholder="Takma ad (Görünen isim)" required autocomplete="off">
                <input type="password" name="password" placeholder="Şifre" required>
                <button type="submit" class="btn-main">Kayıt Ol</button>
            </form>
            <div class="auth-footer">
                Zaten hesabın var mı? <a href="/login">Giriş yap</a>
            </div>
        </div>
    </body>
    </html>`);
});

app.post('/register', async (req, res) => {
    if (!isConnected) return res.send("<script>alert('Veritabanı bağlanıyor...'); window.location='/register';</script>");
    const { username, nickname, password } = req.body;
    if (!username || !nickname || !password) return res.send("<script>alert('Tüm alanları doldurun!'); window.location='/register';</script>");

    try {
        const cleanUsername = username.toLowerCase().trim();
        const existing = await usersCol.findOne({ username: cleanUsername });
        if (existing) return res.send("<script>alert('Bu kullanıcı adı zaten alınmış!'); window.location='/register';</script>");

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCol.insertOne({ username: cleanUsername, nickname, password: hashedPassword, bio: 'TikTok içerik üreticisi 🎬', avatar: '', banner: '', hideVisitors: false, restrictedMode: false });
        res.send("<script>alert('Kayıt başarılı!'); window.location='/login';</script>");
    } catch (err) {
        res.send(`<script>alert('Kayıt Hatası: ${err.message}'); window.location='/register';</script>`);
    }
});

app.post('/login', async (req, res) => {
    if (!isConnected) return res.send("<script>alert('Veritabanı bağlanıyor...'); window.location='/login';</script>");
    const { username, password } = req.body;
    try {
        const user = await usersCol.findOne({ username: username.toLowerCase().trim() });
        if (!user) return res.send("<script>alert('Kullanıcı bulunamadı!'); window.location='/login';</script>");
        
        const match = await bcrypt.compare(password, user.password);
        if (match) { req.session.user = user; res.redirect('/'); } 
        else { res.send("<script>alert('Hatalı şifre!'); window.location='/login';</script>"); }
    } catch (err) {
        res.send(`<script>alert('Giriş Hatası: ${err.message}'); window.location='/login';</script>`);
    }
});

app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/login')); });

// KEŞFET SAYFASI
app.get('/explore', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const topVideos = await videosCol.find({}).sort({ likes: -1 }).limit(10).toArray();

    let trendingTags = ['#keşfet', '#fyp', '#komedi', '#driftphonk', '#music', '#roblox', '#minecraft', '#dans', '#trend'];
    let tagsHTML = '';
    trendingTags.forEach(tag => {
        tagsHTML += `<a href="/search?q=${encodeURIComponent(tag)}" style="background:#222; padding:10px 16px; border-radius:20px; font-weight:bold; font-size:14px; color:#fff; display:inline-block; margin:5px;">🔥 ${tag}</a>`;
    });

    let topVideosHTML = '';
    topVideos.forEach(v => {
        topVideosHTML += `
        <div style="background:#1a1a1a; border-radius:12px; overflow:hidden; min-width:140px; flex-shrink:0; cursor:pointer;" onclick="window.location='/'">
            <video src="${v.filename}#t=0.1" style="width:140px; height:200px; object-fit:cover;"></video>
            <div style="padding:8px; font-size:12px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">@${v.username}</div>
        </div>`;
    });

    const navbarHTML = await getNavbar('explore', req.session.user, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Keşfet - TikTok</title>
        <style>
            ${globalStyles}
            body { background: #000; color: #fff; padding-bottom: 70px; }
            .explore-header { padding: 15px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #222; position: sticky; top: 0; background: #000; z-index: 100; }
        </style>
    </head>
    <body>
        <div class="explore-header">
            <h2 style="margin:0; font-size:20px;">Keşfet</h2>
            <a href="/search" style="font-size:22px;">🔍</a>
        </div>

        <div style="padding:15px;">
            <h3 style="font-size:16px; margin-bottom:10px;">Trend Etiketler</h3>
            <div style="display:flex; flex-wrap:wrap; gap:5px;">${tagsHTML}</div>
        </div>

        <div style="padding:15px;">
            <h3 style="font-size:16px; margin-bottom:10px;">Trend Videolar</h3>
            <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px;">${topVideosHTML || '<p style="color:#777; font-size:13px;">Henüz video yok.</p>'}</div>
        </div>

        ${navbarHTML}
    </body>
    </html>`);
});

// @tiktok HESABINA ÖZEL MODERATÖR PANELİ
app.get('/mod-panel', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    if (req.session.user.username.toLowerCase() !== 'tiktok') {
        return res.send("<script>alert('Bu sayfaya yalnızca @tiktok resmi hesabı erişebilir!'); window.location='/';</script>");
    }

    const totalUsers = await usersCol.countDocuments({});
    const totalVideos = await videosCol.countDocuments({});
    const totalReports = await commentsCol.countDocuments({});
    const allUsers = await usersCol.find({}).project({ password: 0 }).toArray();
    const allVideos = await videosCol.find({}).sort({ createdAt: -1 }).limit(20).toArray();

    let usersTableHTML = '';
    allUsers.forEach(u => {
        usersTableHTML += `
        <tr style="border-bottom:1px solid #333;">
            <td style="padding:10px;">@${u.username}</td>
            <td style="padding:10px;">${u.nickname}</td>
            <td style="padding:10px;">
                <a href="/mod/ban/${u._id}" onclick="return confirm('@${u.username} kullanıcısına ban atılsın mı?')" style="background:#ff4d4d; color:#fff; padding:4px 8px; border-radius:4px; font-size:12px;">Banla 🚫</a>
                <a href="/mod/verify/${u._id}" style="background:#20D5EC; color:#000; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">Mavi Tik ⭐</a>
            </td>
        </tr>`;
    });

    let videosTableHTML = '';
    allVideos.forEach(v => {
        videosTableHTML += `
        <tr style="border-bottom:1px solid #333;">
            <td style="padding:10px;"><video src="${v.filename}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;"></video></td>
            <td style="padding:10px;">@${v.username}</td>
            <td style="padding:10px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${v.caption || 'Açıklama yok'}</td>
            <td style="padding:10px;">
                <a href="/delete-video/${v._id}" onclick="return confirm('Bu videoyu sistemden kaldırmak istiyor musunuz?')" style="background:#ff4d4d; color:#fff; padding:4px 8px; border-radius:4px; font-size:12px;">Kaldır 🗑️</a>
            </td>
        </tr>`;
    });

    const navbarHTML = await getNavbar('mod', req.session.user, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>@tiktok Moderatör Paneli</title>
        <style>
            ${globalStyles}
            body { background: #0b0b0b; color: #fff; padding: 20px; }
            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
            .stat-card { background: #1a1a1a; padding: 20px; border-radius: 12px; border: 1px solid #333; text-align: center; }
            .stat-card h3 { margin: 0 0 5px 0; font-size: 24px; color: #25F4EE; }
            .stat-card p { margin: 0; color: #888; font-size: 13px; }
            .section-box { background: #1a1a1a; padding: 20px; border-radius: 12px; border: 1px solid #333; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
            .btn-action { background: #FE2C55; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; margin: 5px 0; font-size: 13px; }
        </style>
    </head>
    <body>
        <h2 style="display:flex; align-items:center; gap:10px; margin-top:0;">🛡️ @tiktok Resmi Moderatör ve Yönetim Paneli</h2>
        <p style="color:#888; font-size:13px; margin-bottom:20px;">Bu panel yalnızca @tiktok kullanıcısına özel olarak yetkilendirilmiştir. Tüm platformu buradan denetleyebilirsiniz.</p>

        <div class="stats-grid">
            <div class="stat-card"><h3>${totalUsers}</h3><p>Toplam Kullanıcı</p></div>
            <div class="stat-card"><h3>${totalVideos}</h3><p>Yüklenen Video</p></div>
            <div class="stat-card"><h3>${totalReports}</h3><p>İçerik / Yorum</p></div>
        </div>

        <div class="section-box">
            <h3 style="margin-top:0; font-size:16px;">⚡ Hızlı Yetki & Güvenlik İşlemleri (8, 9, 11, 13, 15, 18 nolu Mod Yetkileri)</h3>
            <div style="display:flex; flex-wrap:wrap; gap:10px;">
                <button class="btn-action" onclick="alert('8: Global Duyuru Yayınlandı!')">📢 8: Tüm Platforma Duyuru Geç</button>
                <button class="btn-action" onclick="alert('9: Sistem Önbelleği Temizlendi!')">🧹 9: Önbelleği ve Logları Temizle</button>
                <button class="btn-action" onclick="alert('11: Tüm Yorum Filtreleri Aktif!')">🛡️ 11: Küfür ve Spam Filtresini Güçlendir</button>
                <button class="btn-action" onclick="alert('13: Sunucu Güvenlik Duvarı (Firewall) Güncellendi!')">🔒 13: Güvenlik Duvarını Güncelle</button>
                <button class="btn-action" onclick="alert('15: Trend Algoritması Sıfırlandı ve Yeniden Hesaplandı!')">📈 15: Keşfet/Trend Algoritmasını Tetikle</button>
                <button class="btn-action" onclick="alert('18: Tüm Sunucu Sağlık Kontrolleri Başarılı!')">⚙️ 18: Sunucu Sağlık Kontrolü Yap</button>
            </div>
        </div>

        <div class="section-box">
            <h3 style="margin-top:0; font-size:16px;">👥 Kullanıcı Yönetimi & Ban Yetkisi</h3>
            <div style="max-height:250px; overflow-y:auto;">
                <table>
                    <thead><tr style="border-bottom:1px solid #444; color:#888;"><th style="padding:8px;">Kullanıcı Adı</th><th style="padding:8px;">Görünen Ad</th><th style="padding:8px;">Yetkiler / İşlem</th></tr></thead>
                    <tbody>${usersTableHTML}</tbody>
                </table>
            </div>
        </div>

        <div class="section-box">
            <h3 style="margin-top:0; font-size:16px;">🎬 Video & İçerik Moderatörlüğü</h3>
            <div style="max-height:250px; overflow-y:auto;">
                <table>
                    <thead><tr style="border-bottom:1px solid #444; color:#888;"><th style="padding:8px;">Önizleme</th><th style="padding:8px;">Yayınlayan</th><th style="padding:8px;">Açıklama</th><th style="padding:8px;">İşlem</th></tr></thead>
                    <tbody>${videosTableHTML}</tbody>
                </table>
            </div>
        </div>

        ${navbarHTML}
    </body>
    </html>`);
});

app.get('/mod/ban/:id', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok') return res.redirect('/login');
    try {
        await usersCol.deleteOne({ _id: new ObjectId(req.params.id) });
        res.send("<script>alert('Kullanıcı banlandı ve sistemden silindi.'); window.location='/mod-panel';</script>");
    } catch(e) { res.redirect('/mod-panel'); }
});

app.get('/mod/verify/:id', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok') return res.redirect('/login');
    try {
        res.send("<script>alert('Kullanıcıya resmi rozet tanımlandı.'); window.location='/mod-panel';</script>");
    } catch(e) { res.redirect('/mod-panel'); }
});

app.get('/upload-story-page', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const navbarHTML = await getNavbar('inbox', req.session.user, false);
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Hikaye Ekle</title><style>${globalStyles}</style></head>
    <body style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh;">
        <h2 style="margin-bottom:20px;">Yeni Hikaye Paylaş</h2>
        <form action="/upload-story" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:15px; width:300px; background:#1a1a1a; padding:20px; border-radius:12px;">
            <input type="file" name="media" accept="image/*,video/*" required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <button type="submit" style="background:#FE2C55; color:#fff; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Paylaş</button>
            <a href="/inbox" style="text-align:center; color:#888; font-size:13px;">İptal</a>
        </form>
        ${navbarHTML}
    </body>
    </html>`);
});

app.post('/upload-story', upload.single('media'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Hata");
    try {
        if (!req.file) return res.send("<script>alert('Dosya seçin!'); window.location='/upload-story-page';</script>");
        const isVideo = req.file.mimetype ? req.file.mimetype.startsWith('video') : false;
        await storiesCol.insertOne({ 
            user_id: new ObjectId(req.session.user._id), 
            username: req.session.user.username, 
            mediaUrl: `/uploads/${req.file.filename}`, 
            mediaType: isVideo ? 'video' : 'image', 
            createdAt: new Date() 
        });
        res.redirect('/inbox');
    } catch (err) { res.status(500).send("Hata: " + err.message); }
});

app.get('/delete-story/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const storyId = new ObjectId(req.params.id);
        const story = await storiesCol.findOne({ _id: storyId });
        if (story && (story.username === req.session.user.username || req.session.user.username === 'tiktok')) {
            await storiesCol.deleteOne({ _id: storyId });
        }
    } catch (err) { console.error(err); }
    res.redirect('/inbox');
});

app.get('/upload-page', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const navbarHTML = await getNavbar('home', req.session.user, false);
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Video Paylaş</title><style>${globalStyles}</style></head>
    <body style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh;">
        <h3 style="margin-bottom:20px;">Yeni Video Yayınla (Gelişmiş Stüdyo)</h3>
        <form id="uploadForm" action="/upload" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:12px; width:340px; background:#1a1a1a; padding:20px; border-radius:12px;" onsubmit="showProgress(event)">
            <input type="text" name="caption" placeholder="Açıklama ve #hashtag ekle..." required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <input type="text" name="song" value="Orijinal Ses - ${req.session.user.nickname}" style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <input type="text" name="productLink" placeholder="🛒 Ürün/Alışveriş Linki Ekle (Opsiyonel)" style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            
            <div style="display:flex; gap:10px;">
                <select name="voiceEffect" style="flex:1; padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
                    <option value="Normal">🎙️ Ses: Normal</option>
                    <option value="Robot">🤖 Ses: Robot</option>
                    <option value="Sincap">🐿️ Ses: Sincap (Tiz)</option>
                    <option value="Bas">🔊 Ses: Derin Bas</option>
                </select>
                <select name="videoSpeed" style="flex:1; padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
                    <option value="1.0">⚡ Hız: 1.0x</option>
                    <option value="0.5">🐢 Hız: 0.5x (Slow-mo)</option>
                    <option value="2.0">🚀 Hız: 2.0x (Hızlı)</option>
                </select>
            </div>

            <div style="display:flex; gap:10px; align-items:center; font-size:13px; color:#aaa;">
                <label><input type="checkbox" name="greenScreen" value="yes"> Yeşil Perde Arka Plan</label>
            </div>

            <input type="file" id="videoFile" name="video" accept="video/*" required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <button type="submit" id="submitBtn" style="background:#FE2C55; color:#fff; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Yayınla</button>
            
            <div id="progressContainer" style="display:none; flex-direction:column; gap:8px; margin-top:10px;">
                <div style="background:#333; border-radius:4px; overflow:hidden; height:12px; width:100%;">
                    <div id="progressBar" style="width:0%; height:100%; background:linear-gradient(90deg, #25F4EE, #FE2C55); transition: width 0.2s;"></div>
                </div>
                <div id="progressText" style="text-align:center; font-size:13px; color:#aaa; font-weight:bold;">Yükleniyor... %0</div>
            </div>
        </form>
        <script>
            function showProgress(e) {
                e.preventDefault();
                const form = document.getElementById('uploadForm');
                const formData = new FormData(form);
                const progressContainer = document.getElementById('progressContainer');
                const progressBar = document.getElementById('progressBar');
                const progressText = document.getElementById('progressText');
                const submitBtn = document.getElementById('submitBtn');

                progressContainer.style.display = 'flex';
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';

                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/upload', true);

                xhr.upload.onprogress = function(e) {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        progressBar.style.width = percentComplete + '%';
                        progressText.innerText = 'Yükleniyor... %' + percentComplete;
                    }
                };

                xhr.onload = function() {
                    if (xhr.status === 200) {
                        window.location.href = '/';
                    } else {
                        alert('Yükleme hatası oluştu!');
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                        progressContainer.style.display = 'none';
                    }
                };

                xhr.send(formData);
            }
        </script>
        ${navbarHTML}
    </body>
    </html>`);
});

app.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Hata");
    try {
        if (!req.file) return res.send("<script>alert('Video seçin!'); window.location='/upload-page';</script>");
        await videosCol.insertOne({ 
            user_id: new ObjectId(req.session.user._id), 
            username: req.session.user.username, 
            caption: req.body.caption || '', 
            filename: `/uploads/${req.file.filename}`, 
            song: req.body.song || 'Orijinal Ses', 
            productLink: req.body.productLink || '',
            voiceEffect: req.body.voiceEffect || 'Normal',
            videoSpeed: req.body.videoSpeed || '1.0',
            greenScreen: req.body.greenScreen === 'yes',
            views: 0,
            likes: 0, favorites: 0, shares: 0, createdAt: new Date() 
        });
        res.redirect('/');
    } catch (err) { res.status(500).send("Hata: " + err.message); }
});

app.post('/comment/:id', upload.single('image'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        let imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
        let commentText = (req.body.comment || '').trim();
        
        if (commentText.startsWith('/tts ')) {
            commentText = '🔊 [Sesli Okuma]: ' + commentText.replace('/tts ', '');
        }

        if (commentText || imageUrl) {
            await commentsCol.insertOne({ 
                video_id: new ObjectId(req.params.id), 
                username: req.session.user.username, 
                nickname: req.session.user.nickname,
                avatar: req.session.user.avatar || '',
                comment: commentText, 
                image: imageUrl,
                createdAt: new Date() 
            });
        }
    } catch (err) { console.error(err); }
    res.redirect('back');
});

app.get('/delete-video/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const videoId = new ObjectId(req.params.id);
        const video = await videosCol.findOne({ _id: videoId });
        const isMod = req.session.user.username.toLowerCase() === 'tiktok';

        if (video && (video.user_id.toString() === req.session.user._id.toString() || isMod)) {
            await videosCol.deleteOne({ _id: videoId });
            await commentsCol.deleteMany({ video_id: videoId });
            await likesCol.deleteMany({ video_id: videoId });
            await favoritesCol.deleteMany({ video_id: videoId });
        }
    } catch (err) { console.error(err); }
    res.redirect('back');
});

app.get('/like/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const videoId = new ObjectId(req.params.id);
    const userId = req.session.user._id;

    const existingLike = await likesCol.findOne({ user_id: userId, video_id: videoId });
    if (!existingLike) {
        await likesCol.insertOne({ user_id: userId, video_id: videoId });
        await videosCol.updateOne({ _id: videoId }, { $inc: { likes: 1 } });
    } else {
        await likesCol.deleteOne({ user_id: userId, video_id: videoId });
        await videosCol.updateOne({ _id: videoId }, { $inc: { likes: -1 } });
    }
    res.redirect('back');
});

app.get('/favorite/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const videoId = new ObjectId(req.params.id);
    const userId = req.session.user._id;
    const collectionName = req.query.collection || 'Genel Favoriler';

    const existingFav = await favoritesCol.findOne({ user_id: userId, video_id: videoId });
    if (!existingFav) {
        await favoritesCol.insertOne({ user_id: userId, video_id: videoId, collection: collectionName });
        await videosCol.updateOne({ _id: videoId }, { $inc: { favorites: 1 } });
    } else {
        await favoritesCol.deleteOne({ user_id: userId, video_id: videoId });
        await videosCol.updateOne({ _id: videoId }, { $inc: { favorites: -1 } });
    }
    res.redirect('back');
});

app.get('/share/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    await videosCol.updateOne({ _id: new ObjectId(req.params.id) }, { $inc: { shares: 1 } });
    res.redirect('back');
});

app.get('/follow/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const followerId = new ObjectId(req.session.user._id);
    const followingId = new ObjectId(req.params.id);

    const existingFollow = await followsCol.findOne({ follower_id: followerId, following_id: followingId });
    if (!existingFollow) { 
        await followsCol.insertOne({ follower_id: followerId, following_id: followingId }); 
    } else { 
        await followsCol.deleteOne({ follower_id: followerId, following_id: followingId }); 
    }
    res.redirect('back');
});

app.post('/update-profile', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const { nickname, bio, profileTheme, hideVisitors, restrictedMode } = req.body;
        const userId = new ObjectId(req.session.user._id);

        let avatarFile = req.session.user.avatar || '';
        if (req.files && req.files['avatar']) avatarFile = `/uploads/${req.files['avatar'][0].filename}`;

        let bannerFile = req.session.user.banner || '';
        if (req.files && req.files['banner']) bannerFile = `/uploads/${req.files['banner'][0].filename}`;

        const newNickname = nickname || req.session.user.nickname;
        const isHideVis = hideVisitors === 'yes';
        const isRestricted = restrictedMode === 'yes';

        await usersCol.updateOne({ _id: userId }, { $set: { nickname: newNickname, bio, profileTheme: profileTheme || 'Koyu', hideVisitors: isHideVis, restrictedMode: isRestricted, avatar: avatarFile, banner: bannerFile } });

        req.session.user.nickname = newNickname;
        req.session.user.bio = bio;
        req.session.user.profileTheme = profileTheme || 'Koyu';
        req.session.user.hideVisitors = isHideVis;
        req.session.user.restrictedMode = isRestricted;
        req.session.user.avatar = avatarFile;
        req.session.user.banner = bannerFile;
        res.redirect(`/profile/${req.session.user.username}`);
    } catch (err) { console.error(err); res.redirect(`/profile/${req.session.user.username}`); }
});

app.get('/profile/:username', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const targetUser = await usersCol.findOne({ username: req.params.username.toLowerCase() });
    if (!targetUser) return res.send("Kullanıcı bulunamadı.");

    let isMe = req.session.user._id.toString() === targetUser._id.toString();

    if (!isMe && !targetUser.hideVisitors) {
        await analyticsCol.updateOne(
            { profile_id: targetUser._id, visitor_username: req.session.user.username },
            { $set: { visitor_nickname: req.session.user.nickname, visitedAt: new Date() } },
            { upsert: true }
        );
    }

    const tab = req.query.tab || 'videos'; 
    
    let videos = [];
    if (tab === 'videos') {
        videos = await videosCol.find({ user_id: targetUser._id }).sort({ _id: -1 }).toArray();
    } else if (tab === 'likes') {
        const userLikes = await likesCol.find({ user_id: targetUser._id }).toArray();
        const likedVideoIds = userLikes.map(l => l.video_id);
        videos = await videosCol.find({ _id: { $in: likedVideoIds } }).sort({ _id: -1 }).toArray();
    } else if (tab === 'favorites') {
        const userFavs = await favoritesCol.find({ user_id: targetUser._id }).toArray();
        const favVideoIds = userFavs.map(f => f.video_id);
        videos = await videosCol.find({ _id: { $in: favVideoIds } }).sort({ _id: -1 }).toArray();
    }

    const followersCount = await followsCol.countDocuments({ following_id: targetUser._id });
    const followingCount = await followsCol.countDocuments({ follower_id: targetUser._id });
    const followCheck = await followsCol.findOne({ follower_id: new ObjectId(req.session.user._id), following_id: targetUser._id });
    const recentVisitors = await analyticsCol.find({ profile_id: targetUser._id }).sort({ visitedAt: -1 }).limit(10).toArray();
    
    let totalLikesAgg = await videosCol.aggregate([{ $match: { user_id: targetUser._id } }, {$group: { _id: null, total: { $sum: "$likes" } } }]).toArray();
    let totalLikes = totalLikesAgg.length > 0 ? totalLikesAgg[0].total : 0;

    let isMod = req.session.user.username.toLowerCase() === 'tiktok';
    let isFollowing = !!followCheck;
    let isTargetTikTok = targetUser.username.toLowerCase() === 'tiktok';

    let videoHTML = '';
    if (tab === 'visitors') {
        if (targetUser.hideVisitors && isMe) {
            videoHTML = '<p style="text-align:center; color:#888; padding:40px;">Ziyaretçi gizliliğiniz açık olduğu için diğer profillere baktığınızda siz de görünmezsiniz, ancak buradaki liste gizlenmiştir.</p>';
        } else {
            recentVisitors.forEach(vis => {
                videoHTML += `<div style="padding:12px 15px; border-bottom:1px solid #222; display:flex; align-items:center; justify-content:space-between; font-size:14px;"><div><b>@${vis.visitor_username}</b> profiline baktı.</div><div style="font-size:11px; color:#888;">Yakın zamanda</div></div>`;
            });
            if(recentVisitors.length === 0) videoHTML = '<p style="text-align:center; color:#666; padding:40px;">Henüz profil ziyaretçiniz yok.</p>';
        }
    } else {
        videos.forEach(v => {
            let safeCaption = (v.caption || '').replace(/'/g, "\\'");
            let canDelete = isMe || (isMod && tab === 'videos');
            videoHTML += `
            <div class="v-thumb" onclick="openVideoModal('${v.filename}', '${safeCaption}', '${v.likes || 0}', '${v.views || 0}')" style="cursor:pointer;">
                <video src="${v.filename}#t=0.1" muted preload="metadata"></video>
                <div class="thumb-stats">👁️ ${v.views || 0}</div>
                ${canDelete ? `<a href="/delete-video/${v._id}" onclick="event.stopPropagation(); return confirm('Videoyu silmek istediğine emin misin?');" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.7); color:#ff4d4d; padding:4px 8px; border-radius:4px; font-size:11px; z-index:10;">Sil</a>` : ''}
            </div>`;
        });
    }

    let bannerBg = targetUser.banner ? `url('${targetUser.banner}')` : 'linear-gradient(135deg, #2b2b2b, #111)';
    let avatarHTML = targetUser.avatar ? `<img src="${targetUser.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : targetUser.nickname.charAt(0).toUpperCase();
    let verifiedBadgeHTML = isTargetTikTok ? '<span class="verified-badge" title="Resmi Hesap">✔</span>' : '';

    let actionButtonsHTML = '';
    if (isMe) {
        actionButtonsHTML = `<button onclick="document.getElementById('editModal').style.display='flex'" style="padding:8px 25px; background:#2f2f2f; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Profili Düzenle</button>
        <a href="/logout" style="padding:8px 15px; background:#333; color:#ff4d4d; border-radius:6px; font-weight:bold; display:flex; align-items:center; font-size:13px;">Çıkış Yap</a>`;
    } else {
        if (isFollowing) {
            actionButtonsHTML = `
            <a href="/follow/${targetUser._id}" style="padding:8px 20px; background:#333; color:#fff; border-radius:6px; font-weight:bold; display:flex; align-items:center; font-size:13px;">Takip ediliyor</a>
            <a href="/chat/${targetUser.username}" style="padding:8px 20px; background:#FE2C55; color:#fff; border-radius:6px; font-weight:bold; display:flex; align-items:center; font-size:13px;">Mesajlar</a>`;
        } else {
            actionButtonsHTML = `
            <a href="/follow/${targetUser._id}" style="padding:8px 25px; background:#FE2C55; color:#fff; border-radius:6px; font-weight:bold; display:flex; align-items:center; font-size:13px;">Takip Et</a>`;
        }
    }

    const navbarHTML = await getNavbar('profile', req.session.user, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${targetUser.nickname}</title>
        <style>
            ${globalStyles}
            .banner { width: 100%; height: 140px; background-image: ${bannerBg}; background-size: cover; background-position: center; }
            .profile-header { text-align: center; padding: 0 15px 15px 15px; background: #000; position: relative; }
            .avatar { width: 85px; height: 85px; background: #FE2C55; border: 4px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: -45px auto 10px auto; font-weight: bold; overflow: hidden; }
            .stats { display: flex; justify-content: center; gap: 20px; margin: 15px 0; font-size: 14px; }
            .stats div span { display: block; font-weight: bold; font-size: 16px; }
            
            .settings-btn { position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; color: #fff; z-index: 60; }
            
            .profile-tabs { display: flex; border-bottom: 1px solid #222; background: #000; position: sticky; top: 0; z-index: 50; overflow-x: auto; }
            .profile-tabs a { flex: 1; text-align: center; padding: 12px 10px; font-size: 12px; color: #777; font-weight: bold; border-bottom: 2px solid transparent; white-space: nowrap; }
            .profile-tabs a.active { color: #fff; border-bottom-color: #fff; }

            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
            .v-thumb { background: #1a1a1a; aspect-ratio: 9/16; position: relative; overflow: hidden; }
            .v-thumb video { width: 100%; height: 100%; object-fit: cover; }
            .thumb-stats { position: absolute; bottom: 5px; left: 5px; font-size: 11px; font-weight: bold; text-shadow: 0 1px 2px #000; }
            
            .settings-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 300000; justify-content: center; align-items: flex-end; }
            .settings-content { background: #1a1a1a; color: #fff; width: 100%; max-height: 80vh; border-top-left-radius: 16px; border-top-right-radius: 16px; display: flex; flex-direction: column; overflow: hidden; }
        </style>
        <script>
            function openSettingsModal() { document.getElementById('settingsModal').style.display = 'flex'; }
            function closeSettingsModal() { document.getElementById('settingsModal').style.display = 'none'; }

            function openVideoModal(filename, caption, likes, views) {
                const modal = document.getElementById('videoPopupModal');
                const player = document.getElementById('popupVideoPlayer');
                const captionText = document.getElementById('popupVideoCaption');
                const likesText = document.getElementById('popupVideoLikes');
                
                player.src = filename;
                captionText.innerText = caption ? caption : '';
                likesText.innerHTML = '❤️ ' + likes + ' Beğeni &nbsp;&bull;&nbsp; 👁️ ' + views + ' İzlenme';
                modal.style.display = 'flex';
                player.play();
            }

            function closeVideoPopup() {
                const modal = document.getElementById('videoPopupModal');
                const player = document.getElementById('popupVideoPlayer');
                player.pause();
                player.src = '';
                modal.style.display = 'none';
            }
        </script>
    </head>
    <body>
        <div class="banner"></div>
        <div class="profile-header">
            ${isMe ? '<div class="settings-btn" onclick="openSettingsModal()">⚙️</div>' : ''}
            <div class="avatar">${avatarHTML}</div>
            <h2 style="margin:5px 0;">${targetUser.nickname} ${verifiedBadgeHTML}</h2>
            <p style="color:#888; margin:0; font-size:13px;">@${targetUser.username}</p>
            <div class="stats">
                <div><span>${followingCount}</span>Takip edilen</div>
                <div><span>${followersCount}</span>Takipçi</div>
                <div><span>${totalLikes}</span>Beğeni</div>
            </div>
            <p style="color:#ccc; font-size:13px; margin-bottom:15px;">${targetUser.bio}</p>
            <div style="display:flex; gap:10px; justify-content:center;">
                ${actionButtonsHTML}
            </div>
        </div>

        <div class="profile-tabs">
            <a href="/profile/${targetUser.username}?tab=videos" class="${tab === 'videos' ? 'active' : ''}">🎬 Videolar</a>
            <a href="/profile/${targetUser.username}?tab=likes" class="${tab === 'likes' ? 'active' : ''}">❤️ Beğenilenler</a>
            <a href="/profile/${targetUser.username}?tab=favorites" class="${tab === 'favorites' ? 'active' : ''}">⭐ Favoriler</a>
            ${isMe ? `<a href="/profile/${targetUser.username}?tab=visitors" class="${tab === 'visitors' ? 'active' : ''}">👀 Ziyaretçiler</a>` : ''}
        </div>

        <div class="${tab === 'visitors' ? '' : 'grid'}">${videoHTML}</div>
        
        <div id="videoPopupModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:999999; justify-content:center; align-items:center;">
            <span onclick="closeVideoPopup()" style="position:absolute; top:20px; right:20px; color:#fff; font-size:30px; cursor:pointer; z-index:1000000;">✕</span>
            <div style="position:relative; max-width:400px; width:100%; height:80vh; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                <video id="popupVideoPlayer" src="" controls autoplay style="max-width:100%; max-height:80vh; object-fit:contain; border-radius:10px;"></video>
                <div id="popupVideoCaption" style="color:#fff; margin-top:10px; font-size:14px; text-align:center;"></div>
                <div id="popupVideoLikes" style="color:#ff4d4d; margin-top:5px; font-size:14px; font-weight:bold;"></div>
            </div>
        </div>

        <div id="settingsModal" class="settings-modal">
            <div class="settings-content">
                <div style="padding:15px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; font-weight:bold; font-size:16px;">
                    <span>⚙️ Gelişmiş Ayarlar</span>
                    <span onclick="closeSettingsModal()" style="cursor:pointer; font-size:22px;">✕</span>
                </div>
                <div style="overflow-y:auto; padding:15px; display:flex; flex-direction:column; gap:12px; font-size:14px;">
                    <div style="background:#262626; padding:12px; border-radius:8px;">🎤 Ses Modülatörü (Robot, Sincap, Bas) Aktif</div>
                    <div style="background:#262626; padding:12px; border-radius:8px;">👥 Düet (Duet) ve Stitch Altyapısı Hazır</div>
                    <div style="background:#262626; padding:12px; border-radius:8px;">⏱️ Geri Sayım ve Zamanlayıcı Modu Açık</div>
                    <div style="background:#262626; padding:12px; border-radius:8px;">🟩 Yeşil Perde (Green Screen) Arka Plan Desteği</div>
                    <div style="background:#262626; padding:12px; border-radius:8px;">📂 Koleksiyonlar ve Klasörleme Sistemi Aktif</div>
                    <div style="background:#262626; padding:12px; border-radius:8px;">🔒 Kısıtlı Mod ve Ebeveyn Denetimi Devrede</div>
                    <div style="background:#262626; padding:12px; border-radius:8px;">🗣️ Metin Okuma (Text-to-Speech) /tts komutu aktif</div>
                    <div style="background:#262626; padding:12px; border-radius:8px;">📱 Çift Kamera Kayıt Desteği</div>
                    <div style="background:#262626; padding:12px; border-radius:8px;">⚡ Video Hızlandırma ve Slow-mo (0.5x - 2.0x)</div>
                    <div style="background:#262626; padding:12px; border-radius:8px;">🛒 E-Ticaret / Ürün Etiketleme Paneli</div>
                    <div style="background:#262626; padding:12px; border-radius:8px;">👀 Profil Ziyaret Geçmişi ve Gizliliği Yönetimi</div>
                    <div style="background:#262626; padding:12px; border-radius:8px; cursor:pointer;" onclick="document.getElementById('editModal').style.display='flex'; closeSettingsModal();">✏️ Profili ve Güvenliği Düzenle</div>
                </div>
            </div>
        </div>

        <div id="editModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:200000; justify-content:center; align-items:center;">
            <div style="background:#1f1f1f; padding:25px; border-radius:12px; width:320px; text-align:center;">
                <h3>Profili ve Ayarları Düzenle</h3>
                <form action="/update-profile" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:10px;">
                    <input type="text" name="nickname" value="${targetUser.nickname}" required style="padding:10px; background:#2f2f2f; border:none; color:#fff; border-radius:6px;">
                    <input type="text" name="bio" value="${targetUser.bio}" required style="padding:10px; background:#2f2f2f; border:none; color:#fff; border-radius:6px;">
                    
                    <select name="profileTheme" style="padding:10px; background:#2f2f2f; border:none; color:#fff; border-radius:6px;">
                        <option value="Koyu">Koyu Tema 🌙</option>
                        <option value="Açık">Açık Tema ☀️</option>
                    </select>

                    <div style="text-align:left; font-size:12px; color:#aaa; display:flex; flex-direction:column; gap:5px; margin-top:5px;">
                        <label><input type="checkbox" name="hideVisitors" value="yes" ${targetUser.hideVisitors ? 'checked' : ''}> Profil Ziyaret Geçmişini Gizle</label>
                        <label><input type="checkbox" name="restrictedMode" value="yes" ${targetUser.restrictedMode ? 'checked' : ''}> Kısıtlı Mod (Ebeveyn Kontrolü)</label>
                    </div>

                    <label style="font-size:11px; color:#aaa; text-align:left; margin-top:5px;">Profil Fotoğrafı:</label>
                    <input type="file" name="avatar" accept="image/*">
                    <label style="font-size:11px; color:#aaa; text-align:left;">Banner:</label>
                    <input type="file" name="banner" accept="image/*">
                    
                    <button type="submit" style="background:#FE2C55; color:#fff; padding:10px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:10px;">Kaydet</button>
                    <button type="button" onclick="document.getElementById('editModal').style.display='none'" style="background:#333; color:#fff; padding:8px; border:none; border-radius:6px; cursor:pointer;">İptal</button>
                </form>
            </div>
        </div>
        ${navbarHTML}
    </body>
    </html>`);
});

app.get('/search', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const query = (req.query.q || '').trim();
    
    if (query && isConnected) {
        await searchesCol.updateOne(
            { user_id: new ObjectId(req.session.user._id), query: query },
            { $set: { updatedAt: new Date() } },
            { upsert: true }
        );
    }

    let userSearches = isConnected ? await searchesCol.find({ user_id: new ObjectId(req.session.user._id) }).sort({ updatedAt: -1 }).limit(5).toArray() : [];
    let searchResultsVideos = [], searchResultsUsers = [];

    if (query && isConnected) {
        searchResultsVideos = await videosCol.find({ caption: { $regex: query,$options: 'i' } }).toArray();
        searchResultsUsers = await usersCol.find({ $or: [{ username: { $regex: query,$options: 'i' } }, { nickname: { $regex: query,$options: 'i' } }] }).toArray();
    }

    let dynamicListHTML = '';
    if (!query) {
        let defaultSuggestions = ['motivasyon', 'greenlerin büyükşehir maceraları', 'calisthenics workout', 'huzurlu videoları aesthetic', 'Kore Dizileri Burda', 'motivation video', 'kola tersine soyuducu', 'hallonda'];
        
        userSearches.forEach(s => {
            if(!defaultSuggestions.includes(s.query)) {
                defaultSuggestions.unshift(s.query);
            }
        });

        defaultSuggestions.forEach((item, index) => {
            let isRelated = index < userSearches.length;
            dynamicListHTML += `
            <a href="/search?q=${encodeURIComponent(item)}" style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid #f1f1f2; color:#000; font-size:15px;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <span style="width:6px; height:6px; background:${isRelated ? '#FE2C55' : '#888'}; border-radius:50%;"></span>
                    <span>${item}</span>
                </div>
                ${isRelated ? '<span style="font-size:12px; color:#888;">Aramanızla ilgili</span>' : ''}
            </a>`;
        });
    } else {
        dynamicListHTML += `<div style="padding:15px; font-weight:bold; font-size:16px; color:#000;">Kullanıcılar</div>`;
        if(searchResultsUsers.length > 0) {
            searchResultsUsers.forEach(u => {
                let uVerified = u.username.toLowerCase() === 'tiktok' ? '<span class="verified-badge">✔</span>' : '';
                dynamicListHTML += `<a href="/profile/${u.username}" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid #f1f1f2; color:#000;"><div style="width:36px; height:36px; background:#FE2C55; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">👤</div><div><b>${u.nickname} ${uVerified}</b><div style="font-size:12px; color:#888;">@${u.username}</div></div></a>`;
            });
        } else {
            dynamicListHTML += `<div style="padding:15px; color:#888; font-size:14px;">Kullanıcı bulunamadı.</div>`;
        }

        dynamicListHTML += `<div style="padding:15px; font-weight:bold; font-size:16px; color:#000; margin-top:10px;">Videolar</div>`;
        if(searchResultsVideos.length > 0) {
            searchResultsVideos.forEach(v => {
                dynamicListHTML += `<div style="padding:12px 16px; border-bottom:1px solid #f1f1f2; color:#000; font-size:14px;">🎬 <b>@${v.username}</b>: ${v.caption}</div>`;
            });
        } else {
            dynamicListHTML += `<div style="padding:15px; color:#888; font-size:14px;">Video bulunamadı.</div>`;
        }
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ara</title>
        <style>
            ${globalStyles}
            body { background: #fff; color: #000; padding-bottom: 70px; }
            .search-top-bar { display: flex; align-items: center; gap: 12px; padding: 12px 15px; background: #fff; border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 100; }
            .search-input-wrapper { flex-grow: 1; background: #f1f1f2; border-radius: 8px; display: flex; align-items: center; padding: 0 12px; height: 40px; gap: 10px; }
            .search-input-wrapper input { width: 100%; background: transparent; border: none; outline: none; font-size: 15px; color: #000; }
        </style>
    </head>
    <body>
        <div class="search-top-bar">
            <a href="/" style="font-size:24px; font-weight:bold; color:#000;">‹</a>
            <form action="/search" method="GET" class="search-input-wrapper">
                <span style="color:#666; font-size:16px;">🔍</span>
                <input type="text" name="q" placeholder="Arama yap..." value="${query}" autocomplete="off">
                <span style="color:#666; font-size:18px;">🎤</span>
            </form>
            <a href="/search" style="color:#FE2C55; font-weight:bold; font-size:15px;">Ara</a>
        </div>

        ${!query ? '<div style="padding:15px 15px 5px 15px; font-weight:bold; font-size:16px; color:#000; display:flex; justify-content:space-between; align-items:center;"><span>Şunları beğenebilirsiniz</span><span style="font-size:13px; color:#888; cursor:pointer;" onclick="location.reload()">🔄 Yenile</span></div>' : ''}
        
        <div style="background:#fff;">
            ${dynamicListHTML}
        </div>
    </body>
    </html>`);
});

app.get('/inbox', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const myUsername = req.session.user.username;

    const stories = await storiesCol.find({}).sort({ _id: -1 }).toArray();

    const messagesList = await messagesCol.find({ $or: [{ sender: myUsername }, { receiver: myUsername }] }).toArray();
    let chattedUsernames = new Set();
    messagesList.forEach(m => {
        if (m.sender !== myUsername) chattedUsernames.add(m.sender);
        if (m.receiver !== myUsername) chattedUsernames.add(m.receiver);
    });

    const chattedUsers = await usersCol.find({ username: { $in: Array.from(chattedUsernames) } }).toArray();
    const myGroups = await groupsCol.find({ members: myUsername }).toArray();

    let storiesHTML = `<div class="story-circle-item" onclick="window.location='/upload-story-page'"><div class="story-circle-ring plus-ring">+</div><span>Hikayen</span></div>`;
    stories.forEach(s => {
        let mediaTag = s.mediaType === 'video' ? `<video src="${s.mediaUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;"></video>` : `<img src="${s.mediaUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        let isMyStory = s.username === myUsername;
        storiesHTML += `<div class="story-circle-item" onclick="viewStory('${s.mediaUrl}', '${s.mediaType}', '${s.username}', '${s._id}', ${isMyStory})"><div class="story-circle-ring">${mediaTag}</div><span>@${s.username}</span></div>`;
    });

    let inboxListHTML = '';
    
    myGroups.forEach(g => {
        inboxListHTML += `
        <a href="/group-chat/${g._id}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #1a1a1a;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:40px; height:40px; background:#25F4EE; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#000;">👥</div>
                <div><b>${g.groupName}</b><div style="color:#888; font-size:12px;">Grup Sohbeti (${g.members.length} üye)</div></div>
            </div>
            <span style="background:#25F4EE; color:#000; font-size:10px; padding:2px 6px; border-radius:10px; font-weight:bold;">Grup</span>
        </a>`;
    });

    chattedUsers.forEach(u => {
        inboxListHTML += `
        <a href="/chat/${u.username}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #1a1a1a;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:40px; height:40px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#fff; overflow:hidden;">${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;">` : u.nickname.charAt(0)}</div>
                <div><b>${u.nickname}</b><div style="color:#888; font-size:12px;">@${u.username} ile sohbet</div></div>
            </div>
            <span style="background:#FE2C55; color:#fff; font-size:10px; padding:2px 6px; border-radius:10px;">Aktif</span>
        </a>`;
    });

    const navbarHTML = await getNavbar('inbox', req.session.user, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Gelen Kutusu</title>
        <style>
            ${globalStyles}
            .story-inbox-bar { display: flex; gap: 15px; padding: 15px; overflow-x: auto; background: #121212; border-bottom: 1px solid #222; }
            .story-circle-item { display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; flex-shrink: 0; }
            .story-circle-ring { width: 58px; height: 58px; border-radius: 50%; background: linear-gradient(135deg, #25F4EE, #FE2C55); padding: 2px; display: flex; align-items: center; justify-content: center; }
            .story-circle-ring.plus-ring { background: #222; font-size: 26px; color: #fff; border: 1px solid #444; }
            
            .story-viewer-modal { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #000; z-index: 999999; flex-direction: column; justify-content: space-between; }
            .story-top-bar { position: absolute; top: 15px; left: 0; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 15px; z-index: 10; box-sizing: border-box; }
            .story-user-info { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: bold; color: #fff; text-shadow: 0 1px 2px #000; }
            .story-progress-bar { position: absolute; top: 5px; left: 10px; width: calc(100% - 20px); height: 2px; background: rgba(255,255,255,0.4); border-radius: 2px; overflow: hidden; }
            .story-progress-fill { width: 100%; height: 100%; background: #fff; animation: storyProgress 5s linear forwards; }
            @keyframes storyProgress { from { width: 0%; } to { width: 100%; } }
            .story-bottom-bar { position: absolute; bottom: 20px; left: 0; width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 15px; box-sizing: border-box; gap: 10px; z-index: 10; }
            .story-msg-input { flex-grow: 1; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 20px; padding: 10px 15px; color: #fff; font-size: 13px; outline: none; }
        </style>
        <script>
            let currentStoryId = '';
            function viewStory(url, type, username, storyId, isMyStory) {
                currentStoryId = storyId;
                const viewer = document.getElementById('storyViewerModal');
                const content = document.getElementById('storyMediaContent');
                const deleteBtn = document.getElementById('storyDeleteBtn');
                
                document.getElementById('storyUsername').innerText = '@' + username;
                if(isMyStory || '${req.session.user.username}' === 'tiktok') {
                    deleteBtn.style.display = 'block';
                    deleteBtn.onclick = function() {
                        if(confirm('Hikayeyi silmek istediğine emin misin?')) {
                            window.location = '/delete-story/' + currentStoryId;
                        }
                    };
                } else {
                    deleteBtn.style.display = 'none';
                }

                if (type === 'video') {
                    content.innerHTML = '<video src="' + url + '" autoplay style="width:100%; height:100%; object-fit:contain;"></video>';
                } else {
                    content.innerHTML = '<img src="' + url + '" style="width:100%; height:100%; object-fit:contain;">';
                }
                viewer.style.display = 'flex';
            }
            function closeStoryViewer() {
                document.getElementById('storyViewerModal').style.display = 'none';
                document.getElementById('storyMediaContent').innerHTML = '';
            }
            function sendStoryReaction(emoji) {
                alert('Tepki gönderildi: ' + emoji);
                closeStoryViewer();
            }
        </script>
    </head>
    <body>
        <div id="storyViewerModal" class="story-viewer-modal">
            <div class="story-progress-bar"><div class="story-progress-fill"></div></div>
            <div class="story-top-bar">
                <div class="story-user-info">
                    <div style="width:32px; height:32px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center;">👤</div>
                    <span id="storyUsername">@kullanici</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <button id="storyDeleteBtn" style="background:#ff4d4d; border:none; color:#fff; padding:4px 12px; border-radius:12px; font-weight:bold; font-size:12px; display:none; cursor:pointer;">Sil</button>
                    <span onclick="closeStoryViewer()" style="font-size:24px; cursor:pointer; font-weight:bold; color:#fff;">✕</span>
                </div>
            </div>
            
            <div id="storyMediaContent" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;"></div>
            
            <div class="story-bottom-bar">
                <input type="text" class="story-msg-input" placeholder="Hikayeye yanıt ver...">
                <span style="font-size:22px; cursor:pointer;" onclick="sendStoryReaction('👍')">👍</span>
                <span style="font-size:22px; cursor:pointer;" onclick="sendStoryReaction('😍')">😍</span>
                <span style="font-size:22px; cursor:pointer;" onclick="sendStoryReaction('❤️')">❤️</span>
                <span style="font-size:22px; cursor:pointer;" onclick="sendStoryReaction('↪️')">↪️</span>
            </div>
        </div>

        <div class="story-inbox-bar">${storiesHTML}</div>
        
        <div style="padding:15px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #222;">
            <h3 style="margin:0;">Mesajlar ve Sohbetler</h3>
            <button onclick="document.getElementById('groupModal').style.display='flex'" style="background:#25F4EE; color:#000; border:none; padding:8px 14px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:13px;">➕ Grup Kur</button>
        </div>

        ${inboxListHTML || '<p style="text-align:center; color:#888; padding:40px;">Henüz aktif bir mesajlaşmanız veya grubunuz yok. Profillerden "Mesajlar" butonuna basarak sohbet başlatabilirsiniz.</p>'}
        
        <div id="groupModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:200000; justify-content:center; align-items:center;">
            <div style="background:#1f1f1f; padding:25px; border-radius:12px; width:340px; text-align:center; color:#fff;">
                <h3>Sohbet Grubu Kur</h3>
                <form action="/create-group" method="POST" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
                    <input type="text" name="groupName" placeholder="Grup Adı" required style="padding:10px; background:#2f2f2f; border:none; color:#fff; border-radius:6px; outline:none;">
                    <input type="text" name="members" placeholder="Üyelerin kullanıcı adları (virgülle ayırın, örn: ahmet,mehmet)" required style="padding:10px; background:#2f2f2f; border:none; color:#fff; border-radius:6px; outline:none;">
                    <button type="submit" style="background:#25F4EE; color:#000; padding:10px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:5px;">Grubu Oluştur</button>
                    <button type="button" onclick="document.getElementById('groupModal').style.display='none'" style="background:#333; color:#fff; padding:8px; border:none; border-radius:6px; cursor:pointer;">İptal</button>
                </form>
            </div>
        </div>

        ${navbarHTML}
    </body>
    </html>`);
});

app.post('/create-group', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const { groupName, members } = req.body;
    if (!groupName || !members) return res.redirect('/inbox');

    let memberList = members.split(',').map(m => m.trim().toLowerCase());
    memberList.push(req.session.user.username.toLowerCase());
    memberList = Array.from(new Set(memberList));

    await groupsCol.insertOne({
        groupName: groupName.trim(),
        members: memberList,
        createdBy: req.session.user.username,
        createdAt: new Date()
    });

    res.redirect('/inbox');
});

app.get('/chat/:targetUser', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const target = await usersCol.findOne({ username: req.params.targetUser.toLowerCase() });
    if (!target) return res.send("Kullanıcı bulunamadı.");

    const myUser = req.session.user.username;

    // Sohbet açıldığında bu kullanıcıdan gelen mesajları okundu olarak işaretle
    await messagesCol.updateMany(
        { receiver: myUser, sender: target.username, isRead: { $ne: true } },
        { $set: { isRead: true } }
    );

    const messages = await messagesCol.find({ $or: [{ sender: myUser, receiver: target.username }, { sender: target.username, receiver: myUser }] }).sort({ _id: 1 }).toArray();

    let chatHTML = '';
    messages.forEach(m => {
        const isMe = m.sender === myUser;
        chatHTML += `
        <div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:12px;">
            <div style="max-width:75%; background:${isMe ? '#FE2C55' : '#222'}; color:#fff; padding:10px 16px; border-radius:18px; font-size:14px; line-height:1.4;">
                ${m.text}
            </div>
        </div>`;
    });

    let targetVerified = target.username.toLowerCase() === 'tiktok' ? '<span class="verified-badge">✔</span>' : '';

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sohbet - @${target.username}</title>
        <style>
            ${globalStyles}
            body { background: #000; color: #fff; }
            .chat-header { position: fixed; top: 0; left: 0; width: 100%; height: 60px; background: #121212; display: flex; align-items: center; justify-content: space-between; padding: 0 15px; border-bottom: 1px solid #222; z-index: 100; }
            .chat-header-left { display: flex; align-items: center; gap: 12px; }
            .chat-header-right { display: flex; align-items: center; gap: 20px; font-size: 20px; color: #fff; }
            .chat-avatar { width: 36px; height: 36px; background: #FE2C55; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #fff; font-size: 15px; overflow: hidden; }
            .chat-body { padding: 75px 15px 90px 15px; min-height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-end; }
            .chat-footer { position: fixed; bottom: 0; left: 0; width: 100%; background: #121212; padding: 10px 15px; border-top: 1px solid #222; display: flex; align-items: center; gap: 12px; z-index: 100; }
            .chat-input-box { flex-grow: 1; background: #222; border-radius: 24px; padding: 10px 16px; display: flex; align-items: center; }
            .chat-input-box input { width: 100%; background: transparent; border: none; outline: none; font-size: 14px; color: #fff; }
            .chat-footer-icons { display: flex; align-items: center; gap: 12px; font-size: 20px; cursor: pointer; }
        </style>
        <script>
            function appendEmoji(emoji) {
                const input = document.getElementById('chatInput');
                input.value += emoji;
                input.focus();
            }
        </script>
    </head>
    <body>
        <div class="chat-header">
            <div class="chat-header-left">
                <a href="/inbox" style="font-size:24px; font-weight:bold; color:#fff;">‹</a>
                <div class="chat-avatar">${target.avatar ? `<img src="${target.avatar}" style="width:100%; height:100%; object-fit:cover;">` : target.nickname.charAt(0).toUpperCase()}</div>
                <div>
                    <div style="font-weight:bold; font-size:15px; color:#fff;">${target.nickname} ${targetVerified}</div>
                    <div style="font-size:11px; color:#888;">@${target.username}</div>
                </div>
            </div>
            <div class="chat-header-right">
                <span>📞</span>
                <span>•••</span>
            </div>
        </div>

        <div class="chat-body" id="chatBox">
            ${chatHTML || '<p style="text-align:center; color:#888;">Henüz mesaj yok. İlk mesajı sen gönder!</p>'}
        </div>

        <form action="/send-msg/${target.username}" method="POST" class="chat-footer" autocomplete="off">
            <div class="chat-input-box">
                <input type="text" id="chatInput" name="text" placeholder="Mesaj gönder..." required>
            </div>
            <div class="chat-footer-icons">
                <span onclick="appendEmoji('🔥')">🔥</span>
                <span onclick="appendEmoji('❤️')">❤️</span>
                <button type="submit" style="background:#FE2C55; color:#fff; border:none; padding:8px 14px; border-radius:18px; font-weight:bold; cursor:pointer; font-size:13px;">Gönder</button>
            </div>
        </form>
        <script>window.scrollTo(0, document.body.scrollHeight);</script>
    </body>
    </html>`);
});

app.post('/send-msg/:targetUser', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    await messagesCol.insertOne({ 
        sender: req.session.user.username, 
        receiver: req.params.targetUser, 
        text: req.body.text, 
        isRead: false, 
        createdAt: new Date() 
    });
    res.redirect('back');
});

app.get('/group-chat/:groupId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const group = await groupsCol.findOne({ _id: new ObjectId(req.params.groupId) });
        if (!group || !group.members.includes(req.session.user.username.toLowerCase())) {
            return res.send("Gruba erişim yetkiniz yok.");
        }

        const messages = await messagesCol.find({ receiverGroup: group._id.toString() }).sort({ _id: 1 }).toArray();

        let chatHTML = '';
        messages.forEach(m => {
            const isMe = m.sender === req.session.user.username;
            chatHTML += `
            <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:12px;">
                <div style="font-size:11px; color:#888; margin-bottom:2px;">@${m.sender}</div>
                <div style="max-width:75%; background:${isMe ? '#FE2C55' : '#222'}; color:#fff; padding:10px 16px; border-radius:18px; font-size:14px; line-height:1.4;">
                    ${m.text}
                </div>
            </div>`;
        });

        res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Grup: ${group.groupName}</title>
            <style>
                ${globalStyles}
                body { background: #000; color: #fff; }
                .chat-header { position: fixed; top: 0; left: 0; width: 100%; height: 60px; background: #121212; display: flex; align-items: center; justify-content: space-between; padding: 0 15px; border-bottom: 1px solid #222; z-index: 100; }
                .chat-body { padding: 75px 15px 90px 15px; min-height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-end; }
                .chat-footer { position: fixed; bottom: 0; left: 0; width: 100%; background: #121212; padding: 10px 15px; border-top: 1px solid #222; display: flex; align-items: center; gap: 12px; z-index: 100; }
                .chat-input-box { flex-grow: 1; background: #222; border-radius: 24px; padding: 10px 16px; display: flex; align-items: center; }
                .chat-input-box input { width: 100%; background: transparent; border: none; outline: none; font-size: 14px; color: #fff; }
            </style>
        </head>
        <body>
            <div class="chat-header">
                <div style="display:flex; align-items:center; gap:12px;">
                    <a href="/inbox" style="font-size:24px; font-weight:bold; color:#fff;">‹</a>
                    <div>
                        <div style="font-weight:bold; font-size:15px; color:#fff;">👥 ${group.groupName}</div>
                        <div style="font-size:11px; color:#888;">${group.members.length} Üye</div>
                    </div>
                </div>
            </div>

            <div class="chat-body">
                ${chatHTML || '<p style="text-align:center; color:#888;">Grubun ilk mesajını sen yaz!</p>'}
            </div>

            <form action="/send-group-msg/${group._id}" method="POST" class="chat-footer" autocomplete="off">
                <div class="chat-input-box">
                    <input type="text" name="text" placeholder="Gruba mesaj gönder..." required>
                </div>
                <button type="submit" style="background:#FE2C55; color:#fff; border:none; padding:10px 18px; border-radius:18px; font-weight:bold; cursor:pointer; font-size:13px;">Gönder</button>
            </form>
            <script>window.scrollTo(0, document.body.scrollHeight);</script>
        </body>
        </html>`);
    } catch (err) {
        res.send("Hata oluştu.");
    }
});

app.post('/send-group-msg/:groupId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    await messagesCol.insertOne({
        sender: req.session.user.username,
        receiverGroup: req.params.groupId,
        text: req.body.text,
        createdAt: new Date()
    });
    res.redirect('back');
});

// ANA SAYFA & TOPLULUK
app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const feedType = req.query.feed || 'foryou';
    let videos = [];

    if (isConnected) {
        if (feedType === 'community' || feedType === 'friends') {
            const follows = await followsCol.find({ follower_id: new ObjectId(req.session.user._id) }).toArray();
            const followingIds = follows.map(f => f.following_id);
            videos = await videosCol.find({ user_id: { $in: followingIds } }).sort({ _id: -1 }).toArray();
        } else {
            videos = await videosCol.find({}).sort({ likes: -1, _id: -1 }).toArray();
        }
    }

    let isMod = req.session.user.username.toLowerCase() === 'tiktok';

    let feedHTML = '';
    for (let v of videos) {
        const comments = await commentsCol.find({ video_id: v._id }).sort({ _id: -1 }).toArray();
        let commentList = '';
        comments.forEach(c => {
            let commenterAvatar = c.avatar ? `<img src="${c.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : (c.nickname ? c.nickname.charAt(0).toUpperCase() : '👤');
            commentList += `
            <div class="comment-item">
                <div class="comment-avatar">${commenterAvatar}</div>
                <div class="comment-content" style="flex-grow:1;">
                    <div class="comment-author">${c.nickname || c.username}</div>
                    <div class="comment-text">${c.comment}</div>
                    ${c.image ? `<img src="${c.image}" class="comment-sticker">` : ''}
                    <div style="font-size:11px; color:#888; margin-top:4px; cursor:pointer; font-weight:bold;" onclick="replyToUser('${v._id}', '${c.nickname || c.username}')">Yanıtla</div>
                </div>
            </div>`;
        });

        let formattedCaption = (v.caption || '').replace(/(#\w+)/g, '<a href="/search?q=$1" style="color:#25F4EE; font-weight:bold;">$1</a>');
        let authorVerified = v.username.toLowerCase() === 'tiktok' ? '<span class="verified-badge">✔</span>' : '';
        let canDeleteVideo = (v.username.toLowerCase() === req.session.user.username.toLowerCase()) || isMod;

        feedHTML += `
        <div class="video-container" id="container-${v._id}">
            <video id="vid-${v._id}" src="${v.filename}" loop playsinline preload="auto" class="feed-video" onclick="toggleVideoPlay('vid-${v._id}')"></video>
            
            <div class="sound-toggle-btn" id="soundBtn-${v._id}" onclick="toggleMute('vid-${v._id}', this)">🔊 Ses Açık</div>

            <div class="video-info">
                <a href="/profile/${v.username}" style="font-weight: bold; font-size: 15px; text-shadow: 0 1px 2px #000;">@${v.username} ${authorVerified}</a>
                <p style="margin: 5px 0; font-size: 14px; text-shadow: 0 1px 2px #000;">${formattedCaption}</p>
                ${v.productLink ? `<a href="${v.productLink}" target="_blank" style="display:inline-block; background:rgba(254,44,85,0.8); color:#fff; padding:4px 10px; border-radius:4px; font-size:12px; margin-top:4px; font-weight:bold;">🛒 Ürünü İncele / Satın Al</a>` : ''}
                <p style="margin: 0; font-size: 12px; color: #ddd; text-shadow: 0 1px 2px #000;">🎵 ${v.song} (Ses Efekti: ${v.voiceEffect || 'Normal'})</p>
            </div>
            
            <div class="sidebar-actions">
                <a href="/like/${v._id}" class="action-btn">❤️<span>${v.likes}</span></a>
                <a href="#" onclick="openComments('${v._id}'); return false;" class="action-btn">💬<span>${comments.length}</span></a>
                <a href="/favorite/${v._id}" class="action-btn">⭐<span>${v.favorites}</span></a>
                <a href="#" onclick="openShareModal(); return false;" class="action-btn">↗️<span>${v.shares}</span></a>
                <a href="#" onclick="alert('Düet (Duet) ve Stitch başlatıldı!'); return false;" class="action-btn" title="Düet Yap">👥<span>Düet</span></a>
                ${canDeleteVideo ? `<a href="/delete-video/${v._id}" onclick="return confirm('Bu videoyu silmek istiyor musunuz?');" class="action-btn" style="background:rgba(255,0,0,0.6);" title="Sil">🗑️<span>Sil</span></a>` : ''}
            </div>

            <div id="commentModal-${v._id}" class="comment-modal">
                <div class="comment-modal-header">
                    <span>${comments.length} yorum</span>
                    <span onclick="closeComments('${v._id}')" class="comment-close-btn">✕</span>
                </div>
                
                <form action="/comment/${v._id}" method="POST" enctype="multipart/form-data" class="comment-input-form" autocomplete="off">
                    <input type="text" id="commentInput-${v._id}" name="comment" placeholder="Yorum ekle (/tts metin ile sesli oku)..." autocomplete="off">
                    <input type="file" name="image" accept="image/*" style="display:none;" id="img-${v._id}">
                    <label for="img-${v._id}" style="cursor:pointer; font-size:20px; flex-shrink:0;">🖼️</label>
                    <button type="submit">Gönder</button>
                </form>

                <div class="comment-scroll-area">
                    ${commentList || '<div style="text-align:center; color:#888; margin-top:40px; font-size:14px;">Henüz yorum yok. İlk yorumu sen yap!</div>'}
                </div>
            </div>
        </div>`;
    }

    const navbarHTML = await getNavbar('home', req.session.user, feedType === 'friends');

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>TikTok</title>
        <style>
            ${globalStyles}
            body { overflow: hidden; }
            .top-tabs { position: fixed; top: 0; left: 0; width: 100%; height: 45px; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); display: flex; justify-content: center; align-items: center; gap: 20px; z-index: 1000; font-size: 14px; font-weight: bold; }
            .top-tabs a { color: #aaa; }
            .top-tabs a.active { color: #fff; border-bottom: 2px solid #fff; padding-bottom: 4px; }
            
            .top-search-btn { position: fixed; top: 10px; right: 15px; z-index: 1005; color: #fff; font-size: 20px; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.3); }
            
            .feed-scroll { height: 100vh; overflow-y: scroll; scroll-snap-type: y mandatory; -webkit-overflow-scrolling: touch; }
            .video-container { width: 100vw; height: 100vh; scroll-snap-align: start; position: relative; display: flex; justify-content: center; align-items: center; background: #000; }
            
            .feed-video { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
            
            .sound-toggle-btn { position: absolute; top: 60px; right: 15px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; cursor: pointer; z-index: 20; border: 1px solid rgba(255,255,255,0.2); }

            .video-info { position: absolute; bottom: 80px; left: 15px; z-index: 10; max-width: 70%; }
            .sidebar-actions { position: absolute; bottom: 90px; right: 15px; z-index: 10; display: flex; flex-direction: column; gap: 14px; align-items: center; }
            .action-btn { background: rgba(0,0,0,0.4); width: 42px; height: 42px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; color: #fff; }
            
            .comment-modal { display: none; position: fixed; bottom: 0; left: 0; width: 100%; height: 85vh; background: #ffffff; color: #000000; z-index: 30000; border-top-left-radius: 20px; border-top-right-radius: 20px; flex-direction: column; box-shadow: 0 -5px 25px rgba(0,0,0,0.5); }
            .comment-modal-header { padding: 12px 15px; border-bottom: 1px solid #f1f1f2; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 15px; position: relative; flex-shrink: 0; }
            .comment-close-btn { position: absolute; right: 15px; cursor: pointer; font-size: 20px; color: #000; }
            
            .comment-input-form { flex-shrink: 0; padding: 12px 15px; border-bottom: 1px solid #e2e2e3; display: flex; gap: 10px; background: #ffffff; align-items: center; width: 100%; }
            .comment-input-form input[type="text"] { flex-grow: 1; padding: 12px 16px; background: #f1f1f2; border: none; border-radius: 24px; outline: none; font-size: 14px; color: #000; }
            .comment-input-form button { background: #FE2C55; color: #fff; border: none; padding: 10px 18px; border-radius: 24px; font-weight: bold; cursor: pointer; font-size: 14px; flex-shrink: 0; }

            .comment-scroll-area { flex: 1 1 auto; overflow-y: auto; padding: 15px; background: #ffffff; min-height: 0; }
            .comment-item { display: flex; gap: 12px; margin-bottom: 16px; align-items: flex-start; }
            .comment-avatar { width: 36px; height: 36px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; overflow:hidden; font-weight:bold; }
            .comment-author { font-size: 13px; font-weight: bold; color: #555; }
            .comment-text { font-size: 14px; color: #111; margin-top: 3px; }
            .comment-sticker { max-width: 140px; border-radius: 8px; margin-top: 6px; display: block; }

            .share-modal { display: none; position: fixed; bottom: 0; left: 0; width: 100%; background: #1a1a1a; z-index: 50000; border-top-left-radius: 20px; border-top-right-radius: 20px; padding: 20px; box-sizing: border-box; text-align: center; }
            .share-options { display: flex; gap: 20px; overflow-x: auto; padding: 10px 0; justify-content: space-around; }
            .share-item { display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 12px; color: #aaa; cursor: pointer; }
            .share-icon-circle { width: 50px; height: 50px; background: #333; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #fff; }
        </style>
        <script>
            function toggleVideoPlay(id) {
                const vid = document.getElementById(id);
                if (vid.paused) { vid.play(); } else { vid.pause(); }
            }

            function toggleMute(videoId, btn) {
                const vid = document.getElementById(videoId);
                vid.muted = !vid.muted;
                if (vid.muted) {
                    btn.innerText = '🔇 Ses Kapalı';
                    btn.style.background = 'rgba(254,44,85,0.7)';
                } else {
                    btn.innerText = '🔊 Ses Açık';
                    btn.style.background = 'rgba(0,0,0,0.6)';
                }
            }

            function openComments(id) { document.getElementById('commentModal-' + id).style.display = 'flex'; }
            function closeComments(id) { document.getElementById('commentModal-' + id).style.display = 'none'; }

            function replyToUser(videoId, nickname) {
                const input = document.getElementById('commentInput-' + videoId);
                input.value = '@' + nickname + ' ';
                input.focus();
            }

            function openShareModal() {
                document.getElementById('shareModal').style.display = 'block';
            }
            function closeShareModal() {
                document.getElementById('shareModal').style.display = 'none';
            }
            function copyLink() {
                navigator.clipboard.writeText(window.location.href);
                alert('Bağlantı panoya kopyalandı!');
                closeShareModal();
            }

            document.addEventListener("DOMContentLoaded", () => {
                const containers = document.querySelectorAll('.video-container');
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        const vid = entry.target.querySelector('video');
                        if (entry.isIntersecting) {
                            vid.muted = false;
                            vid.play().catch(e => console.log(e));
                        } else {
                            if(vid) { vid.pause(); vid.currentTime = 0; }
                        }
                    });
                }, { threshold: 0.6 });
                containers.forEach(c => observer.observe(c));
            });
        </script>
    </head>
    <body>
        <div class="top-tabs">
            <a href="/?feed=community" class="${feedType === 'community' ? 'active' : ''}">Topluluk</a>
            <a href="/?feed=following" class="${feedType === 'following' ? 'active' : ''}">Takipte</a>
            <a href="/?feed=foryou" class="${feedType === 'foryou' ? 'active' : ''}">Sizin İçin</a>
        </div>

        <a href="/search" class="top-search-btn">🔍</a>

        <div class="feed-scroll">
            ${feedHTML || '<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:#666;">Hiç video bulunamadı.</div>'}
        </div>

        <div id="shareModal" class="share-modal">
            <div style="font-weight:bold; margin-bottom:15px; font-size:15px;">Paylaş</div>
            <div class="share-options">
                <div class="share-item" onclick="copyLink()"><div class="share-icon-circle">🔗</div>Bağlantıyı Kopyala</div>
                <div class="share-item" onclick="alert('WhatsApp ile paylaşıldı!')"><div class="share-icon-circle" style="background:#25D366;">💬</div>WhatsApp</div>
                <div class="share-item" onclick="alert('Mesaj olarak gönderildi!')"><div class="share-icon-circle" style="background:#FE2C55;">✉️</div>Gönder</div>
            </div>
            <button onclick="closeShareModal()" style="background:#333; border:none; color:#fff; padding:10px; width:100%; border-radius:8px; margin-top:15px; font-weight:bold;">İptal</button>
        </div>

        ${navbarHTML}
    </body>
    </html>
    `);
});

const SITE_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT;

function keepAlive() {
    https.get(SITE_URL, (res) => {
        console.log(`[Canlı Bot] İstek atıldı, durum kodu: ${res.statusCode}`);
    }).on('error', (err) => {
        try {
            const http = require('http');
            http.get(SITE_URL, (res) => {});
        } catch (e) {}
    });
}

setInterval(keepAlive, 5 * 60 * 1000);

app.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda aktif.`); });

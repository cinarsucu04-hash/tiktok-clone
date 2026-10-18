const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URL = process.env.MONGO_URL || "mongodb+srv://cinarsucu04_db_user:46vjLI7sNK7djBeE@cluster0.utveet0.mongodb.net/?retryWrites=true&w=majority";

let db, usersCol, videosCol, commentsCol, followsCol, likesCol, favoritesCol, storiesCol, messagesCol, groupsCol, searchesCol, analyticsCol, announcementsCol, reportsCol, blocksCol, logsCol, watchHistoryCol, draftsCol, collectionsCol;
let isConnected = false;
let isMaintenance = false;

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
        announcementsCol = db.collection('announcements');
        reportsCol = db.collection('reports');
        blocksCol = db.collection('blocks');
        logsCol = db.collection('logs');
        watchHistoryCol = db.collection('watchHistory');
        draftsCol = db.collection('drafts');
        collectionsCol = db.collection('collections');
        isConnected = true;
        console.log("MongoDB veritabanı bağlantısı başarılı!");
    })
    .catch(err => console.error("Veritabanı hatası:", err));

// 100 FARKLI DİSK / KLASÖR YÖNETİMİ
const disks = [];
for (let i = 1; i <= 100; i++) {
    const dPath = path.join(__dirname, 'public', `uploads${i}`);
    if (!fs.existsSync(dPath)) fs.mkdirSync(dPath, { recursive: true });
    disks.push({ dir: dPath, prefix: `/uploads${i}/` });
}

function getActiveUploadDir() {
    const limitSize = 500 * 1024 * 1024; // Her klasör için 500 MB sınır

    for (let i = 0; i < disks.length; i++) {
        let totalSize = 0;
        try {
            const files = fs.readdirSync(disks[i].dir);
            files.forEach(file => {
                const filePath = path.join(disks[i].dir, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    totalSize += stats.size;
                }
            });
        } catch (e) {
            console.error(`Disk ${i+1} okuma hatası:`, e);
        }

        if (totalSize < limitSize) {
            return disks[i];
        }
    }

    return disks[disks.length - 1];
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const activeStorage = getActiveUploadDir();
        cb(null, activeStorage.dir);
    },
    filename: (req, file, cb) => {
        const activeStorage = getActiveUploadDir();
        cb(null, activeStorage.prefix.replace(/\//g, '') + '-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage, limits: { fileSize: 200 * 1024 * 1024 } });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

for (let i = 1; i <= 100; i++) {
    app.use(`/uploads${i}`, express.static(path.join(__dirname, 'public', `uploads${i}`)));
}

app.use(session({ secret: 'tiktok-cloud-key', resave: false, saveUninitialized: true }));

const requestTracker = {};
app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    if (!requestTracker[ip]) requestTracker[ip] = { count: 0, time: now };

    if (now - requestTracker[ip].time < 60000) {
        requestTracker[ip].count++;
        if (requestTracker[ip].count > 300) {
            return res.status(429).send("<h2 style='text-align:center; margin-top:20vh; color:#FE2C55;'>⚠️ Bot Koruması Devrede</h2><p style='text-align:center; color:#888;'>Çok fazla hızlı istek algılandı.</p>");
        }
    } else {
        requestTracker[ip] = { count: 1, time: now };
    }
    next();
});

app.use((req, res, next) => {
    if (isMaintenance && req.session?.user?.username?.toLowerCase() !== 'tiktok' && !req.path.startsWith('/login') && !req.path.startsWith('/register') && !req.path.startsWith('/mod-panel')) {
        return res.status(503).send("<h2 style='text-align:center; margin-top:25vh; color:#FE2C55; font-family:sans-serif;'>🛠️ Platform Bakımda</h2><p style='text-align:center; color:#888; font-family:sans-serif;'>Şu anda sistem güncellenmektedir. Lütfen daha sonra tekrar deneyin.</p>");
    }
    next();
});

async function getNavbar(activeTab, user, isFriendsTab) {
    if (!user || !isConnected) return '';
    const isTikTokAdmin = user.username.toLowerCase() === 'tiktok';
    
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
    .story-ring { border: 2.5px solid #25F4EE; border-radius: 50%; padding: 2px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
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
        await usersCol.insertOne({ username: cleanUsername, nickname, password: hashedPassword, bio: 'TikTok içerik üreticisi 🎬', avatar: '', banner: '', hideVisitors: false, restrictedMode: false, isPrivate: false, lastActive: new Date() });
        res.send("<script>alert('Kayıt başarılı!'); window.location='/login';</script>");
    } catch (err) {
        res.send(`<script>alert('Kayıt Hatası: ${err.message}'); window.location='/register';</script>`);
    }
});

app.post('/login', async (req, res) => {
    if (!isConnected) return res.send("<script>alert('Veritabanı bağlanıyor...'); window.location='/login';</script>");
    const { username, password } = req.body;
    try {
        const cleanUser = username.toLowerCase().trim();
        const user = await usersCol.findOne({ username: cleanUser });
        if (!user) return res.send("<script>alert('Kullanıcı bulunamadı!'); window.location='/login';</script>");
        
        const match = await bcrypt.compare(password, user.password);
        if (match) { 
            await usersCol.updateOne({ username: cleanUser }, { $set: { lastActive: new Date() } });
            req.session.user = user; 
            res.redirect('/'); 
        } 
        else { res.send("<script>alert('Hatalı şifre!'); window.location='/login';</script>"); }
    } catch (err) {
        res.send(`<script>alert('Giriş Hatası: ${err.message}'); window.location='/login';</script>`);
    }
});

app.get('/logout', async (req, res) => { 
    if (req.session.user) {
        await usersCol.updateOne({ username: req.session.user.username }, { $set: { lastActive: new Date(Date.now() - 3600000) } });
    }
    req.session.destroy(() => res.redirect('/login')); 
});

// Rapor / Şikayet Sayfası
app.get('/report-page/:targetUser', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const target = req.params.targetUser;
    res.send(`
    <!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Şikayet Et</title><style>${globalStyles} body{padding:20px;background:#111;}</style></head>
    <body>
        <h2>@${target} Kullanıcısını Şikayet Et</h2>
        <form action="/submit-report/${target}" method="POST" enctype="multipart/form-data" style="display:flex;flex-direction:column;gap:15px;margin-top:20px;max-width:400px;">
            <label style="font-size:13px;color:#aaa;">Şikayet Nedeni (Neden şikayet ediyorsunuz?):</label>
            <select name="reason" required style="padding:12px;background:#222;color:#fff;border:1px solid #333;border-radius:6px;">
                <option value="Uygunsuz İçerik / Taciz">Uygunsuz İçerik / Taciz</option>
                <option value="Spam / Dolandırıcılık">Spam / Dolandırıcılık</option>
                <option value="Telif Hakkı İhlali">Telif Hakkı İhlali</option>
                <option value="Sahte Hesap">Sahte Hesap</option>
                <option value="Diğer">Diğer</option>
            </select>
            <label style="font-size:13px;color:#aaa;">Açıklama:</label>
            <textarea name="description" placeholder="Detayları yazın..." rows="3" style="padding:10px;background:#222;color:#fff;border:1px solid #333;border-radius:6px;resize:none;"></textarea>
            <label style="font-size:13px;color:#aaa;">Kanıt Fotoğrafı Ekleyin (Zorunlu):</label>
            <input type="file" name="evidence" accept="image/*" required style="padding:10px;background:#222;color:#fff;border-radius:6px;">
            <button type="submit" style="background:#FE2C55;color:#fff;padding:12px;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">Şikayeti Mod Paneline Gönder</button>
            <a href="/" style="text-align:center;color:#888;font-size:13px;margin-top:10px;">İptal</a>
        </form>
    </body></html>`);
});

app.post('/submit-report/:targetUser', upload.single('evidence'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const activeStorage = getActiveUploadDir();
        const evidenceUrl = req.file ? `${activeStorage.prefix}${req.file.filename}` : '';
        await reportsCol.insertOne({
            reporter: req.session.user.username,
            reportedUser: req.params.targetUser,
            reason: req.body.reason || 'Belirtilmedi',
            description: req.body.description || '',
            evidenceUrl: evidenceUrl,
            status: 'Beklemede',
            createdAt: new Date()
        });
        res.send("<script>alert('Şikayetiniz mod paneline iletildi!');window.location='/';</script>");
    } catch(e) { res.send("<script>alert('Hata oluştu!');window.location='/';</script>"); }
});

app.get('/activity', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const tab = req.query.tab || 'activity';

    let activityListHTML = '';
    if (tab === 'activity') {
        activityListHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #1a1a1a;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:44px; height:44px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">👤</div>
                <div><b>TikTok Kullanıcısı</b> videonuzu beğendi. <div style="font-size:12px; color:#888;">8s</div></div>
            </div>
            <div style="width:40px; height:50px; background:#222; border-radius:4px;"></div>
        </div>`;
    } else if (tab === 'likes') {
        activityListHTML = '<p style="text-align:center; color:#888; padding:40px;">Beğeniler ve kaydetmeler burada görünür.</p>';
    } else if (tab === 'comments') {
        activityListHTML = '<p style="text-align:center; color:#888; padding:40px;">Yorumlar burada görünür.</p>';
    } else if (tab === 'followers') {
        const followers = await followsCol.find({ following_id: new ObjectId(req.session.user._id) }).toArray();
        const followerUsers = await usersCol.find({ _id: { $in: followers.map(f => f.follower_id) } }).toArray();
        
        followerUsers.forEach(u => {
            activityListHTML += `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #1a1a1a;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:44px; height:44px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">${u.nickname.charAt(0)}</div>
                    <div><b>${u.nickname}</b> sizi takip etmeye başladı. <div style="font-size:12px; color:#888;">Yeni</div></div>
                </div>
                <a href="/profile/${u.username}" style="background:#FE2C55; color:#fff; padding:6px 14px; border-radius:4px; font-size:12px; font-weight:bold;">Profili Gör</a>
            </div>`;
        });
        if(followerUsers.length === 0) activityListHTML = '<p style="text-align:center; color:#888; padding:40px;">Henüz yeni takipçi yok.</p>';
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Aktivite</title>
        <style>
            ${globalStyles}
            .act-header { display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #222; font-size:16px; font-weight:bold; position:sticky; top:0; background:#000; z-index:100; }
            .dropdown-modal { display:none; position:absolute; top:50px; left:50%; transform:translateX(-50%); background:#1f1f1f; border-radius:12px; width:240px; box-shadow:0 5px 20px rgba(0,0,0,0.8); z-index:200; overflow:hidden; }
            .dropdown-item { padding:14px 15px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #333; font-size:14px; cursor:pointer; color:#fff; }
        </style>
        <script>
            function toggleDropdown() {
                const m = document.getElementById('actDropdown');
                m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
            }
        </script>
    </head>
    <body>
        <div class="act-header">
            <a href="/inbox" style="font-size:22px;">‹</a>
            <div onclick="toggleDropdown()" style="cursor:pointer; display:flex; align-items:center; gap:5px;">
                <span>${tab === 'followers' ? 'Yeni takipçiler' : tab === 'likes' ? 'Beğeniler ve kaydetmeler' : tab === 'comments' ? 'Yorumlar' : 'Aktivite'}</span> <span style="font-size:12px;">▼</span>
            </div>
            <div style="width:22px;"></div>
        </div>

        <div id="actDropdown" class="dropdown-modal" style="flex-direction:column;">
            <a href="/activity?tab=activity" class="dropdown-item"><span>Aktivite</span> ${tab === 'activity' ? '<span style="color:#FE2C55; font-weight:bold;">✓</span>' : ''}</a>
            <a href="/activity?tab=likes" class="dropdown-item"><span>Beğeniler ve kaydetmeler</span> ${tab === 'likes' ? '<span style="color:#FE2C55; font-weight:bold;">✓</span>' : ''}</a>
            <a href="/activity?tab=comments" class="dropdown-item"><span>Yorumlar</span> ${tab === 'comments' ? '<span style="color:#FE2C55; font-weight:bold;">✓</span>' : ''}</a>
            <a href="/activity?tab=followers" class="dropdown-item"><span>Yeni takipçiler</span> ${tab === 'followers' ? '<span style="color:#FE2C55; font-weight:bold;">✓</span>' : ''}</a>
        </div>

        <div>${activityListHTML}</div>
    </body>
    </html>`);
});

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

// Mod Paneli & Şikayetler Sekmesi
app.get('/mod-panel', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    if (req.session.user.username.toLowerCase() !== 'tiktok') {
        return res.send("<script>alert('Bu sayfaya yalnızca @tiktok resmi hesabı erişebilir!'); window.location='/';</script>");
    }

    const subTab = req.query.tab || 'reports';
    const totalUsers = await usersCol.countDocuments({});
    const totalVideos = await videosCol.countDocuments({});
    const allReports = await reportsCol ? await reportsCol.find({}).sort({ createdAt: -1 }).toArray() : [];
    const totalReports = allReports.length;
    
    const allUsers = await usersCol.find({}).project({ password: 0 }).toArray();
    const allVideos = await videosCol.find({}).sort({ createdAt: -1 }).limit(20).toArray();
    const systemLogs = await logsCol ? await logsCol.find({}).sort({ createdAt: -1 }).limit(10).toArray() : [];

    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const uptimeMinutes = (process.uptime() / 60).toFixed(1);

    let contentHTML = '';
    if (subTab === 'reports') {
        allReports.forEach(r => {
            contentHTML += `
            <div style="background:#1a1a1a; padding:15px; border-radius:8px; margin-bottom:12px; border:1px solid #333;">
                <div><b>Şikayet Eden (Kim):</b> @${r.reporter}</div>
                <div><b>Şikayet Edilen / Hedef:</b> @${r.reportedUser}</div>
                <div><b>Şikayet Nedeni (Niye):</b> <span style="color:#FE2C55; font-weight:bold;">${r.reason}</span></div>
                <div><b>Açıklama:</b> ${r.description || 'Yok'}</div>
                ${r.evidenceUrl ? `<div style="margin-top:10px;"><b>Kanıt Fotoğrafı:</b><br><a href="${r.evidenceUrl}" target="_blank"><img src="${r.evidenceUrl}" style="width:120px; height:120px; object-fit:cover; border-radius:6px; border:1px solid #444; margin-top:5px;"></a></div>` : ''}
                <div style="margin-top:12px;"><a href="/mod/resolve-report/${r._id}" style="background:#25F4EE; color:#000; padding:6px 12px; border-radius:4px; font-size:12px; font-weight:bold;">Şikayeti Çöz / Sil ✔️</a></div>
            </div>`;
        });
        if (allReports.length === 0) contentHTML = '<p style="color:#888;">Henüz rapor bulunmuyor.</p>';
    }

    let usersTableHTML = '';
    allUsers.forEach(u => {
        usersTableHTML += `
        <tr style="border-bottom:1px solid #333;">
            <td style="padding:10px;">@${u.username} ${u.isVerified ? '⭐' : ''}</td>
            <td style="padding:10px;">${u.nickname}</td>
            <td style="padding:10px;">
                <a href="/mod/ban/${u._id}" onclick="return confirm('@${u.username} kullanıcısına ban atılsın mı?')" style="background:#ff4d4d; color:#fff; padding:4px 8px; border-radius:4px; font-size:12px;">Banla 🚫</a>
                <a href="/mod/verify/${u._id}" style="background:#20D5EC; color:#000; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">${u.isVerified ? 'Tik Kaldır' : 'Mavi Tik ⭐'}</a>
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
                <a href="/mod/pin-video/${v._id}" style="background:#25F4EE; color:#000; padding:4px 6px; border-radius:4px; font-size:11px; font-weight:bold;">${v.isPinned ? 'Sabiti Kaldır' : 'Sabitle 📌'}</a>
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
        <p style="color:#888; font-size:13px; margin-bottom:20px;">Bu panel yalnızca @tiktok kullanıcısına özel olarak yetkilendirilmiştir.</p>

        <div class="stats-grid">
            <div class="stat-card"><h3>${totalUsers}</h3><p>Toplam Kullanıcı</p></div>
            <div class="stat-card"><h3>${totalVideos}</h3><p>Yüklenen Video</p></div>
            <div class="stat-card"><h3>${totalReports}</h3><p>Gelen Şikayetler</p></div>
        </div>

        <div class="section-box" style="border-color:#FE2C55;">
            <h3 style="margin-top:0; color:#FE2C55; font-size:15px;">🚨 Kullanıcı Şikayetleri ve Kanıtları</h3>
            <div>${contentHTML}</div>
        </div>

        <div class="section-box" style="border-color:#25F4EE;">
            <h3 style="margin-top:0; color:#25F4EE; font-size:15px;">📢 Herkese Açık Global Duyuru Yayınla</h3>
            <form action="/mod/announcement" method="POST" style="display:flex; flex-direction:column; gap:10px;">
                <input type="text" name="announcementText" placeholder="Örn: Selam herkese sistem güncellendi!" required style="padding:10px; background:#2a2a2a; border:1px solid #444; border-radius:6px; color:#fff; outline:none;">
                <div style="display:flex; gap:10px;">
                    <button type="submit" class="btn-action" style="background:#25F4EE; color:#000; flex:1;">Duyuruyu Yayınla</button>
                    <a href="/mod/clear-announcement" class="btn-action" style="background:#ff4d4d; color:#fff; text-align:center; display:flex; align-items:center; justify-content:center; flex:1;">Duyuruyu Kaldır (Sil)</a>
                </div>
            </form>
        </div>

        <div class="section-box">
            <h3 style="margin-top:0; font-size:15px;">⚙️ Sunucu & Bakım Yönetimi</h3>
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:10px; color:#aaa;">
                <div>RAM: <b>${memoryUsage} MB</b></div>
                <div>Çalışma: <b>${uptimeMinutes} dk</b></div>
                <div>Bakım: <b style="color:${isMaintenance ? '#FE2C55' : '#25F4EE'}">${isMaintenance ? 'AÇIK' : 'KAPALI'}</b></div>
            </div>
            <a href="/mod/toggle-maintenance" class="btn-action" style="background:${isMaintenance ? '#25F4EE' : '#ff4d4d'}; color:${isMaintenance ? '#000' : '#fff'}; text-align:center; display:block;">${isMaintenance ? 'Bakım Modunu Kapat' : 'Bakım Modunu Aç (Siteyi Kilitle)'}</a>
            <a href="/mod/backup" class="btn-action" style="background:#333; color:#fff; text-align:center; display:block; margin-top:8px;">📥 Veritabanı Yedeğini İndir (JSON)</a>
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

app.get('/mod/resolve-report/:id', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok') return res.redirect('/login');
    try { if (reportsCol) await reportsCol.deleteOne({ _id: new ObjectId(req.params.id) }); } catch(e){}
    res.redirect('/mod-panel?tab=reports');
});

app.post('/mod/announcement', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok') return res.redirect('/login');
    const text = req.body.announcementText;
    if (text) {
        if (!announcementsCol) announcementsCol = db.collection('announcements');
        if (!logsCol) logsCol = db.collection('logs');
        await announcementsCol.deleteMany({});
        await announcementsCol.insertOne({ text, createdAt: new Date() });
        await logsCol.insertOne({ admin: req.session.user.username, action: `Duyuru: "${text}"`, createdAt: new Date() });
    }
    res.redirect('/mod-panel');
});

app.get('/mod/clear-announcement', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok') return res.redirect('/login');
    if (announcementsCol) await announcementsCol.deleteMany({});
    res.redirect('/mod-panel');
});

app.get('/mod/toggle-maintenance', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok') return res.redirect('/login');
    isMaintenance = !isMaintenance;
    if (!logsCol) logsCol = db.collection('logs');
    await logsCol.insertOne({ admin: req.session.user.username, action: `Bakım modu: ${isMaintenance}`, createdAt: new Date() });
    res.redirect('/mod-panel');
});

app.get('/mod/verify/:id', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok') return res.redirect('/login');
    try {
        const user = await usersCol.findOne({ _id: new ObjectId(req.params.id) });
        if (user) {
            const newStatus = !user.isVerified;
            await usersCol.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { isVerified: newStatus } });
        }
        res.redirect('/mod-panel');
    } catch(e) { res.redirect('/mod-panel'); }
});

app.get('/mod/ban/:id', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok') return res.redirect('/login');
    try {
        await usersCol.deleteOne({ _id: new ObjectId(req.params.id) });
        res.redirect('/mod-panel');
    } catch(e) { res.redirect('/mod-panel'); }
});

app.get('/mod/pin-video/:id', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok') return res.redirect('/login');
    try {
        const video = await videosCol.findOne({ _id: new ObjectId(req.params.id) });
        if (video) {
            await videosCol.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { isPinned: !video.isPinned } });
        }
        res.redirect('/mod-panel');
    } catch(e) { res.redirect('/mod-panel'); }
});

app.get('/mod/backup', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok') return res.redirect('/login');
    const users = await usersCol.find({}).project({ password: 0 }).toArray();
    const videos = await videosCol.find({}).toArray();
    res.setHeader('Content-disposition', 'attachment; filename=tiktok_backup.json');
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify({ users, videos, date: new Date() }, null, 2));
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
        
        const activeStorage = getActiveUploadDir();
        await storiesCol.insertOne({ 
            user_id: new ObjectId(req.session.user._id), 
            username: req.session.user.username, 
            mediaUrl: `${activeStorage.prefix}${req.file.filename}`, 
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
    
    const currentUser = await usersCol.findOne({ _id: new ObjectId(req.session.user._id) });
    const isPrivateAccount = currentUser ? currentUser.isPrivate : false;
    const defaultAudience = isPrivateAccount ? "Takipçiler" : "Herkese açık";

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Önizleme</title>
        <style>
            body { background: #fff; color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0 0 80px 0; }
            .top-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; font-weight: bold; font-size: 16px; border-bottom: 1px solid #f1f1f2; background: #fff; position: sticky; top: 0; z-index: 10; }
            .content-box { padding: 15px; }
            .caption-input { width: 100%; border: none; outline: none; font-size: 16px; color: #000; resize: none; background: transparent; margin-top: 10px; }
            .caption-input::placeholder { color: #8a8b91; }
            .desc-hint { font-size: 13px; color: #8a8b91; margin-top: 5px; line-height: 1.4; border-bottom: 1px solid #f1f1f2; padding-bottom: 15px; }
            .tools-row { display: flex; gap: 15px; padding: 12px 0; border-bottom: 1px solid #f1f1f2; align-items: center; font-size: 20px; }
            .menu-item { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #f1f1f2; font-size: 15px; cursor: pointer; color: #161823; }
            .menu-item-left { display: flex; align-items: center; gap: 12px; }
            .bottom-actions { position: fixed; bottom: 0; left: 0; width: 100%; background: #fff; padding: 12px 15px; display: flex; gap: 10px; border-top: 1px solid #f1f1f2; box-sizing: border-box; z-index: 100; }
            .btn-draft { flex: 1; background: #f1f1f2; color: #161823; border: none; padding: 14px; border-radius: 6px; font-weight: bold; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
            .btn-publish { flex: 1; background: #fe2c55; color: #fff; border: none; padding: 14px; border-radius: 6px; font-weight: bold; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
            .custom-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; justify-content: flex-end; flex-direction: column; }
            .modal-content { background: #fff; border-top-left-radius: 16px; border-top-right-radius: 16px; padding: 20px 15px 30px 15px; max-height: 80vh; overflow-y: auto; }
            .modal-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 17px; margin-bottom: 15px; }
            #progressContainer { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:99999; flex-direction:column; justify-content:center; align-items:center; color:#fff; }
        </style>
    </head>
    <body>
        <div class="top-bar">
            <a href="/" style="font-size:22px; color:#000;">‹</a>
            <span>Önizleme</span>
            <div style="width:22px;"></div>
        </div>

        <form id="uploadForm" action="/upload" method="POST" enctype="multipart/form-data" onsubmit="showProgress(event)">
            <input type="hidden" name="visibility" id="visibilityInput" value="${defaultAudience}">

            <div class="content-box">
                <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
                    <div style="width:70px; height:90px; background:#111; border-radius:6px; overflow:hidden; position:relative; display:flex; align-items:center; justify-content:center;">
                        <video id="previewVid" style="width:100%; height:100%; object-fit:cover;"></video>
                        <div style="position:absolute; top:4px; left:4px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:bold;">Kapak</div>
                    </div>
                    <div style="flex-grow:1;">
                        <textarea name="caption" class="caption-input" placeholder="Akılda kalıcı bir başlık ekleyin" rows="2" required></textarea>
                    </div>
                </div>
                
                <div class="desc-hint">Uzun bir açıklama yazmak, ortalama 3 kat daha fazla görüntülemeye almaya yardımcı olabilir.</div>

                <div class="tools-row">
                    <span>#</span>
                    <span>@</span>
                    <span>✨</span>
                    <div style="margin-left:auto; font-size:16px;">🔲</div>
                </div>

                <div class="menu-item" onclick="alert('Konum özelliği aktif.')">
                    <div class="menu-item-left"><span>📍</span><span>Konum</span></div>
                    <span style="color:#8a8b91;">›</span>
                </div>

                <div class="menu-item" onclick="alert('Bağlantı ekleme alanı.')">
                    <div class="menu-item-left"><span>🔗</span><span>Bağlantı ekle</span></div>
                    <span style="color:#8a8b91;">›</span>
                </div>

                <div class="menu-item" onclick="openAudienceModal()">
                    <div class="menu-item-left"><span>🌐</span><span id="audienceText">${defaultAudience} bu gönderiyi görüntüleyebilir</span></div>
                    <span style="color:#8a8b91;">›</span>
                </div>

                <div class="menu-item" onclick="openMoreOptions()">
                    <div class="menu-item-left"><span>⚙️</span><span>Daha fazla seçenek</span></div>
                    <span style="color:#8a8b91;">›</span>
                </div>

                <div style="margin-top:20px;">
                    <label style="font-size:13px; font-weight:bold; color:#555; display:block; margin-bottom:5px;">Video Dosyası Seç:</label>
                    <input type="file" id="videoFile" name="video" accept="video/*" required style="width:100%; padding:10px; background:#f1f1f2; border-radius:6px; font-size:14px;" onchange="loadVideoThumbnail(this)">
                </div>
            </div>

            <div class="bottom-actions">
                <button type="button" class="btn-draft" onclick="alert('Taslaklara kaydedildi!')"><span>📦</span> Taslaklar</button>
                <button type="submit" id="submitBtn" class="btn-publish"><span>⬆️</span> Paylaş</button>
            </div>
        </form>

        <div id="audienceModal" class="custom-modal" onclick="closeAudienceModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <span>Bu gönderiyi kimler görüntüleyebilir</span>
                    <span onclick="document.getElementById('audienceModal').style.display='none'" style="cursor:pointer; font-size:22px;">✕</span>
                </div>
                
                ${isPrivateAccount ? `
                    <div style="padding:12px 0; border-bottom:1px solid #f1f1f2; display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="selectAudience('Takipçiler')">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span>🌐</span>
                            <div>
                                <div style="font-weight:bold; font-size:15px;">Takipçiler</div>
                                <div style="font-size:12px; color:#8a8b91;">Yalnızca özel hesabınızdaki takipçilere görünür</div>
                            </div>
                        </div>
                        <input type="radio" name="aud" ${defaultAudience === 'Takipçiler' ? 'checked' : ''}>
                    </div>
                    <div style="padding:12px 0; border-bottom:1px solid #f1f1f2; display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="selectAudience('Yalnızca siz')">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span>🔒</span>
                            <div>
                                <div style="font-weight:bold; font-size:15px;">Yalnızca siz</div>
                                <div style="font-size:12px; color:#8a8b91;">Sadece siz görebilirsiniz</div>
                            </div>
                        </div>
                        <input type="radio" name="aud" ${defaultAudience === 'Yalnızca siz' ? 'checked' : ''}>
                    </div>
                    <p style="color:#fe2c55; font-size:13px; margin-top:15px; font-weight:bold;">⚠️ Hesabınız özel olduğu için "Herkese açık" video paylaşımı yapılamaz.</p>
                ` : `
                    <div style="padding:12px 0; border-bottom:1px solid #f1f1f2; display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="selectAudience('Herkese açık')">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span>🌐</span>
                            <div>
                                <div style="font-weight:bold; font-size:15px;">Herkese açık</div>
                                <div style="font-size:12px; color:#8a8b91;">Herkes bu gönderiyi görebilir</div>
                            </div>
                        </div>
                        <input type="radio" name="aud" ${defaultAudience === 'Herkese açık' ? 'checked' : ''}>
                    </div>
                    <div style="padding:12px 0; border-bottom:1px solid #f1f1f2; display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="selectAudience('Takipçiler')">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span>👥</span>
                            <div>
                                <div style="font-weight:bold; font-size:15px;">Takipçiler</div>
                                <div style="font-size:12px; color:#8a8b91;">Takipçileriniz görebilir</div>
                            </div>
                        </div>
                        <input type="radio" name="aud">
                    </div>
                    <div style="padding:12px 0; border-bottom:1px solid #f1f1f2; display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="selectAudience('Yalnızca siz')">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span>🔒</span>
                            <div>
                                <div style="font-weight:bold; font-size:15px;">Yalnızca siz</div>
                                <div style="font-size:12px; color:#8a8b91;">Sadece siz görebilirsiniz</div>
                            </div>
                        </div>
                        <input type="radio" name="aud">
                    </div>
                `}
            </div>
        </div>

        <div id="moreOptionsModal" class="custom-modal" onclick="closeMoreModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <span>Daha fazla seçenek</span>
                    <span onclick="document.getElementById('moreOptionsModal').style.display='none'" style="cursor:pointer; font-size:22px;">✕</span>
                </div>
                <div style="font-weight:bold; font-size:13px; color:#8a8b91; margin-bottom:10px;">Gizlilik ayarları</div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f1f1f2;">
                    <span>Yorumlara izin ver</span><input type="checkbox" checked style="width:20px; height:20px; accent-color:#fe2c55;">
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f1f1f2;">
                    <span>İçeriğin yeniden kullanılmasına izin ver</span><input type="checkbox" style="width:20px; height:20px; accent-color:#fe2c55;">
                </div>
            </div>
        </div>

        <div id="progressContainer">
            <div style="font-size:18px; font-weight:bold; margin-bottom:10px;">Video Yayınlanıyor...</div>
            <div style="width:80%; max-width:300px; background:#333; height:10px; border-radius:5px; overflow:hidden;">
                <div id="progressBar" style="width:0%; height:100%; background:#fe2c55; transition:width 0.2s;"></div>
            </div>
            <div id="progressText" style="margin-top:10px; font-size:14px; color:#aaa;">%0</div>
        </div>

        <script>
            function openAudienceModal() { document.getElementById('audienceModal').style.display = 'flex'; }
            function closeAudienceModal(e) { if(e.target.id === 'audienceModal') document.getElementById('audienceModal').style.display = 'none'; }
            function selectAudience(val) {
                document.getElementById('audienceText').innerText = val + ' bu gönderiyi görüntüleyebilir';
                document.getElementById('visibilityInput').value = val;
                document.getElementById('audienceModal').style.display = 'none';
            }
            function openMoreOptions() { document.getElementById('moreOptionsModal').style.display = 'flex'; }
            function closeMoreModal(e) { if(e.target.id === 'moreOptionsModal') document.getElementById('moreOptionsModal').style.display = 'none'; }
            function loadVideoThumbnail(input) {
                if (input.files && input.files[0]) {
                    const videoElem = document.getElementById('previewVid');
                    videoElem.src = URL.createObjectURL(input.files[0]);
                    videoElem.currentTime = 0.5;
                }
            }
            function showProgress(e) {
                e.preventDefault();
                const form = document.getElementById('uploadForm');
                const formData = new FormData(form);
                const progContainer = document.getElementById('progressContainer');
                const progressBar = document.getElementById('progressBar');
                const progressText = document.getElementById('progressText');
                progContainer.style.display = 'flex';
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/upload', true);
                xhr.upload.onprogress = function(e) {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        progressBar.style.width = percent + '%';
                        progressText.innerText = '%' + percent;
                    }
                };
                xhr.onload = function() {
                    if (xhr.status === 200) { window.location.href = '/'; } else { alert('Yükleme hatası!'); progContainer.style.display = 'none'; }
                };
                xhr.send(formData);
            }
        </script>
    </body>
    </html>`);
});

app.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Hata");
    try {
        if (!req.file) return res.send("<script>alert('Video seçin!'); window.location='/upload-page';</script>");
        const currentUser = await usersCol.findOne({ _id: new ObjectId(req.session.user._id) });
        let visibility = req.body.visibility || 'Herkese açık';
        if (currentUser && currentUser.isPrivate && visibility === 'Herkese açık') {
            visibility = 'Takipçiler';
        }
        
        const activeStorage = getActiveUploadDir();
        await videosCol.insertOne({ 
            user_id: new ObjectId(req.session.user._id), 
            username: req.session.user.username, 
            caption: req.body.caption || '', 
            filename: `${activeStorage.prefix}${req.file.filename}`, 
            song: 'Orijinal Ses', 
            visibility: visibility,
            views: 0, likes: 0, favorites: 0, shares: 0, isPinned: false, createdAt: new Date() 
        });
        res.redirect('/');
    } catch (err) { res.status(500).send("Hata: " + err.message); }
});

app.post('/comment/:id', upload.single('image'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const activeStorage = getActiveUploadDir();
        let imageUrl = req.file ? `${activeStorage.prefix}${req.file.filename}` : '';
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
                comment: commentText, image: imageUrl, likes: 0, createdAt: new Date() 
            });
        }
    } catch (err) { console.error(err); }
    res.redirect('back');
});

app.get('/pin-comment/:commentId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const comment = await commentsCol.findOne({ _id: new ObjectId(req.params.commentId) });
        if (comment) {
            const newPinned = !comment.isPinned;
            await commentsCol.updateMany({ video_id: comment.video_id }, { $set: { isPinned: false } });
            await commentsCol.updateOne({ _id: comment._id }, { $set: { isPinned: newPinned } });
        }
    } catch(e) {}
    res.redirect('back');
});

app.get('/like-comment/:commentId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        await commentsCol.updateOne({ _id: new ObjectId(req.params.commentId) }, { $inc: { likes: 1 } });
    } catch(e) {}
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
        const { nickname, bio, profileTheme, hideVisitors, restrictedMode, isPrivate } = req.body;
        const userId = new ObjectId(req.session.user._id);
        const activeStorage = getActiveUploadDir();
        
        let avatarFile = req.session.user.avatar || '';
        if (req.files && req.files['avatar']) avatarFile = `${activeStorage.prefix}${req.files['avatar'][0].filename}`;
        
        let bannerFile = req.session.user.banner || '';
        if (req.files && req.files['banner']) bannerFile = `${activeStorage.prefix}${req.files['banner'][0].filename}`;

        const newNickname = nickname || req.session.user.nickname;
        const isHideVis = hideVisitors === 'yes';
        const isRestricted = restrictedMode === 'yes';
        const isPriv = isPrivate === 'yes';

        await usersCol.updateOne({ _id: userId }, { $set: { nickname: newNickname, bio, profileTheme: profileTheme || 'Koyu', hideVisitors: isHideVis, restrictedMode: isRestricted, isPrivate: isPriv, avatar: avatarFile, banner: bannerFile, lastActive: new Date() } });

        req.session.user.nickname = newNickname;
        req.session.user.bio = bio;
        req.session.user.profileTheme = profileTheme || 'Koyu';
        req.session.user.hideVisitors = isHideVis;
        req.session.user.restrictedMode = isRestricted;
        req.session.user.isPrivate = isPriv;
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
        if (!analyticsCol) analyticsCol = db.collection('analytics');
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
        videos = await videosCol.find({ _id: { $in: userLikes.map(l => l.video_id) } }).sort({ _id: -1 }).toArray();
    } else if (tab === 'favorites') {
        const userFavs = await favoritesCol.find({ user_id: targetUser._id }).toArray();
        videos = await videosCol.find({ _id: { $in: userFavs.map(f => f.video_id) } }).sort({ _id: -1 }).toArray();
    }

    const followersCount = await followsCol.countDocuments({ following_id: targetUser._id });
    const followingCount = await followsCol.countDocuments({ follower_id: targetUser._id });
    const followCheck = await followsCol.findOne({ follower_id: new ObjectId(req.session.user._id), following_id: targetUser._id });
    const recentVisitors = analyticsCol ? await analyticsCol.find({ profile_id: targetUser._id }).sort({ visitedAt: -1 }).limit(10).toArray() : [];
    
    let totalLikesAgg = await videosCol.aggregate([{ $match: { user_id: targetUser._id } }, {$group: { _id: null, total: { $sum: "$likes" } } }]).toArray();
    let totalLikes = totalLikesAgg.length > 0 ? totalLikesAgg[0].total : 0;

    const userStories = await storiesCol.find({ username: targetUser.username }).toArray();
    const hasStory = userStories.length > 0;

    let isMod = req.session.user.username.toLowerCase() === 'tiktok';
    let isFollowing = !!followCheck;
    let isTargetTikTok = targetUser.username.toLowerCase() === 'tiktok';

    let videoHTML = '';
    let canViewContent = isMe || !targetUser.isPrivate || isFollowing;

    if (!canViewContent) {
        videoHTML = '<div style="text-align:center; padding:50px; color:#888;"><div style="font-size:40px; margin-bottom:10px;">🔒</div><h3>Bu hesap gizli</h3><p style="font-size:13px;">Bu kullanıcının videolarını görmek için takip etmelisiniz.</p></div>';
    } else {
        if (tab === 'visitors') {
            if (targetUser.hideVisitors && isMe) {
                videoHTML = '<p style="text-align:center; color:#888; padding:40px;">Ziyaretçi gizliliğiniz açık.</p>';
            } else {
                recentVisitors.forEach(vis => {
                    videoHTML += `<div style="padding:12px 15px; border-bottom:1px solid #222; display:flex; align-items:center; justify-content:space-between; font-size:14px;"><div><b>@${vis.visitor_username}</b> profiline baktı.</div><div style="font-size:11px; color:#888;">Yakın zamanda</div></div>`;
                });
                if(recentVisitors.length === 0) videoHTML = '<p style="text-align:center; color:#666; padding:40px;">Henüz ziyaretçi yok.</p>';
            }
        } else {
            videos.forEach(v => {
                let safeCaption = (v.caption || '').replace(/'/g, "\\'");
                let canDelete = isMe || (isMod && tab === 'videos');
                videoHTML += `
                <div class="v-thumb" style="position:relative;">
                    <video src="${v.filename}#t=0.1" muted preload="metadata" style="width:100%; height:100%; object-fit:cover;"></video>
                    <div class="thumb-stats">👁️ ${v.views || 0}</div>
                    ${canDelete ? `<a href="/delete-video/${v._id}" onclick="return confirm('Silmek istediğine emin misin?');" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.7); color:#ff4d4d; padding:4px 8px; border-radius:4px; font-size:11px; z-index:10;">Sil</a>` : ''}
                </div>`;
            });
        }
    }

    let bannerBg = targetUser.banner ? `url('${targetUser.banner}')` : 'linear-gradient(135deg, #2b2b2b, #111)';
    let rawAvatarHTML = targetUser.avatar ? `<img src="${targetUser.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : targetUser.nickname.charAt(0).toUpperCase();
    
    let avatarContainerHTML = hasStory ? 
        `<div class="story-ring" onclick="window.location='/inbox'" style="width:93px; height:93px; margin:-45px auto 10px auto; border-radius:50%; display:flex; align-items:center; justify-content:center;">
            <div style="width:85px; height:85px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:36px; font-weight:bold; overflow:hidden;">${rawAvatarHTML}</div>
         </div>` : 
        `<div class="avatar" style="width:85px; height:85px; background:#FE2C55; border:4px solid #000; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:36px; margin:-45px auto 10px auto; font-weight:bold; overflow:hidden;">${rawAvatarHTML}</div>`;

    let verifiedBadgeHTML = isTargetTikTok ? '<span class="verified-badge" title="Resmi Hesap">✔</span>' : '';
    let lockIconHTML = targetUser.isPrivate ? '<span style="font-size:20px; margin-right:6px; vertical-align:middle;">🔒</span>' : '';

    let actionButtonsHTML = isMe ? 
        `<button onclick="document.getElementById('editModal').style.display='flex'" style="padding:8px 25px; background:#2f2f2f; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Profili Düzenle</button>
         <a href="/logout" style="padding:8px 15px; background:#333; color:#ff4d4d; border-radius:6px; font-weight:bold; display:flex; align-items:center; font-size:13px;">Çıkış Yap</a>` :
        (isFollowing ? `<a href="/follow/${targetUser._id}" style="padding:8px 20px; background:#333; color:#fff; border-radius:6px; font-weight:bold; font-size:13px;">Takip ediliyor</a><a href="/chat/${targetUser.username}" style="padding:8px 20px; background:#FE2C55; color:#fff; border-radius:6px; font-weight:bold; font-size:13px;">Mesajlar</a>` : `<a href="/follow/${targetUser._id}" style="padding:8px 25px; background:#FE2C55; color:#fff; border-radius:6px; font-weight:bold; font-size:13px;">Takip Et</a>`);

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
        </style>
    </head>
    <body>
        <div class="banner"></div>
        <div class="profile-header">
            ${isMe ? `<div class="settings-btn" onclick="document.getElementById('settingsModal').style.display='flex'">⚙️</div>` : ''}
            ${avatarContainerHTML}
            <h2 style="margin:5px 0; display:flex; align-items:center; justify-content:center; gap:4px;">${lockIconHTML}${targetUser.nickname} ${verifiedBadgeHTML}</h2>
            <p style="color:#888; margin:0; font-size:13px;">@${targetUser.username}</p>
            <div style="margin-top:10px;"><a href="/report-page/${targetUser.username}" style="color:#FE2C55; font-size:12px; font-weight:bold;">Şikayet Et ⚠️</a></div>
            <div class="stats">
                <div><span>${followingCount}</span>Takip edilen</div>
                <div><span>${followersCount}</span>Takipçi</div>
                <div><span>${totalLikes}</span>Beğeni</div>
            </div>
            <p style="color:#ccc; font-size:13px; margin-bottom:15px;">${targetUser.bio}</p>
            <div style="display:flex; gap:10px; justify-content:center;">${actionButtonsHTML}</div>
        </div>

        <div class="profile-tabs">
            <a href="/profile/${targetUser.username}?tab=videos" class="${tab === 'videos' ? 'active' : ''}">🎬 Videolar</a>
            <a href="/profile/${targetUser.username}?tab=likes" class="${tab === 'likes' ? 'active' : ''}">❤️ Beğenilenler</a>
            <a href="/profile/${targetUser.username}?tab=favorites" class="${tab === 'favorites' ? 'active' : ''}">⭐ Favoriler</a>
            ${isMe ? `<a href="/profile/${targetUser.username}?tab=visitors" class="${tab === 'visitors' ? 'active' : ''}">👀 Ziyaretçiler</a>` : ''}
        </div>

        <div class="${tab === 'visitors' ? '' : 'grid'}">${videoHTML}</div>

        <div id="settingsModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:300000; justify-content:center; align-items:flex-end;">
            <div style="background:#1a1a1a; color:#fff; width:100%; max-height:80vh; border-top-left-radius:16px; border-top-right-radius:16px; display:flex; flex-direction:column; overflow:hidden;">
                <div style="padding:15px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; font-weight:bold;">
                    <span>⚙️ Ayarlar</span><span onclick="document.getElementById('settingsModal').style.display='none'" style="cursor:pointer; font-size:22px;">✕</span>
                </div>
                <div style="padding:15px; display:flex; flex-direction:column; gap:12px; font-size:14px;">
                    <div style="background:#262626; padding:12px; border-radius:8px; cursor:pointer;" onclick="document.getElementById('editModal').style.display='flex'; document.getElementById('settingsModal').style.display='none';">✏️ Profili Düzenle</div>
                </div>
            </div>
        </div>

        <div id="editModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:200000; justify-content:center; align-items:center;">
            <div style="background:#1f1f1f; padding:25px; border-radius:12px; width:340px; text-align:left; color:#fff;">
                <h3 style="text-align:center; margin-top:0;">Profili Düzenle</h3>
                <form action="/update-profile" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:10px;">
                    <label style="font-size:11px; color:#aaa;">Görünen Ad:</label>
                    <input type="text" name="nickname" value="${targetUser.nickname}" required style="padding:10px; background:#2f2f2f; border:none; color:#fff; border-radius:6px;">
                    
                    <label style="font-size:11px; color:#aaa;">Biyografi:</label>
                    <input type="text" name="bio" value="${targetUser.bio || ''}" style="padding:10px; background:#2f2f2f; border:none; color:#fff; border-radius:6px;">

                    <label style="font-size:11px; color:#aaa;">Profil Fotoğrafı:</label>
                    <input type="file" name="avatar" accept="image/*">

                    <label style="font-size:11px; color:#aaa;">Banner (Arka Plan) Görseli:</label>
                    <input type="file" name="banner" accept="image/*">

                    <div style="display:flex; align-items:center; gap:10px; background:#262626; padding:10px; border-radius:6px; margin-top:5px;">
                        <input type="checkbox" name="isPrivate" value="yes" ${targetUser.isPrivate ? 'checked' : ''} style="width:20px; height:20px; accent-color:#FE2C55;">
                        <label style="font-size:14px; font-weight:bold;">Gizli Hesap 🔒</label>
                    </div>

                    <button type="submit" style="background:#FE2C55; color:#fff; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:10px;">Kaydet</button>
                    <button type="button" onclick="document.getElementById('editModal').style.display='none'" style="background:#333; color:#fff; padding:10px; border:none; border-radius:6px; cursor:pointer;">İptal</button>
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
        await searchesCol.updateOne({ user_id: new ObjectId(req.session.user._id), query: query }, { $set: { updatedAt: new Date() } }, { upsert: true });
    }
    let userSearches = isConnected ? await searchesCol.find({ user_id: new ObjectId(req.session.user._id) }).sort({ updatedAt: -1 }).limit(5).toArray() : [];
    let searchResultsVideos = [], searchResultsUsers = [];
    if (query && isConnected) {
        searchResultsVideos = await videosCol.find({ caption: { $regex: query,$options: 'i' } }).toArray();
        searchResultsUsers = await usersCol.find({ $or: [{ username: { $regex: query,$options: 'i' } }, { nickname: { $regex: query,$options: 'i' } }] }).toArray();
    }
    let dynamicListHTML = '';
    if (!query) {
        let defaultSuggestions = ['motivasyon', 'greenlerin büyükşehir maceraları', 'calisthenics workout'];
        userSearches.forEach(s => { if(!defaultSuggestions.includes(s.query)) defaultSuggestions.unshift(s.query); });
        defaultSuggestions.forEach((item, index) => {
            let isRelated = index < userSearches.length;
            dynamicListHTML += `<a href="/search?q=${encodeURIComponent(item)}" style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid #f1f1f2; color:#000; font-size:15px;"><div style="display:flex; align-items:center; gap:14px;"><span style="width:6px; height:6px; background:${isRelated ? '#FE2C55' : '#888'}; border-radius:50%;"></span><span>${item}</span></div>${isRelated ? '<span style="font-size:12px; color:#888;">Aramanızla ilgili</span>' : ''}</a>`;
        });
    } else {
        searchResultsUsers.forEach(u => {
            dynamicListHTML += `<a href="/profile/${u.username}" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid #f1f1f2; color:#000;"><div style="width:36px; height:36px; background:#FE2C55; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">👤</div><div><b>${u.nickname}</b><div style="font-size:12px; color:#888;">@${u.username}</div></div></a>`;
        });
        searchResultsVideos.forEach(v => {
            dynamicListHTML += `<div style="padding:12px 16px; border-bottom:1px solid #f1f1f2; color:#000; font-size:14px;">🎬 <b>@${v.username}</b>: ${v.caption}</div>`;
        });
    }
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ara</title><style>${globalStyles} body{background:#fff; color:#000;}</style></head>
    <body>
        <div style="display:flex; align-items:center; gap:12px; padding:12px 15px; background:#fff; border-bottom:1px solid #eee; position:sticky; top:0;">
            <a href="/" style="font-size:24px; font-weight:bold; color:#000;">‹</a>
            <form action="/search" method="GET" style="flex-grow:1; background:#f1f1f2; border-radius:8px; display:flex; align-items:center; padding:0 12px; height:40px; gap:10px;">
                <span>🔍</span><input type="text" name="q" placeholder="Arama yap..." value="${query}" style="width:100%; background:transparent; border:none; outline:none; font-size:15px;">
            </form>
        </div>
        <div style="background:#fff;">${dynamicListHTML}</div>
    </body>
    </html>`);
});

app.get('/inbox', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const myUsername = req.session.user.username;

    const allStories = await storiesCol.find({}).sort({ createdAt: 1 }).toArray();
    const storyGroupsMap = new Map();
    allStories.forEach(s => {
        if (!storyGroupsMap.has(s.username)) {
            storyGroupsMap.set(s.username, []);
        }
        storyGroupsMap.get(s.username).push(s);
    });

    const messagesList = await messagesCol.find({ $or: [{ sender: myUsername }, { receiver: myUsername }] }).sort({ createdAt: -1 }).toArray();
    let chattedUsernames = new Map();
    messagesList.forEach(m => {
        let partner = m.sender === myUsername ? m.receiver : m.sender;
        if (!chattedUsernames.has(partner)) {
            chattedUsernames.set(partner, { unreadCount: 0, lastMessage: m.text || 'Medya' });
        }
        if (m.receiver === myUsername && !m.isRead) {
            chattedUsernames.get(partner).unreadCount++;
        }
    });

    const chattedUsers = await usersCol.find({ username: { $in: Array.from(chattedUsernames.keys()) } }).toArray();
    const myGroups = await groupsCol.find({ members: myUsername }).toArray();

    let storiesBarHTML = `<div class="story-circle-item" onclick="window.location='/upload-story-page'"><div style="width:58px; height:58px; border-radius:50%; background:#222; border:1px solid #444; display:flex; align-items:center; justify-content:center; font-size:26px; color:#fff;">+</div><span>Oluştur</span></div>`;
    
    storyGroupsMap.forEach((storiesArr, uname) => {
        let firstStory = storiesArr[0];
        let avatarContent = `<img src="${firstStory.mediaUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        let userJson = JSON.stringify(storiesArr).replace(/"/g, '&quot;');
        
        storiesBarHTML += `
        <div class="story-circle-item" onclick='openMultiStoryViewer(${userJson}, 0)'>
            <div class="story-ring" style="width:62px; height:62px; border-radius:50%;">
                <div style="width:54px; height:54px; border-radius:50%; overflow:hidden; background:#333;">${avatarContent}</div>
            </div>
            <span>@${uname}</span>
        </div>`;
    });

    let inboxListHTML = '';
    myGroups.forEach(g => {
        inboxListHTML += `<a href="/group-chat/${g._id}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #1a1a1a;"><div style="display:flex; align-items:center; gap:12px;"><div style="width:48px; height:48px; background:#25F4EE; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#000;">👥</div><div><div style="font-weight:bold; font-size:15px;">${g.groupName}</div><div style="color:#888; font-size:12px;">Grup Sohbeti</div></div></div></a>`;
    });

    chattedUsers.forEach(u => {
        let chatInfo = chattedUsernames.get(u.username) || { unreadCount: 0, lastMessage: 'Sohbet' };
        let avatarContent = u.avatar ? `<img src="${u.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : u.nickname.charAt(0).toUpperCase();
        inboxListHTML += `
        <a href="/chat/${u.username}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #1a1a1a; color:#fff;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:48px; height:48px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#fff; overflow:hidden;">${avatarContent}</div>
                <div>
                    <div style="font-weight:bold; font-size:15px;">${u.nickname} <span style="font-size:12px; color:#888;">@${u.username}</span></div>
                    <div style="color:#aaa; font-size:13px;">${chatInfo.lastMessage}</div>
                </div>
            </div>
            ${chatInfo.unreadCount > 0 ? `<div style="background:#FE2C55; color:#fff; font-size:12px; font-weight:bold; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center;">${chatInfo.unreadCount}</div>` : ''}
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
            .story-circle-item { display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; flex-shrink: 0; font-size: 11px; color: #fff; }
            
            .story-viewer-modal { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #000; z-index: 999999; flex-direction: column; justify-content: space-between; }
            .story-top-bars-container { position: absolute; top: 10px; left: 10px; width: calc(100% - 20px); display: flex; gap: 4px; z-index: 20; }
            .story-single-bar { flex: 1; height: 3px; background: rgba(255,255,255,0.4); border-radius: 2px; overflow: hidden; }
            .story-single-bar-fill { width: 0%; height: 100%; background: #fff; transition: width 0.1s linear; }
            .story-top-info { position: absolute; top: 20px; left: 0; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 15px; z-index: 20; box-sizing: border-box; }
        </style>
        <script>
            let activeStories = [];
            let currentIndex = 0;
            let progressTimer = null;

            function openMultiStoryViewer(storiesArr, index) {
                activeStories = storiesArr;
                currentIndex = index;
                renderStoryModal();
                document.getElementById('storyViewerModal').style.display = 'flex';
            }

            function renderStoryModal() {
                if(currentIndex >= activeStories.length) {
                    closeStoryViewer();
                    return;
                }
                const story = activeStories[currentIndex];
                const content = document.getElementById('storyMediaContent');
                document.getElementById('storyUsername').innerText = '@' + story.username;

                let barsHTML = '';
                for(let i=0; i<activeStories.length; i++) {
                    let fillColor = i < currentIndex ? '100%' : (i === currentIndex ? '0%' : '0%');
                    barsHTML += '<div class="story-single-bar"><div class="story-single-bar-fill" id="barFill-' + i + '" style="width:' + fillColor + ';"></div></div>';
                }
                document.getElementById('topBarsContainer').innerHTML = barsHTML;

                if (story.mediaType === 'video') {
                    content.innerHTML = '<video src="' + story.mediaUrl + '" autoplay style="width:100%; height:100%; object-fit:contain;"></video>';
                } else {
                    content.innerHTML = '<img src="' + story.mediaUrl + '" style="width:100%; height:100%; object-fit:contain;">';
                }

                const deleteBtn = document.getElementById('storyDeleteBtn');
                if(story.username === '${req.session.user.username}' || '${req.session.user.username}' === 'tiktok') {
                    deleteBtn.style.display = 'block';
                    deleteBtn.onclick = function() {
                        if(confirm('Hikayeyi silmek istiyor musun?')) window.location = '/delete-story/' + story._id;
                    };
                } else {
                    deleteBtn.style.display = 'none';
                }

                startStoryTimer();
            }

            function startStoryTimer() {
                clearInterval(progressTimer);
                let currentProgress = 0;
                const fillElem = document.getElementById('barFill-' + currentIndex);
                
                progressTimer = setInterval(() => {
                    currentProgress += 2;
                    if(fillElem) fillElem.style.width = currentProgress + '%';
                    if(currentProgress >= 100) {
                        clearInterval(progressTimer);
                        currentIndex++;
                        renderStoryModal();
                    }
                }, 100);
            }

            function handleStoryClick(e) {
                const screenWidth = window.innerWidth;
                const clickX = e.clientX;
                clearInterval(progressTimer);

                if (clickX > screenWidth / 2) {
                    currentIndex++;
                    renderStoryModal();
                } else {
                    if(currentIndex > 0) currentIndex--;
                    renderStoryModal();
                }
            }

            function closeStoryViewer() {
                clearInterval(progressTimer);
                document.getElementById('storyViewerModal').style.display = 'none';
                document.getElementById('storyMediaContent').innerHTML = '';
            }
        </script>
    </head>
    <body>
        <div id="storyViewerModal" class="story-viewer-modal">
            <div class="story-top-bars-container" id="topBarsContainer"></div>
            <div class="story-top-info">
                <div style="display:flex; align-items:center; gap:10px; color:#fff; font-weight:bold; font-size:14px; text-shadow:0 1px 2px #000;">
                    <div style="width:32px; height:32px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center;">👤</div>
                    <span id="storyUsername">@kullanici</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <button id="storyDeleteBtn" style="background:#ff4d4d; border:none; color:#fff; padding:4px 12px; border-radius:12px; font-weight:bold; font-size:12px; display:none; cursor:pointer;">Sil</button>
                    <span onclick="closeStoryViewer()" style="font-size:24px; cursor:pointer; font-weight:bold; color:#fff;">✕</span>
                </div>
            </div>
            
            <div id="storyMediaContent" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="handleStoryClick(event)"></div>
            
            <div style="position:absolute; bottom:20px; left:0; width:100%; display:flex; align-items:center; justify-content:space-between; padding:0 15px; box-sizing:border-box; z-index:20;">
                <input type="text" placeholder="Hikayeye yanıt ver..." style="flex-grow:1; background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.3); border-radius:20px; padding:10px 15px; color:#fff; font-size:13px; outline:none;">
            </div>
        </div>

        <div style="padding:15px; font-size:20px; font-weight:bold; border-bottom:1px solid #222; display:flex; justify-content:space-between; align-items:center;">
            <span>Gelen kutusu</span>
            <span>🔍</span>
        </div>

        <div class="story-inbox-bar">${storiesBarHTML}</div>
        
        <div style="padding:12px 15px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #222;">
            <a href="/activity" style="display:flex; align-items:center; gap:12px; color:#fff; font-weight:bold; font-size:15px;">
                <div style="width:42px; height:42px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff;">⚡</div>
                <div>Aktivite ve yeni takipçiler</div>
            </a>
            <button onclick="document.getElementById('groupModal').style.display='flex'" style="background:#25F4EE; color:#000; border:none; padding:6px 12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">➕ Grup Kur</button>
        </div>

        ${inboxListHTML || '<p style="text-align:center; color:#888; padding:40px;">Henüz aktif mesajlaşma yok.</p>'}

        <div id="groupModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:200000; justify-content:center; align-items:center;">
            <div style="background:#1f1f1f; padding:25px; border-radius:12px; width:340px; text-align:center; color:#fff;">
                <h3>Sohbet Grubu Kur</h3>
                <form action="/create-group" method="POST" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
                    <input type="text" name="groupName" placeholder="Grup Adı" required style="padding:10px; background:#2f2f2f; border:none; color:#fff; border-radius:6px;">
                    <input type="text" name="members" placeholder="Üyeler (virgülle ayırın)" required style="padding:10px; background:#2f2f2f; border:none; color:#fff; border-radius:6px;">
                    <button type="submit" style="background:#25F4EE; color:#000; padding:10px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Oluştur</button>
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
    await groupsCol.insertOne({ groupName: groupName.trim(), members: memberList, createdBy: req.session.user.username, createdAt: new Date() });
    res.redirect('/inbox');
});

app.get('/chat/:targetUser', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const target = await usersCol.findOne({ username: req.params.targetUser.toLowerCase() });
    if (!target) return res.send("Kullanıcı bulunamadı.");
    const myUser = req.session.user.username;
    await messagesCol.updateMany({ receiver: myUser, sender: target.username, isRead: { $ne: true } }, {$set: { isRead: true } });
    const messages = await messagesCol.find({ $or: [{ sender: myUser, receiver: target.username }, { sender: target.username, receiver: myUser }] }).sort({ _id: 1 }).toArray();

    let chatHTML = '';
    messages.forEach(m => {
        const isMe = m.sender === myUser;
        chatHTML += `<div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:12px;"><div style="max-width:75%; background:${isMe ? '#FE2C55' : '#222'}; color:#fff; padding:10px 16px; border-radius:18px; font-size:14px;">${m.text}</div></div>`;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sohbet</title><style>${globalStyles} body{background:#000; color:#fff;}</style></head>
    <body>
        <div style="position:fixed; top:0; left:0; width:100%; height:60px; background:#121212; display:flex; align-items:center; padding:0 15px; border-bottom:1px solid #222; z-index:100;">
            <a href="/inbox" style="font-size:24px; font-weight:bold; color:#fff; margin-right:12px;">‹</a>
            <div style="font-weight:bold; font-size:15px;">${target.nickname}</div>
        </div>
        <div style="padding:75px 15px 90px 15px;">${chatHTML || '<p style="text-align:center; color:#888;">Mesaj yok.</p>'}</div>
        <form action="/send-msg/${target.username}" method="POST" style="position:fixed; bottom:0; left:0; width:100%; background:#121212; padding:10px 15px; border-top:1px solid #222; display:flex; gap:12px; z-index:100;">
            <input type="text" name="text" placeholder="Mesaj gönder..." required style="flex-grow:1; background:#222; border:none; border-radius:24px; padding:10px 16px; color:#fff; outline:none;">
            <button type="submit" style="background:#FE2C55; color:#fff; border:none; padding:8px 14px; border-radius:18px; font-weight:bold; cursor:pointer;">Gönder</button>
        </form>
    </body>
    </html>`);
});

app.post('/send-msg/:targetUser', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    await messagesCol.insertOne({ sender: req.session.user.username, receiver: req.params.targetUser, text: req.body.text, isRead: false, createdAt: new Date() });
    res.redirect('back');
});

app.get('/group-chat/:groupId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const group = await groupsCol.findOne({ _id: new ObjectId(req.params.groupId) });
        if (!group || !group.members.includes(req.session.user.username.toLowerCase())) return res.send("Yetkiniz yok.");
        const messages = await messagesCol.find({ receiverGroup: group._id.toString() }).sort({ _id: 1 }).toArray();
        let chatHTML = '';
        messages.forEach(m => {
            const isMe = m.sender === req.session.user.username;
            chatHTML += `<div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:12px;"><div style="font-size:11px; color:#888;">@${m.sender}</div><div style="background:${isMe ? '#FE2C55' : '#222'}; color:#fff; padding:10px 16px; border-radius:18px; font-size:14px;">${m.text}</div></div>`;
        });
        res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head><meta charset="UTF-8"><title>Grup</title><style>${globalStyles} body{background:#000; color:#fff;}</style></head>
        <body>
            <div style="position:fixed; top:0; left:0; width:100%; height:60px; background:#121212; display:flex; align-items:center; padding:0 15px; border-bottom:1px solid #222;"><a href="/inbox" style="font-size:24px; color:#fff; margin-right:12px;">‹</a><b>${group.groupName}</b></div>
            <div style="padding:75px 15px 90px 15px;">${chatHTML || '<p style="text-align:center; color:#888;">Mesaj yok.</p>'}</div>
            <form action="/send-group-msg/${group._id}" method="POST" style="position:fixed; bottom:0; left:0; width:100%; background:#121212; padding:10px 15px; border-top:1px solid #222; display:flex; gap:12px;"><input type="text" name="text" placeholder="Mesaj..." required style="flex-grow:1; background:#222; border:none; border-radius:24px; padding:10px 16px; color:#fff;"><button type="submit" style="background:#FE2C55; color:#fff; border:none; border-radius:18px; padding:8px 14px; font-weight:bold;">Gönder</button></form>
        </body>
        </html>`);
    } catch(e) { res.send("Hata"); }
});

app.post('/send-group-msg/:groupId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    await messagesCol.insertOne({ sender: req.session.user.username, receiverGroup: req.params.groupId, text: req.body.text, createdAt: new Date() });
    res.redirect('back');
});

app.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    await usersCol.updateOne({ username: req.session.user.username }, { $set: { lastActive: new Date() } });

    const feedType = req.query.feed || 'foryou';
    let videos = [];
    if (isConnected) {
        if (feedType === 'community' || feedType === 'friends') {
            const follows = await followsCol.find({ follower_id: new ObjectId(req.session.user._id) }).toArray();
            videos = await videosCol.find({ user_id: { $in: follows.map(f => f.following_id) } }).sort({ _id: -1 }).toArray();
        } else {
            videos = await videosCol.find({}).sort({ isPinned: -1, likes: -1, _id: -1 }).toArray();
        }
    }

    const allStories = await storiesCol.find({}).toArray();
    const activeStoryUsernames = new Set(allStories.map(s => s.username));
    const userId = new ObjectId(req.session.user._id);

    const activeAnnouncement = isConnected && announcementsCol ? await announcementsCol.findOne({}) : null;
    let isMod = req.session.user.username.toLowerCase() === 'tiktok';

    let feedHTML = '';
    for (let v of videos) {
        const comments = await commentsCol.find({ video_id: v._id }).sort({ isPinned: -1, _id: -1 }).toArray();
        const isLiked = await likesCol.findOne({ user_id: userId, video_id: v._id });
        const isFav = await favoritesCol.findOne({ user_id: userId, video_id: v._id });

        let commentList = '';
        comments.forEach(c => {
            let commenterAvatar = c.avatar ? `<img src="${c.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : (c.nickname ? c.nickname.charAt(0).toUpperCase() : '👤');
            let pinBtn = (v.username === req.session.user.username || isMod) ? `<a href="/pin-comment/${c._id}" style="font-size:10px; color:${c.isPinned ? '#FE2C55' : '#888'}; margin-left:8px;">${c.isPinned ? '📌 Sabitlendi' : 'Sabitle'}</a>` : '';
            let commentLikeBtn = `<a href="/like-comment/${c._id}" style="font-size:10px; color:#888; margin-left:8px;">❤️ ${c.likes || 0}</a>`;
            commentList += `<div class="comment-item" style="${c.isPinned ? 'background:rgba(254,44,85,0.08); padding:6px; border-radius:6px;' : ''}"><div class="comment-avatar">${commenterAvatar}</div><div class="comment-content" style="flex-grow:1;"><div class="comment-author">${c.nickname || c.username} ${pinBtn} ${commentLikeBtn}</div><div class="comment-text">${c.comment}</div></div></div>`;
        });

        let formattedCaption = (v.caption || '').replace(/(#\w+)/g, '<a href="/search?q=$1" style="color:#25F4EE; font-weight:bold;">$1</a>');
        let authorVerified = (v.username.toLowerCase() === 'tiktok' || v.isVerified) ? '<span class="verified-badge">✔</span>' : '';
        let canDeleteVideo = (v.username.toLowerCase() === req.session.user.username.toLowerCase()) || isMod;

        let hasUserStory = activeStoryUsernames.has(v.username);
        let avatarWrapperHTML = hasUserStory ? 
            `<div class="story-ring" onclick="window.location='/profile/${v.username}'" style="width:50px; height:50px; border-radius:50%; position:absolute; top:-3px; left:-3px; display:flex; align-items:center; justify-content:center;"></div>
             <div style="position:absolute; bottom:-6px; left:50%; transform:translateX(-50%); width:18px; height:18px; background:#FE2C55; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">+</div>` : '';

        feedHTML += `
        <div class="video-container" id="container-${v._id}">
            <video id="vid-${v._id}" src="${v.filename}" loop playsinline preload="auto" class="feed-video" onclick="toggleVideoPlay('vid-${v._id}')"></video>
            <div class="sound-toggle-btn" id="soundBtn-${v._id}" onclick="toggleMute('vid-${v._id}', this)">🔊 Ses Açık</div>
            <div class="video-info">
                <a href="/profile/${v.username}" style="font-weight: bold; font-size: 15px; text-shadow: 0 1px 2px #000;">@${v.username} ${authorVerified}</a>
                <p style="margin: 5px 0; font-size: 14px; text-shadow: 0 1px 2px #000;">${formattedCaption}</p>
                <p style="margin: 0; font-size: 12px; color: #ddd; text-shadow: 0 1px 2px #000;">🎵 ${v.song}</p>
            </div>
            <div class="sidebar-actions">
                <div style="position:relative; margin-bottom:10px;">
                    <a href="/profile/${v.username}" style="width:44px; height:44px; border-radius:50%; background:#25F4EE; display:block; overflow:hidden;">
                        <div style="width:100%; height:100%; background:#555; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold;">${v.username.charAt(0).toUpperCase()}</div>
                    </a>
                    ${avatarWrapperHTML}
                </div>
                <a href="/like/${v._id}" class="action-btn" style="color:${isLiked ? '#FE2C55' : '#fff'};">♥<span>${v.likes}</span></a>
                <a href="#" onclick="openComments('${v._id}'); return false;" class="action-btn">💬<span>${comments.length}</span></a>
                <a href="/favorite/${v._id}" class="action-btn" style="color:${isFav ? '#FFD700' : '#fff'};">★<span>${v.favorites}</span></a>
                <a href="/report-page/${v.username}" class="action-btn" style="font-size:12px;" title="Şikayet Et">⚠️</a>
                
                <div style="width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg, #25F4EE, #FE2C55); padding:2px; margin-top:5px;">
                    <div style="width:100%; height:100%; background:#111; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px;">🎵</div>
                </div>

                ${canDeleteVideo ? `<a href="/delete-video/${v._id}" onclick="return confirm('Silmek istiyor musun?');" class="action-btn" style="background:rgba(255,0,0,0.6); margin-top:5px;">🗑️<span>Sil</span></a>` : ''}
            </div>

            <div id="commentModal-${v._id}" class="comment-modal">
                <div class="comment-modal-header"><span>${comments.length} yorum</span><span onclick="closeComments('${v._id}')" class="comment-close-btn">✕</span></div>
                <form action="/comment/${v._id}" method="POST" enctype="multipart/form-data" class="comment-input-form" autocomplete="off">
                    <input type="text" name="comment" placeholder="Yorum ekle (veya /tts [metin])..." required style="flex-grow:1; padding:12px 16px; background:#f1f1f2; border:none; border-radius:24px; outline:none;">
                    <button type="submit" style="background:#FE2C55; color:#fff; border:none; padding:10px 18px; border-radius:24px; font-weight:bold; cursor:pointer;">Gönder</button>
                </form>
                <div class="comment-scroll-area">${commentList || '<div style="text-align:center; color:#888; margin-top:40px;">Yorum yok.</div>'}</div>
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
            .top-search-btn { position: fixed; top: 10px; right: 15px; z-index: 1005; color: #fff; font-size: 20px; width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; }
            .feed-scroll { height: 100vh; overflow-y: scroll; scroll-snap-type: y mandatory; }
            .video-container { width: 100vw; height: 100vh; scroll-snap-align: start; position: relative; display: flex; justify-content: center; align-items: center; background: #000; }
            .feed-video { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
            .sound-toggle-btn { position: absolute; top: 60px; right: 15px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; cursor: pointer; z-index: 20; }
            .video-info { position: absolute; bottom: 80px; left: 15px; z-index: 10; max-width: 70%; }
            .sidebar-actions { position: absolute; bottom: 90px; right: 15px; z-index: 10; display: flex; flex-direction: column; gap: 14px; align-items: center; }
            .action-btn { background: rgba(0,0,0,0.4); width: 42px; height: 42px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; color: #fff; }
            .comment-modal { display: none; position: fixed; bottom: 0; left: 0; width: 100%; height: 85vh; background: #ffffff; color: #000; z-index: 30000; border-top-left-radius: 20px; border-top-right-radius: 20px; flex-direction: column; }
            .comment-modal-header { padding: 12px 15px; border-bottom: 1px solid #f1f1f2; display: flex; justify-content: center; font-weight: bold; position: relative; }
            .comment-close-btn { position: absolute; right: 15px; cursor: pointer; }
            .comment-input-form { padding: 12px 15px; display: flex; gap: 10px; background: #fff; }
            .comment-scroll-area { flex: 1; overflow-y: auto; padding: 15px; }
            .comment-item { display: flex; gap: 12px; margin-bottom: 16px; }
            .comment-avatar { width: 36px; height: 36px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; overflow: hidden; }
        </style>
        <script>
            function toggleVideoPlay(id) { const vid = document.getElementById(id); vid.paused ? vid.play() : vid.pause(); }
            function toggleMute(videoId, btn) {
                const vid = document.getElementById(videoId);
                vid.muted = !vid.muted;
                btn.innerText = vid.muted ? '🔇 Ses Kapalı' : '🔊 Ses Açık';
            }
            function openComments(id) { document.getElementById('commentModal-' + id).style.display = 'flex'; }
            function closeComments(id) { document.getElementById('commentModal-' + id).style.display = 'none'; }
            document.addEventListener("DOMContentLoaded", () => {
                const containers = document.querySelectorAll('.video-container');
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        const vid = entry.target.querySelector('video');
                        if (entry.isIntersecting) { vid.muted = false; vid.play().catch(e=>{}); }
                        else { if(vid) { vid.pause(); vid.currentTime = 0; } }
                    });
                }, { threshold: 0.6 });
                containers.forEach(c => observer.observe(c));
            });
        </script>
    </head>
    <body>
        ${activeAnnouncement ? `<div style="position:fixed; top:45px; left:0; width:100%; background:linear-gradient(90deg,#FE2C55,#25F4EE); color:#000; padding:10px; font-weight:bold; font-size:13px; z-index:9999; text-align:center;">📢 DUYURU: ${activeAnnouncement.text}</div>` : ''}
        <div class="top-tabs">
            <a href="/?feed=community" class="${feedType === 'community' ? 'active' : ''}">Topluluk</a>
            <a href="/?feed=following" class="${feedType === 'following' ? 'active' : ''}">Takipte</a>
            <a href="/?feed=foryou" class="${feedType === 'foryou' ? 'active' : ''}">Sizin İçin</a>
        </div>
        <a href="/search" class="top-search-btn">🔍</a>
        <div class="feed-scroll">${feedHTML || '<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:#666;">Video yok.</div>'}</div>
        ${navbarHTML}
    </body>
    </html>`);
});

const SITE_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT;
function keepAlive() {
    https.get(SITE_URL, (res) => {}).on('error', (err) => {});
}
setInterval(keepAlive, 5 * 60 * 1000);

app.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda aktif.`); });

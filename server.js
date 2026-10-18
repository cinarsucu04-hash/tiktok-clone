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
    const limitSize = 500 * 1024 * 1024;
    for (let i = 0; i < disks.length; i++) {
        let totalSize = 0;
        try {
            const files = fs.readdirSync(disks[i].dir);
            files.forEach(file => {
                const filePath = path.join(disks[i].dir, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) totalSize += stats.size;
            });
        } catch (e) {}
        if (totalSize < limitSize) return disks[i];
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
            return res.status(429).send("<h2 style='text-align:center; margin-top:20vh; color:#FE2C55;'>⚠️ Bot Koruması Devrede</h2>");
        }
    } else {
        requestTracker[ip] = { count: 1, time: now };
    }
    next();
});

app.use((req, res, next) => {
    if (isMaintenance && req.session?.user?.username?.toLowerCase() !== 'tiktok' && !req.path.startsWith('/login') && !req.path.startsWith('/register') && !req.path.startsWith('/mod-panel')) {
        return res.status(503).send("<h2 style='text-align:center; margin-top:25vh; color:#FE2C55; font-family:sans-serif;'>🛠️ Platform Bakımda</h2>");
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
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Giriş Yap</title><style>body { background: #0f0f0f; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }</style></head>
    <body><div style="width:100%; max-width:380px; padding:30px; background:#1a1a1a; border-radius:16px; text-align:center;">
    <h2 style="color:#25F4EE;">Giriş Yap</h2>
    <form action="/login" method="POST">
        <input type="text" name="username" placeholder="Kullanıcı adı" required style="width:100%; padding:14px; margin-bottom:15px; background:#2a2a2a; border:1px solid #333; border-radius:8px; color:#fff; outline:none;">
        <input type="password" name="password" placeholder="Şifre" required style="width:100%; padding:14px; margin-bottom:15px; background:#2a2a2a; border:1px solid #333; border-radius:8px; color:#fff; outline:none;">
        <button type="submit" style="width:100%; padding:14px; background:#FE2C55; color:#fff; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Giriş Yap</button>
    </form>
    <p style="margin-top:15px; font-size:13px; color:#888;">Hesabın yok mu? <a href="/register" style="color:#25F4EE;">Kayıt ol</a></p>
    </div></body></html>`);
});

app.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Kayıt Ol</title><style>body { background: #0f0f0f; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }</style></head>
    <body><div style="width:100%; max-width:380px; padding:30px; background:#1a1a1a; border-radius:16px; text-align:center;">
    <h2 style="color:#FE2C55;">Kayıt Ol</h2>
    <form action="/register" method="POST">
        <input type="text" name="username" placeholder="Kullanıcı adı" required style="width:100%; padding:14px; margin-bottom:15px; background:#2a2a2a; border:1px solid #333; border-radius:8px; color:#fff; outline:none;">
        <input type="text" name="nickname" placeholder="Görünen ad" required style="width:100%; padding:14px; margin-bottom:15px; background:#2a2a2a; border:1px solid #333; border-radius:8px; color:#fff; outline:none;">
        <input type="password" name="password" placeholder="Şifre" required style="width:100%; padding:14px; margin-bottom:15px; background:#2a2a2a; border:1px solid #333; border-radius:8px; color:#fff; outline:none;">
        <button type="submit" style="width:100%; padding:14px; background:#25F4EE; color:#000; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Kayıt Ol</button>
    </form>
    <p style="margin-top:15px; font-size:13px; color:#888;">Hesabın var mı? <a href="/login" style="color:#FE2C55;">Giriş yap</a></p>
    </div></body></html>`);
});

app.post('/register', async (req, res) => {
    if (!isConnected) return res.redirect('/register');
    const { username, nickname, password } = req.body;
    try {
        const cleanUser = username.toLowerCase().trim();
        const existing = await usersCol.findOne({ username: cleanUser });
        if (existing) return res.send("<script>alert('Bu kullanıcı adı alınmış!'); window.location='/register';</script>");
        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCol.insertOne({ username: cleanUser, nickname, password: hashedPassword, bio: 'TikTok Üreticisi', avatar: '', banner: '', isPrivate: false });
        res.redirect('/login');
    } catch(e) { res.redirect('/register'); }
});

app.post('/login', async (req, res) => {
    if (!isConnected) return res.redirect('/login');
    const { username, password } = req.body;
    try {
        const cleanUser = username.toLowerCase().trim();
        const user = await usersCol.findOne({ username: cleanUser });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.send("<script>alert('Hatalı kullanıcı adı veya şifre!'); window.location='/login';</script>");
        }
        req.session.user = user;
        res.redirect('/');
    } catch(e) { res.redirect('/login'); }
});

app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/login')); });

app.get('/block/:username', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const blocker = req.session.user.username;
    const blocked = req.params.username.toLowerCase();
    if (blocker !== blocked) {
        if (!blocksCol) blocksCol = db.collection('blocks');
        await blocksCol.updateOne({ blocker, blocked }, { $set: { createdAt: new Date() } }, { upsert: true });
    }
    res.redirect(`/profile/${blocked}`);
});

app.get('/unblock/:username', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    if (blocksCol) await blocksCol.deleteOne({ blocker: req.session.user.username, blocked: req.params.username.toLowerCase() });
    res.redirect(`/profile/${req.params.username}`);
});

app.get('/clear-chat/:partner', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const myUser = req.session.user.username;
    const partner = req.params.partner.toLowerCase();
    await messagesCol.deleteMany({ $or: [{ sender: myUser, receiver: partner }, { sender: partner, receiver: myUser }] });
    res.redirect('/inbox');
});

app.get('/leave-group/:groupId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const groupId = new ObjectId(req.params.groupId);
        await groupsCol.updateOne({ _id: groupId }, { $pull: { members: req.session.user.username.toLowerCase() } });
    } catch(e){}
    res.redirect('/inbox');
});

app.get('/report-page/:targetUser', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const target = req.params.targetUser;
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Şikayet Et</title><style>${globalStyles} body{padding:20px;background:#111;}</style></head>
    <body><h2>@${target} Kullanıcısını Şikayet Et</h2>
    <form action="/submit-report/${target}" method="POST" enctype="multipart/form-data" style="display:flex;flex-direction:column;gap:15px;margin-top:20px;max-width:400px;">
        <select name="reason" required style="padding:12px;background:#222;color:#fff;border:1px solid #333;border-radius:6px;">
            <option value="Taciz">Taciz</option><option value="Spam">Spam</option><option value="Uygunsuz İçerik">Uygunsuz İçerik</option>
        </select>
        <textarea name="description" placeholder="Açıklama..." rows="3" style="padding:10px;background:#222;color:#fff;border-radius:6px;"></textarea>
        <input type="file" name="evidence" accept="image/*" required style="padding:10px;background:#222;color:#fff;">
        <button type="submit" style="background:#FE2C55;color:#fff;padding:12px;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">Gönder</button>
    </form></body></html>`);
});

app.post('/submit-report/:targetUser', upload.single('evidence'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const activeStorage = getActiveUploadDir();
        const evidenceUrl = req.file ? `${activeStorage.prefix}${req.file.filename}` : '';
        if (!reportsCol) reportsCol = db.collection('reports');
        await reportsCol.insertOne({ reporter: req.session.user.username, reportedUser: req.params.targetUser, reason: req.body.reason, description: req.body.description, evidenceUrl, status: 'Beklemede', createdAt: new Date() });
        res.send("<script>alert('Şikayet iletildi!');window.location='/';</script>");
    } catch(e){ res.send("<script>alert('Hata!');window.location='/';</script>"); }
});

app.get('/activity', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Aktivite</title><style>${globalStyles}</style></head><body style="padding:20px;"><h2>Aktiviteler</h2><a href="/inbox" style="color:#FE2C55;">Geri dön</a></body></html>`);
});

app.get('/explore', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const topVideos = await videosCol.find({}).sort({ likes: -1 }).limit(10).toArray();
    let topVideosHTML = '';
    topVideos.forEach(v => {
        topVideosHTML += `<div style="background:#1a1a1a; border-radius:12px; overflow:hidden; min-width:140px;" onclick="window.location='/'"><video src="${v.filename}#t=0.1" style="width:140px; height:200px; object-fit:cover;"></video></div>`;
    });
    const navbarHTML = await getNavbar('explore', req.session.user, false);
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Keşfet</title><style>${globalStyles}</style></head>
    <body style="padding:15px;"><h2>Keşfet</h2><div style="display:flex; gap:10px; overflow-x:auto;">${topVideosHTML || '<p style="color:#777;">Video yok.</p>'}</div>${navbarHTML}</body></html>`);
});

app.get('/mod-panel', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok') return res.redirect('/');
    const allReports = reportsCol ? await reportsCol.find({}).toArray() : [];
    let reportsHTML = '';
    allReports.forEach(r => {
        reportsHTML += `<div style="background:#1a1a1a; padding:15px; border-radius:8px; margin-bottom:10px;"><b>@${r.reportedUser}</b> - ${r.reason} <a href="/mod/resolve-report/${r._id}" style="color:#25F4EE; margin-left:10px;">Çöz ✔️</a></div>`;
    });
    const navbarHTML = await getNavbar('mod', req.session.user, false);
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Mod Paneli</title><style>${globalStyles}</style></head>
    <body style="padding:20px;"><h2>🛡️ Mod Paneli</h2><h3>Şikayetler</h3><div>${reportsHTML || '<p>Rapor yok.</p>'}</div>${navbarHTML}</body></html>`);
});

app.get('/mod/resolve-report/:id', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok') return res.redirect('/login');
    try { if (reportsCol) await reportsCol.deleteOne({ _id: new ObjectId(req.params.id) }); } catch(e){}
    res.redirect('/mod-panel');
});

app.get('/upload-story-page', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const navbarHTML = await getNavbar('inbox', req.session.user, false);
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Hikaye Ekle</title><style>${globalStyles}</style></head>
    <body style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh;">
        <form action="/upload-story" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:15px; width:300px; background:#1a1a1a; padding:20px; border-radius:12px;">
            <input type="file" name="media" accept="image/*,video/*" required style="color:#fff;">
            <button type="submit" style="background:#FE2C55; color:#fff; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Paylaş</button>
        </form>${navbarHTML}
    </body></html>`);
});

app.post('/upload-story', upload.single('media'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Hata");
    try {
        if (!req.file) return res.redirect('/upload-story-page');
        const activeStorage = getActiveUploadDir();
        await storiesCol.insertOne({ user_id: new ObjectId(req.session.user._id), username: req.session.user.username, mediaUrl: `${activeStorage.prefix}${req.file.filename}`, mediaType: req.file.mimetype.startsWith('video') ? 'video' : 'image', createdAt: new Date() });
        res.redirect('/inbox');
    } catch (e) { res.status(500).send("Hata"); }
});

app.get('/delete-story/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        await storiesCol.deleteOne({ _id: new ObjectId(req.params.id) });
    } catch(e){}
    res.redirect('/inbox');
});

app.get('/upload-page', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Video Yükle</title><style>${globalStyles}</style></head>
    <body style="padding:20px; background:#fff; color:#000;">
        <h2>Video Yükle</h2>
        <form action="/upload" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:15px; max-width:400px;">
            <input type="text" name="caption" placeholder="Açıklama" required style="padding:10px; border:1px solid #ccc; border-radius:6px;">
            <input type="file" name="video" accept="video/*" required>
            <button type="submit" style="background:#FE2C55; color:#fff; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Paylaş</button>
        </form>
    </body></html>`);
});

app.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Hata");
    try {
        if (!req.file) return res.redirect('/upload-page');
        const activeStorage = getActiveUploadDir();
        await videosCol.insertOne({ user_id: new ObjectId(req.session.user._id), username: req.session.user.username, caption: req.body.caption || '', filename: `${activeStorage.prefix}${req.file.filename}`, song: 'Orijinal Ses', likes: 0, favorites: 0, shares: 0, views: 0, createdAt: new Date() });
        res.redirect('/');
    } catch (e) { res.status(500).send("Hata"); }
});

app.post('/comment/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const commentText = (req.body.comment || '').trim();
        if (commentText) {
            await commentsCol.insertOne({ video_id: new ObjectId(req.params.id), username: req.session.user.username, nickname: req.session.user.nickname, comment: commentText, likes: 0, createdAt: new Date() });
        }
    } catch(e){}
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
    } catch(e){}
    res.redirect('back');
});

app.get('/delete-video/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const videoId = new ObjectId(req.params.id);
        const video = await videosCol.findOne({ _id: videoId });
        if (video && (video.user_id.toString() === req.session.user._id.toString() || req.session.user.username.toLowerCase() === 'tiktok')) {
            await videosCol.deleteOne({ _id: videoId });
            await commentsCol.deleteMany({ video_id: videoId });
            await likesCol.deleteMany({ video_id: videoId });
            await favoritesCol.deleteMany({ video_id: videoId });
        }
    } catch(e){}
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
    const existingFav = await favoritesCol.findOne({ user_id: userId, video_id: videoId });
    if (!existingFav) {
        await favoritesCol.insertOne({ user_id: userId, video_id: videoId, collection: 'Genel' });
        await videosCol.updateOne({ _id: videoId }, { $inc: { favorites: 1 } });
    } else {
        await favoritesCol.deleteOne({ user_id: userId, video_id: videoId });
        await videosCol.updateOne({ _id: videoId }, { $inc: { favorites: -1 } });
    }
    res.redirect('back');
});

app.get('/search', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const query = (req.query.q || '').trim();
    let searchResultsVideos = [], searchResultsUsers = [];
    if (query && isConnected) {
        searchResultsVideos = await videosCol.find({ caption: { $regex: query,$options: 'i' } }).toArray();
        searchResultsUsers = await usersCol.find({ $or: [{ username: { $regex: query,$options: 'i' } }, { nickname: { $regex: query,$options: 'i' } }] }).toArray();
    }
    let resultsHTML = '';
    searchResultsUsers.forEach(u => {
        resultsHTML += `<a href="/profile/${u.username}" style="display:block; padding:10px; border-bottom:1px solid #222; color:#fff;">@${u.username} (${u.nickname})</a>`;
    });
    searchResultsVideos.forEach(v => {
        resultsHTML += `<div style="padding:10px; border-bottom:1px solid #222; color:#fff;">🎬 @${v.username}: ${v.caption}</div>`;
    });
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Ara</title><style>${globalStyles}</style></head>
    <body style="padding:15px;"><form action="/search" method="GET"><input type="text" name="q" placeholder="Ara..." value="${query}" style="width:100%; padding:10px; background:#222; color:#fff; border:none; border-radius:6px;"></form>
    <div style="margin-top:15px;">${resultsHTML || '<p style="color:#888;">Sonuç yok.</p>'}</div></body></html>`);
});

app.get('/profile/:username', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const targetUser = await usersCol.findOne({ username: req.params.username.toLowerCase() });
    if (!targetUser) return res.send("Kullanıcı bulunamadı.");
    const isMe = req.session.user._id.toString() === targetUser._id.toString();
    const blockCheck = blocksCol ? await blocksCol.findOne({ blocker: req.session.user.username, blocked: targetUser.username }) : null;
    const navbarHTML = await getNavbar('profile', req.session.user, false);

    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${targetUser.nickname}</title><style>${globalStyles}</style></head>
    <body style="text-align:center; padding-top:40px;">
        <div style="width:90px; height:90px; background:#FE2C55; color:#fff; border-radius:50%; margin:0 auto; display:flex; align-items:center; justify-content:center; font-size:36px; font-weight:bold;">${targetUser.nickname.charAt(0)}</div>
        <h2>${targetUser.nickname}</h2><p style="color:#888;">@${targetUser.username}</p>
        <p>${targetUser.bio || ''}</p>
        <div style="margin:15px;"><a href="/report-page/${targetUser.username}" style="color:#FE2C55; font-size:13px; font-weight:bold;">Şikayet Et ⚠️</a></div>
        ${!isMe ? (blockCheck ? `<a href="/unblock/${targetUser.username}" style="background:#333; color:#fff; padding:8px 16px; border-radius:6px; display:inline-block;">Engeli Kaldır</a>` : `<a href="/block/${targetUser.username}" style="background:#ff4d4d; color:#fff; padding:8px 16px; border-radius:6px; display:inline-block;">Engelle 🚫</a>`) : ''}
        <div style="margin-top:20px;"><a href="/" style="color:#25F4EE;">Ana sayfaya dön</a></div>${navbarHTML}
    </body></html>`);
});

// GELİŞTİRİLMİŞ SOHBET VE TİKTOK BALONCUKLARI
app.get('/chat/:targetUser', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const targetName = req.params.targetUser.toLowerCase();
    const target = await usersCol.findOne({ username: targetName });
    if (!target) return res.send("Kullanıcı bulunamadı.");

    if (blocksCol) {
        const isBlocked = await blocksCol.findOne({ blocker: targetName, blocked: req.session.user.username });
        const didIBlock = await blocksCol.findOne({ blocker: req.session.user.username, blocked: targetName });
        if (isBlocked || didIBlock) return res.send("<h2 style='text-align:center; margin-top:30vh; color:#888;'>⚠️ Engellendiği için mesajlaşamazsınız.</h2>");
    }

    const myUser = req.session.user.username;
    await messagesCol.updateMany({ receiver: myUser, sender: target.username, isRead: { $ne: true } }, {$set: { isRead: true } });
    const messages = await messagesCol.find({ $or: [{ sender: myUser, receiver: target.username }, { sender: target.username, receiver: myUser }] }).sort({ createdAt: 1 }).toArray();

    let chatHTML = '';
    messages.forEach(m => {
        const isMe = m.sender === myUser;
        chatHTML += `
        <div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:12px;">
            <div style="max-width:75%; background:${isMe ? '#FE2C55' : '#1f1f1f'}; color:#fff; padding:12px 18px; border-radius:20px; font-size:14px; word-break:break-word; border:1px solid ${isMe ? '#FE2C55' : '#333'};">
                ${m.text}
            </div>
        </div>`;
    });

    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${target.nickname}</title><style>${globalStyles} body{background:#000;display:flex;flex-direction:column;height:100vh;margin:0;}</style></head>
    <body>
        <div style="position:fixed;top:0;left:0;width:100%;height:65px;background:#111;display:flex;align-items:center;justify-content:space-between;padding:0 15px;border-bottom:1px solid #222;z-index:100;">
            <div style="display:flex;align-items:center;gap:12px;"><a href="/inbox" style="font-size:26px;color:#fff;">‹</a><b>${target.nickname}</b></div>
            <div><a href="/clear-chat/${target.username}" onclick="return confirm('Silinsin mi?')" style="color:#ff4d4d;font-size:13px;margin-right:12px;">Sohbeti Sil 🗑️</a><a href="/block/${target.username}" onclick="return confirm('Engellensin mi?')" style="color:#ff4d4d;font-size:13px;">Engelle 🚫</a></div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:80px 15px 90px 15px;display:flex;flex-direction:column;">${chatHTML || '<p style="text-align:center;color:#666;margin-top:50px;">Mesaj yok.</p>'}</div>
        <form action="/send-msg/${target.username}" method="POST" style="position:fixed;bottom:0;left:0;width:100%;background:#111;padding:12px 15px;border-top:1px solid #222;display:flex;gap:10px;">
            <input type="text" name="text" placeholder="Mesaj yaz..." required autocomplete="off" style="flex-grow:1;background:#222;border:1px solid #333;border-radius:24px;padding:12px 18px;color:#fff;outline:none;font-size:14px;">
            <button type="submit" style="background:#FE2C55;color:#fff;border:none;border-radius:24px;padding:0 22px;font-weight:bold;cursor:pointer;">Gönder</button>
        </form>
    </body></html>`);
});

app.post('/send-msg/:targetUser', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    await messagesCol.insertOne({ sender: req.session.user.username, receiver: req.params.targetUser.toLowerCase(), text: req.body.text, isRead: false, createdAt: new Date() });
    res.redirect('back');
});

app.get('/group-chat/:groupId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const group = await groupsCol.findOne({ _id: new ObjectId(req.params.groupId) });
        if (!group || !group.members.includes(req.session.user.username.toLowerCase())) return res.send("Yetkiniz yok.");
        const messages = await messagesCol.find({ receiverGroup: group._id.toString() }).sort({ createdAt: 1 }).toArray();
        let chatHTML = '';
        messages.forEach(m => {
            const isMe = m.sender === req.session.user.username;
            chatHTML += `<div style="display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'};margin-bottom:12px;"><div style="font-size:11px;color:#888;">@${m.sender}</div><div style="max-width:75%;background:${isMe ? '#FE2C55' : '#1f1f1f'};color:#fff;padding:12px 18px;border-radius:20px;font-size:14px;">${m.text}</div></div>`;
        });
        res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${group.groupName}</title><style>${globalStyles} body{background:#000;display:flex;flex-direction:column;height:100vh;margin:0;}</style></head>
        <body>
            <div style="position:fixed;top:0;left:0;width:100%;height:65px;background:#111;display:flex;align-items:center;justify-content:space-between;padding:0 15px;border-bottom:1px solid #222;z-index:100;"><a href="/inbox" style="font-size:26px;color:#fff;">‹</a><b>👥 ${group.groupName}</b><a href="/leave-group/${group._id}" style="color:#ff4d4d;font-size:13px;">Gruptan Çık 🚪</a></div>
            <div style="flex:1;overflow-y:auto;padding:80px 15px 90px 15px;display:flex;flex-direction:column;">${chatHTML}</div>
            <form action="/send-group-msg/${group._id}" method="POST" style="position:fixed;bottom:0;left:0;width:100%;background:#111;padding:12px 15px;border-top:1px solid #222;display:flex;gap:10px;">
                <input type="text" name="text" placeholder="Gruba yaz..." required autocomplete="off" style="flex-grow:1;background:#222;border:1px solid #333;border-radius:24px;padding:12px 18px;color:#fff;outline:none;">
                <button type="submit" style="background:#25F4EE;color:#000;border:none;border-radius:24px;padding:0 22px;font-weight:bold;cursor:pointer;">Gönder</button>
            </form>
        </body></html>`);
    } catch(e){ res.send("Hata."); }
});

app.post('/send-group-msg/:groupId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    await messagesCol.insertOne({ sender: req.session.user.username, receiverGroup: req.params.groupId, text: req.body.text, createdAt: new Date() });
    res.redirect('back');
});

app.get('/inbox', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const myUsername = req.session.user.username;
    const allStories = await storiesCol.find({}).toArray();
    let storiesBarHTML = `<div onclick="window.location='/upload-story-page'" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;flex-shrink:0;"><div style="width:58px;height:58px;border-radius:50%;background:#222;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;">+</div><span style="font-size:11px;color:#fff;margin-top:4px;">Oluştur</span></div>`;
    allStories.forEach(s => {
        storiesBarHTML += `<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;"><div class="story-ring" style="width:62px;height:62px;"><div style="width:54px;height:54px;border-radius:50%;background:#333;overflow:hidden;"><img src="${s.mediaUrl}" style="width:100%;height:100%;object-fit:cover;"></div></div><span style="font-size:11px;color:#fff;margin-top:4px;">@${s.username}</span></div>`;
    });

    const messagesList = await messagesCol.find({ $or: [{ sender: myUsername }, { receiver: myUsername }] }).sort({ createdAt: -1 }).toArray();
    let chattedUsernames = new Map();
    messagesList.forEach(m => {
        let partner = m.sender === myUsername ? m.receiver : m.sender;
        if (!chattedUsernames.has(partner)) chattedUsernames.set(partner, { unreadCount: 0, lastMessage: m.text || 'Medya' });
        if (m.receiver === myUsername && !m.isRead) chattedUsernames.get(partner).unreadCount++;
    });

    const chattedUsers = await usersCol.find({ username: { $in: Array.from(chattedUsernames.keys()) } }).toArray();
    const myGroups = await groupsCol.find({ members: myUsername }).toArray();

    let inboxListHTML = '';
    myGroups.forEach(g => {
        inboxListHTML += `<a href="/group-chat/${g._id}" style="display:flex;align-items:center;justify-content:space-between;padding:12px 15px;border-bottom:1px solid #1a1a1a;color:#fff;"><div style="display:flex;align-items:center;gap:12px;"><div style="width:48px;height:48px;background:#25F4EE;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#000;">👥</div><div><div style="font-weight:bold;font-size:15px;">${g.groupName}</div><div style="color:#888;font-size:12px;">Grup Sohbeti</div></div></div></a>`;
    });

    chattedUsers.forEach(u => {
        let chatInfo = chattedUsernames.get(u.username) || { unreadCount: 0, lastMessage: 'Sohbet' };
        inboxListHTML += `<a href="/chat/${u.username}" style="display:flex;align-items:center;justify-content:space-between;padding:12px 15px;border-bottom:1px solid #1a1a1a;color:#fff;"><div style="display:flex;align-items:center;gap:12px;"><div style="width:48px;height:48px;background:#FE2C55;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#fff;">${u.nickname.charAt(0)}</div><div><div style="font-weight:bold;font-size:15px;">${u.nickname}</div><div style="color:#aaa;font-size:13px;">${chatInfo.lastMessage}</div></div></div>${chatInfo.unreadCount > 0 ? `<div style="background:#FE2C55;color:#fff;font-size:12px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${chatInfo.unreadCount}</div>` : ''}</a>`;
    });

    const navbarHTML = await getNavbar('inbox', req.session.user, false);
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Gelen Kutusu</title><style>${globalStyles}</style></head>
    <body style="padding-bottom:70px;">
        <div style="padding:15px;font-size:20px;font-weight:bold;border-bottom:1px solid #222;">Gelen kutusu</div>
        <div style="display:flex;gap:15px;padding:15px;overflow-x:auto;background:#121212;border-bottom:1px solid #222;">${storiesBarHTML}</div>
        <div style="padding:12px 15px;display:flex;justify-content:space-between;border-bottom:1px solid #222;"><a href="/activity" style="color:#fff;font-weight:bold;">⚡ Aktivite ve yeni takipçiler</a><button onclick="document.getElementById('groupModal').style.display='flex'" style="background:#25F4EE;color:#000;border:none;padding:6px 12px;border-radius:6px;font-weight:bold;cursor:pointer;">➕ Grup Kur</button></div>
        <div>${inboxListHTML || '<p style="text-align:center;color:#888;padding:40px;">Henüz aktif mesajlaşma yok.</p>'}</div>
        <div id="groupModal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:200000;justify-content:center;align-items:center;">
            <div style="background:#1f1f1f;padding:25px;border-radius:12px;width:340px;text-align:center;color:#fff;">
                <h3>Sohbet Grubu Kur</h3>
                <form action="/create-group" method="POST" style="display:flex;flex-direction:column;gap:12px;margin-top:15px;">
                    <input type="text" name="groupName" placeholder="Grup Adı" required style="padding:10px;background:#2f2f2f;border:none;color:#fff;border-radius:6px;">
                    <input type="text" name="members" placeholder="Üyeler (virgülle ayırın)" required style="padding:10px;background:#2f2f2f;border:none;color:#fff;border-radius:6px;">
                    <button type="submit" style="background:#25F4EE;color:#000;padding:10px;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">Oluştur</button>
                    <button type="button" onclick="document.getElementById('groupModal').style.display='none'" style="background:#333;color:#fff;padding:8px;border:none;border-radius:6px;cursor:pointer;">İptal</button>
                </form>
            </div>
        </div>${navbarHTML}
    </body></html>`);
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

app.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const videos = isConnected ? await videosCol.find({}).sort({ _id: -1 }).toArray() : [];
    const userId = new ObjectId(req.session.user._id);

    let feedHTML = '';
    for (let v of videos) {
        const isLiked = await likesCol.findOne({ user_id: userId, video_id: v._id });
        const isFav = await favoritesCol.findOne({ user_id: userId, video_id: v._id });

        feedHTML += `
        <div style="height:100vh; scroll-snap-align:start; display:flex; justify-content:center; align-items:center; position:relative; background:#000;">
            <video src="${v.filename}" autoplay loop muted controls style="width:100%; height:100%; object-fit:cover;"></video>
            <div style="position:absolute; bottom:80px; left:15px; color:#fff; text-shadow:0 1px 2px #000;">
                <b>@${v.username}</b><p>${v.caption}</p>
            </div>
            <div style="position:absolute; bottom:90px; right:15px; display:flex; flex-direction:column; gap:14px; align-items:center; z-index:10;">
                <a href="/like/${v._id}" style="background:rgba(0,0,0,0.4); width:42px; height:42px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:20px; color:${isLiked ? '#FE2C55' : '#fff'};" title="Beğen">♥<span style="font-size:11px;">${v.likes || 0}</span></a>
                <a href="/favorite/${v._id}" style="background:rgba(0,0,0,0.4); width:42px; height:42px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:20px; color:${isFav ? '#FFD700' : '#fff'};" title="Favorilere Ekle">★<span style="font-size:11px;">${v.favorites || 0}</span></a>
            </div>
        </div>`;
    }
    const navbarHTML = await getNavbar('home', req.session.user, false);
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>TikTok</title><style>${globalStyles} body{overflow:hidden;}</style></head>
    <body><div style="height:100vh; overflow-y:scroll; scroll-snap-type:y mandatory;">${feedHTML || '<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:#666;">Video yok.</div>'}</div>${navbarHTML}</body></html>`);
});

const SITE_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT;
setInterval(() => { https.get(SITE_URL, () => {}).on('error', () => {}); }, 5 * 60 * 1000);

app.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda aktif.`); });

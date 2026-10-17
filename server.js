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

let db, usersCol, videosCol, commentsCol, followsCol, likesCol, favoritesCol, storiesCol, messagesCol, groupsCol, searchesCol, analyticsCol, notificationsCol, draftsCol, reportsCol, blocksCol;
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
        notificationsCol = db.collection('notifications');
        draftsCol = db.collection('drafts');
        reportsCol = db.collection('reports');
        blocksCol = db.collection('blocks');
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

async function getNavbar(activeTab, username, isFriendsTab) {
    let unreadCount = 0;
    if (isConnected && username) {
        try {
            unreadCount = await notificationsCol.countDocuments({ receiver: username.toLowerCase(), read: false });
        } catch(e) {}
    }

    let badgeHTML = unreadCount > 0 ? `<div style="position:absolute; top:-4px; right:2px; background:#FE2C55; color:#fff; border-radius:10px; padding:1px 5px; font-size:10px; font-weight:bold; border:2px solid #121212;">${unreadCount}</div>` : '';

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
        <a href="/inbox" class="${activeTab === 'inbox' ? 'active' : ''}" style="position:relative;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
            <span>Gelen kutusu</span>
            ${badgeHTML}
        </a>
        <a href="/profile/${username}" class="${activeTab === 'profile' ? 'active' : ''}">
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
    .tiktok-nav a { display: flex; flex-direction: column; align-items: center; color: #888; font-size: 10px; gap: 3px; position: relative; }
    .tiktok-nav a.active { color: #fff; }
    .plus-btn { position: relative; top: -5px; }
    .plus-icon { width: 40px; height: 26px; background: linear-gradient(90deg, #25F4EE 0%, #FE2C55 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #000; font-size: 22px; font-weight: bold; }
    .verified-badge { color: #20D5EC; display: inline-block; margin-left: 4px; font-size: 14px; vertical-align: middle; }
    
    .top-toast-notification {
        position: fixed; top: 15px; left: 50%; transform: translateX(-50%) translateY(-100px);
        background: rgba(30, 30, 30, 0.95); color: #fff; padding: 10px 20px; border-radius: 30px;
        font-size: 13px; font-weight: bold; z-index: 999999; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; gap: 8px; transition: transform 0.4s ease;
    }
    .top-toast-notification.show { transform: translateX(-50%) translateY(0); }
`;

app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Giriş Yap</title>
        <style>body{background:#0f0f0f;color:#fff;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;} .card{width:100%;max-width:380px;padding:30px;background:#1a1a1a;border-radius:16px;text-align:center;} input{width:100%;padding:14px;margin-bottom:15px;background:#2a2a2a;border:1px solid #333;border-radius:8px;color:#fff;outline:none;} button{width:100%;padding:14px;background:#FE2C55;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;}</style>
    </head>
    <body>
        <div class="card">
            <h2>Giriş Yap</h2>
            <form action="/login" method="POST">
                <input type="text" name="username" placeholder="Kullanıcı adı" required>
                <input type="password" name="password" placeholder="Şifre" required>
                <button type="submit">Giriş Yap</button>
            </form>
        </div>
    </body>
    </html>`);
});

app.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Kayıt Ol</title>
        <style>body{background:#0f0f0f;color:#fff;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;} .card{width:100%;max-width:380px;padding:30px;background:#1a1a1a;border-radius:16px;text-align:center;} input{width:100%;padding:14px;margin-bottom:15px;background:#2a2a2a;border:1px solid #333;border-radius:8px;color:#fff;outline:none;} button{width:100%;padding:14px;background:#25F4EE;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer;}</style>
    </head>
    <body>
        <div class="card">
            <h2>Kayıt Ol</h2>
            <form action="/register" method="POST">
                <input type="text" name="username" placeholder="Kullanıcı adı" required>
                <input type="text" name="nickname" placeholder="Takma ad" required>
                <input type="password" name="password" placeholder="Şifre" required>
                <button type="submit">Kayıt Ol</button>
            </form>
        </div>
    </body>
    </html>`);
});

app.post('/register', async (req, res) => {
    if (!isConnected) return res.redirect('/register');
    const { username, nickname, password } = req.body;
    try {
        const cleanUsername = username.toLowerCase().trim();
        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCol.insertOne({ username: cleanUsername, nickname, password: hashedPassword, bio: 'TikTok içerik üreticisi 🎬', avatar: '', banner: '', isPrivate: false, hideVisitors: false, restrictedMode: false });
        res.redirect('/login');
    } catch (err) { res.redirect('/register'); }
});

app.post('/login', async (req, res) => {
    if (!isConnected) return res.redirect('/login');
    const { username, password } = req.body;
    try {
        const user = await usersCol.findOne({ username: username.toLowerCase().trim() });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user;
            res.redirect('/');
        } else { res.redirect('/login'); }
    } catch (err) { res.redirect('/login'); }
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

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Keşfet</title><style>${globalStyles}</style></head>
    <body style="background:#000; color:#fff; padding-bottom:70px;">
        <div style="padding:15px; border-bottom:1px solid #222; display:flex; justify-content:space-between; align-items:center;">
            <h2 style="margin:0;">Keşfet</h2>
            <a href="/search" style="font-size:22px;">🔍</a>
        </div>
        <div style="padding:15px;">
            <h3 style="font-size:16px;">Trend Etiketler</h3>
            <div style="display:flex; flex-wrap:wrap; gap:5px;">${tagsHTML}</div>
        </div>
        <div style="padding:15px;">
            <h3 style="font-size:16px;">Trend Videolar</h3>
            <div style="display:flex; gap:10px; overflow-x:auto;">${topVideosHTML}</div>
        </div>
        ${await getNavbar('explore', req.session.user.username, false)}
    </body>
    </html>`);
});

// VİDEO YÜKLEME VE TASLAK SİSTEMİ
app.get('/upload-page', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const navbarHTML = await getNavbar('home', req.session.user.username, false);
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Video Paylaş</title><style>${globalStyles}</style></head>
    <body style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh;">
        <form action="/upload" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:12px; width:340px; background:#1a1a1a; padding:20px; border-radius:12px;">
            <input type="text" name="caption" placeholder="Açıklama..." required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <input type="file" name="video" accept="video/*" required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <button type="submit" style="background:#FE2C55; color:#fff; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Yayınla</button>
            <button type="submit" formaction="/save-draft" style="background:#333; color:#fff; padding:10px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Taslak Olarak Kaydet</button>
            <a href="/drafts" style="text-align:center; color:#25F4EE; font-size:13px; font-weight:bold; margin-top:5px;">📂 Taslaklarım (Sadece Siz Görürsünüz)</a>
        </form>
        ${navbarHTML}
    </body>
    </html>`);
});

app.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Hata");
    try {
        if (!req.file) return res.redirect('/upload-page');
        await videosCol.insertOne({ 
            user_id: new ObjectId(req.session.user._id), 
            username: req.session.user.username, 
            caption: req.body.caption || '', 
            filename: `/uploads/${req.file.filename}`, 
            song: 'Orijinal Ses', 
            views: 0, likes: 0, favorites: 0, shares: 0, createdAt: new Date() 
        });
        res.redirect('/');
    } catch (err) { res.status(500).send("Hata"); }
});

app.post('/save-draft', upload.single('video'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Hata");
    try {
        if (!req.file) return res.redirect('/upload-page');
        await draftsCol.insertOne({
            user_id: new ObjectId(req.session.user._id),
            username: req.session.user.username,
            caption: req.body.caption || '',
            filename: `/uploads/${req.file.filename}`,
            createdAt: new Date()
        });
        res.redirect('/drafts');
    } catch (err) { res.status(500).send("Hata"); }
});

app.get('/drafts', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const myDrafts = await draftsCol.find({ user_id: new ObjectId(req.session.user._id) }).sort({ _id: -1 }).toArray();

    let draftsHTML = '';
    myDrafts.forEach(d => {
        draftsHTML += `
        <div style="background:#1a1a1a; padding:15px; border-radius:10px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:bold; font-size:14px;">${d.caption || 'Başlıksız Taslak'}</div>
                <div style="font-size:11px; color:#888;">Gizli Taslak Video</div>
            </div>
            <a href="/publish-draft/${d._id}" style="background:#FE2C55; color:#fff; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:bold;">Yayınla</a>
        </div>`;
    });

    const navbarHTML = await getNavbar('profile', req.session.user.username, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Taslaklarım</title><style>${globalStyles}</style></head>
    <body style="background:#000; color:#fff; padding:20px; padding-bottom:70px;">
        <h2>📂 Taslaklarım (Sadece Sizin Görebileceğiniz Alan)</h2>
        <a href="/upload-page" style="color:#25F4EE; font-size:13px; font-weight:bold; display:block; margin-bottom:20px;">‹ Video Yükleme Sayfasına Dön</a>
        ${draftsHTML || '<p style="color:#888; text-align:center; margin-top:50px;">Henüz kaydedilmiş taslağınız yok.</p>'}
        ${navbarHTML}
    </body>
    </html>`);
});

app.get('/publish-draft/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const draft = await draftsCol.findOne({ _id: new ObjectId(req.params.id), user_id: new ObjectId(req.session.user._id) });
        if (draft) {
            await videosCol.insertOne({
                user_id: draft.user_id,
                username: draft.username,
                caption: draft.caption,
                filename: draft.filename,
                song: 'Orijinal Ses',
                views: 0, likes: 0, favorites: 0, shares: 0, createdAt: new Date()
            });
            await draftsCol.deleteOne({ _id: draft._id });
        }
    } catch (err) {}
    res.redirect('/');
});

// YORUM SİSTEMİ (BEĞENME VE SABİTLEME - SADECE İÇERİK ÜRETİCİSİ SABİTLEYEBİLİR)
app.post('/comment/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const commentText = (req.body.comment || '').trim();
        if (commentText) {
            await commentsCol.insertOne({ 
                video_id: new ObjectId(req.params.id), 
                username: req.session.user.username, 
                nickname: req.session.user.nickname,
                avatar: req.session.user.avatar || '',
                comment: commentText, 
                likes: 0,
                isPinned: false,
                createdAt: new Date() 
            });
            const v = await videosCol.findOne({ _id: new ObjectId(req.params.id) });
            if (v && v.username !== req.session.user.username) {
                await notificationsCol.insertOne({
                    receiver: v.username.toLowerCase(),
                    sender: req.session.user.username,
                    text: `@${req.session.user.username} videona yorum yaptı.`,
                    read: false,
                    createdAt: new Date()
                });
            }
        }
    } catch (err) {}
    res.redirect('back');
});

app.get('/like-comment/:commentId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        await commentsCol.updateOne({ _id: new ObjectId(req.params.commentId) }, { $inc: { likes: 1 } });
    } catch(e){}
    res.redirect('back');
});

app.get('/pin-comment/:commentId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const comment = await commentsCol.findOne({ _id: new ObjectId(req.params.commentId) });
        if (comment) {
            const video = await videosCol.findOne({ _id: comment.video_id });
            // Sadece video sahibi (içerik üreticisi) sabitleyebilir
            if (video && video.username.toLowerCase() === req.session.user.username.toLowerCase()) {
                await commentsCol.updateOne({ _id: comment._id }, { $set: { isPinned: !comment.isPinned } });
            }
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
        const v = await videosCol.findOne({ _id: videoId });
        if (v && v.username !== req.session.user.username) {
            await notificationsCol.insertOne({
                receiver: v.username.toLowerCase(),
                sender: req.session.user.username,
                text: `@${req.session.user.username} videonu beğendi.`,
                read: false,
                createdAt: new Date()
            });
        }
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
        await favoritesCol.insertOne({ user_id: userId, video_id: videoId });
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

// KULLANICI ENGELLEME & RAPORLAMA (@tiktok yöneticisine gitme)
app.get('/block/:username', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const targetUsername = req.params.username.toLowerCase();
    if (targetUsername !== req.session.user.username.toLowerCase()) {
        await blocksCol.updateOne(
            { blocker: req.session.user.username.toLowerCase(), blocked: targetUsername },
            { $set: { createdAt: new Date() } },
            { upsert: true }
        );
    }
    res.redirect('/');
});

app.get('/report-page/:username', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const targetUser = req.params.username;
    const navbarHTML = await getNavbar('home', req.session.user.username, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Rapor Et</title><style>${globalStyles}</style></head>
    <body style="background:#000; color:#fff; display:flex; justify-content:center; align-items:center; height:100vh;">
        <form action="/submit-report" method="POST" enctype="multipart/form-data" style="background:#1a1a1a; padding:25px; border-radius:12px; width:340px; display:flex; flex-direction:column; gap:12px;">
            <h3>@${targetUser} Şikayet Et</h3>
            <input type="hidden" name="reportedUser" value="${targetUser}">
            <textarea name="reason" placeholder="Şikayet nedeni ve açıklaması..." required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px; height:80px;"></textarea>
            <label style="font-size:12px; color:#aaa;">Kanıt Ekran Görüntüsü Yükle:</label>
            <input type="file" name="evidence" accept="image/*" required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <button type="submit" style="background:#FE2C55; color:#fff; padding:10px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Şikayeti @tiktok'a Gönder</button>
            <a href="/" style="text-align:center; color:#888; font-size:12px;">İptal</a>
        </form>
        ${navbarHTML}
    </body>
    </html>`);
});

app.post('/submit-report', upload.single('evidence'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const { reportedUser, reason } = req.body;
        const evidenceUrl = req.file ? `/uploads/${req.file.filename}` : '';

        await reportsCol.insertOne({
            reporter: req.session.user.username,
            reportedUser: reportedUser.toLowerCase(),
            reason,
            evidenceUrl,
            createdAt: new Date()
        });

        // @tiktok hesabına rapor bildirimi gider
        await notificationsCol.insertOne({
            receiver: 'tiktok',
            sender: req.session.user.username,
            text: `🚨 Rapor: @${req.session.user.username}, @${reportedUser} kullanıcısını şikayet etti! Sebep: ${reason}`,
            read: false,
            createdAt: new Date()
        });

        res.send("<script>alert('Şikayetiniz yönetici @tiktok hesabına başarıyla iletildi.'); window.location='/';</script>");
    } catch(e) { res.redirect('/'); }
});

app.get('/follow/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const followerId = new ObjectId(req.session.user._id);
    const followingId = new ObjectId(req.params.id);

    const existingFollow = await followsCol.findOne({ follower_id: followerId, following_id: followingId });
    if (!existingFollow) { 
        await followsCol.insertOne({ follower_id: followerId, following_id: followingId }); 
        const targetUser = await usersCol.findOne({ _id: followingId });
        if (targetUser) {
            await notificationsCol.insertOne({
                receiver: targetUser.username.toLowerCase(),
                sender: req.session.user.username,
                text: `@${req.session.user.username} seni takip etmeye başladı.`,
                read: false,
                createdAt: new Date()
            });
        }
    } else { 
        await followsCol.deleteOne({ follower_id: followerId, following_id: followingId }); 
    }
    res.redirect('back');
});

// PROFİL & GİZLİLİK & @TİKTOK YÖNETİCİ PANELİ (BAN ATMA V.B.)
app.post('/update-profile', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const { nickname, bio, isPrivate } = req.body;
        const userId = new ObjectId(req.session.user._id);
        let avatarFile = req.session.user.avatar || '';
        if (req.files && req.files['avatar']) avatarFile = `/uploads/${req.files['avatar'][0].filename}`;
        let bannerFile = req.session.user.banner || '';
        if (req.files && req.files['banner']) bannerFile = `/uploads/${req.files['banner'][0].filename}`;

        const privFlag = isPrivate === 'on';

        await usersCol.updateOne({ _id: userId }, { $set: { nickname: nickname || req.session.user.nickname, bio, isPrivate: privFlag, avatar: avatarFile, banner: bannerFile } });
        req.session.user.nickname = nickname || req.session.user.nickname;
        req.session.user.bio = bio;
        req.session.user.isPrivate = privFlag;
        req.session.user.avatar = avatarFile;
        req.session.user.banner = bannerFile;
        res.redirect(`/profile/${req.session.user.username}`);
    } catch (err) { res.redirect(`/profile/${req.session.user.username}`); }
});

// YÖNETİCİ BAN İŞLEMİ (@tiktok hesabı yapabilir)
app.get('/admin/ban/:username', async (req, res) => {
    if (!req.session.user || req.session.user.username.toLowerCase() !== 'tiktok' || !isConnected) return res.redirect('/');
    const targetUsername = req.params.username.toLowerCase();
    if (targetUsername !== 'tiktok') {
        await usersCol.deleteOne({ username: targetUsername });
        await videosCol.deleteMany({ username: targetUsername });
    }
    res.redirect('/profile/tiktok');
});

app.get('/profile/:username', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const targetUser = await usersCol.findOne({ username: req.params.username.toLowerCase() });
    if (!targetUser) return res.send("Kullanıcı bulunamadı.");

    const isMe = req.session.user._id.toString() === targetUser._id.toString();
    const isTikTokAdmin = req.session.user.username.toLowerCase() === 'tiktok';

    // Gizli hesap kontrolü
    const followCheck = await followsCol.findOne({ follower_id: new ObjectId(req.session.user._id), following_id: targetUser._id });
    const isFollowing = !!followCheck;
    if (targetUser.isPrivate && !isMe && !isFollowing && !isTikTokAdmin) {
        return res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head><meta charset="UTF-8"><style>${globalStyles}</style></head>
        <body style="background:#000; color:#fff; text-align:center; padding-top:100px;">
            <h2>🔒 Bu Hesap Gizli</h2>
            <p style="color:#888;">Bu kullanıcının videolarını görmek için takip etmelisiniz.</p>
            <a href="/follow/${targetUser._id}" style="background:#FE2C55; color:#fff; padding:10px 25px; border-radius:6px; font-weight:bold; display:inline-block; margin-top:15px;">Takip Et</a>
            <br><br><a href="/" style="color:#aaa; font-size:13px;">Ana sayfaya dön</a>
        </body>
        </html>`);
    }

    const videos = await videosCol.find({ user_id: targetUser._id }).sort({ _id: -1 }).toArray();
    const followersCount = await followsCol.countDocuments({ following_id: targetUser._id });
    const followingCount = await followsCol.countDocuments({ follower_id: targetUser._id });
    
    let videoHTML = '';
    videos.forEach(v => {
        videoHTML += `<div class="v-thumb"><video src="${v.filename}" muted></video></div>`;
    });

    let adminPanelHTML = '';
    if (isTikTokAdmin && !isMe) {
        adminPanelHTML = `
        <div style="background:#220000; border:1px solid #ff4d4d; padding:15px; border-radius:8px; margin:20px auto; max-width:400px; text-align:center;">
            <h4 style="color:#ff4d4d; margin:0 0 10px 0;">🛡️ Yönetici Kontrol Paneli (@tiktok)</h4>
            <a href="/admin/ban/${targetUser.username}" onclick="return confirm('Bu kullanıcıyı kalıcı olarak banlamak istediğinize emin misiniz?');" style="background:#ff4d4d; color:#fff; padding:8px 16px; border-radius:6px; font-weight:bold; display:inline-block; font-size:13px;">Kullanıcıyı Banla ❌</a>
        </div>`;
    }

    const navbarHTML = await getNavbar('profile', req.session.user.username, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${targetUser.nickname}</title>
        <style>${globalStyles} .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; } .v-thumb { background: #1a1a1a; aspect-ratio: 9/16; position: relative; }</style>
    </head>
    <body style="background:#000; color:#fff;">
        <div style="text-align:center; padding:30px 15px;">
            <h2>${targetUser.nickname} ${targetUser.username.toLowerCase() === 'tiktok' ? '<span class="verified-badge">✔</span>' : ''}</h2>
            <p style="color:#888;">@${targetUser.username}</p>
            <div style="display:flex; justify-content:center; gap:20px; margin:15px 0;">
                <div><b>${followingCount}</b> Takip</div>
                <div><b>${followersCount}</b> Takipçi</div>
            </div>
            ${adminPanelHTML}
            ${isMe ? `
                <button onclick="document.getElementById('editModal').style.display='flex'" style="background:#333; color:#fff; padding:8px 20px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Profili Düzenle</button>
            ` : `
                <div style="display:flex; justify-content:center; gap:10px;">
                    <a href="/follow/${targetUser._id}" style="background:${isFollowing?'#333':'#FE2C55'}; color:#fff; padding:8px 25px; border-radius:6px; font-weight:bold;">${isFollowing?'Takiptesin':'Takip Et'}</a>
                    <a href="/block/${targetUser.username}" onclick="return confirm('Bu kullanıcıyı engellemek istiyor musunuz?');" style="background:#222; color:#ff4d4d; padding:8px 15px; border-radius:6px; font-weight:bold; font-size:13px;">Engelle 🚫</a>
                    <a href="/report-page/${targetUser.username}" style="background:#222; color:#ffa500; padding:8px 15px; border-radius:6px; font-weight:bold; font-size:13px;">Şikayet Et ⚠️</a>
                </div>
            `}
        </div>

        ${isMe ? `
        <div id="editModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; justify-content:center; align-items:center;">
            <div style="background:#1a1a1a; padding:25px; border-radius:12px; width:320px;">
                <h3>Profili Düzenle</h3>
                <form action="/update-profile" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:10px;">
                    <input type="text" name="nickname" value="${targetUser.nickname}" required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
                    <textarea name="bio" placeholder="Biyografi" style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">${targetUser.bio || ''}</textarea>
                    <label style="font-size:12px; color:#aaa;"><input type="checkbox" name="isPrivate" ${targetUser.isPrivate ? 'checked' : ''}> Hesabı Gizli Yap</label>
                    <button type="submit" style="background:#FE2C55; color:#fff; padding:10px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:5px;">Kaydet</button>
                    <button type="button" onclick="document.getElementById('editModal').style.display='none'" style="background:#333; color:#fff; padding:8px; border:none; border-radius:6px; cursor:pointer;">İptal</button>
                </form>
            </div>
        </div>` : ''}

        <div class="grid">${videoHTML}</div>
        ${navbarHTML}
    </body>
    </html>`);
});

app.get('/inbox', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const myUsername = req.session.user.username.toLowerCase();

    await notificationsCol.updateMany({ receiver: myUsername, read: false }, { $set: { read: true } });

    const notifs = await notificationsCol.find({ receiver: myUsername }).sort({ _id: -1 }).toArray();
    let notifHTML = '';
    notifs.forEach(n => {
        notifHTML += `<div style="padding:12px 15px; border-bottom:1px solid #222; font-size:14px;">🔔 ${n.text}</div>`;
    });

    const navbarHTML = await getNavbar('inbox', req.session.user.username, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Gelen Kutusu</title><style>${globalStyles}</style></head>
    <body style="background:#000; color:#fff; padding-bottom:70px;">
        <h3 style="padding:15px; margin:0; border-bottom:1px solid #222;">Bildirimler ${myUsername === 'tiktok' ? '(<span style="color:#25F4EE;">Yönetici Paneli</span>)' : ''}</h3>
        ${notifHTML || '<p style="text-align:center; color:#888; margin-top:40px;">Henüz bildiriminiz yok.</p>'}
        ${navbarHTML}
    </body>
    </html>`);
});

app.get('/search', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const navbarHTML = await getNavbar('home', req.session.user.username, false);
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><style>${globalStyles}</style></head><body style="background:#fff; color:#000; padding:20px;"><h2>Arama Sayfası</h2>${navbarHTML}</body></html>`);
});

// ANA SAYFA VE ANLIK 3 SANİYELİK BİLDİRİM TOAST SİSTEMİ (VİDEO HIZI AYARI EKLENDİ)
app.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const feedType = req.query.feed || 'foryou';
    let videos = [];
    if (isConnected) {
        // Engellenen kullanıcıların videolarını akıştan filtrele
        const myBlocks = await blocksCol.find({ blocker: req.session.user.username.toLowerCase() }).toArray();
        const blockedUsers = myBlocks.map(b => b.blocked);

        videos = await videosCol.find({ username: { $nin: blockedUsers } }).sort({ likes: -1, _id: -1 }).toArray();
    }

    const unreadNotif = isConnected ? await notificationsCol.findOne({ receiver: req.session.user.username.toLowerCase(), read: false }) : null;
    let toastMessage = unreadNotif ? unreadNotif.text : '';

    let feedHTML = '';
    for (let v of videos) {
        // Sabitlenen yorumlar üste gelecek şekilde sıralama
        const comments = await commentsCol.find({ video_id: v._id }).sort({ isPinned: -1, _id: -1 }).toArray();
        let commentList = '';
        comments.forEach(c => {
            commentList += `
            <div style="display:flex; gap:10px; margin-bottom:12px; ${c.isPinned ? 'background:#fff3f3; padding:8px; border-radius:6px;' : ''}">
                <div style="width:32px; height:32px; background:#ddd; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; color:#000;">👤</div>
                <div style="flex-grow:1;">
                    <div style="font-size:12px; font-weight:bold; color:#555;">${c.nickname || c.username} ${c.isPinned ? '📌 <span style="color:#FE2C55;">(Sabitlendi)</span>' : ''}</div>
                    <div style="font-size:13px; color:#111; margin-top:2px;">${c.comment}</div>
                    <div style="font-size:11px; color:#888; margin-top:4px; display:flex; gap:10px;">
                        <a href="/like-comment/${c._id}">❤️ ${c.likes || 0} Beğen</a>
                        ${v.username.toLowerCase() === req.session.user.username.toLowerCase() ? `<a href="/pin-comment/${c._id}" style="color:#FE2C55; font-weight:bold;">${c.isPinned ? 'Sabiti Kaldır' : 'Sabitle'}</a>` : ''}
                    </div>
                </div>
            </div>`;
        });

        feedHTML += `
        <div class="video-container" id="container-${v._id}">
            <video id="vid-${v._id}" src="${v.filename}" loop playsinline preload="auto" class="feed-video" onclick="toggleVideoPlay('vid-${v._id}')"></video>
            
            <!-- VİDEO HIZI KONTROLÜ -->
            <select onchange="changeSpeed('vid-${v._id}', this.value)" style="position:absolute; top:65px; left:15px; background:rgba(0,0,0,0.6); color:#fff; border:1px solid #444; border-radius:10px; padding:4px; font-size:11px; z-index:15;">
                <option value="1">1.0x Hız</option>
                <option value="1.5">1.5x Hız</option>
                <option value="2">2.0x Hız</option>
            </select>

            <div class="sound-toggle-btn" id="soundBtn-${v._id}" onclick="toggleMute('vid-${v._id}', this)" style="position:absolute; top:65px; right:15px; background:rgba(0,0,0,0.6); color:#fff; padding:6px 12px; border-radius:20px; font-size:12px; font-weight:bold; cursor:pointer; z-index:15;">🔊 Ses Açık</div>

            <div class="video-info">
                <a href="/profile/${v.username}" style="font-weight: bold; font-size: 15px; text-shadow: 0 1px 2px #000;">@${v.username}</a>
                <p style="margin: 5px 0; font-size: 14px; text-shadow: 0 1px 2px #000;">${v.caption}</p>
            </div>
            
            <div class="sidebar-actions">
                <a href="/like/${v._id}" class="action-btn">❤️<span>${v.likes}</span></a>
                <a href="#" onclick="openComments('${v._id}'); return false;" class="action-btn">💬<span>${comments.length}</span></a>
                <a href="/favorite/${v._id}" class="action-btn">⭐<span>${v.favorites}</span></a>
            </div>

            <div id="commentModal-${v._id}" class="comment-modal">
                <div class="comment-modal-header">
                    <span>${comments.length} yorum</span>
                    <span onclick="closeComments('${v._id}')" class="comment-close-btn">✕</span>
                </div>
                <div class="comment-scroll-area">${commentList || '<div style="text-align:center; color:#888; margin-top:40px;">Henüz yorum yok.</div>'}</div>
                <form action="/comment/${v._id}" method="POST" class="comment-input-form">
                    <input type="text" name="comment" placeholder="Yorum ekle..." required autocomplete="off">
                    <button type="submit">Gönder</button>
                </form>
            </div>
        </div>`;
    }

    const navbarHTML = await getNavbar('home', req.session.user.username, false);

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
            .feed-scroll { height: 100vh; overflow-y: scroll; scroll-snap-type: y mandatory; }
            .video-container { width: 100vw; height: 100vh; scroll-snap-align: start; position: relative; display: flex; justify-content: center; align-items: center; background: #000; }
            .feed-video { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
            .video-info { position: absolute; bottom: 80px; left: 15px; z-index: 10; max-width: 70%; }
            .sidebar-actions { position: absolute; bottom: 90px; right: 15px; z-index: 10; display: flex; flex-direction: column; gap: 14px; align-items: center; }
            .action-btn { background: rgba(0,0,0,0.4); width: 42px; height: 42px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; color: #fff; }

            .comment-modal { display: none; position: fixed; bottom: 0; left: 0; width: 100%; height: 75vh; background: #fff; color: #000; z-index: 30000; border-top-left-radius: 20px; border-top-right-radius: 20px; flex-direction: column; }
            .comment-modal-header { padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: center; font-weight: bold; position: relative; }
            .comment-close-btn { position: absolute; right: 15px; cursor: pointer; }
            .comment-scroll-area { flex-grow: 1; overflow-y: auto; padding: 15px; }
            .comment-input-form { padding: 12px 15px; border-top: 1px solid #eee; display: flex; gap: 10px; background: #fff; }
            .comment-input-form input { flex-grow: 1; padding: 10px; background: #f1f1f2; border: none; border-radius: 20px; outline: none; }
            .comment-input-form button { background: #FE2C55; color: #fff; border: none; padding: 10px 16px; border-radius: 20px; font-weight: bold; }
        </style>
        <script>
            function toggleVideoPlay(id) {
                const vid = document.getElementById(id);
                if (vid.paused) { vid.play(); } else { vid.pause(); }
            }

            function changeSpeed(id, speed) {
                const vid = document.getElementById(id);
                vid.playbackRate = parseFloat(speed);
            }

            function toggleMute(videoId, btn) {
                const vid = document.getElementById(videoId);
                vid.muted = !vid.muted;
                btn.innerText = vid.muted ? '🔇 Ses Kapalı' : '🔊 Ses Açık';
            }

            function openComments(id) { document.getElementById('commentModal-' + id).style.display = 'flex'; }
            function closeComments(id) { document.getElementById('commentModal-' + id).style.display = 'none'; }

            // 3 SANİYE BOYUNCA EKRANIN ÜST ORTASINDA GÖRÜNÜP GİDEN TOAST BİLDİRİM
            window.addEventListener('DOMContentLoaded', () => {
                const msg = "${toastMessage}";
                if (msg) {
                    const toast = document.createElement('div');
                    toast.className = 'top-toast-notification';
                    toast.innerHTML = '🔔 ' + msg;
                    document.body.appendChild(toast);

                    setTimeout(() => { toast.classList.add('show'); }, 100);
                    setTimeout(() => {
                        toast.classList.remove('show');
                        setTimeout(() => { toast.remove(); }, 400);
                    }, 3000);
                }
            });

            document.addEventListener("DOMContentLoaded", () => {
                const containers = document.querySelectorAll('.video-container');
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        const vid = entry.target.querySelector('video');
                        if (entry.isIntersecting) {
                            vid.muted = false;
                            vid.play().catch(e => {});
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
        <div class="feed-scroll">${feedHTML || '<div style="display:flex;justify-content:center;align-items:center;height:100vh;color:#666;">Video yok.</div>'}</div>
        ${navbarHTML}
    </body>
    </html>`);
});

const SITE_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT;
setInterval(() => {
    https.get(SITE_URL, (res) => {}).on('error', (err) => {});
}, 5 * 60 * 1000);

app.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda aktif.`); });

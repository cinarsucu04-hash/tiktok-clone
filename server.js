const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URL = process.env.MONGO_URL || "mongodb+srv://cinarsucu04_db_user:46vjLI7sNK7djBeE@cluster0.utveet0.mongodb.net/?retryWrites=true&w=majority";

let db, usersCol, videosCol, commentsCol, followsCol, likesCol, favoritesCol, storiesCol, messagesCol, searchesCol, draftsCol, notificationsCol;
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
        searchesCol = db.collection('searches');
        draftsCol = db.collection('drafts');
        notificationsCol = db.collection('notifications');
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
app.use(session({ secret: 'tiktok-cloud-key-advanced', resave: false, saveUninitialized: true }));

// GELEN KUTUSU ÜZERİNDE BİLDİRİM SAYISI ROZETİ (BADGE)
async function getNavbar(activeTab, username, isFriendsTab) {
    let notifCount = 0;
    if (isConnected && username) {
        try {
            notifCount = await notificationsCol.countDocuments({ receiver: username });
        } catch(e) {}
    }

    let badgeHTML = notifCount > 0 ? `<div style="position:absolute; top:-4px; right:-8px; background:#FE2C55; color:#fff; border-radius:10px; padding:1px 5px; font-size:10px; font-weight:bold; border:2px solid #121212;">${notifCount}</div>` : '';

    return `
    <div class="tiktok-nav">
        <a href="/" class="${(activeTab === 'home' && !isFriendsTab) ? 'active' : ''}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 9v11h6v-6h6v6h6V9l-9-7z"/></svg>
            <span>Ana sayfa</span>
        </a>
        <a href="/?feed=friends" class="${(activeTab === 'home' && isFriendsTab) ? 'active' : ''}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            <span>Arkadaşlar</span>
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
    * { box-sizing: border-box; }
    body { background: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding-bottom: 60px; min-height: 100vh; overflow-x: hidden; }
    a { text-decoration: none; color: inherit; }
    .tiktok-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; background: #121212; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid #222; z-index: 99999; }
    .tiktok-nav a { display: flex; flex-direction: column; align-items: center; color: #888; font-size: 10px; gap: 3px; position: relative; }
    .tiktok-nav a.active { color: #fff; }
    .plus-btn { position: relative; top: -5px; }
    .plus-icon { width: 40px; height: 26px; background: linear-gradient(90deg, #25F4EE 0%, #FE2C55 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #000; font-size: 22px; font-weight: bold; }
`;

app.post('/register', async (req, res) => {
    if (!isConnected) return res.send("<script>alert('Veritabanı bağlanıyor...'); window.location='/';</script>");
    const { username, nickname, password } = req.body;
    if (!username || !nickname || !password) return res.send("<script>alert('Tüm alanları doldurun!'); window.location='/';</script>");

    try {
        const cleanUsername = username.toLowerCase().trim();
        const existing = await usersCol.findOne({ username: cleanUsername });
        if (existing) return res.send("<script>alert('Bu kullanıcı adı zaten alınmış!'); window.location='/';</script>");

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCol.insertOne({ username: cleanUsername, nickname, password: hashedPassword, bio: 'TikTok içerik üreticisi 🎬', avatar: '', banner: '', isPrivate: false, theme: 'dark' });
        res.send("<script>alert('Kayıt başarılı! Giriş yapabilirsiniz.'); window.location='/';</script>");
    } catch (err) {
        res.send(`<script>alert('Kayıt Hatası: ${err.message}'); window.location='/';</script>`);
    }
});

app.post('/login', async (req, res) => {
    if (!isConnected) return res.send("<script>alert('Veritabanı bağlanıyor...'); window.location='/';</script>");
    const { username, password } = req.body;
    try {
        const user = await usersCol.findOne({ username: username.toLowerCase().trim() });
        if (!user) return res.send("<script>alert('Kullanıcı bulunamadı!'); window.location='/';</script>");
        
        const match = await bcrypt.compare(password, user.password);
        if (match) { req.session.user = user; res.redirect('/'); } 
        else { res.send("<script>alert('Hatalı şifre!'); window.location='/';</script>"); }
    } catch (err) {
        res.send(`<script>alert('Giriş Hatası: ${err.message}'); window.location='/';</script>`);
    }
});

app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

app.post('/update-settings', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const { isPrivate, theme } = req.body;
    const userId = new ObjectId(req.session.user._id);
    const privFlag = isPrivate === 'on';
    
    await usersCol.updateOne({ _id: userId }, { $set: { isPrivate: privFlag, theme: theme || 'dark' } });
    req.session.user.isPrivate = privFlag;
    req.session.user.theme = theme || 'dark';
    res.redirect(`/profile/${req.session.user.username}`);
});

app.get('/sound/:songName', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const songName = req.params.songName;
    const soundVideos = await videosCol.find({ song: songName }).toArray();

    let gridHTML = '';
    soundVideos.forEach(v => {
        gridHTML += `<div style="background:#111; aspect-ratio:9/16; position:relative; overflow:hidden;"><video src="${v.filename}" muted style="width:100%; height:100%; object-fit:cover;"></video><div style="position:absolute; bottom:5px; left:5px; font-size:11px;">❤️ ${v.likes}</div></div>`;
    });

    const navbarHTML = await getNavbar('home', req.session.user.username, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ses: ${songName}</title><style>${globalStyles}</style></head>
    <body style="padding:20px;">
        <a href="/" style="color:#FE2C55; font-weight:bold;">‹ Geri dön</a>
        <h2>🎵 ${songName}</h2>
        <p style="color:#888;">Bu ses ile paylaşılan ${soundVideos.length} video bulunuyor.</p>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:2px; margin-top:20px;">${gridHTML}</div>
        ${navbarHTML}
    </body>
    </html>`);
});

app.get('/tag/:tagName', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const tagName = '#' + req.params.tagName;
    const tagVideos = await videosCol.find({ caption: { $regex: tagName,$options: 'i' } }).toArray();

    let gridHTML = '';
    tagVideos.forEach(v => {
        gridHTML += `<div style="background:#111; aspect-ratio:9/16; position:relative; overflow:hidden;"><video src="${v.filename}" muted style="width:100%; height:100%; object-fit:cover;"></video><div style="position:absolute; bottom:5px; left:5px; font-size:11px;">❤️ ${v.likes}</div></div>`;
    });

    const navbarHTML = await getNavbar('home', req.session.user.username, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Etiket: ${tagName}</title><style>${globalStyles}</style></head>
    <body style="padding:20px;">
        <a href="/" style="color:#FE2C55; font-weight:bold;">‹ Geri dön</a>
        <h2>🏷️ ${tagName}</h2>
        <p style="color:#888;">Bu etiketle paylaşılan ${tagVideos.length} video bulunuyor.</p>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:2px; margin-top:20px;">${gridHTML}</div>
        ${navbarHTML}
    </body>
    </html>`);
});

app.get('/notifications', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const notifs = await notificationsCol.find({ receiver: req.session.user.username }).sort({ _id: -1 }).toArray();

    // Bildirim sayfasına girince bildirimleri okundu sayıp temizleyelim ki rozet sıfırlansın
    await notificationsCol.deleteMany({ receiver: req.session.user.username });

    let notifHTML = '';
    notifs.forEach(n => {
        notifHTML += `<div style="padding:12px 15px; border-bottom:1px solid #222; font-size:14px;">🔔 <b>@${n.sender}</b> ${n.text}</div>`;
    });

    const navbarHTML = await getNavbar('inbox', req.session.user.username, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Bildirimler</title><style>${globalStyles}</style></head>
    <body style="padding-top:10px;">
        <h3 style="padding:15px; margin:0;">Bildirim Merkezi</h3>
        ${notifHTML || '<p style="text-align:center; color:#888; margin-top:40px;">Henüz bildiriminiz yok.</p>'}
        ${navbarHTML}
    </body>
    </html>`);
});

app.get('/drafts', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const drafts = await draftsCol.find({ user_id: new ObjectId(req.session.user._id) }).toArray();

    let draftHTML = '';
    drafts.forEach(d => {
        draftHTML += `<div style="padding:15px; background:#1a1a1a; border-radius:8px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;"><div><b>${d.caption}</b><div style="font-size:11px; color:#888;">Taslak Video</div></div><a href="/publish-draft/${d._id}" style="background:#FE2C55; color:#fff; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:bold;">Yayınla</a></div>`;
    });

    const navbarHTML = await getNavbar('profile', req.session.user.username, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Taslaklar</title><style>${globalStyles}</style></head>
    <body style="padding:20px;">
        <a href="/upload-page" style="color:#FE2C55; font-weight:bold;">‹ Geri dön</a>
        <h2>📂 Video Taslaklarım</h2>
        <div style="margin-top:20px;">${draftHTML || '<p style="color:#888;">Hiç taslağınız yok.</p>'}</div>
        ${navbarHTML}
    </body>
    </html>`);
});

app.get('/publish-draft/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const draft = await draftsCol.findOne({ _id: new ObjectId(req.params.id) });
    if (draft) {
        await videosCol.insertOne({ user_id: draft.user_id, username: draft.username, caption: draft.caption, filename: draft.filename, song: draft.song, likes: 0, favorites: 0, shares: 0, createdAt: new Date() });
        await draftsCol.deleteOne({ _id: draft._id });
    }
    res.redirect('/');
});

app.get('/upload-page', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const navbarHTML = await getNavbar('home', req.session.user.username, false);
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Video Paylaş</title><style>${globalStyles}</style></head>
    <body style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh;">
        <h3 style="margin-bottom:20px;">Yeni Video Yayınla</h3>
        <form action="/upload" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:15px; width:320px; background:#1a1a1a; padding:20px; border-radius:12px;">
            <input type="text" name="caption" placeholder="Açıklama (#etiket ekleyebilirsin)..." required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <input type="text" name="song" value="Orijinal Ses - ${req.session.user.nickname}" style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <input type="file" name="video" accept="video/*" required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <button type="submit" style="background:#FE2C55; color:#fff; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Paylaş</button>
            <button type="submit" formaction="/save-draft" style="background:#333; color:#fff; padding:10px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Taslak olarak kaydet</button>
            <a href="/drafts" style="text-align:center; font-size:12px; color:#aaa;">Taslaklarım</a>
        </form>
        ${navbarHTML}
    </body>
    </html>`);
});

app.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Hata");
    try {
        if (!req.file) return res.send("<script>alert('Video seçin!'); window.location='/upload-page';</script>");
        await videosCol.insertOne({ user_id: new ObjectId(req.session.user._id), username: req.session.user.username, caption: req.body.caption || '', filename: `/uploads/${req.file.filename}`, song: req.body.song || 'Orijinal Ses', likes: 0, favorites: 0, shares: 0, createdAt: new Date() });
        res.redirect('/');
    } catch (err) { res.status(500).send("Hata: " + err.message); }
});

app.post('/save-draft', upload.single('video'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Hata");
    try {
        if (!req.file) return res.send("<script>alert('Video seçin!'); window.location='/upload-page';</script>");
        await draftsCol.insertOne({ user_id: new ObjectId(req.session.user._id), username: req.session.user.username, caption: req.body.caption || '', filename: `/uploads/${req.file.filename}`, song: req.body.song || 'Orijinal Ses', createdAt: new Date() });
        res.redirect('/drafts');
    } catch (err) { res.status(500).send("Hata: " + err.message); }
});

app.post('/comment/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
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
            const targetVid = await videosCol.findOne({ _id: new ObjectId(req.params.id) });
            if(targetVid) {
                await notificationsCol.insertOne({ receiver: targetVid.username, sender: req.session.user.username, text: 'videona yorum yaptı.', createdAt: new Date() });
            }
        }
    } catch (err) { console.error(err); }
    res.redirect('back');
});

app.get('/like-comment/:commentId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    await commentsCol.updateOne({ _id: new ObjectId(req.params.commentId) }, { $inc: { likes: 1 } });
    res.redirect('back');
});

app.get('/pin-comment/:commentId', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const cId = new ObjectId(req.params.commentId);
    const comment = await commentsCol.findOne({ _id: cId });
    if(comment) {
        await commentsCol.updateOne({ _id: cId }, { $set: { isPinned: !comment.isPinned } });
    }
    res.redirect('back');
});

app.get('/delete-video/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    try {
        const videoId = new ObjectId(req.params.id);
        const video = await videosCol.findOne({ _id: videoId });
        if (video && video.user_id.toString() === req.session.user._id.toString()) {
            await videosCol.deleteOne({ _id: videoId });
            await commentsCol.deleteMany({ video_id: videoId });
            await likesCol.deleteMany({ video_id: videoId });
            await favoritesCol.deleteMany({ video_id: videoId });
        }
    } catch (err) { console.error(err); }
    res.redirect(`/profile/${req.session.user.username}`);
});

app.get('/like/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const videoId = new ObjectId(req.params.id);
    const userId = req.session.user._id;

    const existingLike = await likesCol.findOne({ user_id: userId, video_id: videoId });
    if (!existingLike) {
        await likesCol.insertOne({ user_id: userId, video_id: videoId });
        await videosCol.updateOne({ _id: videoId }, { $inc: { likes: 1 } });
        const targetVid = await videosCol.findOne({ _id: videoId });
        if(targetVid) {
            await notificationsCol.insertOne({ receiver: targetVid.username, sender: req.session.user.username, text: 'videonu beğendi.', createdAt: new Date() });
        }
    } else {
        await likesCol.deleteOne({ user_id: userId, video_id: videoId });
        await videosCol.updateOne({ _id: videoId }, { $inc: { likes: -1 } });
    }
    res.redirect('back');
});

app.get('/favorite/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
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
    if (!req.session.user || !isConnected) return res.redirect('/');
    await videosCol.updateOne({ _id: new ObjectId(req.params.id) }, { $inc: { shares: 1 } });
    res.redirect('back');
});

app.get('/follow/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const followerId = req.session.user._id;
    const followingId = new ObjectId(req.params.id);

    const existingFollow = await followsCol.findOne({ follower_id: followerId, following_id: followingId });
    if (!existingFollow) { 
        await followsCol.insertOne({ follower_id: followerId, following_id: followingId }); 
        const targetUser = await usersCol.findOne({ _id: followingId });
        if(targetUser) {
            await notificationsCol.insertOne({ receiver: targetUser.username, sender: req.session.user.username, text: 'seni takip etmeye başladı.', createdAt: new Date() });
        }
    } 
    else { await followsCol.deleteOne({ follower_id: followerId, following_id: followingId }); }
    res.redirect('back');
});

app.post('/update-profile', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    try {
        const { nickname, bio } = req.body;
        const userId = new ObjectId(req.session.user._id);

        let avatarFile = req.session.user.avatar || '';
        if (req.files && req.files['avatar']) avatarFile = `/uploads/${req.files['avatar'][0].filename}`;

        let bannerFile = req.session.user.banner || '';
        if (req.files && req.files['banner']) bannerFile = `/uploads/${req.files['banner'][0].filename}`;

        const newNickname = nickname || req.session.user.nickname;
        await usersCol.updateOne({ _id: userId }, { $set: { nickname: newNickname, bio, avatar: avatarFile, banner: bannerFile } });

        req.session.user.nickname = newNickname;
        req.session.user.bio = bio;
        req.session.user.avatar = avatarFile;
        req.session.user.banner = bannerFile;
        res.redirect(`/profile/${req.session.user.username}`);
    } catch (err) { console.error(err); res.redirect(`/profile/${req.session.user.username}`); }
});

app.get('/profile/:username', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const targetUser = await usersCol.findOne({ username: req.params.username });
    if (!targetUser) return res.send("Kullanıcı bulunamadı.");

    const videos = await videosCol.find({ user_id: targetUser._id }).sort({ _id: -1 }).toArray();
    const followersCount = await followsCol.countDocuments({ following_id: targetUser._id });
    const followingCount = await followsCol.countDocuments({ follower_id: targetUser._id });
    const followCheck = await followsCol.findOne({ follower_id: new ObjectId(req.session.user._id), following_id: targetUser._id });
    
    let totalLikesAgg = await videosCol.aggregate([{ $match: { user_id: targetUser._id } }, {$group: { _id: null, total: { $sum: "$likes" } } }]).toArray();
    let totalLikes = totalLikesAgg.length > 0 ? totalLikesAgg[0].total : 0;

    let isMe = req.session.user._id.toString() === targetUser._id.toString();
    let isFollowing = !!followCheck;

    let videoHTML = '';
    videos.forEach(v => {
        videoHTML += `
        <div class="v-thumb">
            <video src="${v.filename}" muted></video>
            <div class="thumb-stats">❤️ ${v.likes}</div>
            ${isMe ? `<a href="/delete-video/${v._id}" onclick="return confirm('Silinsin mi?');" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:#ff4d4d; padding:4px 8px; border-radius:4px; font-size:11px;">Sil</a>` : ''}
        </div>`;
    });

    let bannerBg = targetUser.banner ? `url('${targetUser.banner}')` : 'linear-gradient(135deg, #2b2b2b, #111)';
    let avatarHTML = targetUser.avatar ? `<img src="${targetUser.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : targetUser.nickname.charAt(0).toUpperCase();
    const navbarHTML = await getNavbar('profile', req.session.user.username, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${targetUser.nickname}</title>
        <style>
            ${globalStyles}
            .banner { width: 100%; height: 140px; background-image: ${bannerBg}; background-size: cover; background-position: center; }
            .profile-header { text-align: center; padding: 0 15px 20px 15px; background: #000; position: relative; }
            .avatar { width: 85px; height: 85px; background: #FE2C55; border: 4px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: -45px auto 10px auto; font-weight: bold; overflow: hidden; }
            .stats { display: flex; justify-content: center; gap: 20px; margin: 15px 0; font-size: 14px; }
            .stats div span { display: block; font-weight: bold; font-size: 16px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
            .v-thumb { background: #1a1a1a; aspect-ratio: 9/16; position: relative; overflow: hidden; }
            .v-thumb video { width: 100%; height: 100%; object-fit: cover; }
            .thumb-stats { position: absolute; bottom: 5px; left: 5px; font-size: 11px; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="banner"></div>
        <div class="profile-header">
            <div class="avatar">${avatarHTML}</div>
            <h2 style="margin:5px 0;">${targetUser.nickname} <span onclick="document.getElementById('qrModal').style.display='flex'" style="font-size:16px; cursor:pointer;" title="QR Kod">🔳</span></h2>
            <p style="color:#888; margin:0; font-size:13px;">@${targetUser.username}</p>
            <div class="stats">
                <div><span>${followingCount}</span>Takip edilen</div>
                <div><span>${followersCount}</span>Takipçi</div>
                <div><span>${totalLikes}</span>Beğeni</div>
            </div>
            <p style="color:#ccc; font-size:13px;">${targetUser.bio}</p>
            ${isMe ? `<button onclick="document.getElementById('editModal').style.display='flex'" style="padding:8px 25px; background:#2f2f2f; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Profili Düzenle</button>` : `<a href="/follow/${targetUser._id}" style="padding:8px 25px; background:${isFollowing ? '#333' : '#FE2C55'}; color:#fff; border-radius:6px; font-weight:bold;">${isFollowing ? 'Takiptesin' : 'Takip Et'}</a>`}
        </div>
        <div class="grid">${videoHTML || '<p style="grid-column: span 3; text-align: center; color: #666; padding: 40px;">Henüz video yok.</p>'}</div>
        
        <div id="qrModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:300000; justify-content:center; align-items:center;">
            <div style="background:#fff; color:#000; padding:25px; border-radius:12px; width:260px; text-align:center;">
                <h3>@${targetUser.username}</h3>
                <div style="background:#eee; width:150px; height:150px; margin:15px auto; display:flex; align-items:center; justify-content:center; font-size:40px;">🔳</div>
                <p style="font-size:12px; color:#666;">Bu profili taratın</p>
                <button onclick="document.getElementById('qrModal').style.display='none'" style="background:#333; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">Kapat</button>
            </div>
        </div>

        <div id="editModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:200000; justify-content:center; align-items:center;">
            <div style="background:#1f1f1f; padding:25px; border-radius:12px; width:300px; text-align:center;">
                <h3>Profili Düzenle & Ayarlar</h3>
                <form action="/update-profile" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:10px;">
                    <input type="text" name="nickname" value="${targetUser.nickname}" required style="padding:10px; background:#2f2f2f; border:none; color:#fff; border-radius:6px;">
                    <input type="text" name="bio" value="${targetUser.bio}" required style="padding:10px; background:#2f2f2f; border:none; color:#fff; border-radius:6px;">
                    <label style="font-size:11px; color:#aaa; text-align:left;">Profil Fotoğrafı:</label>
                    <input type="file" name="avatar" accept="image/*">
                    <label style="font-size:11px; color:#aaa; text-align:left;">Banner:</label>
                    <input type="file" name="banner" accept="image/*">
                    <button type="submit" style="background:#FE2C55; color:#fff; padding:10px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:10px;">Kaydet</button>
                    <button type="button" onclick="document.getElementById('editModal').style.display='none'" style="background:#333; color:#fff; padding:8px; border:none; border-radius:6px; cursor:pointer;">İptal</button>
                </form>
                <form action="/update-settings" method="POST" style="margin-top:15px; text-align:left; font-size:13px; border-top:1px solid #333; padding-top:10px;">
                    <label><input type="checkbox" name="isPrivate" ${targetUser.isPrivate ? 'checked' : ''}> Hesabı Gizli Yap</label><br><br>
                    <button type="submit" style="background:#444; color:#fff; border:none; padding:6px 12px; border-radius:4px; width:100%; cursor:pointer;">Ayarları Güncelle</button>
                </form>
            </div>
        </div>
        ${navbarHTML}
    </body>
    </html>`);
});

app.get('/search', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
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
        userSearches.forEach(s => {
            dynamicListHTML += `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid #f1f1f2; color:#000; font-size:15px;">
                <a href="/search?q=${encodeURIComponent(s.query)}" style="flex-grow:1;">${s.query}</a>
                <a href="/clear-search/${s._id}" style="color:#888; font-size:12px;">✕</a>
            </div>`;
        });
    } else {
        searchResultsUsers.forEach(u => {
            dynamicListHTML += `<a href="/profile/${u.username}" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid #f1f1f2; color:#000;"><b>${u.nickname}</b> (@${u.username})</a>`;
        });
        searchResultsVideos.forEach(v => {
            dynamicListHTML += `<div style="padding:12px 16px; border-bottom:1px solid #f1f1f2; color:#000; font-size:14px;">🎬 <b>@${v.username}</b>: ${v.caption}</div>`;
        });
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ara</title>
        <style>${globalStyles} body { background: #fff; color: #000; padding-bottom: 70px; }</style>
    </head>
    <body>
        <div style="display:flex; align-items:center; gap:12px; padding:12px 15px; background:#fff; border-bottom:1px solid #eee;">
            <a href="/" style="font-size:24px; font-weight:bold; color:#000;">‹</a>
            <form action="/search" method="GET" style="flex-grow:1; background:#f1f1f2; border-radius:8px; display:flex; align-items:center; padding:0 12px; height:40px;">
                <input type="text" name="q" placeholder="Arama yap..." value="${query}" style="width:100%; background:transparent; border:none; outline:none; font-size:15px;">
            </form>
        </div>
        ${!query && userSearches.length > 0 ? '<div style="padding:15px; font-weight:bold; display:flex; justify-content:space-between;"><span>Son Aramalar</span><a href="/clear-all-searches" style="font-size:12px; color:#888;">Tümünü Temizle</a></div>' : ''}
        <div>${dynamicListHTML}</div>
    </body>
    </html>`);
});

app.get('/clear-search/:id', async (req, res) => {
    if (req.session.user && isConnected) {
        await searchesCol.deleteOne({ _id: new ObjectId(req.params.id) });
    }
    res.redirect('/search');
});

app.get('/clear-all-searches', async (req, res) => {
    if (req.session.user && isConnected) {
        await searchesCol.deleteMany({ user_id: new ObjectId(req.session.user._id) });
    }
    res.redirect('/search');
});

app.get('/inbox', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const users = await usersCol.find({ _id: { $ne: new ObjectId(req.session.user._id) } }).toArray();
    const notifCount = await notificationsCol.countDocuments({ receiver: req.session.user.username });

    let userListHTML = `<a href="/notifications" style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #1a1a1a; color:#FE2C55; font-weight:bold;"><div>Bildirimler</div><span>${notifCount} 🔔</span></a>`;
    users.forEach(u => {
        userListHTML += `<a href="/chat/${u.username}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #1a1a1a;"><div><b>${u.nickname}</b><div style="color:#888; font-size:12px;">@${u.username} ile sohbet et</div></div>💬</a>`;
    });

    const navbarHTML = await getNavbar('inbox', req.session.user.username, false);

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Gelen Kutusu</title><style>${globalStyles}</style></head>
    <body style="padding-bottom:70px;">
        <h3 style="padding:15px; margin:0;">Gelen Kutusu</h3>
        ${userListHTML}
        ${navbarHTML}
    </body>
    </html>`);
});

app.get('/chat/:targetUser', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const target = await usersCol.findOne({ username: req.params.targetUser });
    if (!target) return res.send("Kullanıcı bulunamadı.");

    const myUser = req.session.user.username;
    const messages = await messagesCol.find({ $or: [{ sender: myUser, receiver: target.username }, { sender: target.username, receiver: myUser }] }).sort({ _id: 1 }).toArray();

    let chatHTML = '';
    messages.forEach(m => {
        const isMe = m.sender === myUser;
        let content = m.text ? `<div>${m.text}</div>` : '';
        if (m.mediaUrl) {
            content += `<img src="${m.mediaUrl}" style="max-width:150px; border-radius:8px; margin-top:5px;">`;
        }
        chatHTML += `<div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:12px;"><div style="max-width:75%; background:${isMe ? '#33ccff' : '#f1f1f2'}; color:#000; padding:10px 16px; border-radius:18px; font-size:14px;">${content}</div></div>`;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sohbet</title><style>${globalStyles}</style></head>
    <body style="background:#fff; color:#000;">
        <div style="position:fixed; top:0; left:0; width:100%; height:60px; background:#fff; display:flex; align-items:center; padding:0 15px; border-bottom:1px solid #eee; z-index:100;">
            <a href="/inbox" style="font-size:24px; font-weight:bold; margin-right:15px;">‹</a>
            <b>${target.nickname}</b>
        </div>
        <div style="padding:75px 15px 90px 15px; min-height:100vh; box-sizing:border-box;">${chatHTML}</div>
        <form action="/send-msg/${target.username}" method="POST" enctype="multipart/form-data" style="position:fixed; bottom:0; left:0; width:100%; background:#fff; padding:10px 15px; border-top:1px solid #eee; display:flex; gap:10px; align-items:center;">
            <input type="text" name="text" placeholder="Mesaj yaz..." style="flex-grow:1; background:#f1f1f2; border:none; border-radius:20px; padding:10px 15px; outline:none;">
            <input type="file" name="media" accept="image/*" style="display:none;" id="chatImg">
            <label for="chatImg" style="cursor:pointer; font-size:20px;">🖼️</label>
            <button type="submit" style="background:#FE2C55; color:#fff; border:none; padding:8px 14px; border-radius:20px; font-weight:bold;">Gönder</button>
        </form>
    </body>
    </html>`);
});

app.post('/send-msg/:targetUser', upload.single('media'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    let mediaUrl = req.file ? `/uploads/${req.file.filename}` : '';
    await messagesCol.insertOne({ sender: req.session.user.username, receiver: req.params.targetUser, text: req.body.text || '', mediaUrl, createdAt: new Date() });
    await notificationsCol.insertOne({ receiver: req.params.targetUser, sender: req.session.user.username, text: 'sana bir mesaj gönderdi.', createdAt: new Date() });
    res.redirect('back');
});

app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Giriş</title><style>body{background:#fff;color:#000;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;}form{display:flex;flex-direction:column;gap:10px;width:300px;}input,button{padding:12px;border-radius:4px;border:1px solid #ddd;}</style></head>
        <body>
            <form action="/login" method="POST">
                <h2>TikTok Giriş</h2>
                <input type="text" name="username" placeholder="Kullanıcı adı" required>
                <input type="password" name="password" placeholder="Şifre" required>
                <button type="submit" style="background:#FE2C55;color:#fff;border:none;font-weight:bold;">Giriş Yap</button>
            </form>
        </body>
        </html>`);
    }

    const feedType = req.query.feed || 'foryou';
    let videos = [];
    if (isConnected) {
        if (feedType === 'friends') {
            const follows = await followsCol.find({ follower_id: new ObjectId(req.session.user._id) }).toArray();
            videos = await videosCol.find({ user_id: { $in: follows.map(f => f.following_id) } }).sort({ _id: -1 }).toArray();
        } else {
            videos = await videosCol.find({}).sort({ _id: -1 }).toArray();
        }
    }

    let feedHTML = '';
    for (let v of videos) {
        const comments = await commentsCol.find({ video_id: v._id }).sort({ isPinned: -1, _id: -1 }).toArray();
        let commentList = '';
        comments.forEach(c => {
            commentList += `
            <div style="display:flex; gap:10px; margin-bottom:12px; ${c.isPinned ? 'background:#fff8f8; padding:8px; border-radius:6px;' : ''}">
                <div style="width:32px; height:32px; background:#ddd; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">👤</div>
                <div style="flex-grow:1;">
                    <div style="font-size:12px; font-weight:bold; color:#666;">${c.nickname || c.username} ${c.isPinned ? '📌 (Sabitlendi)' : ''}</div>
                    <div style="font-size:13px; color:#111; margin-top:2px;">${c.comment}</div>
                    <div style="font-size:11px; color:#888; margin-top:4px; display:flex; gap:10px;">
                        <a href="/like-comment/${c._id}">❤️ ${c.likes || 0} Beğen</a>
                        ${v.user_id.toString() === req.session.user._id.toString() ? `<a href="/pin-comment/${c._id}">${c.isPinned ? 'Sabiti Kaldır' : 'Sabitle'}</a>` : ''}
                    </div>
                </div>
            </div>`;
        });

        let formattedCaption = v.caption.replace(/#([\wğüşıöçĞÜŞİÖÇ]+)/g, '<a href="/tag/$1" style="color:#25F4EE; font-weight:bold;">#$1</a>');

        feedHTML += `
        <div class="video-container" id="container-${v._id}">
            <video id="vid-${v._id}" src="${v.filename}" loop playsinline class="feed-video"></video>
            <div class="sound-toggle" onclick="toggleSound('vid-${v._id}', this)">🔊 Sesi Aç</div>
            
            <select onchange="changeSpeed('vid-${v._id}', this.value)" style="position:absolute; top:65px; left:15px; background:rgba(0,0,0,0.6); color:#fff; border:1px solid #444; border-radius:10px; padding:4px; font-size:11px; z-index:15;">
                <option value="1">1.0x Hız</option>
                <option value="1.5">1.5x Hız</option>
                <option value="2">2.0x Hız</option>
            </select>

            <div class="video-info">
                <a href="/profile/${v.username}" style="font-weight: bold; font-size: 15px; text-shadow: 0 1px 2px #000;">@${v.username}</a>
                <p style="margin: 5px 0; font-size: 14px; text-shadow: 0 1px 2px #000;">${formattedCaption}</p>
                <a href="/sound/${encodeURIComponent(v.song)}" style="font-size: 12px; color: #ddd; text-shadow: 0 1px 2px #000;">🎵 ${v.song}</a>
            </div>
            
            <div class="sidebar-actions">
                <a href="/like/${v._id}" class="action-btn">❤️<span>${v.likes}</span></a>
                <a href="#" onclick="openComments('${v._id}'); return false;" class="action-btn">💬<span>${comments.length}</span></a>
                <a href="/favorite/${v._id}" class="action-btn">⭐<span>${v.favorites}</span></a>
                <a href="/share/${v._id}" onclick="alert('Bağlantı kopyalandı!');" class="action-btn">↗️<span>${v.shares}</span></a>
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

    const navbarHTML = await getNavbar('home', req.session.user.username, feedType === 'friends');

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>TikTok</title>
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
            .video-info { position: absolute; bottom: 80px; left: 15px; z-index: 10; max-width: 70%; }
            .sidebar-actions { position: absolute; bottom: 90px; right: 15px; z-index: 10; display: flex; flex-direction: column; gap: 14px; align-items: center; }
            .action-btn { background: rgba(0,0,0,0.4); width: 42px; height: 42px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; color: #fff; }
            .sound-toggle { position: absolute; top: 65px; right: 15px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 12px; border-radius: 15px; font-size: 12px; z-index: 15; cursor: pointer; }
            .comment-modal { display: none; position: fixed; bottom: 0; left: 0; width: 100%; height: 75vh; background: #fff; color: #000; z-index: 30000; border-top-left-radius: 20px; border-top-right-radius: 20px; flex-direction: column; }
            .comment-modal-header { padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: center; font-weight: bold; position: relative; }
            .comment-close-btn { position: absolute; right: 15px; cursor: pointer; }
            .comment-scroll-area { flex-grow: 1; overflow-y: auto; padding: 15px; }
            .comment-input-form { padding: 12px 15px; border-top: 1px solid #eee; display: flex; gap: 10px; background: #fff; }
            .comment-input-form input { flex-grow: 1; padding: 10px; background: #f1f1f2; border: none; border-radius: 20px; outline: none; }
            .comment-input-form button { background: #FE2C55; color: #fff; border: none; padding: 10px 16px; border-radius: 20px; font-weight: bold; }
        </style>
        <script>
            let globalMutedState = true;
            function toggleSound(id, btn) {
                const vid = document.getElementById(id);
                if (vid.muted) { vid.muted = false; vid.play(); globalMutedState = false; btn.innerText = "🔇 Sesi Kapat"; } 
                else { vid.muted = true; globalMutedState = true; btn.innerText = "🔊 Sesi Aç"; }
            }
            function changeSpeed(id, speed) {
                const vid = document.getElementById(id);
                vid.playbackRate = parseFloat(speed);
            }
            function openComments(id) { document.getElementById('commentModal-' + id).style.display = 'flex'; }
            function closeComments(id) { document.getElementById('commentModal-' + id).style.display = 'none'; }
            document.addEventListener("DOMContentLoaded", () => {
                const containers = document.querySelectorAll('.video-container');
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        const vid = entry.target.querySelector('video');
                        if (entry.isIntersecting) { vid.muted = globalMutedState; vid.play().catch(e=>{}); } 
                        else { if(vid) { vid.pause(); vid.currentTime = 0; } }
                    });
                }, { threshold: 0.6 });
                containers.forEach(c => observer.observe(c));
            });
        </script>
    </head>
    <body>
        <div class="top-tabs">
            <a href="/?feed=friends" class="${feedType === 'friends' ? 'active' : ''}">Arkadaşlar</a>
            <a href="/?feed=foryou" class="${feedType !== 'friends' ? 'active' : ''}">Sizin İçin</a>
        </div>
        <a href="/search" class="top-search-btn">🔍</a>
        <div class="feed-scroll">${feedHTML || '<div style="display:flex;justify-content:center;align-items:center;height:100vh;color:#666;">Video yok.</div>'}</div>
        ${navbarHTML}
    </body>
    </html>`);
});

app.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda aktif.`); });

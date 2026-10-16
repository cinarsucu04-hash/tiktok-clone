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

let db, usersCol, videosCol, commentsCol, followsCol, likesCol, storiesCol, messagesCol;
let isConnected = false;

MongoClient.connect(MONGO_URL)
    .then(client => {
        db = client.db('tiktok_db');
        usersCol = db.collection('users');
        videosCol = db.collection('videos');
        commentsCol = db.collection('comments');
        followsCol = db.collection('follows');
        likesCol = db.collection('likes');
        storiesCol = db.collection('stories');
        messagesCol = db.collection('messages');
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

function getNavbar(activeTab, username) {
    return `
    <div class="tiktok-nav">
        <a href="/" class="${activeTab === 'home' ? 'active' : ''}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 9v11h6v-6h6v6h6V9l-9-7z"/></svg>
            <span>Ana sayfa</span>
        </a>
        <a href="/search" class="${activeTab === 'search' ? 'active' : ''}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <span>Keşfet/Ara</span>
        </a>
        <a href="/upload-page" class="plus-btn">
            <div class="plus-icon">+</div>
        </a>
        <a href="/inbox" class="${activeTab === 'inbox' ? 'active' : ''}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
            <span>Gelen kutusu</span>
        </a>
        <a href="/profile/${username}" class="${activeTab === 'profile' ? 'active' : ''}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            <span>Profil</span>
        </a>
    `;
}

const globalStyles = `
    * { box-sizing: border-box; }
    body { background: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding-bottom: 60px; min-height: 100vh; overflow-x: hidden; }
    a { text-decoration: none; color: inherit; }
    .tiktok-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; background: #121212; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid #222; z-index: 99999; }
    .tiktok-nav a { display: flex; flex-direction: column; align-items: center; color: #888; font-size: 10px; gap: 3px; }
    .tiktok-nav a.active { color: #fff; }
    .plus-btn { position: relative; top: -5px; }
    .plus-icon { width: 40px; height: 26px; background: linear-gradient(90deg, #25F4EE 0%, #FE2C55 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #000; font-size: 22px; font-weight: bold; }
    
    .progress-overlay { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 999999; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
    .progress-bar-bg { width: 80%; max-width: 300px; height: 12px; background: #333; border-radius: 6px; overflow: hidden; margin-top: 15px; }
    .progress-bar-fill { width: 0%; height: 100%; background: #FE2C55; transition: width 0.2s ease; }
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
        await usersCol.insertOne({ username: cleanUsername, nickname, password: hashedPassword, bio: 'TikTok içerik üreticisi 🎬', avatar: '', banner: '' });
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

app.get('/upload-story-page', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Hikaye Ekle</title><style>${globalStyles}</style></head>
    <body style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh;">
        <h2 style="margin-bottom:20px;">Yeni Hikaye Paylaş</h2>
        <form action="/upload-story" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:15px; width:300px; background:#1a1a1a; padding:20px; border-radius:12px;">
            <input type="file" name="media" accept="image/*,video/*" required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <button type="submit" style="background:#FE2C55; color:#fff; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Paylaş</button>
        </form>
        ${getNavbar('inbox', req.session.user.username)}
    </body>
    </html>`);
});

app.post('/upload-story', upload.single('media'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Hata");
    try {
        if (!req.file) return res.status(400).send("Dosya yok");
        const isVideo = req.file.mimetype.startsWith('video');
        await storiesCol.insertOne({ user_id: new ObjectId(req.session.user._id), username: req.session.user.username, mediaUrl: `/uploads/${req.file.filename}`, mediaType: isVideo ? 'video' : 'image', createdAt: new Date() });
        res.redirect('/inbox');
    } catch (err) { res.status(500).send("Hata: " + err.message); }
});

app.get('/upload-page', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Video Paylaş</title><style>${globalStyles}</style></head>
    <body style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh;">
        <h3 style="margin-bottom:20px;">Yeni Video Yayınla</h3>
        <form action="/upload" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:15px; width:320px; background:#1a1a1a; padding:20px; border-radius:12px;">
            <input type="text" name="caption" placeholder="Açıklama ekle..." required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <input type="text" name="song" value="Orijinal Ses - ${req.session.user.nickname}" style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <input type="file" name="video" accept="video/*" required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <button type="submit" style="background:#FE2C55; color:#fff; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Paylaş</button>
        </form>
        ${getNavbar('home', req.session.user.username)}
    </body>
    </html>`);
});

app.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Hata");
    try {
        if (!req.file) return res.status(400).send("Video yok");
        await videosCol.insertOne({ user_id: new ObjectId(req.session.user._id), username: req.session.user.username, caption: req.body.caption || '', filename: `/uploads/${req.file.filename}`, song: req.body.song || 'Orijinal Ses', likes: 0, favorites: 0, shares: 0, createdAt: new Date() });
        res.redirect('/');
    } catch (err) { res.status(500).send("Hata: " + err.message); }
});

app.post('/comment/:id', upload.single('image'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    try {
        let imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
        await commentsCol.insertOne({ video_id: new ObjectId(req.params.id), username: req.session.user.username, comment: req.body.comment || '', image: imageUrl, createdAt: new Date() });
    } catch (err) { console.error(err); }
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
    } else {
        await likesCol.deleteOne({ user_id: userId, video_id: videoId });
        await videosCol.updateOne({ _id: videoId }, { $inc: { likes: -1 } });
    }
    res.redirect('back');
});

app.get('/favorite/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    await videosCol.updateOne({ _id: new ObjectId(req.params.id) }, { $inc: { favorites: 1 } });
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
    if (!existingFollow) { await followsCol.insertOne({ follower_id: followerId, following_id: followingId }); } 
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
            <h2 style="margin:5px 0;">${targetUser.nickname}</h2>
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
        
        <div id="editModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:200000; justify-content:center; align-items:center;">
            <div style="background:#1f1f1f; padding:25px; border-radius:12px; width:300px; text-align:center;">
                <h3>Profili Düzenle</h3>
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
            </div>
        </div>
        ${getNavbar('profile', req.session.user.username)}
    </body>
    </html>`);
});

app.get('/search', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const query = req.query.q || '';
    let searchResultsVideos = [], searchResultsUsers = [];

    if (query && isConnected) {
        searchResultsVideos = await videosCol.find({ caption: { $regex: query,$options: 'i' } }).toArray();
        searchResultsUsers = await usersCol.find({ $or: [{ username: { $regex: query,$options: 'i' } }, { nickname: { $regex: query,$options: 'i' } }] }).toArray();
    }

    let resultsHTML = '';
    if (query) {
        resultsHTML += `<h3 style="padding: 15px;">Kullanıcılar</h3>`;
        searchResultsUsers.forEach(u => {
            resultsHTML += `<a href="/profile/${u.username}" style="display:flex; align-items:center; gap:12px; padding:12px 15px; border-bottom:1px solid #1a1a1a;"><b>${u.nickname}</b> (@${u.username})</a>`;
        });
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ara</title><style>${globalStyles}</style></head>
    <body>
        <form action="/search" method="GET" style="padding:12px 15px; display:flex; gap:10px;">
            <input type="text" name="q" placeholder="Ara..." value="${query}" style="flex-grow:1; padding:10px; background:#262626; border:none; color:#fff; border-radius:8px;">
            <button type="submit" style="background:#FE2C55; color:#fff; border:none; padding:10px 15px; border-radius:8px; font-weight:bold;">Ara</button>
        </form>
        ${resultsHTML}
        ${getNavbar('search', req.session.user.username)}
    </body>
    </html>`);
});

app.get('/inbox', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const users = await usersCol.find({ _id: { $ne: new ObjectId(req.session.user._id) } }).toArray();
    const stories = await storiesCol.find({}).sort({ _id: -1 }).toArray();

    let storiesHTML = `<div class="story-circle-item" onclick="window.location='/upload-story-page'"><div class="story-circle-ring plus-ring">+</div><span>Hikayen</span></div>`;
    stories.forEach(s => {
        let mediaTag = s.mediaType === 'video' ? `<video src="${s.mediaUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;"></video>` : `<img src="${s.mediaUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        storiesHTML += `<div class="story-circle-item" onclick="alert('Hikaye izleniyor!')"><div class="story-circle-ring">${mediaTag}</div><span>@${s.username}</span></div>`;
    });

    let userListHTML = '';
    users.forEach(u => {
        userListHTML += `<a href="/chat/${u.username}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #1a1a1a;"><div><b>${u.nickname}</b><div style="color:#888; font-size:12px;">@${u.username} ile sohbet et</div></div>💬</a>`;
    });

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
        </style>
    </head>
    <body>
        <div class="story-inbox-bar">${storiesHTML}</div>
        <h3 style="padding:15px; margin:0;">Mesajlar</h3>
        ${userListHTML}
        ${getNavbar('inbox', req.session.user.username)}
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
        chatHTML += `<div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:10px;"><div style="background:${isMe ? '#FE2C55' : '#262626'}; color:#fff; padding:10px 14px; border-radius:16px; font-size:14px;">${m.text}</div></div>`;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sohbet - @${target.username}</title>
        <style>${globalStyles}</style>
    </head>
    <body style="padding-top:60px; padding-bottom:70px;">
        <div style="position:fixed; top:0; left:0; width:100%; height:50px; background:#121212; display:flex; align-items:center; padding:0 15px; gap:15px; border-bottom:1px solid #222; z-index:100;">
            <a href="/inbox" style="font-size:20px;">←</a><b>${target.nickname} (@${target.username})</b>
        </div>
        <div style="padding:15px;">${chatHTML || '<p style="text-align:center; color:#555;">Henüz mesaj yok.</p>'}</div>
        <form action="/send-msg/${target.username}" method="POST" style="position:fixed; bottom:0; left:0; width:100%; padding:10px; background:#121212; display:flex; gap:10px;">
            <input type="text" name="text" placeholder="Mesaj yaz..." required style="flex-grow:1; background:#222; border:none; color:#fff; padding:10px; border-radius:20px; outline:none;">
            <button type="submit" style="background:#FE2C55; color:#fff; border:none; padding:0 15px; border-radius:20px; font-weight:bold;">Gönder</button>
        </form>
    </body>
    </html>`);
});

app.post('/send-msg/:targetUser', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    await messagesCol.insertOne({ sender: req.session.user.username, receiver: req.params.targetUser, text: req.body.text, createdAt: new Date() });
    res.redirect('back');
});

// ANA SAYFA - FULL SCREEN & SCROLL FIX
app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>TikTok</title>
            <style>body{background:#000; color:#fff; font-family:sans-serif; display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; margin:0;} input{width:280px; padding:12px; margin:8px 0; background:#262626; border:none; color:#fff; border-radius:6px;} button{width:280px; padding:12px; background:#FE2C55; color:#fff; border:none; font-weight:bold; border-radius:6px; cursor:pointer;}</style>
        </head>
        <body>
            <div style="background:#161616; padding:30px; border-radius:12px; text-align:center;">
                <h2>TikTok'a Giriş Yap</h2>
                <form action="/login" method="POST">
                    <input type="text" name="username" placeholder="Kullanıcı adı" required>
                    <input type="password" name="password" placeholder="Şifre" required>
                    <button type="submit">Giriş Yap</button>
                </form>
                <br>
                <form action="/register" method="POST">
                    <input type="text" name="username" placeholder="Kullanıcı adı" required>
                    <input type="text" name="nickname" placeholder="Takma ad" required>
                    <input type="password" name="password" placeholder="Şifre" required>
                    <button type="submit" style="background:#333;">Kayıt Ol</button>
                </form>
            </div>
        </body>
        </html>`);
    }

    const feedType = req.query.feed || 'foryou';
    let videos = isConnected ? await videosCol.find({}).sort({ _id: -1 }).toArray() : [];

    let feedHTML = '';
    for (let v of videos) {
        const comments = await commentsCol.find({ video_id: v._id }).sort({ _id: -1 }).toArray();
        let commentList = '';
        comments.forEach(c => {
            commentList += `
            <div class="comment-item">
                <div class="comment-avatar">👤</div>
                <div class="comment-content">
                    <div class="comment-author">@${c.username}</div>
                    <div class="comment-text">${c.comment}</div>
                    ${c.image ? `<img src="${c.image}" class="comment-sticker">` : ''}
                </div>
            </div>`;
        });

        feedHTML += `
        <div class="video-container" id="container-${v._id}">
            <video id="vid-${v._id}" src="${v.filename}" loop playsinline class="feed-video"></video>
            <div class="sound-toggle" onclick="toggleSound('vid-${v._id}', this)">🔊 Sesi Aç</div>
            <div class="fullscreen-btn" onclick="toggleCustomFullscreen('container-${v._id}')">⛶ Tam Ekran</div>
            
            <div class="video-info hide-on-fullscreen">
                <a href="/profile/${v.username}" style="font-weight: bold; font-size: 15px;">@${v.username}</a>
                <p style="margin: 5px 0; font-size: 14px;">${v.caption}</p>
                <p style="margin: 0; font-size: 12px; color: #ddd;">🎵 ${v.song}</p>
            </div>
            
            <div class="sidebar-actions hide-on-fullscreen">
                <a href="/like/${v._id}" class="action-btn">❤️<span>${v.likes}</span></a>
                <a href="#" onclick="openComments('${v._id}'); return false;" class="action-btn">💬<span>${comments.length}</span></a>
                <a href="/favorite/${v._id}" class="action-btn">⭐<span>${v.favorites}</span></a>
                <a href="/share/${v._id}" onclick="alert('Kopyalandı!');" class="action-btn">↗️<span>${v.shares}</span></a>
            </div>

            <div id="commentModal-${v._id}" class="comment-modal">
                <div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
                    <b>${comments.length} Yorum</b><span onclick="closeComments('${v._id}')" style="cursor:pointer;">✕</span>
                </div>
                <div style="flex-grow:1; overflow-y:scroll; padding:10px;">${commentList || '<p style="color:#888;">Yorum yok.</p>'}</div>
                <form action="/comment/${v._id}" method="POST" enctype="multipart/form-data" style="padding:10px; border-top:1px solid #eee; display:flex; gap:8px;">
                    <input type="text" name="comment" placeholder="Yorum ekle..." style="flex-grow:1; padding:8px; border:1px solid #ddd; border-radius:15px; outline:none;">
                    <input type="file" name="image" accept="image/*" style="display:none;" id="img-${v._id}">
                    <label for="img-${v._id}" style="cursor:pointer; font-size:18px;">🖼️</label>
                    <button type="submit" style="background:#FE2C55; color:#fff; border:none; padding:8px 12px; border-radius:15px;">Gönder</button>
                </form>
            </div>
        </div>`;
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>TikTok</title>
        <style>
            ${globalStyles}
            body { overflow: hidden; }
            .top-tabs { position: fixed; top: 0; left: 0; width: 100%; height: 45px; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); display: flex; justify-content: center; align-items: center; gap: 25px; z-index: 1000; font-size: 15px; font-weight: bold; }
            .top-tabs a { color: #aaa; }
            .top-tabs a.active { color: #fff; border-bottom: 2px solid #fff; padding-bottom: 4px; }
            
            .feed-scroll { height: 100vh; overflow-y: scroll; scroll-snap-type: y mandatory; -webkit-overflow-scrolling: touch; }
            .video-container { width: 100vw; height: 100vh; scroll-snap-align: start; position: relative; display: flex; justify-content: center; align-items: center; background: #000; }
            
            /* pointer-events: none sayesinde video üzerinde kaydırma/kaydırma engellenmez, pürüzsüz kayar */
            .feed-video { width: 100%; height: 100%; object-fit: contain; position: absolute; top: 0; left: 0; pointer-events: none; }
            
            .video-info { position: absolute; bottom: 80px; left: 15px; z-index: 10; max-width: 70%; text-shadow: 0 1px 2px #000; }
            .sidebar-actions { position: absolute; bottom: 90px; right: 15px; z-index: 10; display: flex; flex-direction: column; gap: 14px; align-items: center; }
            .action-btn { background: rgba(0,0,0,0.4); width: 42px; height: 42px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; color: #fff; }
            .sound-toggle { position: absolute; top: 65px; right: 15px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 12px; border-radius: 15px; font-size: 12px; z-index: 15; cursor: pointer; border: 1px solid rgba(255,255,255,0.3); }
            .fullscreen-btn { position: absolute; top: 65px; right: 120px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 12px; border-radius: 15px; font-size: 12px; z-index: 15; cursor: pointer; border: 1px solid rgba(255,255,255,0.3); }
            
            /* Tam Ekran Olunca Gizlenecekler (Beğeni, yorumlar, açıklama vb.) */
            .video-container.is-fullscreen .hide-on-fullscreen { display: none !important; }
            
            .comment-modal { display: none; position: fixed; bottom: 0; left: 0; width: 100%; height: 70vh; background: #fff; color: #000; z-index: 30000; border-top-left-radius: 12px; border-top-right-radius: 12px; flex-direction: column; }
            .comment-item { display: flex; gap: 10px; margin-bottom: 10px; }
            .comment-avatar { width: 30px; height: 30px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
            .comment-author { font-size: 12px; font-weight: bold; color: #666; }
            .comment-text { font-size: 13px; color: #111; }
            .comment-sticker { max-width: 100px; border-radius: 6px; margin-top: 4px; }
        </style>
        <script>
            let globalMutedState = true;

            function toggleSound(id, btn) {
                const vid = document.getElementById(id);
                if (vid.muted) { vid.muted = false; vid.play(); globalMutedState = false; btn.innerText = "🔇 Sesi Kapat"; } 
                else { vid.muted = true; globalMutedState = true; btn.innerText = "🔊 Sesi Aç"; }
            }

            function toggleCustomFullscreen(containerId) {
                const container = document.getElementById(containerId);
                container.classList.toggle('is-fullscreen');
            }

            function openComments(id) { document.getElementById('commentModal-' + id).style.display = 'flex'; }
            function closeComments(id) { document.getElementById('commentModal-' + id).style.display = 'none'; }

            document.addEventListener("DOMContentLoaded", () => {
                const containers = document.querySelectorAll('.video-container');
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        const vid = entry.target.querySelector('video');
                        const btn = entry.target.querySelector('.sound-toggle');
                        if (entry.isIntersecting) {
                            vid.muted = globalMutedState;
                            vid.play().catch(e => console.log(e));
                            if(btn) btn.innerText = globalMutedState ? "🔊 Sesi Aç" : "🔇 Sesi Kapat";
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
            <a href="/?feed=following" class="${feedType === 'following' ? 'active' : ''}">Takip edilen</a>
            <a href="/?feed=foryou" class="${feedType === 'foryou' ? 'active' : ''}">Sizin için</a>
        </div>

        <div class="feed-scroll">
            ${feedHTML || '<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:#666;">Henüz video yok. Alttaki "+" butonundan paylaş!</div>'}
        </div>
        ${getNavbar('home', req.session.user.username)}
    </body>
    </html>
    `);
});

app.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda aktif.`); });

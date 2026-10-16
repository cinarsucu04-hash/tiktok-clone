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
    </div>`;
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
            <a href="/inbox" style="text-align:center; color:#888; font-size:13px;">İptal</a>
        </form>
        ${getNavbar('inbox', req.session.user.username)}
    </body>
    </html>`);
});

app.post('/upload-story', upload.single('media'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Hata");
    try {
        if (!req.file) return res.send("<script>alert('Dosya seçin!'); window.location='/upload-story-page';</script>");
        const isVideo = req.file.mimetype ? req.file.mimetype.startsWith('video') : false;
        await storiesCol.insertOne({ user_id: new ObjectId(req.session.user._id), username: req.session.user.username, mediaUrl: `/uploads/${req.file.filename}`, mediaType: isVideo ? 'video' : 'image', createdAt: new Date() });
        res.redirect('/inbox');
    } catch (err) { res.status(500).send("Hata: " + err.message); }
});

app.get('/delete-story/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    try {
        const storyId = new ObjectId(req.params.id);
        const story = await storiesCol.findOne({ _id: storyId });
        if (story && story.username === req.session.user.username) {
            await storiesCol.deleteOne({ _id: storyId });
        }
    } catch (err) { console.error(err); }
    res.redirect('/inbox');
});

app.get('/upload-page', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Video Paylaş</title><style>${globalStyles}</style></head>
    <body style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh;">
        <h3 style="margin-bottom:20px;">Yeni Video Yayınla</h3>
        <form id="uploadForm" action="/upload" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:15px; width:320px; background:#1a1a1a; padding:20px; border-radius:12px;" onsubmit="showProgress(event)">
            <input type="text" name="caption" placeholder="Açıklama ekle..." required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <input type="text" name="song" value="Orijinal Ses - ${req.session.user.nickname}" style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <input type="file" id="videoFile" name="video" accept="video/*" required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <button type="submit" id="submitBtn" style="background:#FE2C55; color:#fff; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Paylaş</button>
            
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
        ${getNavbar('home', req.session.user.username)}
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
    const myUsername = req.session.user.username;

    let storiesHTML = `<div class="story-circle-item" onclick="window.location='/upload-story-page'"><div class="story-circle-ring plus-ring">+</div><span>Hikayen</span></div>`;
    stories.forEach(s => {
        let mediaTag = s.mediaType === 'video' ? `<video src="${s.mediaUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;"></video>` : `<img src="${s.mediaUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        let isMyStory = s.username === myUsername;
        storiesHTML += `<div class="story-circle-item" onclick="viewStory('${s.mediaUrl}', '${s.mediaType}', '${s.username}', '${s._id}', ${isMyStory})"><div class="story-circle-ring">${mediaTag}</div><span>@${s.username}</span></div>`;
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
                if(isMyStory) {
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
        chatHTML += `
        <div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:12px;">
            <div style="max-width:75%; background:${isMe ? '#33ccff' : '#f1f1f2'}; color:${isMe ? '#000' : '#000'}; padding:10px 16px; border-radius:18px; font-size:14px; line-height:1.4;">
                ${m.text}
            </div>
        </div>`;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sohbet - @${target.username}</title>
        <style>
            ${globalStyles}
            body { background: #fff; color: #000; }
            .chat-header { position: fixed; top: 0; left: 0; width: 100%; height: 60px; background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 15px; border-bottom: 1px solid #eee; z-index: 100; }
            .chat-header-left { display: flex; align-items: center; gap: 12px; }
            .chat-header-right { display: flex; align-items: center; gap: 20px; font-size: 20px; color: #000; }
            .chat-avatar { width: 36px; height: 36px; background: #FE2C55; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #fff; font-size: 15px; overflow: hidden; }
            .chat-body { padding: 75px 15px 90px 15px; min-height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-end; }
            .chat-footer { position: fixed; bottom: 0; left: 0; width: 100%; background: #fff; padding: 10px 15px; border-top: 1px solid #eee; display: flex; align-items: center; gap: 12px; z-index: 100; }
            .chat-input-box { flex-grow: 1; background: #f1f1f2; border-radius: 24px; padding: 10px 16px; display: flex; align-items: center; }
            .chat-input-box input { width: 100%; background: transparent; border: none; outline: none; font-size: 14px; color: #000; }
            .chat-footer-icons { display: flex; align-items: center; gap: 12px; font-size: 20px; cursor: pointer; }
        </style>
        <script>
            function appendEmoji(emoji) {
                const input = document.getElementById('chatInput');
                input.value += emoji;
                input.focus();
            }
            function triggerAction(actionName) {
                alert(actionName + ' özelliği seçildi!');
            }
        </script>
    </head>
    <body>
        <div class="chat-header">
            <div class="chat-header-left">
                <a href="/inbox" style="font-size:24px; font-weight:bold;">‹</a>
                <div class="chat-avatar">${target.avatar ? `<img src="${target.avatar}" style="width:100%; height:100%; object-fit:cover;">` : target.nickname.charAt(0).toUpperCase()}</div>
                <div>
                    <div style="font-weight:bold; font-size:15px; color:#000;">${target.nickname}</div>
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
            <span class="chat-footer-icons" onclick="triggerAction('Kamera')">📷</span>
            <div class="chat-input-box">
                <input type="text" id="chatInput" name="text" placeholder="Mesaj..." required>
            </div>
            <div class="chat-footer-icons">
                <span onclick="triggerAction('Galeri / Resim')">🖼️</span>
                <span onclick="appendEmoji('😊')">😊</span>
                <span onclick="appendEmoji('❤️')">❤️</span>
                <span onclick="triggerAction('Ses Kaydı')">🎙️</span>
            </div>
        </form>
        <script>window.scrollTo(0, document.body.scrollHeight);</script>
    </body>
    </html>`);
});

app.post('/send-msg/:targetUser', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    await messagesCol.insertOne({ sender: req.session.user.username, receiver: req.params.targetUser, text: req.body.text, createdAt: new Date() });
    res.redirect('back');
});

// ANA SAYFA - BEYAZ MOD YORUM PANELİ VE VİDEO AKIŞI
app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TikTok'a Kaydolun</title>
            <style>
                body { background: #fff; color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
                .container { width: 100%; max-width: 380px; text-align: center; }
                h2 { font-size: 26px; font-weight: bold; margin-bottom: 30px; }
                .form-group { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
                input { width: 100%; padding: 14px; background: #f1f1f2; border: none; border-radius: 4px; font-size: 15px; box-sizing: border-box; outline: none; }
                .btn-red { width: 100%; padding: 14px; background: #FE2C55; color: white; border: none; border-radius: 4px; font-weight: bold; font-size: 16px; cursor: pointer; }
                .footer-text { position: fixed; bottom: 20px; width: 100%; text-align: center; font-size: 14px; color: #333; }
                .footer-text span { color: #FE2C55; font-weight: bold; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="container">
                <div id="registerView">
                    <h2>TikTok'a kaydolun</h2>
                    <form action="/register" method="POST" class="form-group">
                        <input type="text" name="username" placeholder="Kullanıcı adı" required>
                        <input type="text" name="nickname" placeholder="Takma ad (Görünen isim)" required>
                        <input type="password" name="password" placeholder="Şifre" required>
                        <button type="submit" class="btn-red">Kayıt Ol</button>
                    </form>
                </div>
                <div id="loginView" style="display:none;">
                    <h2>TikTok'a Giriş Yap</h2>
                    <form action="/login" method="POST" class="form-group">
                        <input type="text" name="username" placeholder="Kullanıcı adı" required>
                        <input type="password" name="password" placeholder="Şifre" required>
                        <button type="submit" class="btn-red">Giriş Yap</button>
                    </form>
                </div>
            </div>
            <div class="footer-text" id="footerText">
                Zaten bir hesabınız var mı? <span onclick="toggleView()">Giriş yap</span>
            </div>
            <script>
                function toggleView() {
                    const reg = document.getElementById('registerView');
                    const log = document.getElementById('loginView');
                    const footer = document.getElementById('footerText');
                    if (reg.style.display === 'none') {
                        reg.style.display = 'block';
                        log.style.display = 'none';
                        footer.innerHTML = 'Zaten bir hesabınız var mı? <span onclick="toggleView()">Giriş yap</span>';
                    } else {
                        reg.style.display = 'none';
                        log.style.display = 'block';
                        footer.innerHTML = 'Hesabınız yok mu? <span onclick="toggleView()">Kayıt ol</span>';
                    }
                }
            </script>
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
            
            <div class="video-info">
                <a href="/profile/${v.username}" style="font-weight: bold; font-size: 15px; text-shadow: 0 1px 2px #000;">@${v.username}</a>
                <p style="margin: 5px 0; font-size: 14px; text-shadow: 0 1px 2px #000;">${v.caption}</p>
                <p style="margin: 0; font-size: 12px; color: #ddd; text-shadow: 0 1px 2px #000;">🎵 ${v.song}</p>
            </div>
            
            <div class="sidebar-actions">
                <a href="/like/${v._id}" class="action-btn">❤️<span>${v.likes}</span></a>
                <a href="#" onclick="openComments('${v._id}'); return false;" class="action-btn">💬<span>${comments.length}</span></a>
                <a href="/favorite/${v._id}" class="action-btn">⭐<span>${v.favorites}</span></a>
                <a href="/share/${v._id}" onclick="alert('Kopyalandı!');" class="action-btn">↗️<span>${v.shares}</span></a>
            </div>

            <!-- GÖNDERDİĞİN FOTOĞRAFTAKİ BİREBİR BEYAZ MOD TIKTOK YORUM MODALI -->
            <div id="commentModal-${v._id}" class="comment-modal">
                <div class="comment-modal-header">
                    <span>${comments.length} yorum</span>
                    <span onclick="closeComments('${v._id}')" class="comment-close-btn">✕</span>
                </div>
                <div class="comment-scroll-area">
                    ${commentList || '<div style="text-align:center; color:#888; margin-top:60px; font-size:14px;">Henüz yorum yok. İlk yorumu sen yap!</div>'}
                </div>
                <form action="/comment/${v._id}" method="POST" enctype="multipart/form-data" class="comment-input-form" autocomplete="off">
                    <div class="comment-user-avatar">👤</div>
                    <input type="text" id="cInput-${v._id}" name="comment" placeholder="Yorum ekleyin..." required>
                    <input type="file" name="image" accept="image/*" style="display:none;" id="img-${v._id}">
                    <label for="img-${v._id}" class="comment-icon-btn">🖼️</label>
                    <span class="comment-icon-btn" onclick="addCommentEmoji('${v._id}', '😊')">😊</span>
                    <span class="comment-icon-btn" onclick="addCommentEmoji('${v._id}', '@')">@</span>
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
            
            .feed-video { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
            
            .video-info { position: absolute; bottom: 80px; left: 15px; z-index: 10; max-width: 70%; }
            .sidebar-actions { position: absolute; bottom: 90px; right: 15px; z-index: 10; display: flex; flex-direction: column; gap: 14px; align-items: center; }
            .action-btn { background: rgba(0,0,0,0.4); width: 42px; height: 42px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; color: #fff; }
            .sound-toggle { position: absolute; top: 65px; right: 15px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 12px; border-radius: 15px; font-size: 12px; z-index: 15; cursor: pointer; border: 1px solid rgba(255,255,255,0.3); }
            
            /* BEYAZ MOD TIKTOK YORUM MODALI (FOTOĞRAFA BİREBİR UYUMLU) */
            .comment-modal { display: none; position: fixed; bottom: 0; left: 0; width: 100%; height: 75vh; background: #ffffff; color: #000000; z-index: 30000; border-top-left-radius: 16px; border-top-right-radius: 16px; flex-direction: column; box-shadow: 0 -5px 25px rgba(0,0,0,0.3); }
            .comment-modal-header { padding: 15px; border-bottom: 1px solid #f1f1f2; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 15px; position: relative; flex-shrink: 0; }
            .comment-close-btn { position: absolute; right: 15px; cursor: pointer; font-size: 20px; color: #000; }
            .comment-scroll-area { flex-grow: 1; overflow-y: auto; padding: 15px; min-height: 0; background: #ffffff; }
            .comment-item { display: flex; gap: 12px; margin-bottom: 16px; align-items: flex-start; }
            .comment-avatar { width: 36px; height: 36px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
            .comment-author { font-size: 12px; font-weight: bold; color: #666; }
            .comment-text { font-size: 14px; color: #111; margin-top: 3px; }
            .comment-sticker { max-width: 140px; border-radius: 8px; margin-top: 6px; }
            
            .comment-input-form { padding: 10px 15px; border-top: 1px solid #f1f1f2; display: flex; gap: 12px; background: #ffffff; align-items: center; flex-shrink: 0; }
            .comment-user-avatar { width: 32px; height: 32px; background: #333; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
            .comment-input-form input[type="text"] { flex-grow: 1; padding: 10px 16px; background: #f1f1f2; border: none; border-radius: 20px; outline: none; font-size: 14px; color: #000; min-width: 0; }
            .comment-icon-btn { cursor: pointer; font-size: 22px; user-select: none; flex-shrink: 0; }
        </style>
        <script>
            let globalMutedState = true;

            function toggleSound(id, btn) {
                const vid = document.getElementById(id);
                if (vid.muted) { vid.muted = false; vid.play(); globalMutedState = false; btn.innerText = "🔇 Sesi Kapat"; } 
                else { vid.muted = true; globalMutedState = true; btn.innerText = "🔊 Sesi Aç"; }
            }

            function openComments(id) { document.getElementById('commentModal-' + id).style.display = 'flex'; }
            function closeComments(id) { document.getElementById('commentModal-' + id).style.display = 'none'; }
            
            function addCommentEmoji(id, text) {
                const inp = document.getElementById('cInput-' + id);
                if(text === '@') {
                    inp.value += '@';
                } else {
                    inp.value += text;
                }
                inp.focus();
            }

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

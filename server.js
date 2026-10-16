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
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 200 * 1024 * 1024 } // 200MB limit
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: 'tiktok-cloud-key',
    resave: false,
    saveUninitialized: true
}));

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
    </div>
    `;
}

const globalStyles = `
    * { box-sizing: border-box; }
    body { background: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding-bottom: 70px; min-height: 100vh; overflow-x: hidden; }
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

// Kayıt ve Giriş
app.post('/register', async (req, res) => {
    if (!isConnected) return res.send("<script>alert('Veritabanı bağlanıyor...'); window.location='/';</script>");
    const { username, nickname, password } = req.body;
    if (!username || !nickname || !password) return res.send("<script>alert('Tüm alanları doldurun!'); window.location='/';</script>");

    try {
        const cleanUsername = username.toLowerCase().trim();
        const existing = await usersCol.findOne({ username: cleanUsername });
        if (existing) return res.send("<script>alert('Bu kullanıcı adı zaten alınmış!'); window.location='/';</script>");

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCol.insertOne({
            username: cleanUsername,
            nickname,
            password: hashedPassword,
            bio: 'TikTok içerik üreticisi 🎬',
            avatar: '',
            banner: ''
        });
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
        if (match) {
            req.session.user = user;
            res.redirect('/');
        } else {
            res.send("<script>alert('Hatalı şifre!'); window.location='/';</script>");
        }
    } catch (err) {
        res.send(`<script>alert('Giriş Hatası: ${err.message}'); window.location='/';</script>`);
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// Hikaye Sayfası
app.get('/upload-story-page', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hikaye Ekle</title>
        <style>
            ${globalStyles}
            .container { padding: 30px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: calc(100vh - 60px); box-sizing: border-box; }
            .form-box { width: 100%; max-width: 350px; background: #1a1a1a; padding: 20px; border-radius: 12px; display: flex; flex-direction: column; gap: 15px; }
            .form-box input { padding: 12px; background: #2a2a2a; border: none; color: #fff; border-radius: 6px; box-sizing: border-box; }
            .btn { background: #FE2C55; color: #fff; padding: 12px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; text-align: center; }
        </style>
    </head>
    <body>
        <div class="progress-overlay" id="progressOverlay">
            <h3>Hikaye Yükleniyor...</h3>
            <div id="percentText" style="font-size:20px; font-weight:bold; color:#FE2C55;">0%</div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" id="progressBarFill"></div></div>
        </div>

        <div class="container">
            <h2 style="margin-bottom: 20px;">Yeni Hikaye Paylaş</h2>
            <form id="storyForm" class="form-box">
                <label style="font-size: 13px; color: #aaa;">Fotoğraf veya Video Seç:</label>
                <input type="file" id="storyMedia" name="media" accept="image/*,video/*" required>
                <button type="submit" class="btn">Hikayeye Ekle</button>
                <a href="/" style="text-align: center; color: #888; font-size: 13px; margin-top: 5px;">İptal</a>
            </form>
        </div>

        <script>
            document.getElementById('storyForm').addEventListener('submit', function(e) {
                e.preventDefault();
                const fileInput = document.getElementById('storyMedia');
                if(!fileInput.files.length) return;

                const formData = new FormData();
                formData.append('media', fileInput.files[0]);

                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/upload-story', true);
                document.getElementById('progressOverlay').style.display = 'flex';

                xhr.upload.onprogress = function(e) {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        document.getElementById('progressBarFill').style.width = percent + '%';
                        document.getElementById('percentText').innerText = percent + '%';
                    }
                };

                xhr.onload = function() {
                    if (xhr.status === 200) window.location.href = '/';
                    else {
                        alert('Yükleme hatası: ' + xhr.responseText);
                        document.getElementById('progressOverlay').style.display = 'none';
                    }
                };
                xhr.send(formData);
            });
        </script>
        ${getNavbar('home', req.session.user.username)}
    </body>
    </html>
    `);
});

app.post('/upload-story', upload.single('media'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Veritabanı bağlantı hatası");
    try {
        if (!req.file) return res.status(400).send("Dosya bulunamadı");
        const mediaUrl = `/uploads/${req.file.filename}`;
        const isVideo = req.file.mimetype.startsWith('video');

        await storiesCol.insertOne({
            user_id: new ObjectId(req.session.user._id),
            username: req.session.user.username,
            mediaUrl: mediaUrl,
            mediaType: isVideo ? 'video' : 'image',
            createdAt: new Date()
        });
        res.status(200).send("OK");
    } catch (err) {
        res.status(500).send("Hata: " + err.message);
    }
});

// Video Yükleme Sayfası
app.get('/upload-page', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Video Paylaş</title>
        <style>
            ${globalStyles}
            .editor-container { width: 100vw; height: calc(100vh - 60px); background: #111; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 20px; box-sizing: border-box; }
            .form-box { width: 100%; max-width: 400px; background: rgba(20,20,20,0.9); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; gap: 15px; }
            .form-box input { width: 100%; padding: 12px; background: #2a2a2a; border: none; color: #fff; border-radius: 6px; box-sizing: border-box; }
            .publish-btn { background: #FE2C55; color: #fff; padding: 14px; border: none; border-radius: 6px; font-weight: bold; font-size: 15px; cursor: pointer; text-align: center; }
        </style>
    </head>
    <body>
        <div class="progress-overlay" id="progressOverlay">
            <h3>Video Yükleniyor...</h3>
            <div id="percentText" style="font-size:24px; font-weight:bold; color:#FE2C55;">0%</div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" id="progressBarFill"></div></div>
        </div>

        <div class="editor-container">
            <h3 style="margin-top: 10px;">Yeni Video Yayınla</h3>
            <form id="videoForm" class="form-box">
                <input type="text" id="captionInput" placeholder="Açıklama ekle, #etiketle..." required>
                <input type="text" id="songInput" value="Orijinal Ses - ${req.session.user.nickname}">
                <label style="font-size: 12px; color: #aaa;">Galeriden Video Seç:</label>
                <input type="file" id="videoFileInput" accept="video/*" required>
                <button type="submit" class="publish-btn">Paylaş</button>
            </form>
            <div></div>
        </div>

        <script>
            document.getElementById('videoForm').addEventListener('submit', function(e) {
                e.preventDefault();
                const fileInput = document.getElementById('videoFileInput');
                if(!fileInput.files.length) return;

                const formData = new FormData();
                formData.append('video', fileInput.files[0]);
                formData.append('caption', document.getElementById('captionInput').value);
                formData.append('song', document.getElementById('songInput').value);

                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/upload', true);
                document.getElementById('progressOverlay').style.display = 'flex';

                xhr.upload.onprogress = function(e) {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        document.getElementById('progressBarFill').style.width = percent + '%';
                        document.getElementById('percentText').innerText = percent + '%';
                    }
                };

                xhr.onload = function() {
                    if (xhr.status === 200) window.location.href = '/';
                    else {
                        alert('Yükleme Hatası: ' + xhr.responseText);
                        document.getElementById('progressOverlay').style.display = 'none';
                    }
                };
                xhr.send(formData);
            });
        </script>
        ${getNavbar('home', req.session.user.username)}
    </body>
    </html>
    `);
});

app.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.status(500).send("Sunucu bağlantı hatası");
    try {
        if (!req.file) return res.status(400).send("Video dosyası bulunamadı");
        const videoUrl = `/uploads/${req.file.filename}`;

        await videosCol.insertOne({
            user_id: new ObjectId(req.session.user._id),
            username: req.session.user.username,
            caption: req.body.caption || '',
            filename: videoUrl,
            song: req.body.song || 'Orijinal Ses',
            likes: 0,
            favorites: 0,
            shares: 0,
            createdAt: new Date()
        });
        res.status(200).send("OK");
    } catch (err) {
        res.status(500).send("Yükleme sunucu hatası: " + err.message);
    }
});

// Yorum ve Çıkartma/Fotoğraf Gönderimi
app.post('/comment/:id', upload.single('image'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    try {
        let imageUrl = '';
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }

        await commentsCol.insertOne({
            video_id: new ObjectId(req.params.id),
            username: req.session.user.username,
            comment: req.body.comment || '',
            image: imageUrl,
            createdAt: new Date()
        });
    } catch (err) {
        console.error(err);
    }
    res.redirect('back');
});

// Video Silme
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

// Beğeni
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

// Favori ve Paylaş
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

// Takip Et / Takipten Çık
app.get('/follow/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const followerId = req.session.user._id;
    const followingId = new ObjectId(req.params.id);

    const existingFollow = await followsCol.findOne({ follower_id: followerId, following_id: followingId });
    if (!existingFollow) {
        await followsCol.insertOne({ follower_id: followerId, following_id: followingId });
    } else {
        await followsCol.deleteOne({ follower_id: followerId, following_id: followingId });
    }
    res.redirect('back');
});

// Profil Güncelleme
app.post('/update-profile', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    try {
        const { nickname, bio } = req.body;
        const userId = new ObjectId(req.session.user._id);

        let avatarFile = req.session.user.avatar || '';
        if (req.files && req.files['avatar']) {
            avatarFile = `/uploads/${req.files['avatar'][0].filename}`;
        }

        let bannerFile = req.session.user.banner || '';
        if (req.files && req.files['banner']) {
            bannerFile = `/uploads/${req.files['banner'][0].filename}`;
        }

        const newNickname = nickname || req.session.user.nickname;
        await usersCol.updateOne({ _id: userId }, {
            $set: { nickname: newNickname, bio, avatar: avatarFile, banner: bannerFile }
        });

        req.session.user.nickname = newNickname;
        req.session.user.bio = bio;
        req.session.user.avatar = avatarFile;
        req.session.user.banner = bannerFile;
        res.redirect(`/profile/${req.session.user.username}`);
    } catch (err) {
        console.error(err);
        res.redirect(`/profile/${req.session.user.username}`);
    }
});

// 1. ESKİ & GELİŞTİRİLMİŞ PROFİL SAYFASI
app.get('/profile/:username', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const targetUser = await usersCol.findOne({ username: req.params.username });
    if (!targetUser) return res.send("Kullanıcı bulunamadı.");

    const videos = await videosCol.find({ user_id: targetUser._id }).sort({ _id: -1 }).toArray();
    const followersCount = await followsCol.countDocuments({ following_id: targetUser._id });
    const followingCount = await followsCol.countDocuments({ follower_id: targetUser._id });
    const followCheck = await followsCol.findOne({ follower_id: new ObjectId(req.session.user._id), following_id: targetUser._id });
    
    let totalLikesAgg = await videosCol.aggregate([
        { $match: { user_id: targetUser._id } },
        { $group: { _id: null, total: { $sum: "$likes" } } }
    ]).toArray();
    let totalLikes = totalLikesAgg.length > 0 ? totalLikesAgg[0].total : 0;

    let isMe = req.session.user._id.toString() === targetUser._id.toString();
    let isFollowing = !!followCheck;

    let videoHTML = '';
    videos.forEach(v => {
        videoHTML += `
        <div class="v-thumb">
            <video src="${v.filename}" muted></video>
            <div class="thumb-stats">❤️ ${v.likes}</div>
            ${isMe ? `<a href="/delete-video/${v._id}" onclick="return confirm('Bu videoyu silmek istiyor musunuz?');" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:#ff4d4d; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold;">🗑️ Sil</a>` : ''}
        </div>`;
    });

    let bannerBg = targetUser.banner ? `url('${targetUser.banner}')` : 'linear-gradient(135deg, #2b2b2b, #111)';
    let avatarHTML = targetUser.avatar ? `<img src="${targetUser.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : targetUser.nickname.charAt(0).toUpperCase();

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${targetUser.nickname} (@${targetUser.username})</title>
        <style>
            ${globalStyles}
            .profile-wrapper { padding-bottom: 80px; min-height: 100vh; }
            .banner { width: 100%; height: 140px; background-image: ${bannerBg}; background-size: cover; background-position: center; position: relative; }
            .profile-header { text-align: center; padding: 0 15px 20px 15px; background: #000; position: relative; }
            .avatar { width: 85px; height: 85px; background: #FE2C55; border: 4px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: -45px auto 10px auto; font-weight: bold; position: relative; z-index: 2; overflow: hidden; }
            .stats { display: flex; justify-content: center; gap: 20px; margin: 15px 0; font-size: 14px; }
            .stats div span { display: block; font-weight: bold; font-size: 16px; }
            .bio-box { color: #ccc; font-size: 13px; margin-top: 10px; padding: 0 20px; }
            .action-buttons { display: flex; justify-content: center; gap: 10px; margin-top: 15px; }
            .btn-profile { padding: 8px 25px; border-radius: 6px; font-weight: bold; font-size: 14px; cursor: pointer; border: none; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
            .v-thumb { background: #1a1a1a; aspect-ratio: 9/16; position: relative; overflow: hidden; }
            .v-thumb video { width: 100%; height: 100%; object-fit: cover; }
            .thumb-stats { position: absolute; bottom: 5px; left: 5px; font-size: 11px; font-weight: bold; text-shadow: 0 1px 2px #000; }
            .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 200000; justify-content: center; align-items: center; }
            .modal-content { background: #1f1f1f; padding: 25px; border-radius: 12px; width: 320px; text-align: center; }
            .modal-content input { width: 100%; padding: 10px; margin: 8px 0; background: #2f2f2f; border: none; color: #fff; border-radius: 6px; box-sizing: border-box; }
        </style>
    </head>
    <body>
        <div class="profile-wrapper">
            <div class="banner"></div>
            <div class="profile-header">
                <div class="avatar">${avatarHTML}</div>
                <h2 style="margin: 5px 0;">${targetUser.nickname}</h2>
                <p style="color: #888; margin: 0; font-size: 13px;">@${targetUser.username}</p>
                
                <div class="stats">
                    <div><span>${followingCount}</span>Takip edilen</div>
                    <div><span>${followersCount}</span>Takipçi</div>
                    <div><span>${totalLikes}</span>Beğeni</div>
                </div>

                <div class="bio-box">${targetUser.bio}</div>

                <div class="action-buttons">
                    ${isMe ? `
                        <button class="btn-profile" style="background: #2f2f2f; color: #fff;" onclick="document.getElementById('editModal').style.display='flex'">Profili Düzenle</button>
                    ` : `
                        <a href="/follow/${targetUser._id}" class="btn-profile" style="background: ${isFollowing ? '#333' : '#FE2C55'}; color: #fff; line-height:30px;">${isFollowing ? 'Takiptesin' : 'Takip Et'}</a>
                        <a href="/chat/${targetUser.username}" class="btn-profile" style="background: #2f2f2f; color: #fff; line-height:30px;">Mesaj At</a>
                    `}
                </div>
            </div>

            <div class="grid">
                ${videoHTML || '<p style="grid-column: span 3; text-align: center; color: #666; padding: 40px;">Henüz video yok.</p>'}
            </div>
        </div>

        ${isMe ? `
        <div id="editModal" class="modal">
            <div class="modal-content">
                <h3>Profili Düzenle</h3>
                <form action="/update-profile" method="POST" enctype="multipart/form-data">
                    <label style="font-size:11px; color:#aaa; display:block; text-align:left;">Takma Ad:</label>
                    <input type="text" name="nickname" value="${targetUser.nickname}" required>
                    <label style="font-size:11px; color:#aaa; display:block; text-align:left;">Biyografi:</label>
                    <input type="text" name="bio" value="${targetUser.bio}" required>
                    <label style="font-size:11px; color:#aaa; display:block; text-align:left;">Profil Fotoğrafı:</label>
                    <input type="file" name="avatar" accept="image/*">
                    <label style="font-size:11px; color:#aaa; display:block; text-align:left;">Kapak (Banner):</label>
                    <input type="file" name="banner" accept="image/*">
                    <button type="submit" style="background:#FE2C55; color:#fff; padding:12px; border:none; border-radius:6px; width:100%; font-weight:bold; cursor:pointer; margin-top:15px;">Kaydet</button>
                    <button type="button" style="background:#333; color:#fff; padding:10px; border:none; border-radius:6px; width:100%; font-weight:bold; cursor:pointer; margin-top:8px;" onclick="document.getElementById('editModal').style.display='none'">İptal</button>
                </form>
            </div>
        </div>` : ''}

        ${getNavbar('profile', req.session.user.username)}
    </body>
    </html>
    `);
});

// 2. ESKİ & GELİŞTİRİLMİŞ KEŞFET / ARAMA SAYFASI
app.get('/search', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const query = req.query.q || '';
    let searchResultsVideos = [];
    let searchResultsUsers = [];

    if (query && isConnected) {
        searchResultsVideos = await videosCol.find({ caption: { $regex: query,$options: 'i' } }).toArray();
        searchResultsUsers = await usersCol.find({ 
            $or: [
                { username: { $regex: query,$options: 'i' } },
                { nickname: { $regex: query,$options: 'i' } }
            ] 
        }).toArray();
    }

    let resultsHTML = '';
    if (query) {
        resultsHTML += `<h3 style="padding: 15px 15px 5px 15px; font-size:16px;">Kullanıcılar</h3>`;
        if (searchResultsUsers.length > 0) {
            searchResultsUsers.forEach(u => {
                resultsHTML += `
                <a href="/profile/${u.username}" style="display:flex; align-items:center; gap:12px; padding:12px 15px; border-bottom:1px solid #1a1a1a;">
                    <div style="width:40px; height:40px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">${u.nickname.charAt(0).toUpperCase()}</div>
                    <div><b>${u.nickname}</b><div style="color:#888; font-size:12px;">@${u.username}</div></div>
                </a>`;
            });
        } else {
            resultsHTML += `<p style="padding: 0 15px; color:#777; font-size:14px;">Kullanıcı bulunamadı.</p>`;
        }

        resultsHTML += `<h3 style="padding: 20px 15px 5px 15px; font-size:16px;">Videolar</h3>`;
        if (searchResultsVideos.length > 0) {
            searchResultsVideos.forEach(v => {
                resultsHTML += `
                <div style="padding: 12px 15px; border-bottom:1px solid #1a1a1a; display:flex; justify-content:space-between; align-items:center;">
                    <div><b>@${v.username}</b><p style="margin:4px 0 0 0; font-size:13px; color:#ccc;">${v.caption}</p></div>
                    <video src="${v.filename}" style="width:50px; height:70px; object-fit:cover; border-radius:4px;"></video>
                </div>`;
            });
        } else {
            resultsHTML += `<p style="padding: 0 15px; color:#777; font-size:14px;">Video bulunamadı.</p>`;
        }
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Keşfet / Arama</title>
        <style>
            ${globalStyles}
            .search-header { display: flex; align-items: center; padding: 12px 15px; background: #121212; gap: 12px; border-bottom: 1px solid #222; }
            .search-bar { flex-grow: 1; display: flex; align-items: center; background: #262626; border-radius: 8px; padding: 8px 12px; gap: 8px; }
            .search-bar input { background: transparent; border: none; color: #fff; width: 100%; font-size: 14px; outline: none; }
            .suggestions { padding: 20px 15px; }
            .sug-title { font-weight: bold; font-size: 16px; margin-bottom: 15px; }
            .sug-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; color: #ddd; font-size: 15px; border-bottom: 1px solid #1a1a1a; }
            .dot { width: 6px; height: 6px; background: #FE2C55; border-radius: 50%; }
        </style>
    </head>
    <body>
        <div class="search-header">
            <a href="/" style="font-size: 20px;">←</a>
            <form action="/search" method="GET" class="search-bar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#888"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input type="text" name="q" placeholder="Kullanıcı veya video ara..." value="${query}" required>
            </form>
            <button type="submit" form="searchForm" style="background:none; border:none; color:#FE2C55; font-weight:bold; font-size:15px; cursor:pointer;">Ara</button>
        </div>
        <form id="searchForm" action="/search" method="GET"></form>
        ${query ? resultsHTML : `
        <div class="suggestions">
            <div class="sug-title">Popüler Aramalar ve Trendler</div>
            <a href="/search?q=dans" class="sug-item"><div class="dot"></div> dans trendleri</a>
            <a href="/search?q=komik" class="sug-item"><div class="dot"></div> komik videolar</a>
            <a href="/search?q=oyun" class="sug-item"><div class="dot"></div> oyun dünyası</a>
            <a href="/search?q=müzik" class="sug-item"><div class="dot"></div> müzik ve remix</a>
        </div>
        `}
        ${getNavbar('search', req.session.user.username)}
    </body>
    </html>
    `);
});

// Gelen Kutusu ve Mesajlaşma
app.get('/inbox', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const users = await usersCol.find({ _id: { $ne: new ObjectId(req.session.user._id) } }).toArray();

    let userListHTML = '';
    users.forEach(u => {
        userListHTML += `
        <a href="/chat/${u.username}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #1a1a1a;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:45px; height:45px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">${u.nickname.charAt(0).toUpperCase()}</div>
                <div>
                    <div style="font-weight:bold; font-size:14px;">${u.nickname}</div>
                    <div style="color:#888; font-size:12px;">@${u.username} ile sohbet et</div>
                </div>
            </div>
            <span style="color:#FE2C55; font-size:18px;">💬</span>
        </a>`;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gelen Kutusu</title>
        <style>${globalStyles}</style>
    </head>
    <body>
        <div style="padding: 15px; border-bottom: 1px solid #222; display:flex; justify-content:space-between; align-items:center;">
            <h2 style="margin: 0; font-size: 20px;">Gelen Kutusu & Mesajlar</h2>
            <a href="/upload-story-page" style="background:#FE2C55; color:#fff; padding:6px 14px; border-radius:15px; font-size:12px; font-weight:bold;">+ Hikaye Ekle</a>
        </div>
        ${userListHTML || '<p style="text-align:center; color:#666; margin-top:40px;">Sohbet edilecek başka kullanıcı yok.</p>'}
        ${getNavbar('inbox', req.session.user.username)}
    </body>
    </html>
    `);
});

// DM Sohbet Odası
app.get('/chat/:targetUser', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const target = await usersCol.findOne({ username: req.params.targetUser });
    if (!target) return res.send("Kullanıcı bulunamadı.");

    const myUser = req.session.user.username;
    const otherUser = target.username;

    const messages = await messagesCol.find({
        $or: [
            { sender: myUser, receiver: otherUser },
            { sender: otherUser, receiver: myUser }
        ]
    }).sort({ _id: 1 }).toArray();

    let chatHTML = '';
    messages.forEach(m => {
        const isMe = m.sender === myUser;
        chatHTML += `
        <div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:10px;">
            <div style="max-width:70%; background:${isMe ? '#FE2C55' : '#262626'}; color:#fff; padding:10px 14px; border-radius:16px; font-size:14px;">
                ${m.text}
            </div>
        </div>`;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sohbet - @${target.username}</title>
        <style>
            ${globalStyles}
            .chat-header { position:fixed; top:0; left:0; width:100%; height:55px; background:#121212; display:flex; align-items:center; padding:0 15px; gap:15px; border-bottom:1px solid #222; z-index:100; }
            .chat-box { padding:70px 15px 80px 15px; min-height:100vh; display:flex; flex-direction:column; justify-content:flex-end; box-sizing:border-box; }
            .chat-input { position:fixed; bottom:0; left:0; width:100%; padding:10px; background:#121212; display:flex; gap:10px; border-top:1px solid #222; }
            .chat-input input { flex-grow:1; background:#222; border:none; color:#fff; padding:12px; border-radius:20px; outline:none; font-size:14px; }
            .chat-input button { background:#FE2C55; color:#fff; border:none; padding:0 18px; border-radius:20px; font-weight:bold; cursor:pointer; }
        </style>
    </head>
    <body>
        <div class="chat-header">
            <a href="/inbox" style="font-size:22px;">←</a>
            <b>${target.nickname} (@${target.username})</b>
        </div>
        <div class="chat-box" id="chatBox">
            ${chatHTML || '<p style="text-align:center; color:#555;">Henüz mesaj yok. İlk mesajı sen gönder!</p>'}
        </div>
        <form action="/send-msg/${target.username}" method="POST" class="chat-input">
            <input type="text" name="text" placeholder="Mesaj yaz..." required autocomplete="off">
            <button type="submit">Gönder</button>
        </form>
        <script>window.scrollTo(0, document.body.scrollHeight);</script>
    </body>
    </html>
    `);
});

app.post('/send-msg/:targetUser', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    await messagesCol.insertOne({
        sender: req.session.user.username,
        receiver: req.params.targetUser,
        text: req.body.text,
        createdAt: new Date()
    });
    res.redirect('back');
});

// 3. ESKİ & GELİŞTİRİLMİŞ GİRİŞ / KAYIT OL SAYFASI
app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TikTok'a Hoş Geldiniz</title>
            <style>
                body { background: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
                .container { width: 100%; max-width: 380px; text-align: center; background: #161616; padding: 30px; border-radius: 12px; border: 1px solid #262626; }
                h2 { font-size: 24px; font-weight: bold; margin-bottom: 25px; color: #fff; }
                .form-group { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
                input { width: 100%; padding: 14px; background: #262626; border: none; border-radius: 6px; font-size: 15px; color: #fff; box-sizing: border-box; outline: none; }
                .btn-red { width: 100%; padding: 14px; background: #FE2C55; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer; }
                .footer-text { margin-top: 20px; font-size: 14px; color: #888; }
                .footer-text span { color: #FE2C55; font-weight: bold; cursor: pointer; }
                .hidden { display: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <div id="registerView">
                    <h2>TikTok'a Kaydolun</h2>
                    <form action="/register" method="POST" class="form-group">
                        <input type="text" name="username" placeholder="Kullanıcı adı" required>
                        <input type="text" name="nickname" placeholder="Takma ad (Görünen isim)" required>
                        <input type="password" name="password" placeholder="Şifre" required>
                        <button type="submit" class="btn-red">Kayıt Ol</button>
                    </form>
                </div>
                <div id="loginView" class="hidden">
                    <h2>TikTok'a Giriş Yap</h2>
                    <form action="/login" method="POST" class="form-group">
                        <input type="text" name="username" placeholder="Kullanıcı adı" required>
                        <input type="password" name="password" placeholder="Şifre" required>
                        <button type="submit" class="btn-red">Giriş Yap</button>
                    </form>
                </div>
                <div class="footer-text" id="footerText">
                    Zaten bir hesabınız var mı? <span onclick="toggleView()">Giriş yapın</span>
                </div>
            </div>
            <script>
                function toggleView() {
                    const reg = document.getElementById('registerView');
                    const log = document.getElementById('loginView');
                    const footer = document.getElementById('footerText');
                    if (reg.classList.contains('hidden')) {
                        reg.classList.remove('hidden');
                        log.classList.add('hidden');
                        footer.innerHTML = 'Zaten bir hesabınız var mı? <span onclick="toggleView()">Giriş yapın</span>';
                    } else {
                        reg.classList.add('hidden');
                        log.classList.remove('hidden');
                        footer.innerHTML = 'Hesabınız yok mu? <span onclick="toggleView()">Kayıt olun</span>';
                    }
                }
            </script>
        </body>
        </html>
        `);
    }

    const feedType = req.query.feed || 'foryou';
    let videos = [];

    if (isConnected) {
        if (feedType === 'following') {
            const followings = await followsCol.find({ follower_id: new ObjectId(req.session.user._id) }).toArray();
            const followingIds = followings.map(f => f.following_id);
            followingIds.push(new ObjectId(req.session.user._id));
            videos = await videosCol.find({ user_id: { $in: followingIds } }).sort({ _id: -1 }).toArray();
        } else {
            videos = await videosCol.find({}).sort({ _id: -1 }).toArray();
        }
    }

    const stories = isConnected ? await storiesCol.find({}).sort({ _id: -1 }).toArray() : [];

    let storiesHTML = `
    <div class="story-item" onclick="window.location='/upload-story-page'">
        <div class="story-ring plus">+</div>
        <span>Hikayen</span>
    </div>`;

    stories.forEach(s => {
        let mediaTag = s.mediaType === 'video' 
            ? `<video src="${s.mediaUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;"></video>`
            : `<img src="${s.mediaUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;

        storiesHTML += `
        <div class="story-item" onclick="viewStory('${s.mediaUrl}', '${s.mediaType}')">
            <div class="story-ring">${mediaTag}</div>
            <span>@${s.username}</span>
        </div>`;
    });

    let feedHTML = '';
    for (let v of videos) {
        const comments = await commentsCol.find({ video_id: v._id }).sort({ _id: -1 }).toArray();
        let commentList = '';
        comments.forEach(c => {
            commentList += `
            <div style="margin-bottom:12px; font-size:13px;">
                <b style="color:#FE2C55;">@${c.username}:</b> ${c.comment}
                ${c.image ? `<br><img src="${c.image}" style="max-width:140px; border-radius:8px; margin-top:6px;">` : ''}
            </div>`;
        });

        feedHTML += `
        <div class="video-container" data-id="${v._id}">
            <video id="vid-${v._id}" src="${v.filename}" loop playsinline></video>
            <div class="sound-toggle" onclick="toggleSound('vid-${v._id}', this)">🔊 Sesi Aç</div>
            <div class="fullscreen-btn" onclick="toggleFullscreen('vid-${v._id}')">⛶ Tam Ekran</div>
            <div class="video-info">
                <a href="/profile/${v.username}" style="font-weight: bold; font-size: 15px; text-shadow: 0 1px 2px #000;">@${v.username}</a>
                <p style="margin: 5px 0; font-size: 14px; text-shadow: 0 1px 2px #000;">${v.caption}</p>
                <p style="margin: 0; font-size: 12px; color: #ddd; text-shadow: 0 1px 2px #000;">🎵 ${v.song}</p>
            </div>
            <div class="sidebar-actions">
                <a href="/like/${v._id}" class="action-btn">❤️<span>${v.likes}</span></a>
                <a href="#" onclick="openComments('${v._id}'); return false;" class="action-btn">💬<span>${comments.length}</span></a>
                <a href="/favorite/${v._id}" class="action-btn">⭐<span>${v.favorites}</span></a>
                <a href="/share/${v._id}" onclick="alert('Video bağlantısı kopyalandı!');" class="action-btn">↗️<span>${v.shares}</span></a>
            </div>
            <div id="commentModal-${v._id}" class="comment-modal">
                <div class="comment-box">
                    <h3>Yorumlar (${comments.length})</h3>
                    <div class="comment-list">${commentList || '<p style="color:#666;">Henüz yorum yok.</p>'}</div>
                    <form action="/comment/${v._id}" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:8px;">
                        <input type="text" name="comment" placeholder="Yorum yaz veya çıkartma ekle..." style="padding:10px; background:#2f2f2f; border:none; color:#fff; border-radius:6px; outline:none;" autocomplete="off">
                        <label style="font-size:11px; color:#aaa;">Çıkartma / Fotoğraf Seç:</label>
                        <input type="file" name="image" accept="image/*" style="font-size:11px; color:#aaa;">
                        <button type="submit" class="comment-btn">Gönder</button>
                    </form>
                    <button type="button" class="close-comment" onclick="closeComments('${v._id}')">Kapat</button>
                </div>
            </div>
        </div>`;
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TikTok Akış</title>
        <style>
            ${globalStyles}
            body { overflow: hidden; }
            .top-tabs { position: fixed; top: 0; left: 0; width: 100%; height: 45px; background: rgba(0,0,0,0.5); backdrop-filter: blur(10px); display: flex; justify-content: center; align-items: center; gap: 25px; z-index: 1000; font-size: 15px; font-weight: bold; color: #aaa; }
            .top-tabs a { color: #aaa; text-decoration: none; }
            .top-tabs a.active { color: #fff; border-bottom: 2px solid #fff; padding-bottom: 4px; }
            .story-bar { position: fixed; top: 45px; left: 0; width: 100%; background: #000; display: flex; gap: 12px; padding: 10px 15px; overflow-x: auto; z-index: 999; border-bottom: 1px solid #1a1a1a; scrollbar-width: none; }
            .story-bar::-webkit-scrollbar { display: none; }
            .story-item { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; flex-shrink: 0; }
            .story-ring { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #25F4EE, #FE2C55); padding: 2px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            .story-ring.plus { background: #333; font-size: 24px; color: #fff; }
            .story-item span { font-size: 11px; color: #ccc; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            
            .feed-scroll { height: calc(100vh - 120px); margin-top: 120px; overflow-y: scroll; scroll-snap-type: y mandatory; }
            .video-container { width: 100vw; height: calc(100vh - 120px); scroll-snap-align: start; position: relative; display: flex; justify-content: center; align-items: center; background: #000; }
            video { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
            .video-info { position: absolute; bottom: 20px; left: 15px; z-index: 10; max-width: 70%; }
            .sidebar-actions { position: absolute; bottom: 30px; right: 15px; z-index: 10; display: flex; flex-direction: column; gap: 12px; align-items: center; }
            .action-btn { background: rgba(0,0,0,0.4); width: 42px; height: 42px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; color: #fff; text-decoration: none; }
            .action-btn span { font-size: 10px; margin-top: 1px; }
            .sound-toggle { position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 12px; border-radius: 15px; font-size: 12px; z-index: 15; cursor: pointer; border: 1px solid rgba(255,255,255,0.3); }
            .fullscreen-btn { position: absolute; top: 15px; right: 120px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 12px; border-radius: 15px; font-size: 12px; z-index: 15; cursor: pointer; border: 1px solid rgba(255,255,255,0.3); }
            
            .comment-modal { display: none; position: fixed; bottom: 0; left: 0; width: 100%; height: 60vh; background: #1a1a1a; z-index: 3000; border-top-left-radius: 16px; border-top-right-radius: 16px; box-sizing: border-box; padding: 15px; flex-direction: column; justify-content: space-between; }
            .comment-box { display: flex; flex-direction: column; height: 100%; }
            .comment-list { flex-grow: 1; overflow-y: scroll; margin: 10px 0; }
            .comment-btn { background: #FE2C55; color: #fff; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; }
            .close-comment { background: #333; color: #fff; border: none; padding: 8px; border-radius: 6px; margin-top: 6px; cursor: pointer; width: 100%; }

            .story-viewer { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #000; z-index: 9000; justify-content: center; align-items: center; }
            .story-viewer-close { position: absolute; top: 20px; right: 20px; font-size: 24px; color: #fff; cursor: pointer; z-index: 9001; }
        </style>
        <script>
            let globalMutedState = true;

            function toggleSound(id, btn) {
                const vid = document.getElementById(id);
                if (vid.muted) {
                    vid.muted = false;
                    vid.play();
                    globalMutedState = false;
                    btn.innerText = "🔇 Sesi Kapat";
                } else {
                    vid.muted = true;
                    globalMutedState = true;
                    btn.innerText = "🔊 Sesi Aç";
                }
            }

            function toggleFullscreen(id) {
                const vid = document.getElementById(id);
                if (vid.requestFullscreen) vid.requestFullscreen();
                else if (vid.webkitRequestFullscreen) vid.webkitRequestFullscreen();
            }

            function openComments(id) { document.getElementById('commentModal-' + id).style.display = 'flex'; }
            function closeComments(id) { document.getElementById('commentModal-' + id).style.display = 'none'; }

            function viewStory(url, type) {
                const viewer = document.getElementById('storyViewer');
                const content = document.getElementById('storyViewerContent');
                if (type === 'video') {
                    content.innerHTML = '<video src="' + url + '" autoplay controls style="max-width:100%; max-height:100%;"></video>';
                } else {
                    content.innerHTML = '<img src="' + url + '" style="max-width:100%; max-height:100%; object-fit:contain;">';
                }
                viewer.style.display = 'flex';
            }
            function closeStory() {
                document.getElementById('storyViewer').style.display = 'none';
                document.getElementById('storyViewerContent').innerHTML = '';
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
        <div id="storyViewer" class="story-viewer">
            <div class="story-viewer-close" onclick="closeStory()">✕</div>
            <div id="storyViewerContent" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;"></div>
        </div>

        <div class="top-tabs">
            <a href="/?feed=following" class="${feedType === 'following' ? 'active' : ''}">Takip edilen</a>
            <a href="/?feed=foryou" class="${feedType === 'foryou' ? 'active' : ''}">Sizin için</a>
        </div>

        <div class="story-bar">${storiesHTML}</div>

        <div class="feed-scroll">
            ${feedHTML || '<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:#666; text-align:center; padding:20px;">' + (feedType === 'following' ? 'Takip ettiğin kişilerin henüz videosu yok.' : 'Henüz video yok. Alttaki "+" butonuna basarak video paylaş!') + '</div>'}
        </div>
        ${getNavbar('home', req.session.user.username)}
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
});

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URL = process.env.MONGO_URL || "mongodb+srv://cinarsucu04_db_user:46vjLI7sNK7djBeE@cluster0.utveet0.mongodb.net/?retryWrites=true&w=majority";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

let db, usersCol, videosCol, commentsCol, followsCol, likesCol;
let isConnected = false;

MongoClient.connect(MONGO_URL)
    .then(client => {
        db = client.db('tiktok_db');
        usersCol = db.collection('users');
        videosCol = db.collection('videos');
        commentsCol = db.collection('comments');
        followsCol = db.collection('follows');
        likesCol = db.collection('likes');
        isConnected = true;
        console.log("MongoDB bulut veritabanına başarıyla bağlandı!");
    })
    .catch(err => console.error("Veritabanı bağlantı hatası:", err));

const upload = multer({ storage: multer.memoryStorage() });

const uploadToCloudinary = (fileBuffer, resourceType = 'auto') => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: resourceType },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        uploadStream.end(fileBuffer);
    });
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
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
    body { background: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding-bottom: 60px; }
    a { text-decoration: none; color: inherit; }
    .tiktok-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 55px; background: #121212; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid #222; z-index: 1000; }
    .tiktok-nav a { display: flex; flex-direction: column; align-items: center; color: #888; font-size: 10px; gap: 3px; }
    .tiktok-nav a.active { color: #fff; }
    .plus-btn { position: relative; top: -5px; }
    .plus-icon { width: 40px; height: 26px; background: linear-gradient(90deg, #25F4EE 0%, #FE2C55 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #000; font-size: 22px; font-weight: bold; }
`;

app.post('/register', async (req, res) => {
    if (!isConnected) return res.send("<script>alert('Veritabanı henüz bağlanıyor, lütfen 5 saniye sonra tekrar deneyin!'); window.location='/';</script>");
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
            bio: 'Biyografi eklenmedi...',
            avatar: '',
            banner: ''
        });
        res.send("<script>alert('Kayıt başarılı! Giriş yapabilirsiniz.'); window.location='/';</script>");
    } catch (err) {
        res.send(`<script>alert('Kayıt Hatası: ${err.message.replace(/'/g, "\\'")}'); window.location='/';</script>`);
    }
});

app.post('/login', async (req, res) => {
    if (!isConnected) return res.send("<script>alert('Veritabanı henüz bağlanıyor, lütfen 5 saniye sonra tekrar deneyin!'); window.location='/';</script>");
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
        res.send(`<script>alert('Giriş Hatası: ${err.message.replace(/'/g, "\\'")}'); window.location='/';</script>`);
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.get('/search', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const query = req.query.q || '';
    
    let searchResultsVideos = [];
    let searchResultsUsers = [];

    if (query && isConnected) {
        searchResultsVideos = await videosCol.find({ 
            $or: [
                { caption: { $regex: query,$options: 'i' } },
                { username: { $regex: query,$options: 'i' } }
            ] 
        }).toArray();

        searchResultsUsers = await usersCol.find({ 
            $or: [
                { username: { $regex: query,$options: 'i' } },
                { nickname: { $regex: query,$options: 'i' } }
            ] 
        }).toArray();
    }

    let resultsHTML = '';
    if (query) {
        resultsHTML += `<h3 style="padding: 10px 15px; font-size:16px;">Kullanıcılar</h3>`;
        if (searchResultsUsers.length > 0) {
            searchResultsUsers.forEach(u => {
                resultsHTML += `
                <a href="/profile/${u.username}" style="display:flex; align-items:center; gap:10px; padding:10px 15px; border-bottom:1px solid #1a1a1a;">
                    <div style="width:40px; height:40px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">${u.nickname.charAt(0).toUpperCase()}</div>
                    <div><b>${u.nickname}</b><div style="color:#888; font-size:12px;">@${u.username}</div></div>
                </a>`;
            });
        } else {
            resultsHTML += `<p style="padding: 0 15px; color:#777; font-size:14px;">Kullanıcı bulunamadı.</p>`;
        }

        resultsHTML += `<h3 style="padding: 15px 15px 5px 15px; font-size:16px;">Videolar</h3>`;
        if (searchResultsVideos.length > 0) {
            searchResultsVideos.forEach(v => {
                resultsHTML += `
                <div style="padding: 10px 15px; border-bottom:1px solid #1a1a1a; display:flex; justify-content:space-between; align-items:center;">
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
            .search-header { display: flex; align-items: center; padding: 12px 15px; background: #121212; gap: 10px; border-bottom: 1px solid #222; }
            .search-bar { flex-grow: 1; display: flex; align-items: center; background: #262626; border-radius: 8px; padding: 8px 12px; gap: 8px; }
            .search-bar input { background: transparent; border: none; color: #fff; width: 100%; font-size: 14px; outline: none; }
            .suggestions { padding: 15px; }
            .sug-title { font-weight: bold; font-size: 16px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
            .sug-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; color: #ddd; font-size: 15px; border-bottom: 1px solid #1a1a1a; }
            .dot { width: 6px; height: 6px; background: #FE2C55; border-radius: 50%; }
        </style>
    </head>
    <body>
        <div class="search-header">
            <a href="/" style="font-size: 20px;">←</a>
            <form action="/search" method="GET" class="search-bar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#888"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input type="text" name="q" placeholder="spor, eğlence, dans..." value="${query}" required>
                <span style="color:#888;">🎤</span>
            </form>
            <button type="submit" form="searchForm" style="background:none; border:none; color:#FE2C55; font-weight:bold; font-size:15px; cursor:pointer;">Ara</button>
        </div>

        <form id="searchForm" action="/search" method="GET"></form>

        ${query ? resultsHTML : `
        <div class="suggestions">
            <div class="sug-title">Şunları beğenebilirsiniz <span style="font-size:12px; color:#888; font-weight:normal;">Yenile ↻</span></div>
            <a href="/search?q=Vinland saga" class="sug-item"><div class="dot"></div> Vinland saga</a>
            <a href="/search?q=motivasyon" class="sug-item"><div class="dot"></div> motivasyon</a>
            <a href="/search?q=calisthenics" class="sug-item"><div style="width:6px; height:6px; background:#888; border-radius:50%;"></div> calisthenics hareketleri</a>
            <a href="/search?q=komik" class="sug-item"><div style="width:6px; height:6px; background:#888; border-radius:50%;"></div> komik videolar</a>
            <a href="/search?q=oyun" class="sug-item"><div style="width:6px; height:6px; background:#888; border-radius:50%;"></div> oyun dünyası</a>
            <a href="/search?q=tarih" class="sug-item"><div style="width:6px; height:6px; background:#888; border-radius:50%;"></div> Tarih Videoları</a>
            <a href="/search?q=disiplin" class="sug-item"><div style="width:6px; height:6px; background:#888; border-radius:50%;"></div> sessiz disiplin</a>
        </div>
        `}

        ${getNavbar('search', req.session.user.username)}
    </body>
    </html>
    `);
});

app.get('/upload-page', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Video Düzenle ve Paylaş</title>
        <style>
            ${globalStyles}
            .editor-container { position: relative; width: 100vw; height: calc(100vh - 55px); background: #111; display: flex; flex-direction: column; justify-content: space-between; align-items: center; box-sizing: border-box; padding: 20px; }
            .top-bar { width: 100%; display: flex; justify-content: center; }
            .sound-badge { background: rgba(0,0,0,0.6); border: 1px solid #444; padding: 8px 16px; border-radius: 20px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
            .side-tools { position: absolute; right: 15px; top: 70px; display: flex; flex-direction: column; gap: 15px; align-items: center; }
            .tool-icon { width: 38px; height: 38px; background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 1px solid rgba(255,255,255,0.2); }
            .form-box { width: 100%; background: rgba(20,20,20,0.9); padding: 15px; border-radius: 12px; display: flex; flex-direction: column; gap: 10px; }
            .form-box input { width: 100%; padding: 10px; background: #2a2a2a; border: none; color: #fff; border-radius: 6px; box-sizing: border-box; }
            .publish-btn { background: #FE2C55; color: #fff; padding: 12px; border: none; border-radius: 6px; font-weight: bold; font-size: 15px; cursor: pointer; text-align: center; }
        </style>
    </head>
    <body>
        <div class="editor-container">
            <div class="top-bar">
                <div class="sound-badge">🎵 <input type="text" name="song" form="uploadForm" value="Orijinal Ses - ${req.session.user.nickname}" style="background:transparent; border:none; color:#fff; font-size:12px; outline:none;"></div>
            </div>
            <div class="side-tools">
                <div class="tool-icon">⚙️</div>
                <div class="tool-icon">↗️</div>
                <div class="tool-icon">✂️</div>
                <div class="tool-icon">Aa</div>
                <div class="tool-icon">✨</div>
            </div>
            <form id="uploadForm" action="/upload" method="POST" enctype="multipart/form-data" class="form-box">
                <input type="text" name="caption" placeholder="Açıklama ekle, #etiketle..." required>
                <label style="font-size: 12px; color: #aaa;">Galeriden Video Seç:</label>
                <input type="file" name="video" accept="video/*" required>
                <button type="submit" class="publish-btn">Paylaş</button>
            </form>
        </div>
        ${getNavbar('home', req.session.user.username)}
    </body>
    </html>
    `);
});

app.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    try {
        let videoUrl = '';
        if (req.file) {
            const cloudRes = await uploadToCloudinary(req.file.buffer, 'video');
            videoUrl = cloudRes.secure_url;
        }

        const { caption, song } = req.body;
        const videoSong = song || 'Orijinal Ses';

        await videosCol.insertOne({
            user_id: new ObjectId(req.session.user._id),
            username: req.session.user.username,
            caption,
            filename: videoUrl,
            song: videoSong,
            likes: 0,
            favorites: 0,
            shares: 0
        });
        res.redirect('/');
    } catch (err) {
        console.error("Video yükleme hatası:", err);
        res.redirect('/');
    }
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

app.post('/comment/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const { comment } = req.body;
    await commentsCol.insertOne({
        video_id: new ObjectId(req.params.id),
        username: req.session.user.username,
        comment
    });
    res.redirect('back');
});

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

app.post('/update-profile', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    try {
        const { nickname, bio } = req.body;
        const userId = new ObjectId(req.session.user._id);

        let avatarFile = req.session.user.avatar;
        if (req.files && req.files['avatar']) {
            const avatarRes = await uploadToCloudinary(req.files['avatar'][0].buffer, 'image');
            avatarFile = avatarRes.secure_url;
        }

        let bannerFile = req.session.user.banner;
        if (req.files && req.files['banner']) {
            const bannerRes = await uploadToCloudinary(req.files['banner'][0].buffer, 'image');
            bannerFile = bannerRes.secure_url;
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
        console.error("Profil güncelleme hatası:", err);
        res.redirect(`/profile/${req.session.user.username}`);
    }
});

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

    let videoHTML = '';
    videos.forEach(v => {
        videoHTML += `
        <div class="v-thumb">
            <video src="${v.filename}" muted></video>
            <div class="thumb-stats">❤️ ${v.likes}</div>
        </div>`;
    });

    let isMe = req.session.user._id.toString() === targetUser._id.toString();
    let isFollowing = !!followCheck;
    
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
            .banner { width: 100%; height: 140px; background-image: ${bannerBg}; background-size: cover; background-position: center; position: relative; }
            .profile-header { text-align: center; padding: 0 15px 20px 15px; background: #000; position: relative; }
            .avatar { width: 85px; height: 85px; background: #FE2C55; border: 4px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: -45px auto 10px auto; font-weight: bold; position: relative; z-index: 2; overflow: hidden; }
            .stats { display: flex; justify-content: center; gap: 20px; margin: 15px 0; font-size: 14px; }
            .stats div span { display: block; font-weight: bold; font-size: 16px; }
            .bio-box { color: #ccc; font-size: 13px; margin-top: 10px; }
            .action-buttons { display: flex; justify-content: center; gap: 10px; margin-top: 15px; }
            .btn-profile { padding: 8px 25px; border-radius: 4px; font-weight: bold; font-size: 14px; cursor: pointer; border: none; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
            .v-thumb { background: #1a1a1a; aspect-ratio: 9/16; position: relative; overflow: hidden; }
            .v-thumb video { width: 100%; height: 100%; object-fit: cover; }
            .thumb-stats { position: absolute; bottom: 5px; left: 5px; font-size: 11px; font-weight: bold; text-shadow: 0 1px 2px #000; }
            .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 2000; justify-content: center; align-items: center; }
            .modal-content { background: #1f1f1f; padding: 20px; border-radius: 12px; width: 300px; text-align: center; }
            .modal-content input { width: 100%; padding: 10px; margin: 8px 0; background: #2f2f2f; border: none; color: #fff; border-radius: 6px; box-sizing: border-box; }
        </style>
    </head>
    <body>
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
                    <a href="/follow/${targetUser._id}" class="btn-profile" style="background: ${isFollowing ? '#333' : '#FE2C55'}; color: #fff; text-decoration:none; line-height:30px;">${isFollowing ? 'Takiptesin' : 'Takip Et'}</a>
                `}
            </div>
        </div>

        <div class="grid">
            ${videoHTML || '<p style="grid-column: span 3; text-align: center; color: #666; padding: 40px;">Henüz video yok.</p>'}
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
                    <label style="font-size:11px; color:#aaa; display:block; text-align:left;">Banner:</label>
                    <input type="file" name="banner" accept="image/*">
                    <button type="submit" style="background:#FE2C55; color:#fff; padding:10px; border:none; border-radius:6px; width:100%; font-weight:bold; cursor:pointer; margin-top:10px;">Kaydet</button>
                    <button type="button" style="background:#333; color:#fff; padding:10px; border:none; border-radius:6px; width:100%; font-weight:bold; cursor:pointer; margin-top:5px;" onclick="document.getElementById('editModal').style.display='none'">İptal</button>
                </form>
            </div>
        </div>` : ''}

        ${getNavbar('profile', req.session.user.username)}
    </body>
    </html>
    `);
});

app.get('/friends', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const users = await usersCol.find({ _id: { $ne: new ObjectId(req.session.user._id) } }).toArray();
    let listHTML = '';
    users.forEach(u => {
        listHTML += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; border-bottom: 1px solid #1a1a1a;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 45px; height: 45px; background: #FE2C55; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">${u.nickname.charAt(0).toUpperCase()}</div>
                <div>
                    <a href="/profile/${u.username}" style="font-weight: bold; font-size: 14px;">${u.nickname}</a>
                    <div style="color: #888; font-size: 12px;">@${u.username}</div>
                </div>
            </div>
            <a href="/profile/${u.username}" style="background: #FE2C55; color: #fff; padding: 6px 15px; border-radius: 4px; font-size: 12px; font-weight: bold;">Profili Gör</a>
        </div>`;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Arkadaşlar</title>
        <style>${globalStyles}</style>
    </head>
    <body>
        <h3 style="padding: 15px; margin: 0; border-bottom: 1px solid #222;">Kullanıcılar</h3>
        ${listHTML || '<p style="text-align:center; color:#666; margin-top:50px;">Başka kullanıcı yok.</p>'}
        ${getNavbar('friends', req.session.user.username)}
    </body>
    </html>
    `);
});

app.get('/inbox', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gelen kutusu</title>
        <style>${globalStyles}</style>
    </head>
    <body>
        <h2 style="padding: 15px; margin: 0; border-bottom: 1px solid #222;">Gelen kutusu</h2>
        <div style="padding: 40px; text-align: center; color: #666;">
            <p>Yeni bildirim bulunmuyor.</p>
        </div>
        ${getNavbar('inbox', req.session.user.username)}
    </body>
    </html>
    `);
});

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
                .hidden { display: none; }
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
                <div id="loginView" class="hidden">
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
                    if (reg.classList.contains('hidden')) {
                        reg.classList.remove('hidden');
                        log.classList.add('hidden');
                        footer.innerHTML = 'Zaten bir hesabınız var mı? <span onclick="toggleView()">Giriş yap</span>';
                    } else {
                        reg.classList.add('hidden');
                        log.classList.remove('hidden');
                        footer.innerHTML = 'Hesabınız yok mu? <span onclick="toggleView()">Kayıt ol</span>';
                    }
                }
            </script>
        </body>
        </html>
        `);
    }

    const videos = isConnected ? await videosCol.find({}).sort({ _id: -1 }).toArray() : [];
    let feedHTML = '';
    
    for (let v of videos) {
        const comments = await commentsCol.find({ video_id: v._id }).sort({ _id: -1 }).toArray();
        let commentList = '';
        comments.forEach(c => {
            commentList += `<div style="margin-bottom:8px; font-size:13px;"><b style="color:#FE2C55;">@${c.username}:</b> ${c.comment}</div>`;
        });

        feedHTML += `
        <div class="video-container">
            <video id="vid-${v._id}" src="${v.filename}" loop playsinline></video>
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
                <a href="/share/${v._id}" onclick="alert('Video bağlantısı kopyalandı!');" class="action-btn">↗️<span>${v.shares}</span></a>
            </div>
            <div id="commentModal-${v._id}" class="comment-modal">
                <div class="comment-box">
                    <h3>Yorumlar (${comments.length})</h3>
                    <div class="comment-list">${commentList || '<p style="color:#666;">Henüz yorum yok.</p>'}</div>
                    <form action="/comment/${v._id}" method="POST">
                        <input type="text" name="comment" placeholder="Yorum yaz..." required>
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
            .feed-scroll { height: calc(100vh - 55px); overflow-y: scroll; scroll-snap-type: y mandatory; }
            .video-container { width: 100vw; height: calc(100vh - 55px); scroll-snap-align: start; position: relative; display: flex; justify-content: center; align-items: center; background: #000; }
            video { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
            .video-info { position: absolute; bottom: 20px; left: 15px; z-index: 10; max-width: 70%; }
            .sidebar-actions { position: absolute; bottom: 30px; right: 15px; z-index: 10; display: flex; flex-direction: column; gap: 12px; align-items: center; }
            .action-btn { background: rgba(0,0,0,0.4); width: 42px; height: 42px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; color: #fff; text-decoration: none; }
            .action-btn span { font-size: 10px; margin-top: 1px; }
            .sound-toggle { position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 12px; border-radius: 15px; font-size: 12px; z-index: 15; cursor: pointer; border: 1px solid rgba(255,255,255,0.3); }
            .comment-modal { display: none; position: fixed; bottom: 0; left: 0; width: 100%; height: 60vh; background: #1a1a1a; z-index: 3000; border-top-left-radius: 16px; border-top-right-radius: 16px; box-sizing: border-box; padding: 15px; flex-direction: column; justify-content: space-between; }
            .comment-box { display: flex; flex-direction: column; height: 100%; }
            .comment-list { flex-grow: 1; overflow-y: scroll; margin: 10px 0; }
            .comment-box input { width: 100%; padding: 10px; background: #2f2f2f; border: none; color: #fff; border-radius: 6px; box-sizing: border-box; }
            .comment-btn { background: #FE2C55; color: #fff; border: none; padding: 8px; border-radius: 6px; font-weight: bold; margin-top: 5px; cursor: pointer; width: 100%; }
            .close-comment { background: #333; color: #fff; border: none; padding: 6px; border-radius: 6px; margin-top: 5px; cursor: pointer; width: 100%; }
        </style>
        <script>
            function toggleSound(id, btn) {
                const vid = document.getElementById(id);
                if (vid.muted) {
                    vid.muted = false;
                    vid.play();
                    btn.innerText = "🔇 Sesi Kapat";
                } else {
                    vid.muted = true;
                    btn.innerText = "🔊 Sesi Aç";
                }
            }
            function openComments(id) { document.getElementById('commentModal-' + id).style.display = 'flex'; }
            function closeComments(id) { document.getElementById('commentModal-' + id).style.display = 'none'; }
        </script>
    </head>
    <body>
        <div class="feed-scroll">
            ${feedHTML || '<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:#666;">Henüz video yok. Alttaki "+" butonuna basarak video paylaş!</div>'}
        </div>
        ${getNavbar('home', req.session.user.username)}
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
});

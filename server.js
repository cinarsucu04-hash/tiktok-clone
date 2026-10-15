const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const db = new sqlite3.Database('./users.db');

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/uploads', express.static(uploadDir));
app.use(session({
    secret: 'tiktok-exact-match-key',
    resave: false,
    saveUninitialized: true
}));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        nickname TEXT,
        password TEXT,
        bio TEXT DEFAULT 'Biyografi eklenmedi...',
        avatar TEXT DEFAULT '',
        banner TEXT DEFAULT ''
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        caption TEXT,
        filename TEXT,
        song TEXT DEFAULT 'Orijinal Ses',
        likes INTEGER DEFAULT 0,
        favorites INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER,
        username TEXT,
        comment TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS follows (
        follower_id INTEGER,
        following_id INTEGER
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS likes (
        user_id INTEGER,
        video_id INTEGER
    )`);
});

function getNavbar(activeTab, username) {
    return `
    <div class="tiktok-nav">
        <a href="/" class="${activeTab === 'home' ? 'active' : ''}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 9v11h6v-6h6v6h6V9l-9-7z"/></svg>
            <span>Ana sayfa</span>
        </a>
        <a href="/friends" class="${activeTab === 'friends' ? 'active' : ''}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            <span>Arkadaşlar</span>
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

// Kayıt Ol
app.post('/register', async (req, res) => {
    const { username, nickname, password } = req.body;
    if (!username || !nickname || !password) return res.send("<script>alert('Tüm alanları doldurun!'); window.location='/';</script>");

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, nickname, password) VALUES (?, ?, ?)`, 
            [username.toLowerCase().trim(), nickname, hashedPassword], 
            (err) => {
                if (err) return res.send("<script>alert('Bu kullanıcı adı zaten alınmış!'); window.location='/';</script>");
                res.send("<script>alert('Kayıt başarılı! Giriş yapabilirsiniz.'); window.location='/';</script>");
            }
        );
    } catch {
        res.send("<script>alert('Bir hata oluştu.'); window.location='/';</script>");
    }
});

// Giriş Yap
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username.toLowerCase().trim()], async (err, user) => {
        if (err || !user) return res.send("<script>alert('Kullanıcı bulunamadı!'); window.location='/';</script>");
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = user;
            res.redirect('/');
        } else {
            res.send("<script>alert('Hatalı şifre!'); window.location='/';</script>");
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
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

app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const { caption, song } = req.body;
    const filename = req.file ? req.file.filename : '';
    const videoSong = song || 'Orijinal Ses';

    db.run(`INSERT INTO videos (user_id, username, caption, filename, song) VALUES (?, ?, ?, ?, ?)`, 
        [req.session.user.id, req.session.user.username, caption, filename, videoSong], 
        () => res.redirect('/')
    );
});

app.get('/like/:id', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const userId = req.session.user.id;
    const videoId = req.params.id;

    db.get(`SELECT * FROM likes WHERE user_id = ? AND video_id = ?`, [userId, videoId], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO likes (user_id, video_id) VALUES (?, ?)`, [userId, videoId]);
            db.run(`UPDATE videos SET likes = likes + 1 WHERE id = ?`, [videoId], () => res.redirect('back'));
        } else {
            db.run(`DELETE FROM likes WHERE user_id = ? AND video_id = ?`, [userId, videoId]);
            db.run(`UPDATE videos SET likes = likes - 1 WHERE id = ?`, [videoId], () => res.redirect('back'));
        }
    });
});

app.get('/favorite/:id', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    db.run(`UPDATE videos SET favorites = favorites + 1 WHERE id = ?`, [req.params.id], () => res.redirect('back'));
});

app.get('/share/:id', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    db.run(`UPDATE videos SET shares = shares + 1 WHERE id = ?`, [req.params.id], () => res.redirect('back'));
});

app.post('/comment/:id', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const { comment } = req.body;
    db.run(`INSERT INTO comments (video_id, username, comment) VALUES (?, ?, ?)`, 
        [req.params.id, req.session.user.username, comment], 
        () => res.redirect('back')
    );
});

app.get('/follow/:id', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const followerId = req.session.user.id;
    const followingId = req.params.id;
    if (followerId == followingId) return res.redirect('back');

    db.get(`SELECT * FROM follows WHERE follower_id = ? AND following_id = ?`, [followerId, followingId], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`, [followerId, followingId], () => res.redirect('back'));
        } else {
            db.run(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`, [followerId, followingId], () => res.redirect('back'));
        }
    });
});

// Profil Güncelleme (Takma Ad, Biyografi, Avatar, Banner)
app.post('/update-profile', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const { nickname, bio } = req.body;
    const avatarFile = req.files && req.files['avatar'] ? req.files['avatar'][0].filename : req.session.user.avatar;
    const bannerFile = req.files && req.files['banner'] ? req.files['banner'][0].filename : req.session.user.banner;
    const newNickname = nickname || req.session.user.nickname;

    db.run(`UPDATE users SET nickname = ?, bio = ?, avatar = ?, banner = ? WHERE id = ?`, [newNickname, bio, avatarFile, bannerFile, req.session.user.id], () => {
        req.session.user.nickname = newNickname;
        req.session.user.bio = bio;
        req.session.user.avatar = avatarFile;
        req.session.user.banner = bannerFile;
        res.redirect(`/profile/${req.session.user.username}`);
    });
});

app.get('/profile/:username', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const targetUsername = req.params.username;

    db.get(`SELECT * FROM users WHERE username = ?`, [targetUsername], (err, targetUser) => {
        if (!targetUser) return res.send("Kullanıcı bulunamadı.");

        db.all(`SELECT * FROM videos WHERE user_id = ? ORDER BY id DESC`, [targetUser.id], (err, videos) => {
            db.get(`SELECT COUNT(*) as count FROM follows WHERE follower_id = ? AND following_id = ?`, 
                [req.session.user.id, targetUser.id], (err, followCheck) => {
                db.get(`SELECT COUNT(*) as followersCount FROM follows WHERE following_id = ?`, [targetUser.id], (err, fCount) => {
                    db.get(`SELECT COUNT(*) as followingCount FROM follows WHERE follower_id = ?`, [targetUser.id], (err, followingCountRes) => {
                        db.get(`SELECT SUM(likes) as totalLikes FROM videos WHERE user_id = ?`, [targetUser.id], (err, likesRes) => {

                            let videoHTML = '';
                            videos.forEach(v => {
                                videoHTML += `
                                <div class="v-thumb">
                                    <video src="/uploads/${v.filename}" muted></video>
                                    <div class="thumb-stats">❤️ ${v.likes}</div>
                                </div>`;
                            });

                            let isMe = req.session.user.id === targetUser.id;
                            let isFollowing = followCheck && followCheck.count > 0;
                            let totalLikes = likesRes.totalLikes || 0;
                            let bannerBg = targetUser.banner ? `url('/uploads/${targetUser.banner}')` : 'linear-gradient(135deg, #2b2b2b, #111)';
                            let avatarHTML = targetUser.avatar ? `<img src="/uploads/${targetUser.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : targetUser.nickname.charAt(0).toUpperCase();

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
                                        <div><span>${followingCountRes.followingCount}</span>Takip edilen</div>
                                        <div><span>${fCount.followersCount}</span>Takipçi</div>
                                        <div><span>${totalLikes}</span>Beğeni</div>
                                    </div>

                                    <div class="bio-box">${targetUser.bio}</div>

                                    <div class="action-buttons">
                                        ${isMe ? `
                                            <button class="btn-profile" style="background: #2f2f2f; color: #fff;" onclick="document.getElementById('editModal').style.display='flex'">Profili Düzenle</button>
                                        ` : `
                                            <a href="/follow/${targetUser.id}" class="btn-profile" style="background: ${isFollowing ? '#333' : '#FE2C55'}; color: #fff; text-decoration:none; line-height:30px;">${isFollowing ? 'Takiptesin' : 'Takip Et'}</a>
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
                                            <label style="font-size:11px; color:#aaa; display:block; text-align:left;">Takma Ad (Görünen İsim):</label>
                                            <input type="text" name="nickname" value="${targetUser.nickname}" required>
                                            <label style="font-size:11px; color:#aaa; display:block; text-align:left;">Biyografi:</label>
                                            <input type="text" name="bio" value="${targetUser.bio}" required>
                                            <label style="font-size:11px; color:#aaa; display:block; text-align:left;">Profil Fotoğrafı (Avatar):</label>
                                            <input type="file" name="avatar" accept="image/*">
                                            <label style="font-size:11px; color:#aaa; display:block; text-align:left;">Banner (Kapak Fotoğrafı):</label>
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
                    });
                });
            });
        });
    });
});

app.get('/friends', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    db.all(`SELECT * FROM users WHERE id != ?`, [req.session.user.id], (err, users) => {
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

// Ana Sayfa (Gönderdiğin fotoğraftaki gibi TikTok Giriş/Kayıt Tasarımı)
app.get('/', (req, res) => {
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
                <!-- Kayıt Ol Ekranı -->
                <div id="registerView">
                    <h2 id="titleText">TikTok'a kaydolun</h2>
                    <form action="/register" method="POST" class="form-group">
                        <input type="text" name="username" placeholder="Kullanıcı adı" required>
                        <input type="text" name="nickname" placeholder="Takma ad (Görünen isim)" required>
                        <input type="password" name="password" placeholder="Şifre" required>
                        <button type="submit" class="btn-red">Kayıt Ol</button>
                    </form>
                </div>

                <!-- Giriş Yap Ekranı -->
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

    db.all(`SELECT * FROM videos ORDER BY id DESC`, [], (err, videos) => {
        let feedHTML = '';
        let processedCount = 0;
        if (videos.length === 0) renderFeed('');

        videos.forEach(v => {
            db.all(`SELECT * FROM comments WHERE video_id = ? ORDER BY id DESC`, [v.id], (err, comments) => {
                let commentList = '';
                comments.forEach(c => {
                    commentList += `<div style="margin-bottom:8px; font-size:13px;"><b style="color:#FE2C55;">@${c.username}:</b> ${c.comment}</div>`;
                });

                feedHTML += `
                <div class="video-container">
                    <video id="vid-${v.id}" src="/uploads/${v.filename}" loop playsinline></video>
                    
                    <div class="sound-toggle" onclick="toggleSound('vid-${v.id}', this)">🔊 Sesi Aç</div>

                    <div class="video-info">
                        <a href="/profile/${v.username}" style="font-weight: bold; font-size: 15px; text-shadow: 0 1px 2px #000;">@${v.username}</a>
                        <p style="margin: 5px 0; font-size: 14px; text-shadow: 0 1px 2px #000;">${v.caption}</p>
                        <p style="margin: 0; font-size: 12px; color: #ddd; text-shadow: 0 1px 2px #000;">🎵 ${v.song}</p>
                    </div>

                    <div class="sidebar-actions">
                        <a href="/like/${v.id}" class="action-btn">❤️<span>${v.likes}</span></a>
                        <a href="#" onclick="openComments(${v.id}); return false;" class="action-btn">💬<span>${comments.length}</span></a>
                        <a href="/favorite/${v.id}" class="action-btn">⭐<span>${v.favorites}</span></a>
                        <a href="/share/${v.id}" onclick="alert('Video bağlantısı kopyalandı!');" class="action-btn">↗️<span>${v.shares}</span></a>
                    </div>

                    <div id="commentModal-${v.id}" class="comment-modal">
                        <div class="comment-box">
                            <h3>Yorumlar (${comments.length})</h3>
                            <div class="comment-list">${commentList || '<p style="color:#666;">Henüz yorum yok.</p>'}</div>
                            <form action="/comment/${v.id}" method="POST">
                                <input type="text" name="comment" placeholder="Yorum yaz..." required>
                                <button type="submit" class="comment-btn">Gönder</button>
                            </form>
                            <button type="button" class="close-comment" onclick="closeComments(${v.id})">Kapat</button>
                        </div>
                    </div>
                </div>`;

                processedCount++;
                if (processedCount === videos.length) {
                    renderFeed(feedHTML);
                }
            });
        });

        function renderFeed(html) {
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
                    ${html || '<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:#666;">Henüz video yok. Alttaki "+" butonuna basarak video paylaş!</div>'}
                </div>
                ${getNavbar('home', req.session.user.username)}
            </body>
            </html>
            `);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
});

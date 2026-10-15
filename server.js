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
    secret: 'tiktok-gizli-anahtar',
    resave: false,
    saveUninitialized: true
}));

// Veritabanı Tabloları (Kullanıcı adı UNIQUE yapılarak aynısı alınması engellendi)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        nickname TEXT,
        password TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        caption TEXT,
        filename TEXT,
        likes INTEGER DEFAULT 0
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

// Kayıt Olma (Aynı kullanıcı adı kontrolü)
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

// Giriş Yapma
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

// Çıkış Yap
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// Video Yükleme
app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const { caption } = req.body;
    const filename = req.file ? req.file.filename : '';
    const userId = req.session.user.id;
    const username = req.session.user.username;

    db.run(`INSERT INTO videos (user_id, username, caption, filename) VALUES (?, ?, ?, ?)`, 
        [userId, username, caption, filename], 
        () => res.redirect('/')
    );
});

// Beğenme İşlemi
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

// Takip Etme İşlemi
app.get('/follow/:id', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const followerId = req.session.user.id;
    const followingId = req.params.id;
    if (followerId == followingId) return res.redirect('back');

    db.get(`SELECT * FROM likes WHERE user_id = ?`, [followerId], () => { // dummy check or direct follow toggle
        db.get(`SELECT * FROM follows WHERE follower_id = ? AND following_id = ?`, [followerId, followingId], (err, row) => {
            if (!row) {
                db.run(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`, [followerId, followingId], () => res.redirect('back'));
            } else {
                db.run(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`, [followerId, followingId], () => res.redirect('back'));
            }
        });
    });
});

// Profil Sayfası (Başkalarının veya Kendinin)
app.get('/profile/:username', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const profileUsername = req.params.username;

    db.get(`SELECT * FROM users WHERE username = ?`, [profileUsername], (err, targetUser) => {
        if (!targetUser) return res.send("Kullanıcı bulunamadı.");

        db.all(`SELECT * FROM videos WHERE user_id = ? ORDER BY id DESC`, [targetUser.id], (err, videos) => {
            db.get(`SELECT COUNT(*) as count FROM follows WHERE follower_id = ? AND following_id = ?`, 
                [req.session.user.id, targetUser.id], (err, followCheck) => {
                
                db.get(`SELECT COUNT(*) as followersCount FROM follows WHERE following_id = ?`, [targetUser.id], (err, fCount) => {

                    let videoHTML = '';
                    videos.forEach(v => {
                        videoHTML += `
                        <div class="v-thumb">
                            <video src="/uploads/${v.filename}" muted></video>
                            <p>${v.caption}</p>
                        </div>`;
                    });

                    let isMe = req.session.user.id === targetUser.id;
                    let isFollowing = followCheck && followCheck.count > 0;

                    res.send(`
                    <!DOCTYPE html>
                    <html lang="tr">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>${targetUser.nickname} (@${targetUser.username})</title>
                        <style>
                            body { background: #000; color: #fff; font-family: sans-serif; margin: 0; padding-bottom: 60px; }
                            .header { text-align: center; padding: 20px; background: #121212; }
                            .avatar { width: 80px; height: 80px; background: #fe2c55; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 10px; font-weight: bold; }
                            .btn { background: #fe2c55; color: #fff; border: none; padding: 8px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 10px; }
                            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-top: 10px; }
                            .v-thumb { background: #1a1a1a; aspect-ratio: 9/16; position: relative; overflow: hidden; }
                            .v-thumb video { width: 100%; height: 100%; object-fit: cover; }
                            .v-thumb p { position: absolute; bottom: 5px; left: 5px; right: 5px; font-size: 10px; margin: 0; background: rgba(0,0,0,0.5); padding: 2px; }
                            .nav { position: fixed; bottom: 0; left: 0; width: 100%; background: #121212; display: flex; justify-content: space-around; padding: 12px 0; border-top: 1px solid #333; }
                            .nav a { color: #fff; text-decoration: none; font-weight: bold; font-size: 14px; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <div class="avatar">${targetUser.nickname.charAt(0).toUpperCase()}</div>
                            <h2>${targetUser.nickname}</h2>
                            <p style="color: #888; margin: 0;">@${targetUser.username}</p>
                            <p style="font-size: 14px; margin-top: 8px;">Takipçi: ${fCount.followersCount}</p>
                            ${!isMe ? `<a href="/follow/${targetUser.id}" class="btn" style="background: ${isFollowing ? '#333' : '#fe2c55'}">${isFollowing ? 'Takiptesin' : 'Takip Et'}</a>` : ''}
                        </div>
                        <h3 style="padding: 10px; margin: 0; font-size: 16px;">Videolar</h3>
                        <div class="grid">
                            ${videoHTML || '<p style="padding: 10px; color: #888;">Henüz video yok.</p>'}
                        </div>
                        <div class="nav">
                            <a href="/">🏠 Anasayfa</a>
                            <a href="/profile/${req.session.user.username}">👤 Profilim</a>
                        </div>
                    </body>
                    </html>
                    `);
                });
            });
        });
    });
});

// TikTok Tarzı Ana Sayfa (Akış)
app.get('/', (req, res) => {
    if (!req.session.user) {
        // Giriş Yapma / Kayıt Olma Arayüzü (TikTok Giriş Ekranı Tarzı)
        return res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TikTok Tarzı Platform</title>
            <style>
                body { background: #121212; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: #1e1e1e; padding: 30px; border-radius: 12px; width: 300px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.8); }
                input { width: 100%; padding: 12px; margin: 8px 0; border-radius: 6px; border: none; background: #2b2b2b; color: #fff; box-sizing: border-box; }
                button { width: 100%; padding: 12px; background: #fe2c55; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; }
                .tab { display: flex; justify-content: space-around; margin-bottom: 20px; cursor: pointer; font-weight: bold; color: #888; }
                .tab.active { color: #fe2c55; border-bottom: 2px solid #fe2c55; padding-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2 style="color: #fe2c55; margin-bottom: 20px;">Video Dünyası</h2>
                <form action="/login" method="POST">
                    <h3>Giriş Yap</h3>
                    <input type="text" name="username" placeholder="Kullanıcı Adı" required>
                    <input type="password" name="password" placeholder="Şifre" required>
                    <button type="submit">Giriş Yap</button>
                </form>
                <hr style="border-color: #333; margin: 25px 0;">
                <form action="/register" method="POST">
                    <h3>Kayıt Ol</h3>
                    <input type="text" name="username" placeholder="Kullanıcı Adı (Benzersiz)" required>
                    <input type="text" name="nickname" placeholder="Takma Ad (Görünen İsim)" required>
                    <input type="password" name="password" placeholder="Şifre" required>
                    <button type="submit" style="background: #25f4ee; color: #000;">Kayıt Ol</button>
                </form>
            </div>
        </body>
        </html>
        `);
    }

    db.all(`SELECT * FROM videos ORDER BY id DESC`, [], (err, videos) => {
        let feedHTML = '';
        videos.forEach(v => {
            feedHTML += `
            <div class="video-container">
                <video src="/uploads/${v.filename}" controls loop playsinline></video>
                <div class="video-info">
                    <a href="/profile/${v.username}" style="color: #fff; text-decoration: none; font-weight: bold;">@${v.username}</a>
                    <p>${v.caption}</p>
                </div>
                <div class="sidebar-actions">
                    <a href="/like/${v.id}" class="action-btn">❤️<br><span>${v.likes}</span></a>
                </div>
            </div>`;
        });

        res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Akış - TikTok</title>
            <style>
                body { background: #000; color: #fff; font-family: sans-serif; margin: 0; overflow-y: scroll; scroll-snap-type: y mandatory; }
                .video-container { width: 100vw; height: 100vh; scroll-snap-align: start; position: relative; display: flex; justify-content: center; align-items: center; background: #000; }
                video { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: 1; }
                .video-info { position: absolute; bottom: 70px; left: 15px; z-index: 2; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
                .video-info p { margin: 5px 0 0 0; font-size: 14px; }
                .sidebar-actions { position: absolute; bottom: 80px; right: 15px; z-index: 2; display: flex; flex-direction: column; gap: 15px; text-align: center; }
                .action-btn { background: rgba(0,0,0,0.4); padding: 10px; border-radius: 50%; color: #fff; text-decoration: none; font-size: 18px; width: 45px; height: 45px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .action-btn span { font-size: 11px; margin-top: 2px; }
                .nav { position: fixed; bottom: 0; left: 0; width: 100%; background: #121212; display: flex; justify-content: space-around; padding: 12px 0; border-top: 1px solid #333; z-index: 10; }
                .nav a { color: #fff; text-decoration: none; font-weight: bold; font-size: 14px; }
                .upload-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 20; display: none; justify-content: center; align-items: center; }
                .upload-box { background: #1e1e1e; padding: 25px; border-radius: 12px; width: 300px; text-align: center; }
                .upload-box input, .upload-box button { width: 100%; padding: 10px; margin: 8px 0; border-radius: 5px; border: none; box-sizing: border-box; }
                .upload-box button { background: #fe2c55; color: #fff; font-weight: bold; cursor: pointer; }
            </style>
        </head>
        <body>
            <div style="height: calc(100vh - 50px); overflow-y: scroll; scroll-snap-type: y mandatory;">
                ${feedHTML || '<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:#888;">Henüz video paylaşılmamış. Aşağıdan video yükle!</div>'}
            </div>

            <div class="nav">
                <a href="/">🏠 Anasayfa</a>
                <a href="#" onclick="document.getElementById('modal').style.display='flex'">➕ Video Yükle</a>
                <a href="/profile/${req.session.user.username}">👤 Profilim</a>
            </div>

            <div id="modal" class="upload-modal">
                <div class="upload-box">
                    <h3>Yeni Video Paylaş</h3>
                    <form action="/upload" method="POST" enctype="multipart/form-data">
                        <input type="text" name="caption" placeholder="Açıklama yaz..." required>
                        <input type="file" name="video" accept="video/*" required>
                        <button type="submit">Paylaş</button>
                        <button type="button" style="background:#333;" onclick="document.getElementById('modal').style.display='none'">İptal</button>
                    </form>
                </div>
            </div>
        </body>
        </html>
        `);
    }
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
});

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
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'lcnq6io8',
    api_key: process.env.CLOUDINARY_API_KEY || '65673898511923',
    api_secret: process.env.CLOUDINARY_API_SECRET
});

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
        console.log("MongoDB bulut veritabanına başarıyla bağlandı!");
    })
    .catch(err => console.error("Veritabanı bağlantı hatası:", err));

const upload = multer({ storage: multer.memoryStorage() });

const uploadToCloudinary = (fileBuffer, resourceType = 'auto') => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: resourceType, folder: "tiktok_app" },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        stream.end(fileBuffer);
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

// Kayıt & Giriş
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
            bio: 'Biyografi eklenmedi...',
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

// Hikaye Paylaşım
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
                        alert('Hikaye yükleme hatası: ' + xhr.responseText);
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
    if (!req.session.user || !isConnected) return res.status(500).send("Sunucu hatası");
    try {
        if (!req.file) return res.status(400).send("Dosya seçilmedi");
        const isVideo = req.file.mimetype.startsWith('video');
        const cloudRes = await uploadToCloudinary(req.file.buffer, isVideo ? 'video' : 'image');

        await storiesCol.insertOne({
            user_id: new ObjectId(req.session.user._id),
            username: req.session.user.username,
            mediaUrl: cloudRes.secure_url,
            mediaType: isVideo ? 'video' : 'image',
            createdAt: new Date()
        });
        res.status(200).send("OK");
    } catch (err) {
        res.status(500).send("Yükleme başarısız oldu: " + err.message);
    }
});

// Video Paylaşım (Hatasız Yapı)
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
            .editor-container { width: 100vw; height: calc(100vh - 60px); background: #111; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 20px; }
            .form-box { width: 100%; max-width: 400px; background: rgba(20,20,20,0.9); padding: 15px; border-radius: 12px; display: flex; flex-direction: column; gap: 12px; }
            .form-box input { width: 100%; padding: 10px; background: #2a2a2a; border: none; color: #fff; border-radius: 6px; }
            .publish-btn { background: #FE2C55; color: #fff; padding: 12px; border: none; border-radius: 6px; font-weight: bold; font-size: 15px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="progress-overlay" id="progressOverlay">
            <h3>Video Yükleniyor...</h3>
            <div id="percentText" style="font-size:24px; font-weight:bold; color:#FE2C55;">0%</div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" id="progressBarFill"></div></div>
        </div>

        <div class="editor-container">
            <h3 style="margin-top: 10px;">Yeni Video</h3>
            <form id="videoForm" class="form-box">
                <input type="text" id="captionInput" placeholder="Açıklama veya #etiket..." required>
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
    if (!req.session.user || !isConnected) return res.status(500).send("Veritabanı erişilemiyor");
    try {
        if (!req.file) return res.status(400).send("Video dosyası bulunamadı");
        const cloudRes = await uploadToCloudinary(req.file.buffer, 'video');

        await videosCol.insertOne({
            user_id: new ObjectId(req.session.user._id),
            username: req.session.user.username,
            caption: req.body.caption || '',
            filename: cloudRes.secure_url,
            song: req.body.song || 'Orijinal Ses',
            likes: 0,
            favorites: 0,
            shares: 0,
            createdAt: new Date()
        });
        res.status(200).send("OK");
    } catch (err) {
        console.error("Yükleme Hatası:", err);
        res.status(500).send("Sunucu yükleme hatası: " + err.message);
    }
});

// Resim/Çıkartmalı Yorum Gönderme
app.post('/comment/:id', upload.single('image'), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    try {
        let imageUrl = '';
        if (req.file) {
            const cloudRes = await uploadToCloudinary(req.file.buffer, 'image');
            imageUrl = cloudRes.secure_url;
        }

        await commentsCol.insertOne({
            video_id: new ObjectId(req.params.id),
            username: req.session.user.username,
            comment: req.body.comment || '',
            image: imageUrl,
            createdAt: new Date()
        });
    } catch (err) {
        console.error("Yorum Hatası:", err);
    }
    res.redirect('back');
});

// Gelen Kutusu & Mesajlaşma (DM)
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
            <h2 style="margin: 0; font-size: 20px;">Gelen Kutusu</h2>
            <a href="/upload-story-page" style="background:#222; color:#fff; padding:6px 12px; border-radius:15px; font-size:12px; font-weight:bold;">+ Hikaye Ekle</a>
        </div>
        ${userListHTML || '<p style="text-align:center; color:#666; margin-top:40px;">Sohbet edilecek kullanıcı bulunamadı.</p>'}
        ${getNavbar('inbox', req.session.user.username)}
    </body>
    </html>
    `);
});

// DM Chat Odası
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
        <title>Chat - @${target.username}</title>
        <style>
            ${globalStyles}
            .chat-header { position:fixed; top:0; left:0; width:100%; height:50px; background:#121212; display:flex; align-items:center; padding:0 15px; gap:15px; border-bottom:1px solid #222; z-index:100; }
            .chat-box { padding:60px 15px 70px 15px; min-height:100vh; display:flex; flex-direction:column; justify-content:flex-end; }
            .chat-input { position:fixed; bottom:0; left:0; width:100%; padding:10px; background:#121212; display:flex; gap:10px; border-top:1px solid #222; }
            .chat-input input { flex-grow:1; background:#222; border:none; color:#fff; padding:10px; border-radius:20px; outline:none; }
            .chat-input button { background:#FE2C55; color:#fff; border:none; padding:0 15px; border-radius:20px; font-weight:bold; }
        </style>
    </head>
    <body>
        <div class="chat-header">
            <a href="/inbox" style="font-size:20px;">←</a>
            <b>${target.nickname} (@${target.username})</b>
        </div>
        <div class="chat-box" id="chatBox">
            ${chatHTML || '<p style="text-align:center; color:#555;">Henüz mesaj yok. İlk mesajı sen gönder!</p>'}
        </div>
        <form action="/send-msg/${target.username}" method="POST" class="chat-input">
            <input type="text" name="text" placeholder="Mesaj yaz..." required>
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

// Silme, Beğeni vb. Diğer Rotalar
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

// Arama
app.get('/search', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const query = req.query.q || '';
    let searchResultsVideos = [];
    let searchResultsUsers = [];

    if (query && isConnected) {
        searchResultsVideos = await videosCol.find({ caption: { $regex: query,$options: 'i' } }).toArray();
        searchResultsUsers = await usersCol.find({ username: { $regex: query,$options: 'i' } }).toArray();
    }

    let resultsHTML = '';
    if (query) {
        resultsHTML += `<h3 style="padding:10px 15px;">Kullanıcılar</h3>`;
        searchResultsUsers.forEach(u => {
            resultsHTML += `<a href="/profile/${u.username}" style="display:block; padding:10px 15px;"><b>${u.nickname}</b> (@${u.username})</a>`;
        });
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ara</title><style>${globalStyles}</style></head>
    <body>
        <form action="/search" method="GET" style="padding:15px; display:flex; gap:10px;">
            <input type="text" name="q" placeholder="Ara..." value="${query}" style="flex-grow:1; padding:10px; background:#222; border:none; color:#fff; border-radius:6px;">
            <button type="submit" style="background:#FE2C55; color:#fff; border:none; padding:10px 15px; border-radius:6px;">Ara</button>
        </form>
        ${resultsHTML}
        ${getNavbar('search', req.session.user.username)}
    </body>
    </html>
    `);
});

// Profil
app.get('/profile/:username', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/');
    const targetUser = await usersCol.findOne({ username: req.params.username });
    if (!targetUser) return res.send("Kullanıcı bulunamadı.");

    const videos = await videosCol.find({ user_id: targetUser._id }).sort({ _id: -1 }).toArray();
    let isMe = req.session.user._id.toString() === targetUser._id.toString();

    let videoHTML = '';
    videos.forEach(v => {
        videoHTML += `
        <div style="background:#1a1a1a; aspect-ratio:9/16; position:relative; overflow:hidden;">
            <video src="${v.filename}" style="width:100%; height:100%; object-fit:cover;"></video>
            ${isMe ? `<a href="/delete-video/${v._id}" onclick="return confirm('Silinsin mi?');" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:#ff4d4d; padding:4px 8px; border-radius:4px; font-size:11px;">Sil</a>` : ''}
        </div>`;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${targetUser.nickname}</title><style>${globalStyles}</style></head>
    <body>
        <div style="text-align:center; padding:30px 15px 10px 15px;">
            <h2>${targetUser.nickname}</h2>
            <p style="color:#888;">@${targetUser.username}</p>
            ${!isMe ? `<a href="/chat/${targetUser.username}" style="display:inline-block; background:#FE2C55; color:#fff; padding:8px 20px; border-radius:20px; font-weight:bold; margin-top:10px;">Mesaj Gönder</a>` : ''}
        </div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:2px; padding-bottom:80px;">${videoHTML}</div>
        ${getNavbar('profile', req.session.user.username)}
    </body>
    </html>
    `);
});

// Ana Sayfa Akışı
app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Giriş / Kayıt</title>
        <style>body{background:#fff; font-family:sans-serif; display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; margin:0;} input{display:block; width:280px; padding:12px; margin:8px 0; background:#f1f1f2; border:none; border-radius:4px;} button{width:280px; padding:12px; background:#FE2C55; color:#fff; border:none; font-weight:bold; border-radius:4px; cursor:pointer;}</style>
        </head>
        <body>
            <h2>TikTok'a Hoş Geldiniz</h2>
            <form action="/register" method="POST"><input type="text" name="username" placeholder="Kullanıcı adı" required><input type="text" name="nickname" placeholder="Takma ad" required><input type="password" name="password" placeholder="Şifre" required><button type="submit">Kayıt Ol</button></form>
            <br>
            <form action="/login" method="POST"><input type="text" name="username" placeholder="Kullanıcı adı" required><input type="password" name="password" placeholder="Şifre" required><button type="submit" style="background:#000;">Giriş Yap</button></form>
        </body>
        </html>
        `);
    }

    const videos = isConnected ? await videosCol.find({}).sort({ _id: -1 }).toArray() : [];
    const stories = isConnected ? await storiesCol.find({}).sort({ _id: -1 }).toArray() : [];

    let storiesHTML = `<div class="story-item" onclick="window.location='/upload-story-page'"><div class="story-ring plus">+</div><span>Hikayen</span></div>`;
    stories.forEach(s => {
        let mediaTag = s.mediaType === 'video' ? `<video src="${s.mediaUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;"></video>` : `<img src="${s.mediaUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        storiesHTML += `<div class="story-item" onclick="alert('Hikaye izleniyor!')"><div class="story-ring">${mediaTag}</div><span>@${s.username}</span></div>`;
    });

    let feedHTML = '';
    for (let v of videos) {
        const comments = await commentsCol.find({ video_id: v._id }).sort({ _id: -1 }).toArray();
        let commentList = '';
        comments.forEach(c => {
            commentList += `
            <div style="margin-bottom:10px; font-size:13px;">
                <b style="color:#FE2C55;">@${c.username}:</b> ${c.comment}
                ${c.image ? `<br><img src="${c.image}" style="max-width:120px; border-radius:8px; margin-top:5px;">` : ''}
            </div>`;
        });

        feedHTML += `
        <div class="video-container">
            <video id="vid-${v._id}" src="${v.filename}" loop playsinline></video>
            <div class="sound-toggle" onclick="toggleSound('vid-${v._id}', this)">🔊 Sesi Aç</div>
            <div class="video-info">
                <a href="/profile/${v.username}" style="font-weight: bold;">@${v.username}</a>
                <p style="margin: 5px 0;">${v.caption}</p>
            </div>
            <div class="sidebar-actions">
                <a href="/like/${v._id}" class="action-btn">❤️<span>${v.likes}</span></a>
                <a href="#" onclick="openComments('${v._id}'); return false;" class="action-btn">💬<span>${comments.length}</span></a>
            </div>
            <div id="commentModal-${v._id}" class="comment-modal">
                <div class="comment-box">
                    <h3>Yorumlar (${comments.length})</h3>
                    <div class="comment-list">${commentList || '<p style="color:#666;">Henüz yorum yok.</p>'}</div>
                    <form action="/comment/${v._id}" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:6px;">
                        <input type="text" name="comment" placeholder="Yorum yaz..." style="padding:8px; background:#2f2f2f; border:none; color:#fff; border-radius:4px;">
                        <label style="font-size:11px; color:#aaa;">Çıkartma / Fotoğraf Ekle:</label>
                        <input type="file" name="image" accept="image/*" style="font-size:11px;">
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
        <title>TikTok</title>
        <style>
            ${globalStyles}
            body { overflow: hidden; }
            .story-bar { position: fixed; top: 0; left: 0; width: 100%; background: #000; display: flex; gap: 12px; padding: 10px 15px; overflow-x: auto; z-index: 999; border-bottom: 1px solid #1a1a1a; }
            .story-item { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; flex-shrink: 0; }
            .story-ring { width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #25F4EE, #FE2C55); padding: 2px; display: flex; align-items: center; justify-content: center; }
            .story-ring.plus { background: #333; font-size: 20px; color: #fff; }
            .story-item span { font-size: 10px; color: #ccc; }
            
            .feed-scroll { height: calc(100vh - 130px); margin-top: 70px; overflow-y: scroll; scroll-snap-type: y mandatory; }
            .video-container { width: 100vw; height: calc(100vh - 130px); scroll-snap-align: start; position: relative; background: #000; }
            video { width: 100%; height: 100%; object-fit: cover; }
            .video-info { position: absolute; bottom: 20px; left: 15px; z-index: 10; }
            .sidebar-actions { position: absolute; bottom: 30px; right: 15px; z-index: 10; display: flex; flex-direction: column; gap: 12px; }
            .action-btn { background: rgba(0,0,0,0.4); width: 42px; height: 42px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; text-decoration: none; }
            .sound-toggle { position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 12px; border-radius: 15px; font-size: 12px; z-index: 15; cursor: pointer; }
            .comment-modal { display: none; position: fixed; bottom: 0; left: 0; width: 100%; height: 60vh; background: #1a1a1a; z-index: 3000; border-top-left-radius: 16px; border-top-right-radius: 16px; padding: 15px; }
            .comment-box { display: flex; flex-direction: column; height: 100%; }
            .comment-list { flex-grow: 1; overflow-y: scroll; margin: 10px 0; }
            .comment-btn { background: #FE2C55; color: #fff; border: none; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; }
            .close-comment { background: #333; color: #fff; border: none; padding: 6px; border-radius: 6px; margin-top: 5px; cursor: pointer; }
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
        <div class="story-bar">${storiesHTML}</div>
        <div class="feed-scroll">${feedHTML || '<div style="text-align:center; padding:50px; color:#666;">Henüz video yok. Alttaki "+" butonundan paylaş!</div>'}</div>
        ${getNavbar('home', req.session.user.username)}
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
});

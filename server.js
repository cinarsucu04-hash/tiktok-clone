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

let db, usersCol, videosCol, commentsCol, followsCol, likesCol, favoritesCol, storiesCol, messagesCol, searchesCol, livesCol;
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
        livesCol = db.collection('lives');
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

// SADECE YAYIN YAPANLARA 30 DAKİKADA BİR 50 JETON KAZANDIRAN INTERVAL
setInterval(async () => {
    if (!isConnected) return;
    try {
        const activeLives = await livesCol.find({ status: 'active' }).toArray();
        for (let l of activeLives) {
            await usersCol.updateOne({ username: l.username }, { $inc: { coins: 50 } });
            console.log(`[Yayın Jetonu] @${l.username} aktif yayın yaptığı için 50 jeton kazandı.`);
        }
    } catch (e) { console.error("Yayın jeton dağıtım hatası:", e); }
}, 30 * 60 * 1000);

function getNavbar(activeTab, username, isFriendsTab) {
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
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { background: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding-bottom: 60px; min-height: 100vh; overflow-x: hidden; }
    a { text-decoration: none; color: inherit; }
    .tiktok-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; background: #121212; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid #222; z-index: 99999; }
    .tiktok-nav a { display: flex; flex-direction: column; align-items: center; color: #888; font-size: 10px; gap: 3px; }
    .tiktok-nav a.active { color: #fff; }
    .plus-btn { position: relative; top: -5px; }
    .plus-icon { width: 40px; height: 26px; background: linear-gradient(90deg, #25F4EE 0%, #FE2C55 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #000; font-size: 22px; font-weight: bold; }
    .verified-badge { color: #20D5EC; display: inline-block; margin-left: 4px; font-size: 14px; vertical-align: middle; }
    .coin-badge { background: linear-gradient(135deg, #FFD700, #FFA500); color: #000; font-weight: bold; padding: 3px 8px; border-radius: 12px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; }
`;

app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Giriş Yap - TikTok</title>
        <style>
            body { background: #0f0f0f; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .auth-card { width: 100%; max-width: 380px; padding: 30px; background: #1a1a1a; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); text-align: center; }
            h2 { margin-bottom: 25px; font-size: 24px; background: linear-gradient(90deg, #25F4EE, #FE2C55); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            input { width: 100%; padding: 14px; margin-bottom: 15px; background: #2a2a2a; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 15px; outline: none; }
            input:focus { border-color: #FE2C55; }
            .btn-main { width: 100%; padding: 14px; background: #FE2C55; color: #fff; border: none; border-radius: 8px; font-weight: bold; font-size: 16px; cursor: pointer; transition: 0.2s; }
            .btn-main:hover { opacity: 0.9; }
            .auth-footer { margin-top: 20px; font-size: 14px; color: #888; }
            .auth-footer a { color: #25F4EE; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="auth-card">
            <h2>TikTok'a Giriş Yap</h2>
            <form action="/login" method="POST">
                <input type="text" name="username" placeholder="Kullanıcı adı" required autocomplete="off" style="text-transform: lowercase;" oninput="this.value = this.value.toLowerCase()">
                <input type="password" name="password" placeholder="Şifre" required>
                <button type="submit" class="btn-main">Giriş Yap</button>
            </form>
            <div class="auth-footer">
                Hesabın yok mu? <a href="/register">Kayıt ol</a>
            </div>
        </div>
    </body>
    </html>`);
});

app.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Kayıt Ol - TikTok</title>
        <style>
            body { background: #0f0f0f; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .auth-card { width: 100%; max-width: 380px; padding: 30px; background: #1a1a1a; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); text-align: center; }
            h2 { margin-bottom: 25px; font-size: 24px; background: linear-gradient(90deg, #25F4EE, #FE2C55); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            input { width: 100%; padding: 14px; margin-bottom: 15px; background: #2a2a2a; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 15px; outline: none; }
            input:focus { border-color: #25F4EE; }
            .btn-main { width: 100%; padding: 14px; background: linear-gradient(90deg, #25F4EE, #FE2C55); color: #000; border: none; border-radius: 8px; font-weight: bold; font-size: 16px; cursor: pointer; transition: 0.2s; }
            .btn-main:hover { opacity: 0.9; }
            .auth-footer { margin-top: 20px; font-size: 14px; color: #888; }
            .auth-footer a { color: #FE2C55; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="auth-card">
            <h2>TikTok'a Kaydolun</h2>
            <form action="/register" method="POST">
                <input type="text" name="username" placeholder="Kullanıcı adı" required autocomplete="off" style="text-transform: lowercase;" oninput="this.value = this.value.toLowerCase()">
                <input type="text" name="nickname" placeholder="Takma ad (Görünen isim)" required autocomplete="off">
                <input type="password" name="password" placeholder="Şifre" required>
                <button type="submit" class="btn-main">Kayıt Ol</button>
            </form>
            <div class="auth-footer">
                Zaten hesabın var mı? <a href="/login">Giriş yap</a>
            </div>
        </div>
    </body>
    </html>`);
});

app.get('/switch-account/:id', async (req, res) => {
    if (!isConnected) return res.redirect('/login');
    try {
        const targetUser = await usersCol.findOne({ _id: new ObjectId(req.params.id) });
        if (targetUser) {
            req.session.user = targetUser;
        }
    } catch (err) { console.error(err); }
    res.redirect('/');
});

app.post('/register', async (req, res) => {
    if (!isConnected) return res.send("<script>alert('Veritabanı bağlanıyor...'); window.location='/register';</script>");
    const { username, nickname, password } = req.body;
    if (!username || !nickname || !password) return res.send("<script>alert('Tüm alanları doldurun!'); window.location='/register';</script>");

    try {
        const cleanUsername = username.toLowerCase().trim();
        const existing = await usersCol.findOne({ username: cleanUsername });
        if (existing) return res.send("<script>alert('Bu kullanıcı adı zaten alınmış!'); window.location='/register';</script>");

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCol.insertOne({ username: cleanUsername, nickname, password: hashedPassword, bio: 'TikTok içerik üreticisi 🎬', avatar: '', banner: '', coins: 100 });
        res.send("<script>alert('Kayıt başarılı! 100 Hoşgeldin jetonun hesabına eklendi.'); window.location='/login';</script>");
    } catch (err) {
        res.send(`<script>alert('Kayıt Hatası: ${err.message}'); window.location='/register';</script>`);
    }
});

app.post('/login', async (req, res) => {
    if (!isConnected) return res.send("<script>alert('Veritabanı bağlanıyor...'); window.location='/login';</script>");
    const { username, password } = req.body;
    try {
        const user = await usersCol.findOne({ username: username.toLowerCase().trim() });
        if (!user) return res.send("<script>alert('Kullanıcı bulunamadı!'); window.location='/login';</script>");
        
        const match = await bcrypt.compare(password, user.password);
        if (match) { req.session.user = user; res.redirect('/'); } 
        else { res.send("<script>alert('Hatalı şifre!'); window.location='/login';</script>"); }
    } catch (err) {
        res.send(`<script>alert('Giriş Hatası: ${err.message}'); window.location='/login';</script>`);
    }
});

app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/login')); });

// CANLI YAYIN İŞLEMLERİ (BAŞLAT, DURDUR, KAPAT)
app.get('/start-live', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const username = req.session.user.username;
    
    await livesCol.updateOne(
        { username: username },
        { $set: { nickname: req.session.user.nickname, avatar: req.session.user.avatar || '', title: `${req.session.user.nickname} canlı yayında! 🔴`, viewers: Math.floor(Math.random() * 450) + 50, status: 'active', chestCoins: 0, createdAt: new Date() } },
        { upsert: true }
    );
    res.redirect(`/live/${username}`);
});

app.get('/pause-live', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const live = await livesCol.findOne({ username: req.session.user.username });
    if (live) {
        const newStatus = live.status === 'paused' ? 'active' : 'paused';
        await livesCol.updateOne({ username: req.session.user.username }, { $set: { status: newStatus } });
    }
    res.redirect('back');
});

app.get('/end-live', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    await livesCol.deleteOne({ username: req.session.user.username });
    res.redirect('/');
});

app.post('/drop-chest', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const amount = parseInt(req.body.amount) || 50;
    await livesCol.updateOne({ username: req.session.user.username }, { $set: { chestCoins: amount } });
    res.redirect('back');
});

app.get('/open-chest/:username', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const targetLive = await livesCol.findOne({ username: req.params.username.toLowerCase() });
    if (targetLive && targetLive.chestCoins > 0) {
        const reward = targetLive.chestCoins;
        await usersCol.updateOne({ _id: new ObjectId(req.session.user._id) }, { $inc: { coins: reward } });
        await livesCol.updateOne({ username: req.params.username.toLowerCase() }, { $set: { chestCoins: 0 } });
        req.session.user.coins = (req.session.user.coins || 0) + reward;
    }
    res.redirect('back');
});

// CANLI YAYIN ODASI
app.get('/live/:username', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const targetUsername = req.params.username.toLowerCase();
    const liveInfo = await livesCol.findOne({ username: targetUsername });
    const freshUser = await usersCol.findOne({ _id: new ObjectId(req.session.user._id) });
    req.session.user = freshUser;

    if (!liveInfo) {
        return res.send("<script>alert('Bu kullanıcı şu an canlı yayında değil!'); window.location='/';</script>");
    }

    const isMyLive = req.session.user.username === targetUsername;
    const isPaused = liveInfo.status === 'paused';

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>CANLI - @${targetUsername}</title>
        <style>
            ${globalStyles}
            body { background: #111; overflow: hidden; height: 100vh; }
            .live-container { position: relative; width: 100vw; height: 100vh; display: flex; flex-direction: column; justify-content: space-between; }
            .live-top-bar { position: absolute; top: 15px; left: 15px; right: 15px; display: flex; justify-content: space-between; align-items: center; z-index: 100; }
            .live-host-badge { background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); padding: 6px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: bold; }
            .live-red-tag { background: #FE2C55; color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
            .live-chat-area { position: absolute; bottom: 70px; left: 15px; width: 280px; max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; z-index: 100; pointer-events: none; }
            .chat-bubble { background: rgba(0,0,0,0.4); backdrop-filter: blur(5px); padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.3; animation: fadeIn 0.3s ease; }
            .live-bottom-bar { position: absolute; bottom: 15px; left: 15px; right: 15px; display: flex; align-items: center; gap: 10px; z-index: 100; }
            .live-input { flex-grow: 1; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 24px; padding: 12px 18px; color: #fff; outline: none; font-size: 14px; }
            .live-action-btn { width: 44px; height: 44px; background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); }
            .chest-box-popup { position: absolute; top: 90px; right: 15px; background: linear-gradient(135deg, #FFD700, #FF4500); padding: 10px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; color: #000; cursor: pointer; z-index: 200; animation: bounce 1s infinite alternate; box-shadow: 0 4px 15px rgba(255,215,0,0.5); }
            @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-5px); } }
        </style>
        <script>
            function sendLiveComment(e) {
                e.preventDefault();
                const input = document.getElementById('liveCommentInput');
                if(!input.value.trim()) return;
                const chatArea = document.getElementById('chatArea');
                const bubble = document.createElement('div');
                bubble.className = 'chat-bubble';
                bubble.innerHTML = '<b>${req.session.user.nickname}:</b> ' + input.value;
                chatArea.appendChild(bubble);
                chatArea.scrollTop = chatArea.scrollHeight;
                input.value = '';
            }
            function sendGift(giftName) {
                const chatArea = document.getElementById('chatArea');
                const bubble = document.createElement('div');
                bubble.className = 'chat-bubble';
                bubble.style.background = 'rgba(254,44,85,0.6)';
                bubble.innerHTML = '🎁 <b>${req.session.user.nickname}</b> hediye gönderdi: <b>' + giftName + '</b>';
                chatArea.appendChild(bubble);
                chatArea.scrollTop = chatArea.scrollHeight;
            }
        </script>
    </head>
    <body>
        <div class="live-container">
            <div style="position:absolute; width:100%; height:100%; background:${isPaused ? '#330000' : 'radial-gradient(circle, #222 0%, #000 100%)'}; display:flex; align-items:center; justify-content:center; flex-direction:column;">
                <div style="font-size:70px; margin-bottom:10px;">${isPaused ? '⏸️' : '📹'}</div>
                <div style="font-size:18px; font-weight:bold; color:${isPaused ? '#ff4d4d' : '#aaa'};">@${targetUsername} canlı yayını</div>
                <div style="font-size:13px; color:#666; margin-top:5px;">${isPaused ? 'Yayıncı tarafından durduruldu' : 'Yayın akışı aktif'}</div>
            </div>

            ${liveInfo.chestCoins > 0 ? `<a href="/open-chest/${targetUsername}" class="chest-box-popup">🎁 Sandık Kutusu (${liveInfo.chestCoins} Jeton) - Aç!</a>` : ''}

            <div class="live-top-bar">
                <div class="live-host-badge">
                    <div style="width:28px; height:28px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px;">${liveInfo.nickname.charAt(0)}</div>
                    <div>
                        <div style="font-size:12px;">${liveInfo.nickname}</div>
                        <div style="font-size:10px; color:#aaa;">👥 ${liveInfo.viewers} izleyici</div>
                    </div>
                    <span class="live-red-tag">${isPaused ? 'DURDURULDU' : 'CANLI'}</span>
                </div>
                
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="coin-badge" title="Jetonun">🪙 ${req.session.user.coins || 0}</div>
                    ${isMyLive ? `
                        <a href="/pause-live" style="background:#333; color:#fff; padding:6px 12px; border-radius:15px; font-size:12px; font-weight:bold;">${isPaused ? 'Devam Ettir' : 'Durdur'}</a>
                        <a href="/end-live" style="background:#ff4d4d; color:#fff; padding:6px 12px; border-radius:15px; font-size:12px; font-weight:bold;">Kapat</a>
                    ` : `<a href="/" style="background:rgba(0,0,0,0.6); color:#fff; padding:6px 12px; border-radius:15px; font-size:12px; font-weight:bold;">Çıkış</a>`}
                </div>
            </div>

            <div class="live-chat-area" id="chatArea">
                <div class="chat-bubble">👋 <b>Sistem:</b> Canlı yayına hoş geldiniz! Yayın yapan içerik üreticileri her 30 dakikada bir 50 ücretsiz jeton kazanır.</div>
                <div class="chat-bubble">🔥 <b>ahmet99:</b> Yayın harika gidiyor hocam!</div>
            </div>

            ${isMyLive ? `
            <div style="position:absolute; top:75px; left:15px; z-index:150;">
                <form action="/drop-chest" method="POST" style="display:flex; gap:6px;">
                    <select name="amount" style="background:#222; color:#fff; border:1px solid #444; border-radius:6px; padding:6px;">
                        <option value="50">50 Jetonluk Sandık</option>
                        <option value="100">100 Jetonluk Sandık</option>
                        <option value="250">250 Jetonluk Sandık</option>
                    </select>
                    <button type="submit" style="background:#FFD700; color:#000; border:none; padding:6px 12px; border-radius:6px; font-weight:bold; cursor:pointer;">Sandık At 🎁</button>
                </form>
            </div>` : ''}

            <form onsubmit="sendLiveComment(event)" class="live-bottom-bar">
                <input type="text" id="liveCommentInput" class="live-input" placeholder="Yorum yaz veya soru sor..." autocomplete="off">
                <div class="live-action-btn" onclick="sendGift('Gül 🌹')" title="Gül Gönder">🌹</div>
                <div class="live-action-btn" onclick="sendGift('Aslan 🦁')" title="Aslan Gönder">🦁</div>
            </form>
        </div>
    </body>
    </html>`);
});

app.get('/upload-story-page', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
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
        ${getNavbar('inbox', req.session.user.username, false)}
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
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const storyId = new ObjectId(req.params.id);
        const story = await storiesCol.findOne({ _id: storyId });
        if (story && (story.username === req.session.user.username || req.session.user.username === 'tiktok')) {
            await storiesCol.deleteOne({ _id: storyId });
        }
    } catch (err) { console.error(err); }
    res.redirect('/inbox');
});

app.get('/upload-page', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Video Paylaş</title><style>${globalStyles}</style></head>
    <body style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh;">
        <h3 style="margin-bottom:20px;">Yeni Video Yayınla</h3>
        <form id="uploadForm" action="/upload" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:15px; width:320px; background:#1a1a1a; padding:20px; border-radius:12px;" onsubmit="showProgress(event)">
            <input type="text" name="caption" placeholder="Açıklama ve #hashtag ekle..." required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <input type="text" name="song" value="Orijinal Ses - ${req.session.user.nickname}" style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <input type="file" id="videoFile" name="video" accept="video/*" required style="padding:10px; background:#2a2a2a; border:none; color:#fff; border-radius:6px;">
            <button type="submit" id="submitBtn" style="background:#FE2C55; color:#fff; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Yayınla</button>
            
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
        ${getNavbar('home', req.session.user.username, false)}
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
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        let imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
        const commentText = (req.body.comment || '').trim();
        if (commentText || imageUrl) {
            await commentsCol.insertOne({ 
                video_id: new ObjectId(req.params.id), 
                username: req.session.user.username, 
                nickname: req.session.user.nickname,
                avatar: req.session.user.avatar || '',
                comment: commentText, 
                image: imageUrl,
                createdAt: new Date() 
            });
        }
    } catch (err) { console.error(err); }
    res.redirect('back');
});

app.get('/delete-video/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    try {
        const videoId = new ObjectId(req.params.id);
        const video = await videosCol.findOne({ _id: videoId });
        const isMod = req.session.user.username.toLowerCase() === 'tiktok';

        if (video && (video.user_id.toString() === req.session.user._id.toString() || isMod)) {
            await videosCol.deleteOne({ _id: videoId });
            await commentsCol.deleteMany({ video_id: videoId });
            await likesCol.deleteMany({ video_id: videoId });
            await favoritesCol.deleteMany({ video_id: videoId });
        }
    } catch (err) { console.error(err); }
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

app.get('/follow/:id', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const followerId = req.session.user._id;
    const followingId = new ObjectId(req.params.id);

    const existingFollow = await followsCol.findOne({ follower_id: followerId, following_id: followingId });
    if (!existingFollow) { await followsCol.insertOne({ follower_id: followerId, following_id: followingId }); } 
    else { await followsCol.deleteOne({ follower_id: followerId, following_id: followingId }); }
    res.redirect('back');
});

app.post('/update-profile', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
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
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const targetUser = await usersCol.findOne({ username: req.params.username.toLowerCase() });
    if (!targetUser) return res.send("Kullanıcı bulunamadı.");

    const tab = req.query.tab || 'videos'; 
    const allUsers = await usersCol.find({}).toArray();
    
    let videos = [];
    if (tab === 'videos') {
        videos = await videosCol.find({ user_id: targetUser._id }).sort({ _id: -1 }).toArray();
    } else if (tab === 'likes') {
        const userLikes = await likesCol.find({ user_id: targetUser._id }).toArray();
        const likedVideoIds = userLikes.map(l => l.video_id);
        videos = await videosCol.find({ _id: { $in: likedVideoIds } }).sort({ _id: -1 }).toArray();
    } else if (tab === 'favorites') {
        const userFavs = await favoritesCol.find({ user_id: targetUser._id }).toArray();
        const favVideoIds = userFavs.map(f => f.video_id);
        videos = await videosCol.find({ _id: { $in: favVideoIds } }).sort({ _id: -1 }).toArray();
    }

    const followersCount = await followsCol.countDocuments({ following_id: targetUser._id });
    const followingCount = await followsCol.countDocuments({ follower_id: targetUser._id });
    const followCheck = await followsCol.findOne({ follower_id: new ObjectId(req.session.user._id), following_id: targetUser._id });
    
    let totalLikesAgg = await videosCol.aggregate([{ $match: { user_id: targetUser._id } }, {$group: { _id: null, total: { $sum: "$likes" } } }]).toArray();
    let totalLikes = totalLikesAgg.length > 0 ? totalLikesAgg[0].total : 0;

    let isMe = req.session.user._id.toString() === targetUser._id.toString();
    let isMod = req.session.user.username.toLowerCase() === 'tiktok';
    let isFollowing = !!followCheck;
    let isTargetTikTok = targetUser.username.toLowerCase() === 'tiktok';

    let videoHTML = '';
    videos.forEach(v => {
        let safeCaption = (v.caption || '').replace(/'/g, "\\'");
        let canDelete = isMe || (isMod && tab === 'videos');
        videoHTML += `
        <div class="v-thumb" onclick="openVideoModal('${v.filename}', '${safeCaption}', '${v.likes || 0}')" style="cursor:pointer;">
            <video src="${v.filename}#t=0.1" muted preload="metadata"></video>
            <div class="thumb-stats">❤️ ${v.likes}</div>
            ${canDelete ? `<a href="/delete-video/${v._id}" onclick="event.stopPropagation(); return confirm('Videoyu silmek istediğine emin misin?');" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.7); color:#ff4d4d; padding:4px 8px; border-radius:4px; font-size:11px; z-index:10;">Sil</a>` : ''}
        </div>`;
    });

    let accountsHTML = '';
    allUsers.forEach(acc => {
        let isCurrent = acc._id.toString() === req.session.user._id.toString();
        let accAvatar = acc.avatar ? `<img src="${acc.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : acc.nickname.charAt(0).toUpperCase();
        let accVerified = acc.username.toLowerCase() === 'tiktok' ? '<span class="verified-badge">✔</span>' : '';
        accountsHTML += `
        <a href="/switch-account/${acc._id}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #eee; color:#000;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:40px; height:40px; background:#FE2C55; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold; overflow:hidden;">${accAvatar}</div>
                <div>
                    <div style="font-weight:bold; font-size:15px;">${acc.nickname} ${accVerified}</div>
                    <div style="font-size:12px; color:#888;">@${acc.username}</div>
                </div>
            </div>
            ${isCurrent ? '<span style="color:#FE2C55; font-size:20px; font-weight:bold;">✓</span>' : '<span style="font-size:12px; color:#25F4EE; font-weight:bold;">Geçiş Yap</span>'}
        </a>`;
    });

    let bannerBg = targetUser.banner ? `url('${targetUser.banner}')` : 'linear-gradient(135deg, #2b2b2b, #111)';
    let avatarHTML = targetUser.avatar ? `<img src="${targetUser.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : targetUser.nickname.charAt(0).toUpperCase();
    let verifiedBadgeHTML = isTargetTikTok ? '<span class="verified-badge" title="Resmi Hesap">✔</span>' : '';

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${targetUser.nickname}</title>
        <style>
            ${globalStyles}
            .banner { width: 100%; height: 140px; background-image: ${bannerBg}; background-size: cover; background-position: center; }
            .profile-header { text-align: center; padding: 0 15px 15px 15px; background: #000; position: relative; }
            .avatar { width: 85px; height: 85px; background: #FE2C55; border: 4px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: -45px auto 10px auto; font-weight: bold; overflow: hidden; }
            .stats { display: flex; justify-content: center; gap: 20px; margin: 15px 0; font-size: 14px; }
            .stats div span { display: block; font-weight: bold; font-size: 16px; }
            
            .profile-tabs { display: flex; border-bottom: 1px solid #222; background: #000; position: sticky; top: 0; z-index: 50; }
            .profile-tabs a { flex: 1; text-align: center; padding: 12px 0; font-size: 14px; color: #777; font-weight: bold; border-bottom: 2px solid transparent; }
            .profile-tabs a.active { color: #fff; border-bottom-color: #fff; }

            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
            .v-thumb { background: #1a1a1a; aspect-ratio: 9/16; position: relative; overflow: hidden; }
            .v-thumb video { width: 100%; height: 100%; object-fit: cover; }
            .thumb-stats { position: absolute; bottom: 5px; left: 5px; font-size: 11px; font-weight: bold; text-shadow: 0 1px 2px #000; }
            
            .account-switcher-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 300000; justify-content: center; align-items: flex-end; }
            .account-switcher-content { background: #fff; color: #000; width: 100%; max-height: 70vh; border-top-left-radius: 16px; border-top-right-radius: 16px; display: flex; flex-direction: column; overflow: hidden; }
        </style>
        <script>
            function openAccountSwitcher() { document.getElementById('accountModal').style.display = 'flex'; }
            function closeAccountSwitcher() { document.getElementById('accountModal').style.display = 'none'; }
            
            function openVideoModal(filename, caption, likes) {
                const modal = document.getElementById('videoPopupModal');
                const player = document.getElementById('popupVideoPlayer');
                const captionText = document.getElementById('popupVideoCaption');
                const likesText = document.getElementById('popupVideoLikes');
                
                player.src = filename;
                captionText.innerText = caption ? caption : '';
                likesText.innerText = '❤️ ' + likes + ' Beğeni';
                modal.style.display = 'flex';
                player.play();
            }

            function closeVideoPopup() {
                const modal = document.getElementById('videoPopupModal');
                const player = document.getElementById('popupVideoPlayer');
                player.pause();
                player.src = '';
                modal.style.display = 'none';
            }
        </script>
    </head>
    <body>
        <div class="banner"></div>
        <div class="profile-header">
            <div class="avatar">${avatarHTML}</div>
            <div style="display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;" onclick="openAccountSwitcher()">
                <h2 style="margin:5px 0;">${targetUser.nickname} ${verifiedBadgeHTML}</h2>
                <span style="font-size:14px; color:#aaa;">▼</span>
            </div>
            <p style="color:#888; margin:0; font-size:13px;">@${targetUser.username}</p>
            <div style="margin-top:8px;"><span class="coin-badge">🪙 ${targetUser.coins || 0} Jeton</span></div>
            <div class="stats">
                <div><span>${followingCount}</span>Takip edilen</div>
                <div><span>${followersCount}</span>Takipçi</div>
                <div><span>${totalLikes}</span>Beğeni</div>
            </div>
            <p style="color:#ccc; font-size:13px; margin-bottom:15px;">${targetUser.bio}</p>
            <div style="display:flex; gap:10px; justify-content:center;">
                ${isMe ? `<button onclick="document.getElementById('editModal').style.display='flex'" style="padding:8px 25px; background:#2f2f2f; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Profili Düzenle</button>` : `<a href="/follow/${targetUser._id}" style="padding:8px 25px; background:${isFollowing ? '#333' : '#FE2C55'}; color:#fff; border-radius:6px; font-weight:bold; display:flex; align-items:center;">${isFollowing ? 'Takiptesin' : 'Takip Et'}</a>`}
                ${isMe ? `<a href="/logout" style="padding:8px 15px; background:#333; color:#ff4d4d; border-radius:6px; font-weight:bold; display:flex; align-items:center; font-size:13px;">Çıkış Yap</a>` : ''}
            </div>
        </div>

        <div class="profile-tabs">
            <a href="/profile/${targetUser.username}?tab=videos" class="${tab === 'videos' ? 'active' : ''}">🎬 Videolar</a>
            <a href="/profile/${targetUser.username}?tab=likes" class="${tab === 'likes' ? 'active' : ''}">❤️ Beğenilenler</a>
            <a href="/profile/${targetUser.username}?tab=favorites" class="${tab === 'favorites' ? 'active' : ''}">⭐ Favoriler</a>
        </div>

        <div class="grid">${videoHTML || '<p style="grid-column: span 3; text-align: center; color: #666; padding: 40px;">İçerik bulunamadı.</p>'}</div>
        
        <div id="videoPopupModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:999999; justify-content:center; align-items:center;">
            <span onclick="closeVideoPopup()" style="position:absolute; top:20px; right:20px; color:#fff; font-size:30px; cursor:pointer; z-index:1000000;">✕</span>
            <div style="position:relative; max-width:400px; width:100%; height:80vh; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                <video id="popupVideoPlayer" src="" controls autoplay style="max-width:100%; max-height:80vh; object-fit:contain; border-radius:10px;"></video>
                <div id="popupVideoCaption" style="color:#fff; margin-top:10px; font-size:14px; text-align:center;"></div>
                <div id="popupVideoLikes" style="color:#ff4d4d; margin-top:5px; font-size:14px; font-weight:bold;"></div>
            </div>
        </div>

        <div id="accountModal" class="account-switcher-modal">
            <div class="account-switcher-content">
                <div style="padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; font-weight:bold; font-size:16px;">
                    <span>Hesap değiştir</span>
                    <span onclick="closeAccountSwitcher()" style="cursor:pointer; font-size:22px;">✕</span>
                </div>
                <div style="overflow-y:auto; flex-grow:1;">
                    ${accountsHTML}
                    <a href="/login" style="display:flex; align-items:center; gap:12px; padding:15px; color:#000; font-weight:bold;">
                        <div style="width:40px; height:40px; background:#f1f1f2; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px;">+</div>
                        <span>Hesap Ekle</span>
                    </a>
                </div>
            </div>
        </div>

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
        ${getNavbar('profile', req.session.user.username, false)}
    </body>
    </html>`);
});

app.get('/search', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
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
        let defaultSuggestions = ['motivasyon', 'greenlerin büyükşehir maceraları', 'calisthenics workout', 'huzurlu videoları aesthetic', 'Kore Dizileri Burda', 'motivation video', 'kola tersine soyuducu', 'hallonda'];
        
        userSearches.forEach(s => {
            if(!defaultSuggestions.includes(s.query)) {
                defaultSuggestions.unshift(s.query);
            }
        });

        defaultSuggestions.forEach((item, index) => {
            let isRelated = index < userSearches.length;
            dynamicListHTML += `
            <a href="/search?q=${encodeURIComponent(item)}" style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid #f1f1f2; color:#000; font-size:15px;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <span style="width:6px; height:6px; background:${isRelated ? '#FE2C55' : '#888'}; border-radius:50%;"></span>
                    <span>${item}</span>
                </div>
                ${isRelated ? '<span style="font-size:12px; color:#888;">Aramanızla ilgili</span>' : ''}
            </a>`;
        });
    } else {
        dynamicListHTML += `<div style="padding:15px; font-weight:bold; font-size:16px; color:#000;">Kullanıcılar</div>`;
        if(searchResultsUsers.length > 0) {
            searchResultsUsers.forEach(u => {
                let uVerified = u.username.toLowerCase() === 'tiktok' ? '<span class="verified-badge">✔</span>' : '';
                dynamicListHTML += `<a href="/profile/${u.username}" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid #f1f1f2; color:#000;"><div style="width:36px; height:36px; background:#FE2C55; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">👤</div><div><b>${u.nickname} ${uVerified}</b><div style="font-size:12px; color:#888;">@${u.username}</div></div></a>`;
            });
        } else {
            dynamicListHTML += `<div style="padding:15px; color:#888; font-size:14px;">Kullanıcı bulunamadı.</div>`;
        }

        dynamicListHTML += `<div style="padding:15px; font-weight:bold; font-size:16px; color:#000; margin-top:10px;">Videolar</div>`;
        if(searchResultsVideos.length > 0) {
            searchResultsVideos.forEach(v => {
                dynamicListHTML += `<div style="padding:12px 16px; border-bottom:1px solid #f1f1f2; color:#000; font-size:14px;">🎬 <b>@${v.username}</b>: ${v.caption}</div>`;
            });
        } else {
            dynamicListHTML += `<div style="padding:15px; color:#888; font-size:14px;">Video bulunamadı.</div>`;
        }
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ara</title>
        <style>
            ${globalStyles}
            body { background: #fff; color: #000; padding-bottom: 70px; }
            .search-top-bar { display: flex; align-items: center; gap: 12px; padding: 12px 15px; background: #fff; border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 100; }
            .search-input-wrapper { flex-grow: 1; background: #f1f1f2; border-radius: 8px; display: flex; align-items: center; padding: 0 12px; height: 40px; gap: 10px; }
            .search-input-wrapper input { width: 100%; background: transparent; border: none; outline: none; font-size: 15px; color: #000; }
        </style>
    </head>
    <body>
        <div class="search-top-bar">
            <a href="/" style="font-size:24px; font-weight:bold; color:#000;">‹</a>
            <form action="/search" method="GET" class="search-input-wrapper">
                <span style="color:#666; font-size:16px;">🔍</span>
                <input type="text" name="q" placeholder="Arama yap..." value="${query}" autocomplete="off">
                <span style="color:#666; font-size:18px;">🎤</span>
            </form>
            <a href="/search" style="color:#FE2C55; font-weight:bold; font-size:15px;">Ara</a>
        </div>

        ${!query ? '<div style="padding:15px 15px 5px 15px; font-weight:bold; font-size:16px; color:#000; display:flex; justify-content:space-between; align-items:center;"><span>Şunları beğenebilirsiniz</span><span style="font-size:13px; color:#888; cursor:pointer;" onclick="location.reload()">🔄 Yenile</span></div>' : ''}
        
        <div style="background:#fff;">
            ${dynamicListHTML}
        </div>
    </body>
    </html>`);
});

app.get('/inbox', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
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
                if(isMyStory || '${req.session.user.username}' === 'tiktok') {
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
        ${getNavbar('inbox', req.session.user.username, false)}
    </body>
    </html>`);
});

app.get('/chat/:targetUser', async (req, res) => {
    if (!req.session.user || !isConnected) return res.redirect('/login');
    const target = await usersCol.findOne({ username: req.params.targetUser.toLowerCase() });
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

    let targetVerified = target.username.toLowerCase() === 'tiktok' ? '<span class="verified-badge">✔</span>' : '';

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
                    <div style="font-weight:bold; font-size:15px; color:#000;">${target.nickname} ${targetVerified}</div>
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
    if (!req.session.user || !isConnected) return res.redirect('/login');
    await messagesCol.insertOne({ sender: req.session.user.username, receiver: req.params.targetUser, text: req.body.text, createdAt: new Date() });
    res.redirect('back');
});

// ANA SAYFA & TOPLULUK & CANLI YAYIN LİSTESİ
app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const feedType = req.query.feed || 'foryou';
    let videos = [];
    let activeLives = [];

    if (isConnected) {
        if (feedType === 'community' || feedType === 'friends') {
            const follows = await followsCol.find({ follower_id: new ObjectId(req.session.user._id) }).toArray();
            const followingIds = follows.map(f => f.following_id);
            videos = await videosCol.find({ user_id: { $in: followingIds } }).sort({ _id: -1 }).toArray();
        } else {
            videos = await videosCol.find({}).sort({ _id: -1 }).toArray();
        }
        activeLives = await livesCol.find({}).sort({ _id: -1 }).toArray();
    }

    let isMod = req.session.user.username.toLowerCase() === 'tiktok';

    let feedHTML = '';
    for (let v of videos) {
        const comments = await commentsCol.find({ video_id: v._id }).sort({ _id: -1 }).toArray();
        let commentList = '';
        comments.forEach(c => {
            let commenterAvatar = c.avatar ? `<img src="${c.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : (c.nickname ? c.nickname.charAt(0).toUpperCase() : '👤');
            commentList += `
            <div class="comment-item">
                <div class="comment-avatar">${commenterAvatar}</div>
                <div class="comment-content" style="flex-grow:1;">
                    <div class="comment-author">${c.nickname || c.username}</div>
                    <div class="comment-text">${c.comment}</div>
                    ${c.image ? `<img src="${c.image}" class="comment-sticker">` : ''}
                    <div style="font-size:11px; color:#888; margin-top:4px; cursor:pointer; font-weight:bold;" onclick="replyToUser('${v._id}', '${c.nickname || c.username}')">Yanıtla</div>
                </div>
            </div>`;
        });

        let formattedCaption = (v.caption || '').replace(/(#\w+)/g, '<span style="color:#25F4EE; font-weight:bold;">$1</span>');
        let authorVerified = v.username.toLowerCase() === 'tiktok' ? '<span class="verified-badge">✔</span>' : '';
        let canDeleteVideo = (v.username.toLowerCase() === req.session.user.username.toLowerCase()) || isMod;

        feedHTML += `
        <div class="video-container" id="container-${v._id}">
            <video id="vid-${v._id}" src="${v.filename}" loop playsinline preload="auto" class="feed-video" onclick="toggleVideoPlay('vid-${v._id}')"></video>
            <div class="sound-toggle" onclick="toggleSound('vid-${v._id}', this)">🔊 Sesi Aç</div>
            
            <div class="video-info">
                <a href="/profile/${v.username}" style="font-weight: bold; font-size: 15px; text-shadow: 0 1px 2px #000;">@${v.username} ${authorVerified}</a>
                <p style="margin: 5px 0; font-size: 14px; text-shadow: 0 1px 2px #000;">${formattedCaption}</p>
                <p style="margin: 0; font-size: 12px; color: #ddd; text-shadow: 0 1px 2px #000;">🎵 ${v.song}</p>
            </div>
            
            <div class="sidebar-actions">
                <a href="/like/${v._id}" class="action-btn">❤️<span>${v.likes}</span></a>
                <a href="#" onclick="openComments('${v._id}'); return false;" class="action-btn">💬<span>${comments.length}</span></a>
                <a href="/favorite/${v._id}" class="action-btn">⭐<span>${v.favorites}</span></a>
                <a href="#" onclick="openShareModal(); return false;" class="action-btn">↗️<span>${v.shares}</span></a>
                ${canDeleteVideo ? `<a href="/delete-video/${v._id}" onclick="return confirm('Bu videoyu silmek istiyor musunuz?');" class="action-btn" style="background:rgba(255,0,0,0.6);" title="Mod Silme Yetkisi">🗑️<span>Sil</span></a>` : ''}
            </div>

            <div id="commentModal-${v._id}" class="comment-modal">
                <div class="comment-modal-header">
                    <span>${comments.length} yorum</span>
                    <span onclick="closeComments('${v._id}')" class="comment-close-btn">✕</span>
                </div>
                
                <form action="/comment/${v._id}" method="POST" enctype="multipart/form-data" class="comment-input-form" autocomplete="off">
                    <input type="text" id="commentInput-${v._id}" name="comment" placeholder="Yorum ekle..." autocomplete="off">
                    <input type="file" name="image" accept="image/*" style="display:none;" id="img-${v._id}">
                    <label for="img-${v._id}" style="cursor:pointer; font-size:20px; flex-shrink:0;">🖼️</label>
                    <button type="submit">Gönder</button>
                </form>

                <div class="comment-scroll-area">
                    ${commentList || '<div style="text-align:center; color:#888; margin-top:40px; font-size:14px;">Henüz yorum yok. İlk yorumu sen yap!</div>'}
                </div>
            </div>
        </div>`;
    }

    let livesModalHTML = '';
    activeLives.forEach(l => {
        let isPaused = l.status === 'paused';
        livesModalHTML += `
        <a href="/live/${l.username}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; border-bottom:1px solid #222; color:#fff;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:45px; height:45px; background:linear-gradient(135deg, #25F4EE, #FE2C55); border-radius:50%; padding:2px; display:flex; align-items:center; justify-content:center;">
                    <div style="width:100%; height:100%; background:#000; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">${isPaused ? '⏸️' : '🔴'}</div>
                </div>
                <div>
                    <div style="font-weight:bold; font-size:15px;">${l.nickname} <span style="background:${isPaused ? '#333' : '#FE2C55'}; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px;">${isPaused ? 'DURDURULDU' : 'CANLI'}</span></div>
                    <div style="font-size:12px; color:#888;">@${l.username} • 👥 ${l.viewers} izleyici</div>
                </div>
            </div>
            <span style="background:#FE2C55; color:#fff; padding:6px 14px; border-radius:15px; font-size:12px; font-weight:bold;">Katıl</span>
        </a>`;
    });

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
            
            .top-search-btn { position: fixed; top: 10px; right: 15px; z-index: 1005; color: #fff; font-size: 20px; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.3); }
            .top-live-btn { position: fixed; top: 10px; left: 15px; z-index: 1005; color: #fff; font-size: 20px; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: rgba(254,44,85,0.8); cursor: pointer; text-shadow: 0 1px 2px #000; }
            
            .feed-scroll { height: 100vh; overflow-y: scroll; scroll-snap-type: y mandatory; -webkit-overflow-scrolling: touch; }
            .video-container { width: 100vw; height: 100vh; scroll-snap-align: start; position: relative; display: flex; justify-content: center; align-items: center; background: #000; }
            
            .feed-video { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
            
            .video-info { position: absolute; bottom: 80px; left: 15px; z-index: 10; max-width: 70%; }
            .sidebar-actions { position: absolute; bottom: 90px; right: 15px; z-index: 10; display: flex; flex-direction: column; gap: 14px; align-items: center; }
            .action-btn { background: rgba(0,0,0,0.4); width: 42px; height: 42px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; color: #fff; }
            .sound-toggle { position: absolute; top: 65px; right: 15px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 12px; border-radius: 15px; font-size: 12px; z-index: 15; cursor: pointer; border: 1px solid rgba(255,255,255,0.3); }
            
            .comment-modal { display: none; position: fixed; bottom: 0; left: 0; width: 100%; height: 85vh; background: #ffffff; color: #000000; z-index: 30000; border-top-left-radius: 20px; border-top-right-radius: 20px; flex-direction: column; box-shadow: 0 -5px 25px rgba(0,0,0,0.5); }
            .comment-modal-header { padding: 12px 15px; border-bottom: 1px solid #f1f1f2; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 15px; position: relative; flex-shrink: 0; }
            .comment-close-btn { position: absolute; right: 15px; cursor: pointer; font-size: 20px; color: #000; }
            
            .comment-input-form { flex-shrink: 0; padding: 12px 15px; border-bottom: 1px solid #e2e2e3; display: flex; gap: 10px; background: #ffffff; align-items: center; width: 100%; }
            .comment-input-form input[type="text"] { flex-grow: 1; padding: 12px 16px; background: #f1f1f2; border: none; border-radius: 24px; outline: none; font-size: 14px; color: #000; }
            .comment-input-form button { background: #FE2C55; color: #fff; border: none; padding: 10px 18px; border-radius: 24px; font-weight: bold; cursor: pointer; font-size: 14px; flex-shrink: 0; }

            .comment-scroll-area { flex: 1 1 auto; overflow-y: auto; padding: 15px; background: #ffffff; min-height: 0; }
            .comment-item { display: flex; gap: 12px; margin-bottom: 16px; align-items: flex-start; }
            .comment-avatar { width: 36px; height: 36px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; overflow:hidden; font-weight:bold; }
            .comment-author { font-size: 13px; font-weight: bold; color: #555; }
            .comment-text { font-size: 14px; color: #111; margin-top: 3px; }
            .comment-sticker { max-width: 140px; border-radius: 8px; margin-top: 6px; display: block; }

            .share-modal { display: none; position: fixed; bottom: 0; left: 0; width: 100%; background: #1a1a1a; z-index: 50000; border-top-left-radius: 20px; border-top-right-radius: 20px; padding: 20px; box-sizing: border-box; text-align: center; }
            .share-options { display: flex; gap: 20px; overflow-x: auto; padding: 10px 0; justify-content: space-around; }
            .share-item { display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 12px; color: #aaa; cursor: pointer; }
            .share-icon-circle { width: 50px; height: 50px; background: #333; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #fff; }

            .lives-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 200000; justify-content: center; align-items: flex-end; }
            .lives-content { background: #1a1a1a; color: #fff; width: 100%; max-height: 75vh; border-top-left-radius: 20px; border-top-right-radius: 20px; display: flex; flex-direction: column; overflow: hidden; }

            /* Yayın Başlatma Uyarı & Geri Sayım Modalı */
            .live-alert-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 300000; justify-content: center; align-items: center; }
            .live-alert-card { background: #1f1f1f; color: #fff; padding: 30px; border-radius: 16px; width: 90%; max-width: 380px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.7); }
        </style>
        <script>
            let globalMutedState = true;

            function toggleSound(id, btn) {
                const vid = document.getElementById(id);
                if (vid.muted) { vid.muted = false; vid.play(); globalMutedState = false; btn.innerText = "🔇 Sesi Kapat"; } 
                else { vid.muted = true; globalMutedState = true; btn.innerText = "🔊 Sesi Aç"; }
            }

            function toggleVideoPlay(id) {
                const vid = document.getElementById(id);
                if (vid.paused) { vid.play(); } else { vid.pause(); }
            }

            function openComments(id) { document.getElementById('commentModal-' + id).style.display = 'flex'; }
            function closeComments(id) { document.getElementById('commentModal-' + id).style.display = 'none'; }

            function replyToUser(videoId, nickname) {
                const input = document.getElementById('commentInput-' + videoId);
                input.value = '@' + nickname + ' ';
                input.focus();
            }

            function openShareModal() {
                document.getElementById('shareModal').style.display = 'block';
            }
            function closeShareModal() {
                document.getElementById('shareModal').style.display = 'none';
            }
            function copyLink() {
                navigator.clipboard.writeText(window.location.href);
                alert('Bağlantı panoya kopyalandı!');
                closeShareModal();
            }

            function openLivesModal() {
                document.getElementById('livesModal').style.display = 'flex';
            }
            function closeLivesModal() {
                document.getElementById('livesModal').style.display = 'none';
            }

            let countdownTimer = null;
            function triggerLiveAlert() {
                document.getElementById('livesModal').style.display = 'none';
                document.getElementById('liveAlertModal').style.display = 'flex';
                
                let secondsLeft = 5;
                const btn = document.getElementById('liveConfirmBtn');
                const text = document.getElementById('countdownText');
                
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.innerText = 'Lütfen bekleyin (' + secondsLeft + 's)';

                if(countdownTimer) clearInterval(countdownTimer);

                countdownTimer = setInterval(() => {
                    secondsLeft--;
                    if(secondsLeft > 0) {
                        btn.innerText = 'Lütfen bekleyin (' + secondsLeft + 's)';
                    } else {
                        clearInterval(countdownTimer);
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        btn.innerText = 'Tamam - Yayın Başlat 🔴';
                    }
                }, 1000);
            }

            function closeLiveAlert() {
                if(countdownTimer) clearInterval(countdownTimer);
                document.getElementById('liveAlertModal').style.display = 'none';
            }

            function confirmStartLive() {
                window.location.href = '/start-live';
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
        <div class="top-live-btn" onclick="openLivesModal()" title="Canlı Yayınlar">📡</div>
        
        <div class="top-tabs">
            <a href="/?feed=community" class="${feedType === 'community' ? 'active' : ''}">Topluluk</a>
            <a href="/?feed=following" class="${feedType === 'following' ? 'active' : ''}">Takipte</a>
            <a href="/?feed=foryou" class="${feedType === 'foryou' ? 'active' : ''}">Sizin İçin</a>
        </div>

        <a href="/search" class="top-search-btn">🔍</a>

        <div class="feed-scroll">
            ${feedHTML || '<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:#666;">Hiç video bulunamadı.</div>'}
        </div>

        <div id="livesModal" class="lives-modal">
            <div class="lives-content">
                <div style="padding:15px; border-bottom:1px solid #222; display:flex; justify-content:space-between; align-items:center; font-weight:bold; font-size:16px;">
                    <span>📡 Aktif Canlı Yayınlar</span>
                    <span onclick="closeLivesModal()" style="cursor:pointer; font-size:22px;">✕</span>
                </div>
                <div style="padding:15px; background:#121212; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:13px; color:#aaa;">Yayın aç, her 30 dk'da 50 jeton kazan!</span>
                    <button onclick="triggerLiveAlert()" style="background:#FE2C55; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; font-size:13px; cursor:pointer;">Yayın Aç 🔴</button>
                </div>
                <div style="overflow-y:auto; flex-grow:1;">
                    ${livesModalHTML || '<div style="text-align:center; color:#777; padding:40px;">Şu an aktif canlı yayın bulunmuyor. İlk yayını sen aç!</div>'}
                </div>
            </div>
        </div>

        <!-- YAYIN BAŞLATMA UYARI VE GERİ SAYIM MODALI -->
        <div id="liveAlertModal" class="live-alert-modal">
            <div class="live-alert-card">
                <h3 style="color:#FE2C55; margin-top:0;">Canlı Yayın Bilgilendirmesi 🔴</h3>
                <p style="font-size:14px; color:#ddd; line-height:1.5;">
                    Canlı yayın açarak izleyicilerinizle sohbet edebilir, sandık kutusu dağıtabilir ve <b>her 30 dakikada bir otomatik olarak 50 ücretsiz jeton</b> kazanabilirsiniz!<br><br>Yayına başlamak için lütfen güvenlik ve hazırlık için aşağıdaki sürenin dolmasını bekleyin.
                </p>
                <button id="liveConfirmBtn" onclick="confirmStartLive()" style="width:100%; background:#FE2C55; color:#fff; border:none; padding:12px; border-radius:8px; font-weight:bold; font-size:15px; cursor:pointer; margin-top:10px;">Tamam - Yayın Başlat 🔴</button>
                <button onclick="closeLiveAlert()" style="width:100%; background:#333; color:#fff; border:none; padding:10px; border-radius:8px; font-weight:bold; font-size:13px; cursor:pointer; margin-top:8px;">İptal</button>
            </div>
        </div>

        <div id="shareModal" class="share-modal">
            <div style="font-weight:bold; margin-bottom:15px; font-size:15px;">Paylaş</div>
            <div class="share-options">
                <div class="share-item" onclick="copyLink()"><div class="share-icon-circle">🔗</div>Bağlantıyı Kopyala</div>
                <div class="share-item" onclick="alert('WhatsApp ile paylaşıldı!')"><div class="share-icon-circle" style="background:#25D366;">💬</div>WhatsApp</div>
                <div class="share-item" onclick="alert('Mesaj olarak gönderildi!')"><div class="share-icon-circle" style="background:#FE2C55;">✉️</div>Gönder</div>
            </div>
            <button onclick="closeShareModal()" style="background:#333; border:none; color:#fff; padding:10px; width:100%; border-radius:8px; margin-top:15px; font-weight:bold;">İptal</button>
        </div>

        ${getNavbar('home', req.session.user.username, feedType === 'friends')}
    </body>
    </html>
    `);
});

const SITE_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT;

function keepAlive() {
    https.get(SITE_URL, (res) => {
        console.log(`[Canlı Bot] İstek atıldı, durum kodu: ${res.statusCode}`);
    }).on('error', (err) => {
        try {
            const http = require('http');
            http.get(SITE_URL, (res) => {});
        } catch (e) {}
    });
}

setInterval(keepAlive, 5 * 60 * 1000);

app.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda aktif.`); });

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const db = new sqlite3.Database('./users.db');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'gizli-anahtar-123',
    resave: false,
    saveUninitialized: true
}));

// Veritabanı Tablosu
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        nickname TEXT,
        password TEXT
    )`);
});

// Kayıt Olma
app.post('/register', async (req, res) => {
    const { username, nickname, password } = req.body;
    if (!username || !nickname || !password) return res.send("Tüm alanları doldurun. <a href='/'>Geri dön</a>");

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, nickname, password) VALUES (?, ?, ?)`, 
            [username, nickname, hashedPassword], 
            (err) => {
                if (err) return res.send("Bu kullanıcı adı zaten alınmış. <a href='/'>Geri dön</a>");
                res.send("Kayıt başarılı! <a href='/'>Giriş yapmak için tıkla</a>");
            }
        );
    } catch {
        res.send("Bir hata oluştu. <a href='/'>Geri dön</a>");
    }
});

// Giriş Yapma
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err || !user) return res.send("Kullanıcı bulunamadı. <a href='/'>Geri dön</a>");
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = user;
            res.send(`Hoş geldin ${user.nickname} (@${user.username})! <br><a href='/'>Çıkış yap / Ana sayfa</a>`);
        } else {
            res.send("Hatalı şifre. <a href='/'>Geri dön</a>");
        }
    });
});

// Ana Sayfa Tasarımı
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TikTok Benzeri Site</title>
        <style>
            body { font-family: Arial, sans-serif; background: #121212; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .box { background: #1e1e1e; padding: 25px; border-radius: 12px; width: 320px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
            input { width: 90%; padding: 12px; margin: 8px 0; border-radius: 6px; border: none; background: #2b2b2b; color: #fff; }
            button { width: 95%; padding: 12px; background: #fe2c55; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 5px; }
            button.login-btn { background: #25f4ee; color: #000; }
            h2 { margin-bottom: 15px; font-size: 20px; }
        </style>
    </head>
    <body>
        <div class="box">
            <h2>Kayıt Ol</h2>
            <form action="/register" method="POST">
                <input type="text" name="username" placeholder="Kullanıcı Adı (Örn: ahmet123)" required><br>
                <input type="text" name="nickname" placeholder="Takma Ad (Görünen İsim)" required><br>
                <input type="password" name="password" placeholder="Şifre" required><br>
                <button type="submit">Kayıt Ol</button>
            </form>
            <hr style="margin: 20px 0; border-color: #333;">
            <h2>Giriş Yap</h2>
            <form action="/login" method="POST">
                <input type="text" name="username" placeholder="Kullanıcı Adı" required><br>
                <input type="password" name="password" placeholder="Şifre" required><br>
                <button type="submit" class="login-btn">Giriş Yap</button>
            </form>
        </div>
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
});

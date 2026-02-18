import express from "express";
import session from "express-session";
import sqlite3 from "sqlite3";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static("public"));

app.use(session({
  secret: "monster-secret",
  resave: false,
  saveUninitialized: false
}));

// Use persistent disk on Render
const db = new sqlite3.Database("/data/game.db");

// Create tables
db.serialize(() => {
  db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    coins INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0
  )`);

  db.run(`
  CREATE TABLE IF NOT EXISTS monsters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    hp INTEGER,
    attack INTEGER,
    defense INTEGER,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0
  )`);
});

// SIGNUP
app.post("/signup", (req, res) => {
  const { username, password } = req.body;

  db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    [username, password],
    function (err) {
      if (err) return res.json({ success: false });

      const userId = this.lastID;

      // Give starter monster
      db.run(
        `INSERT INTO monsters (user_id, name, hp, attack, defense)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, "FlameWolf", 100, 20, 10]
      );

      res.json({ success: true });
    }
  );
});

// LOGIN
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    `SELECT * FROM users WHERE username = ? AND password = ?`,
    [username, password],
    (err, user) => {
      if (!user) return res.json({ success: false });

      req.session.userId = user.id;
      res.json({ success: true });
    }
  );
});

// Get player stats
app.get("/me", (req, res) => {
  if (!req.session.userId) return res.json(null);

  db.get(
    `SELECT username, coins, xp, level, wins, losses
     FROM users WHERE id = ?`,
    [req.session.userId],
    (err, user) => {
      res.json(user);
    }
  );
});


// ---------------- MULTIPLAYER ----------------

let queue = [];
let battles = {};

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "findMatch") {
      queue.push(ws);

      if (queue.length >= 2) {
        const p1 = queue.shift();
        const p2 = queue.shift();

        const roomId = Date.now().toString();

        battles[roomId] = {
          p1,
          p2,
          turn: p1,
          p1hp: 100,
          p2hp: 100
        };

        p1.send(JSON.stringify({ type: "start", roomId, you: 1 }));
        p2.send(JSON.stringify({ type: "start", roomId, you: 2 }));
      }
    }

    if (data.type === "attack") {
      const battle = battles[data.roomId];
      if (!battle) return;

      if (battle.turn !== ws) return;

      let damage = Math.floor(Math.random() * 15) + 10;

      if (ws === battle.p1) {
        battle.p2hp -= damage;
        battle.turn = battle.p2;
      } else {
        battle.p1hp -= damage;
        battle.turn = battle.p1;
      }

      battle.p1.send(JSON.stringify({
        type: "update",
        p1hp: battle.p1hp,
        p2hp: battle.p2hp
      }));

      battle.p2.send(JSON.stringify({
        type: "update",
        p1hp: battle.p1hp,
        p2hp: battle.p2hp
      }));

      if (battle.p1hp <= 0 || battle.p2hp <= 0) {
        const winner = battle.p1hp > 0 ? battle.p1 : battle.p2;

        winner.send(JSON.stringify({ type: "win" }));

        delete battles[data.roomId];
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});

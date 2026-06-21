const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const root = __dirname;
const envPath = path.join(root, ".env");
const dbPath = process.env.DB_PATH || path.join(root, "jogolandia.db");

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);

    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1");
const publicUrl = process.env.PUBLIC_URL || `http://localhost:${port}`;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

const db = new DatabaseSync(dbPath);
const userColumns = db.prepare("PRAGMA table_info(users)").all();

if (userColumns.some((column) => column.name === "email")) {
  const suffix = Date.now();
  const hasSessions = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sessions'").get();
  db.exec(`ALTER TABLE users RENAME TO users_email_backup_${suffix};`);

  if (hasSessions) {
    db.exec(`ALTER TABLE sessions RENAME TO sessions_email_backup_${suffix};`);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function send(response, status, data) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(data));
}

function logSafeError(context, error) {
  console.error(`[${context}] ${error.code || error.name || "Error"}: ${error.message}`);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 100_000) {
        request.destroy();
        reject(new Error("Body muito grande."));
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function parseJsonBody(request) {
  return readBody(request).then((body) => JSON.parse(body || "{}"));
}

function normalizeNickname(nickname) {
  return String(nickname || "").trim();
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, storedHash) {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
}

function publicUser(user) {
  return {
    id: user.id,
    nickname: user.nickname,
  };
}

function createSession(userId) {
  const token = createToken();
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;

  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt);
  return token;
}

function getSessionUser(token) {
  if (!token) {
    return null;
  }

  const row = db
    .prepare(
      `SELECT users.id, users.nickname
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ? AND sessions.expires_at > ?`,
    )
    .get(token, Date.now());

  return row || null;
}

async function handleRegister(request, response) {
  try {
    const body = await parseJsonBody(request);
    const nickname = normalizeNickname(body.nickname);
    const password = String(body.password || "");

    if (nickname.length < 3 || nickname.length > 18) {
      send(response, 400, { ok: false, message: "Nickname precisa ter entre 3 e 18 caracteres." });
      return;
    }

    if (password.length < 6) {
      send(response, 400, { ok: false, message: "Senha precisa ter pelo menos 6 caracteres." });
      return;
    }

    if (db.prepare("SELECT id FROM users WHERE lower(nickname) = lower(?)").get(nickname)) {
      send(response, 409, { ok: false, message: "Este nickname ja esta em uso." });
      return;
    }

    const passwordData = hashPassword(password);

    db.prepare(
      `INSERT INTO users (nickname, password_hash, salt)
       VALUES (?, ?, ?)`,
    ).run(nickname, passwordData.hash, passwordData.salt);
    send(response, 201, { ok: true, message: "Conta criada. Agora voce pode fazer login." });
  } catch (error) {
    logSafeError("register", error);
    send(response, 500, { ok: false, message: "Nao foi possivel criar a conta." });
  }
}

async function handleLogin(request, response) {
  try {
    const body = await parseJsonBody(request);
    const nickname = normalizeNickname(body.nickname);
    const password = String(body.password || "");
    const user = db.prepare("SELECT * FROM users WHERE lower(nickname) = lower(?)").get(nickname);

    if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
      send(response, 401, { ok: false, message: "Nickname ou senha incorretos." });
      return;
    }

    send(response, 200, { ok: true, token: createSession(user.id), user: publicUser(user) });
  } catch (error) {
    logSafeError("login", error);
    send(response, 500, { ok: false, message: "Nao foi possivel entrar agora." });
  }
}

async function handleSession(request, response) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const user = getSessionUser(token);

  if (!user) {
    send(response, 401, { ok: false, message: "Sessao expirada." });
    return;
  }

  send(response, 200, { ok: true, user: publicUser(user) });
}

async function handleChangePassword(request, response) {
  try {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    const sessionUser = getSessionUser(token);

    if (!sessionUser) {
      send(response, 401, { ok: false, message: "Sessao expirada. Entre novamente." });
      return;
    }

    const body = await parseJsonBody(request);
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (newPassword.length < 6) {
      send(response, 400, { ok: false, message: "Nova senha precisa ter pelo menos 6 caracteres." });
      return;
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(sessionUser.id);

    if (!user || !verifyPassword(currentPassword, user.salt, user.password_hash)) {
      send(response, 401, { ok: false, message: "Senha atual incorreta." });
      return;
    }

    const passwordData = hashPassword(newPassword);
    db.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").run(
      passwordData.hash,
      passwordData.salt,
      user.id,
    );
    send(response, 200, { ok: true, message: "Senha alterada com sucesso." });
  } catch (error) {
    logSafeError("change-password", error);
    send(response, 500, { ok: false, message: "Nao foi possivel alterar a senha." });
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    send(response, 200, { ok: true });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    send(response, 200, {
      ok: true,
      name: "Jogolandia",
      url: publicUrl,
      database: path.basename(dbPath),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/register") {
    handleRegister(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/login") {
    handleLogin(request, response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/session") {
    handleSession(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/change-password") {
    handleChangePassword(request, response);
    return;
  }

  const cleanPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(root, `.${cleanPath}`);

  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Jogolandia em ${publicUrl}`);
});

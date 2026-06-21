const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const path = require("path");
const tls = require("tls");
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
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    verify_token TEXT,
    reset_token TEXT,
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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
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
    email: user.email,
    verified: Boolean(user.verified),
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
      `SELECT users.id, users.nickname, users.email, users.verified
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ? AND sessions.expires_at > ?`,
    )
    .get(token, Date.now());

  return row || null;
}

function makeLink(request, hash) {
  const origin = request.headers.origin && request.headers.origin !== "null"
    ? request.headers.origin
    : publicUrl;
  return `${origin}/index.html#${hash}`;
}

function smtpCommand(socket, command, expectedCodes) {
  return new Promise((resolve, reject) => {
    let response = "";

    function cleanup() {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    }

    function onData(chunk) {
      response += chunk.toString("utf8");
      const lines = response.trimEnd().split(/\r?\n/);
      const lastLine = lines[lines.length - 1] || "";

      if (/^\d{3} /.test(lastLine)) {
        cleanup();
        const code = Number(lastLine.slice(0, 3));

        if (expectedCodes.includes(code)) {
          resolve(response);
        } else {
          reject(new Error(`SMTP respondeu ${code}: ${response}`));
        }
      }
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function onClose() {
      cleanup();
      reject(new Error("Conexao SMTP fechada antes da resposta."));
    }

    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("close", onClose);

    if (command) {
      socket.write(`${command}\r\n`);
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendSmtpEmail({ to, subject, html }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const secure = process.env.SMTP_SECURE === "true";
  const smtpPort = Number(process.env.SMTP_PORT || (secure ? 465 : 587));

  if (!host || !user || !pass || !from) {
    throw new Error("SMTP nao configurado.");
  }

  let socket = secure
    ? tls.connect({ host, port: smtpPort, servername: host })
    : net.connect({ host, port: smtpPort });

  socket.setEncoding("utf8");
  socket.setTimeout(15000, () => socket.destroy(new Error("Tempo esgotado ao conectar no SMTP.")));
  await smtpCommand(socket, "", [220]);
  await smtpCommand(socket, `EHLO ${host}`, [250]);

  if (!secure) {
    await smtpCommand(socket, "STARTTLS", [220]);
    socket = await new Promise((resolve, reject) => {
      const secureSocket = tls.connect({ socket, servername: host }, () => resolve(secureSocket));
      secureSocket.once("error", reject);
    });
    socket.setEncoding("utf8");
    socket.setTimeout(15000, () => socket.destroy(new Error("Tempo esgotado ao conectar no SMTP.")));
    await smtpCommand(socket, `EHLO ${host}`, [250]);
  }

  await smtpCommand(socket, "AUTH LOGIN", [334]);
  await smtpCommand(socket, Buffer.from(user).toString("base64"), [334]);
  await smtpCommand(socket, Buffer.from(pass).toString("base64"), [235]);
  await smtpCommand(socket, `MAIL FROM:<${from}>`, [250]);
  await smtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
  await smtpCommand(socket, "DATA", [354]);

  const message = [
    `From: Jogolandia <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
    ".",
  ].join("\r\n");

  await smtpCommand(socket, message, [250]);
  await smtpCommand(socket, "QUIT", [221]);
  socket.end();
}

async function sendAccountEmail({ type, user, link }) {
  const isReset = type === "reset";
  const subject = isReset ? "Redefina sua senha na Jogolandia" : "Autentique seu email na Jogolandia";
  const title = isReset ? "Redefinicao de senha" : "Confirme seu email";
  const action = isReset ? "Criar nova senha" : "Autenticar email";
  const safeNickname = escapeHtml(user.nickname || "jogador");
  const safeLink = escapeHtml(link);

  await sendSmtpEmail({
    to: user.email,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h1>${title}</h1>
        <p>Ola, ${safeNickname}.</p>
        <p>${isReset ? "Clique no botao abaixo para redefinir sua senha." : "Clique no botao abaixo para liberar seu login."}</p>
        <p><a href="${safeLink}" style="display:inline-block;background:#cf424d;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${action}</a></p>
        <p>Se o botao nao abrir, copie este link:</p>
        <p>${safeLink}</p>
      </div>
    `,
  });
}

async function handleSendEmail(request, response) {
  try {
    const body = JSON.parse(await readBody(request));
    const safeEmail = escapeHtml(body.email || "");
    const safeNickname = escapeHtml(body.nickname || "jogador");
    const safeLink = escapeHtml(body.link || "");

    if (!safeEmail || !safeLink || !["verify", "reset"].includes(body.type)) {
      send(response, 400, { ok: false, message: "Dados do email incompletos." });
      return;
    }

    const isReset = body.type === "reset";
    const subject = isReset ? "Redefina sua senha na Jogolandia" : "Autentique seu email na Jogolandia";
    const title = isReset ? "Redefinicao de senha" : "Confirme seu email";
    const action = isReset ? "Criar nova senha" : "Autenticar email";

    await sendSmtpEmail({
      to: body.email,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
          <h1>${title}</h1>
          <p>Ola, ${safeNickname}.</p>
          <p>${isReset ? "Clique no botao abaixo para redefinir sua senha." : "Clique no botao abaixo para liberar seu login."}</p>
          <p><a href="${safeLink}" style="display:inline-block;background:#cf424d;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${action}</a></p>
          <p>Se o botao nao abrir, copie este link:</p>
          <p>${safeLink}</p>
        </div>
      `,
    });

    send(response, 200, { ok: true });
  } catch (error) {
    logSafeError("send-email", error);
    const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    send(response, configured ? 500 : 503, {
      ok: false,
      message: configured ? "Nao foi possivel enviar o email." : "Envio de email ainda nao configurado.",
    });
  }
}

async function handleRegister(request, response) {
  try {
    const body = await parseJsonBody(request);
    const nickname = String(body.nickname || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (nickname.length < 3 || nickname.length > 18) {
      send(response, 400, { ok: false, message: "Nickname precisa ter entre 3 e 18 caracteres." });
      return;
    }

    if (!isEmailValid(email)) {
      send(response, 400, { ok: false, message: "Email invalido." });
      return;
    }

    if (password.length < 6) {
      send(response, 400, { ok: false, message: "Senha precisa ter pelo menos 6 caracteres." });
      return;
    }

    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
      send(response, 409, { ok: false, message: "Este email ja esta cadastrado." });
      return;
    }

    const verifyToken = createToken();
    const passwordData = hashPassword(password);
    const pendingUser = { nickname, email };
    const link = makeLink(request, `verify=${verifyToken}`);

    await sendAccountEmail({ type: "verify", user: pendingUser, link });

    db.prepare(
      `INSERT INTO users (nickname, email, password_hash, salt, verified, verify_token)
       VALUES (?, ?, ?, ?, 0, ?)`,
    ).run(nickname, email, passwordData.hash, passwordData.salt, verifyToken);
    send(response, 201, { ok: true, message: "Conta criada. Verifique seu email para liberar o login." });
  } catch (error) {
    logSafeError("register", error);
    send(response, 500, { ok: false, message: "Nao foi possivel criar a conta." });
  }
}

async function handleVerify(request, response) {
  try {
    const body = await parseJsonBody(request);
    const token = String(body.token || "");
    const user = db.prepare("SELECT id FROM users WHERE verify_token = ?").get(token);

    if (!user) {
      send(response, 400, { ok: false, message: "Link de verificacao invalido." });
      return;
    }

    db.prepare("UPDATE users SET verified = 1, verify_token = NULL WHERE id = ?").run(user.id);
    send(response, 200, { ok: true, message: "Email autenticado. Agora voce pode entrar." });
  } catch (error) {
    logSafeError("verify", error);
    send(response, 500, { ok: false, message: "Nao foi possivel confirmar o cadastro." });
  }
}

async function handleLogin(request, response) {
  try {
    const body = await parseJsonBody(request);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
      send(response, 401, { ok: false, message: "Email ou senha incorretos." });
      return;
    }

    if (!user.verified) {
      const link = makeLink(request, `verify=${user.verify_token}`);
      await sendAccountEmail({ type: "verify", user, link });
      send(response, 403, { ok: false, message: "Antes de entrar, autentique seu email. Reenviamos o link." });
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

async function handleRequestReset(request, response) {
  try {
    const body = await parseJsonBody(request);
    const email = normalizeEmail(body.email);
    const user = db.prepare("SELECT id, nickname, email FROM users WHERE email = ?").get(email);

    if (!user) {
      send(response, 404, { ok: false, message: "Nao encontramos uma conta com esse email." });
      return;
    }

    const resetToken = createToken();
    const link = makeLink(request, `reset=${resetToken}`);

    await sendAccountEmail({ type: "reset", user, link });
    db.prepare("UPDATE users SET reset_token = ? WHERE id = ?").run(resetToken, user.id);
    send(response, 200, { ok: true, message: "Enviamos o link de redefinicao." });
  } catch (error) {
    logSafeError("request-reset", error);
    send(response, 500, { ok: false, message: "Nao foi possivel enviar a redefinicao." });
  }
}

async function handleResetPassword(request, response) {
  try {
    const body = await parseJsonBody(request);
    const token = String(body.token || "");
    const password = String(body.password || "");

    if (password.length < 6) {
      send(response, 400, { ok: false, message: "Senha precisa ter pelo menos 6 caracteres." });
      return;
    }

    const user = db.prepare("SELECT id FROM users WHERE reset_token = ?").get(token);

    if (!user) {
      send(response, 400, { ok: false, message: "Link de redefinicao invalido ou expirado." });
      return;
    }

    const passwordData = hashPassword(password);
    db.prepare("UPDATE users SET password_hash = ?, salt = ?, reset_token = NULL WHERE id = ?").run(
      passwordData.hash,
      passwordData.salt,
      user.id,
    );
    send(response, 200, { ok: true, message: "Senha alterada. Entre com sua nova senha." });
  } catch (error) {
    logSafeError("reset-password", error);
    send(response, 500, { ok: false, message: "Nao foi possivel alterar a senha." });
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    send(response, 200, { ok: true });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "POST" && url.pathname === "/api/send-email") {
    handleSendEmail(request, response);
    return;
  }

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

  if (request.method === "POST" && url.pathname === "/api/verify-email") {
    handleVerify(request, response);
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

  if (request.method === "POST" && url.pathname === "/api/request-reset") {
    handleRequestReset(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reset-password") {
    handleResetPassword(request, response);
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

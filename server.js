const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const envPath = path.join(root, ".env");

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
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

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

function ensureSupabaseConfig() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase nao configurado no Render.");
  }
}

async function supabaseRequest(pathname, options = {}) {
  ensureSupabaseConfig();

  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.hint || `Supabase respondeu ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

function eq(value) {
  return `eq.${encodeURIComponent(value)}`;
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

function normalizeCpf(cpf) {
  return String(cpf || "").replace(/\D/g, "");
}

function isCpfValid(cpfValue) {
  const cpf = normalizeCpf(cpfValue);
  return cpf.length === 11;
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
  return { token, expiresAt };
}

async function getSessionUser(token) {
  if (!token) {
    return null;
  }

  const sessions = await supabaseRequest(
    `sessions?select=token,user_id,expires_at&token=${eq(token)}&expires_at=gt.${Date.now()}&limit=1`,
  );
  const session = sessions[0];

  if (!session) {
    return null;
  }

  const users = await supabaseRequest(`users?select=id,nickname&id=${eq(session.user_id)}&limit=1`);
  return users[0] || null;
}

async function countUsers() {
  const response = await fetch(`${supabaseUrl}/rest/v1/users?select=id`, {
    method: "HEAD",
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      Prefer: "count=exact",
    },
  });

  if (!response.ok) {
    return null;
  }

  const range = response.headers.get("content-range") || "";
  return Number(range.split("/")[1] || 0);
}

async function createAndStoreSession(userId) {
  const session = createSession(userId);

  await supabaseRequest("sessions", {
    method: "POST",
    body: JSON.stringify({
      token: session.token,
      user_id: userId,
      expires_at: session.expiresAt,
    }),
  });

  return session.token;
}

async function handleRegister(request, response) {
  try {
    const body = await parseJsonBody(request);
    const nickname = normalizeNickname(body.nickname);
    const cpf = normalizeCpf(body.cpf);
    const password = String(body.password || "");

    if (nickname.length < 3 || nickname.length > 18) {
      send(response, 400, { ok: false, message: "Nickname precisa ter entre 3 e 18 caracteres." });
      return;
    }

    if (password.length < 6) {
      send(response, 400, { ok: false, message: "Senha precisa ter pelo menos 6 caracteres." });
      return;
    }

    if (!isCpfValid(cpf)) {
      send(response, 400, { ok: false, message: "CPF invalido." });
      return;
    }

    const existingNickname = await supabaseRequest(`users?select=id&nickname=ilike.${encodeURIComponent(nickname)}&limit=1`);

    if (existingNickname.length) {
      send(response, 409, { ok: false, message: "Este nickname ja esta em uso." });
      return;
    }

    const existingCpf = await supabaseRequest(`users?select=id&cpf=${eq(cpf)}&limit=1`);

    if (existingCpf.length) {
      send(response, 409, { ok: false, message: "Este CPF ja esta cadastrado." });
      return;
    }

    const passwordData = hashPassword(password);

    const createdUsers = await supabaseRequest("users", {
      method: "POST",
      body: JSON.stringify({
        nickname,
        cpf,
        password_hash: passwordData.hash,
        salt: passwordData.salt,
      }),
    });
    const user = createdUsers[0];
    send(response, 201, {
      ok: true,
      message: "Conta criada. Entrando no painel...",
      token: await createAndStoreSession(user.id),
      user: publicUser(user),
    });
  } catch (error) {
    logSafeError("register", error);
    send(response, 500, { ok: false, message: "Nao foi possivel criar a conta." });
  }
}

async function handleLogin(request, response) {
  try {
    const body = await parseJsonBody(request);
    const cpf = normalizeCpf(body.cpf);
    const password = String(body.password || "");
    const users = await supabaseRequest(`users?select=*&cpf=${eq(cpf)}&limit=1`);
    const user = users[0];

    if (!user) {
      send(response, 404, { ok: false, message: "CPF nao cadastrado. Faca o cadastro primeiro." });
      return;
    }

    if (!verifyPassword(password, user.salt, user.password_hash)) {
      send(response, 401, { ok: false, message: "Senha incorreta." });
      return;
    }

    send(response, 200, { ok: true, token: await createAndStoreSession(user.id), user: publicUser(user) });
  } catch (error) {
    logSafeError("login", error);
    send(response, 500, { ok: false, message: "Nao foi possivel entrar agora." });
  }
}

async function handleSession(request, response) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const user = await getSessionUser(token);

  if (!user) {
    send(response, 401, { ok: false, message: "Sessao expirada." });
    return;
  }

  send(response, 200, { ok: true, user: publicUser(user) });
}

async function handleChangePassword(request, response) {
  try {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    const sessionUser = await getSessionUser(token);

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

    const users = await supabaseRequest(`users?select=*&id=${eq(sessionUser.id)}&limit=1`);
    const user = users[0];

    if (!user || !verifyPassword(currentPassword, user.salt, user.password_hash)) {
      send(response, 401, { ok: false, message: "Senha atual incorreta." });
      return;
    }

    const passwordData = hashPassword(newPassword);
    await supabaseRequest(`users?id=${eq(user.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        password_hash: passwordData.hash,
        salt: passwordData.salt,
      }),
    });
    send(response, 200, { ok: true, message: "Senha alterada com sucesso." });
  } catch (error) {
    logSafeError("change-password", error);
    send(response, 500, { ok: false, message: "Nao foi possivel alterar a senha." });
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    send(response, 200, { ok: true });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    try {
      send(response, 200, {
        ok: true,
        name: "Jogolandia",
        url: publicUrl,
        database: "supabase",
        users: await countUsers(),
      });
    } catch (error) {
      send(response, 500, { ok: false, message: error.message });
    }
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

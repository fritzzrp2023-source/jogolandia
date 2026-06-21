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
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(data));
}

function logSafeError(context, error) {
  console.error(`[${context}] ${error.code || error.name || "Error"}: ${error.message}`);
}

function isSchemaError(error, name) {
  const text = `${error.message || ""} ${JSON.stringify(error.details || {})}`.toLowerCase();
  return text.includes(String(name).toLowerCase());
}

function sendSchemaError(response, area = "banco de dados") {
  send(response, 500, {
    ok: false,
    message: `Falta configurar o ${area} no Supabase. Rode o arquivo SUPABASE-COMPLETO.sql no SQL Editor.`,
  });
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
    publicId: getPublicId(user),
    nickname: user.nickname,
    cpf: user.cpf,
  };
}

function createPublicId() {
  return String(1000000000 + crypto.randomInt(9000000000));
}

async function createUniquePublicId() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const publicId = createPublicId();
    const existing = await supabaseRequest(`users?select=id&public_id=${eq(publicId)}&limit=1`);

    if (!existing.length) {
      return publicId;
    }
  }

  throw new Error("Nao foi possivel gerar ID publico.");
}

function getPublicId(user) {
  return user.public_id || String(user.id).padStart(10, "0");
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

  const users = await supabaseRequest(`users?select=*&id=${eq(session.user_id)}&limit=1`);
  return users[0] || null;
}

async function requireSessionUser(request, response) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const sessionUser = await getSessionUser(token);

  if (!sessionUser) {
    send(response, 401, { ok: false, message: "Sessao expirada. Entre novamente." });
    return null;
  }

  return sessionUser;
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

    const publicId = await createUniquePublicId();
    const createdUsers = await supabaseRequest("users", {
      method: "POST",
      body: JSON.stringify({
        nickname,
        cpf,
        public_id: publicId,
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
    if (isSchemaError(error, "public_id")) {
      sendSchemaError(response, "ID publico dos usuarios");
      return;
    }
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
  const user = await requireSessionUser(request, response);

  if (!user) {
    return;
  }

  send(response, 200, { ok: true, user: publicUser(user) });
}

async function handleProfile(request, response) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    if (request.method === "GET") {
      send(response, 200, { ok: true, user: publicUser(sessionUser) });
      return;
    }

    const body = await parseJsonBody(request);
    const nickname = normalizeNickname(body.nickname);

    if (nickname.length < 3 || nickname.length > 18) {
      send(response, 400, { ok: false, message: "Nickname precisa ter entre 3 e 18 caracteres." });
      return;
    }

    const existing = await supabaseRequest(
      `users?select=id&nickname=ilike.${encodeURIComponent(nickname)}&id=neq.${sessionUser.id}&limit=1`,
    );

    if (existing.length) {
      send(response, 409, { ok: false, message: "Este nickname ja esta em uso." });
      return;
    }

    const updated = await supabaseRequest(`users?id=${eq(sessionUser.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ nickname }),
    });

    send(response, 200, { ok: true, user: publicUser(updated[0]) });
  } catch (error) {
    logSafeError("profile", error);
    send(response, 500, { ok: false, message: "Nao foi possivel salvar os dados da conta." });
  }
}

async function getOnlineUserIds(userIds) {
  if (!userIds.length) {
    return new Set();
  }

  const sessions = await supabaseRequest(
    `sessions?select=user_id&user_id=in.(${userIds.join(",")})&expires_at=gt.${Date.now()}`,
  );

  return new Set(sessions.map((session) => Number(session.user_id)));
}

async function handleFriends(request, response) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const friendships = await supabaseRequest(
      `friendships?select=id,requester_id,addressee_id,status&or=(requester_id.eq.${sessionUser.id},addressee_id.eq.${sessionUser.id})`,
    );
    const otherIds = friendships.map((friendship) => (
      Number(friendship.requester_id) === Number(sessionUser.id) ? friendship.addressee_id : friendship.requester_id
    ));

    if (!otherIds.length) {
      send(response, 200, { ok: true, friends: [] });
      return;
    }

    const users = await supabaseRequest(`users?select=*&id=in.(${otherIds.join(",")})`);
    const onlineIds = await getOnlineUserIds(otherIds);
    const friends = friendships.map((friendship) => {
      const otherId = Number(friendship.requester_id) === Number(sessionUser.id)
        ? Number(friendship.addressee_id)
        : Number(friendship.requester_id);
      const user = users.find((item) => Number(item.id) === otherId);
      const received = Number(friendship.addressee_id) === Number(sessionUser.id);
      const statusText = friendship.status === "accepted"
        ? "amigo"
        : received ? "convite recebido" : "convite enviado";

      return {
        id: otherId,
        publicId: user ? getPublicId(user) : String(otherId).padStart(10, "0"),
        friendshipId: friendship.id,
        nickname: user?.nickname || `Usuario ${otherId}`,
        status: friendship.status,
        statusText,
        canAccept: received && friendship.status === "pending",
        online: onlineIds.has(otherId),
      };
    });

    send(response, 200, { ok: true, friends });
  } catch (error) {
    logSafeError("friends", error);
    if (isSchemaError(error, "friendships") || isSchemaError(error, "public_id")) {
      sendSchemaError(response, "sistema de amigos");
      return;
    }
    send(response, 500, { ok: false, message: "Nao foi possivel carregar amigos agora." });
  }
}

async function handleFriendInvite(request, response) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const body = await parseJsonBody(request);
    const friendPublicId = String(body.friendId || "").replace(/\D/g, "");

    if (friendPublicId.length !== 10) {
      send(response, 400, { ok: false, message: "O ID do amigo precisa ter 10 numeros." });
      return;
    }

    if (friendPublicId === getPublicId(sessionUser)) {
      send(response, 400, { ok: false, message: "Digite o ID de outro usuario." });
      return;
    }

    const target = await supabaseRequest(`users?select=id,public_id,nickname&public_id=${eq(friendPublicId)}&limit=1`);

    if (!target.length) {
      send(response, 404, { ok: false, message: "Usuario nao encontrado com esse ID." });
      return;
    }

    const friendId = Number(target[0].id);
    const low = Math.min(Number(sessionUser.id), friendId);
    const high = Math.max(Number(sessionUser.id), friendId);
    const existing = await supabaseRequest(
      `friendships?select=id,status&user_low=${eq(low)}&user_high=${eq(high)}&limit=1`,
    );

    if (existing.length) {
      send(response, 409, { ok: false, message: "Ja existe convite ou amizade com esse usuario." });
      return;
    }

    await supabaseRequest("friendships", {
      method: "POST",
      body: JSON.stringify({
        requester_id: sessionUser.id,
        addressee_id: friendId,
        user_low: low,
        user_high: high,
        status: "pending",
      }),
    });

    send(response, 201, { ok: true, message: `Convite enviado para ${target[0].nickname}.` });
  } catch (error) {
    logSafeError("friend-invite", error);
    if (isSchemaError(error, "friendships") || isSchemaError(error, "public_id")) {
      sendSchemaError(response, "sistema de amigos");
      return;
    }
    send(response, 500, { ok: false, message: "Nao foi possivel enviar o convite agora." });
  }
}

async function handleFriendAccept(request, response) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const body = await parseJsonBody(request);
    const friendshipId = Number(body.friendshipId);
    const friendship = await supabaseRequest(
      `friendships?select=id,addressee_id,status&id=${eq(friendshipId)}&limit=1`,
    );

    if (!friendship.length || Number(friendship[0].addressee_id) !== Number(sessionUser.id)) {
      send(response, 404, { ok: false, message: "Convite nao encontrado." });
      return;
    }

    await supabaseRequest(`friendships?id=${eq(friendshipId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "accepted", updated_at: new Date().toISOString() }),
    });

    send(response, 200, { ok: true, message: "Convite aceito." });
  } catch (error) {
    logSafeError("friend-accept", error);
    send(response, 500, { ok: false, message: "Nao foi possivel aceitar o convite." });
  }
}

function calculateWinPoints({ mode, difficulty }) {
  const difficultyPoints = {
    easy: 10,
    normal: 20,
    hard: 35,
  };
  const modeBonus = {
    solo: 0,
    duel: 8,
    teams: 12,
  };

  return (difficultyPoints[difficulty] || difficultyPoints.normal) + (modeBonus[mode] || 0);
}

async function handleScoreWin(request, response) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const body = await parseJsonBody(request);
    const game = String(body.game || "hangman");
    const mode = String(body.mode || "solo");
    const difficulty = String(body.difficulty || "normal");
    const pointsEarned = calculateWinPoints({ mode, difficulty });

    const existing = await supabaseRequest(`user_scores?select=*&user_id=${eq(sessionUser.id)}&limit=1`);
    let score;

    if (existing.length) {
      const current = existing[0];
      const updated = await supabaseRequest(`user_scores?user_id=${eq(sessionUser.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          points: Number(current.points || 0) + pointsEarned,
          wins: Number(current.wins || 0) + 1,
          last_game: game,
          updated_at: new Date().toISOString(),
        }),
      });
      score = updated[0];
    } else {
      const created = await supabaseRequest("user_scores", {
        method: "POST",
        body: JSON.stringify({
          user_id: sessionUser.id,
          points: pointsEarned,
          wins: 1,
          last_game: game,
        }),
      });
      score = created[0];
    }

    send(response, 200, { ok: true, pointsEarned, score });
  } catch (error) {
    logSafeError("score-win", error);
    if (isSchemaError(error, "user_scores")) {
      sendSchemaError(response, "sistema de pontuacao");
      return;
    }
    send(response, 500, { ok: false, message: "Nao foi possivel salvar a pontuacao agora." });
  }
}

async function handleRanking(request, response) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const scores = await supabaseRequest("user_scores?select=user_id,points,wins&order=points.desc,wins.desc&limit=20");
    const userIds = scores.map((score) => Number(score.user_id));

    if (!userIds.length) {
      send(response, 200, { ok: true, ranking: [] });
      return;
    }

    const users = await supabaseRequest(`users?select=*&id=in.(${userIds.join(",")})`);
    const ranking = scores.map((score) => {
      const user = users.find((item) => Number(item.id) === Number(score.user_id));
      return {
        userId: Number(score.user_id),
        publicId: user ? getPublicId(user) : String(score.user_id).padStart(10, "0"),
        nickname: user?.nickname || `Usuario ${score.user_id}`,
        points: Number(score.points || 0),
        wins: Number(score.wins || 0),
      };
    });

    send(response, 200, { ok: true, ranking });
  } catch (error) {
    logSafeError("ranking", error);
    if (isSchemaError(error, "user_scores")) {
      sendSchemaError(response, "ranking");
      return;
    }
    send(response, 500, { ok: false, message: "Nao foi possivel carregar o ranking agora." });
  }
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
        name: "Jogarium",
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

  if ((request.method === "GET" || request.method === "PATCH") && url.pathname === "/api/profile") {
    handleProfile(request, response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/friends") {
    handleFriends(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/friends/invite") {
    handleFriendInvite(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/friends/accept") {
    handleFriendAccept(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/score/win") {
    handleScoreWin(request, response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/ranking") {
    handleRanking(request, response);
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
  console.log(`Jogarium em ${publicUrl}`);
});

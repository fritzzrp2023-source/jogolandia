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
  return String(1254879548 + crypto.randomInt(8745120452));
}

function createRoomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
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
  return user.public_id || String(1254879548 + Number(user.id || 0) - 1);
}

const hangmanWords = {
  easy: [
    "amizade", "equipe", "desafio", "segredo", "palavra", "jogador", "vitoria", "rodada", "dupla", "missao",
    "atalho", "memoria", "banana", "janela", "escola", "camisa", "mochila", "cidade", "ponte", "praia",
    "livro", "caneta", "teclado", "mouse", "boneco", "pipoca", "estrela", "planeta", "futebol", "corrida",
    "cozinha", "familia", "amigo", "brilho", "sonho", "risada", "tempo", "chuva", "vento", "barco",
    "floresta", "castelo", "mercado", "musica", "danca", "pintura", "lanche", "viagem", "jardim", "tesouro",
  ],
  normal: [
    "campeonato", "controle", "tabuleiro", "aventura", "partida", "estrategia", "conquista", "diversao", "energia", "convite",
    "ranking", "resposta", "misterio", "labirinto", "biblioteca", "montanha", "cachoeira", "telefone", "computador", "internet",
    "aplicativo", "personagem", "fantasia", "objetivo", "diamante", "carteira", "bicicleta", "passagem", "hospital", "fazenda",
    "universo", "galaxia", "planilha", "controle", "amizades", "campeao", "torneio", "desenho", "historia", "capitulo",
    "explorador", "charada", "pergunta", "resposta", "seguranca", "arquivo", "mensagem", "conexao", "velocidade", "pontuacao",
    "lideranca", "parceria", "criatividade", "rivalidade", "objetivos", "premiacao", "surpresa", "coragem", "talento", "vencedor",
  ],
  hard: [
    "raciocinio", "colaboracao", "comunicacao", "sobrevivencia", "inteligencia", "competitividade", "entretenimento", "planejamento", "concentracao", "persistencia",
    "responsabilidade", "desenvolvimento", "transformacao", "administracao", "multiplicacao", "programacao", "infraestrutura", "criptografia", "sincronizacao", "autenticacao",
    "descentralizacao", "extraordinario", "incompatibilidade", "profissionalismo", "interatividade", "personalidade", "representacao", "possibilidade", "conhecimento", "aprendizagem",
    "coordenacao", "comportamento", "especialidade", "investigacao", "arquitetura", "laboratorio", "observatorio", "meteorologia", "arqueologia", "fotografia",
    "enciclopedia", "constelacao", "protagonista", "imprevisivel", "independencia", "solidariedade", "organizacao", "experimentacao", "classificacao", "participacao",
  ],
};

const hangmanExpansionParts = {
  easy: {
    maxLength: 14,
    roots: [
      "abacaxi", "abelha", "abraco", "amigo", "amizade", "anel", "apito", "areia", "arvore", "aviao",
      "bala", "banana", "barco", "bicho", "bola", "bolacha", "boneca", "boneco", "brilho", "caderno",
      "cafe", "caixa", "camisa", "caneca", "caneta", "casa", "cavalo", "cidade", "clube", "coelho",
      "comida", "copo", "corda", "dado", "dedo", "doce", "equipe", "escada", "escola", "estrela",
      "familia", "farol", "festa", "fita", "flor", "fogao", "folha", "fruta", "garrafa", "gato",
      "janela", "jardim", "jogo", "lanche", "lapis", "leite", "livro", "lua", "mala", "mesa",
      "mochila", "moeda", "mouse", "navio", "nuvem", "olho", "papel", "parque", "pedra", "peixe",
      "pipoca", "pipa", "ponte", "porta", "praia", "prato", "queijo", "radio", "risada", "roda",
      "roupa", "sapato", "sino", "sol", "sorvete", "tempo", "tesouro", "tigre", "trem", "vento",
    ],
    modifiers: [
      "azul", "verde", "feliz", "doce", "leve", "novo", "forte", "rapido", "lento", "alto",
      "baixo", "claro", "escuro", "bravo", "manso", "quente", "frio", "bom", "legal", "macio",
      "duro", "cheio", "vazio", "grande", "pequeno", "redondo", "bonito", "colorido", "amarelo", "roxo",
    ],
  },
  normal: {
    maxLength: 18,
    roots: [
      "aventura", "biblioteca", "campeao", "campeonato", "capitulo", "charada", "conexao", "controle", "convite", "corrida",
      "criatividade", "desenho", "diamante", "diversao", "energia", "estrategia", "explorador", "fazenda", "fantasia", "galaxia",
      "historia", "hospital", "internet", "labirinto", "lideranca", "mensagem", "misterio", "montanha", "objetivo", "parceria",
      "partida", "passagem", "personagem", "planilha", "pontuacao", "premiacao", "pergunta", "ranking", "resposta", "rivalidade",
      "seguranca", "surpresa", "tabuleiro", "telefone", "torneio", "universo", "velocidade", "vencedor", "viagem", "vitoria",
      "arquivo", "bicicleta", "cachoeira", "carteira", "computador", "conquista", "coragem", "mercado", "missao", "teclado",
      "amizades", "aplicativo", "capitao", "cozinha", "desafio", "jogador", "memoria", "planeta", "projeto", "talento",
    ],
    modifiers: [
      "digital", "secreto", "rapido", "especial", "moderno", "brilhante", "criativo", "esperto", "corajoso", "divertido",
      "noturno", "diario", "online", "global", "virtual", "final", "inicial", "central", "principal", "surpresa",
      "coletivo", "familiar", "popular", "radical", "urbano", "magico", "lendario", "campeao", "completo", "perfeito",
    ],
  },
  hard: {
    maxLength: 22,
    roots: [
      "administracao", "aprendizagem", "arqueologia", "arquitetura", "autenticacao", "classificacao", "colaboracao", "comportamento", "comunicacao", "concentracao",
      "conhecimento", "constelacao", "criptografia", "descentralizacao", "desenvolvimento", "enciclopedia", "entretenimento", "especialidade", "experimentacao", "extraordinario",
      "fotografia", "imprevisivel", "incompatibilidade", "independencia", "infraestrutura", "inteligencia", "interatividade", "investigacao", "laboratorio", "meteorologia",
      "multiplicacao", "observatorio", "organizacao", "participacao", "persistencia", "personalidade", "planejamento", "possibilidade", "profissionalismo", "programacao",
      "protagonista", "raciocinio", "representacao", "responsabilidade", "sincronizacao", "solidariedade", "sobrevivencia", "transformacao", "competitividade", "coordenacao",
      "aperfeicoamento", "automatizacao", "compatibilidade", "complexidade", "confiabilidade", "contextualizacao", "documentacao", "especializacao", "hierarquia", "implementacao",
      "interpretacao", "metodologia", "otimizacao", "parametrizacao", "produtividade", "reestruturacao", "sustentabilidade", "visualizacao", "vulnerabilidade", "versatilidade",
    ],
    modifiers: [
      "avancado", "estrategico", "dinamico", "coletivo", "moderno", "complexo", "tecnico", "logico", "profundo", "preciso",
      "global", "digital", "virtual", "seguro", "rapido", "criativo", "analitico", "robusto", "intenso", "eficiente",
      "integrado", "continuo", "progressivo", "original", "central", "especial", "automatico", "inteligente", "competitivo", "colaborativo",
    ],
  },
};

function cleanHangmanWord(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function addHangmanWord(bank, value, maxLength) {
  const word = cleanHangmanWord(value);
  if (word.length >= 4 && word.length <= maxLength) {
    bank.add(word);
  }
}

function expandHangmanWordBank(level, target = 1200) {
  const parts = hangmanExpansionParts[level];
  const bank = new Set();

  hangmanWords[level].forEach((word) => addHangmanWord(bank, word, parts.maxLength));
  parts.roots.forEach((root) => addHangmanWord(bank, root, parts.maxLength));

  parts.roots.forEach((root) => {
    parts.modifiers.forEach((modifier) => {
      addHangmanWord(bank, `${root}${modifier}`, parts.maxLength);
      addHangmanWord(bank, `${modifier}${root}`, parts.maxLength);
    });
  });

  for (const first of parts.roots) {
    for (const second of parts.roots) {
      if (first !== second) {
        addHangmanWord(bank, `${first}${second}`, parts.maxLength);
      }
      if (bank.size >= target) break;
    }
    if (bank.size >= target) break;
  }

  hangmanWords[level] = [...bank].slice(0, target);
}

["easy", "normal", "hard"].forEach((level) => expandHangmanWordBank(level));

const difficultyRules = {
  easy: { maxMisses: 7 },
  normal: { maxMisses: 6 },
  hard: { maxMisses: 5 },
};

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function pickHangmanWord(dictionary, usedSource = []) {
  const usedWords = new Set(Array.from(usedSource || []).filter((word) => dictionary.includes(word)));
  let candidates = dictionary.filter((word) => !usedWords.has(word));

  if (!candidates.length) {
    usedWords.clear();
    candidates = dictionary;
  }

  const word = candidates[crypto.randomInt(candidates.length)];
  usedWords.add(word);
  return { word, usedWords: [...usedWords] };
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

async function awardScoreForUser(userId, { game = "hangman", mode = "solo", difficulty = "normal" }) {
  const pointsEarned = calculateWinPoints({ mode, difficulty });
  const existing = await supabaseRequest(`user_scores?select=*&user_id=${eq(userId)}&limit=1`);

  if (existing.length) {
    const current = existing[0];
    await supabaseRequest(`user_scores?user_id=${eq(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        points: Number(current.points || 0) + pointsEarned,
        wins: Number(current.wins || 0) + 1,
        last_game: game,
        updated_at: new Date().toISOString(),
      }),
    });
    return pointsEarned;
  }

  await supabaseRequest("user_scores", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      points: pointsEarned,
      wins: 1,
      last_game: game,
    }),
  });
  return pointsEarned;
}

async function getUsersMap(userIds) {
  const uniqueIds = [...new Set(userIds.map(Number).filter(Boolean))];

  if (!uniqueIds.length) {
    return new Map();
  }

  const users = await supabaseRequest(`users?select=*&id=in.(${uniqueIds.join(",")})`);
  return new Map(users.map((user) => [Number(user.id), user]));
}

async function getAcceptedFriendIds(userId) {
  const friendships = await supabaseRequest(
    `friendships?select=requester_id,addressee_id,status&status=eq.accepted&or=(requester_id.eq.${userId},addressee_id.eq.${userId})`,
  );

  return new Set(friendships.map((friendship) => (
    Number(friendship.requester_id) === Number(userId)
      ? Number(friendship.addressee_id)
      : Number(friendship.requester_id)
  )));
}

function modeLabel(mode) {
  if (mode === "teams") return "2x2";
  if (mode === "duel") return "1x1";
  return "Solo";
}

function buildHangmanPlayers(mode, playerIds, usersMap) {
  const userName = (userId) => usersMap.get(Number(userId))?.nickname || `Usuario ${userId}`;

  if (mode === "teams") {
    return [
      {
        name: `${userName(playerIds[0])} + ${userName(playerIds[1])}`,
        userIds: [Number(playerIds[0]), Number(playerIds[1])],
        misses: 0,
        hits: 0,
        streak: 0,
      },
      {
        name: `${userName(playerIds[2])} + ${userName(playerIds[3])}`,
        userIds: [Number(playerIds[2]), Number(playerIds[3])],
        misses: 0,
        hits: 0,
        streak: 0,
      },
    ];
  }

  return playerIds.map((userId) => ({
    name: userName(userId),
    userIds: [Number(userId)],
    misses: 0,
    hits: 0,
    streak: 0,
  }));
}

async function createHangmanState(match) {
  const usersMap = await getUsersMap(match.player_ids);
  const words = hangmanWords[match.difficulty] || hangmanWords.normal;
  const previousUsedWords = Array.isArray(match.state?.usedWords)
    ? match.state.usedWords
    : match.state?.word
      ? [match.state.word]
      : [];
  const pickedWord = pickHangmanWord(words, previousUsedWords);
  const word = pickedWord.word;
  const rules = difficultyRules[match.difficulty] || difficultyRules.normal;

  return {
    word,
    normalized: normalizeText(word),
    usedWords: pickedWord.usedWords,
    guessed: [],
    turn: 0,
    locked: false,
    maxMisses: rules.maxMisses,
    players: buildHangmanPlayers(match.mode, match.player_ids, usersMap),
    message: "Partida iniciada. Boa sorte!",
    messageType: "success",
    winnerUserIds: [],
    awarded: false,
  };
}

function currentMatchPlayer(state) {
  return state.players[state.turn] || state.players[0];
}

function userCanPlayTurn(state, userId) {
  const active = currentMatchPlayer(state);
  return (active.userIds || []).map(Number).includes(Number(userId));
}

async function awardMatchIfNeeded(match, state) {
  if (state.awarded || !state.winnerUserIds?.length) {
    return state;
  }

  await Promise.all(state.winnerUserIds.map((userId) => awardScoreForUser(userId, {
    game: match.state?.game || "hangman",
    mode: match.mode,
    difficulty: match.difficulty,
  })));
  return { ...state, awarded: true };
}

function serializeMatch(match, sessionUser, usersMap = new Map()) {
  const playerIds = (match.player_ids || []).map(Number);
  const acceptedIds = (match.accepted_ids || []).map(Number);
  const waitingFor = playerIds
    .filter((userId) => !acceptedIds.includes(userId))
    .map((userId) => ({
      id: userId,
      publicId: usersMap.get(userId) ? getPublicId(usersMap.get(userId)) : String(userId),
      nickname: usersMap.get(userId)?.nickname || `Usuario ${userId}`,
    }));

  return {
    id: Number(match.id),
    hostId: Number(match.host_id),
    playerIds,
    players: playerIds.map((userId) => ({
      id: userId,
      publicId: usersMap.get(userId) ? getPublicId(usersMap.get(userId)) : String(userId),
      nickname: usersMap.get(userId)?.nickname || `Usuario ${userId}`,
    })),
    acceptedIds,
    waitingFor,
    status: match.status,
    game: match.state?.game || "hangman",
    roomCode: match.state?.roomCode || "",
    accessMode: match.state?.accessMode || "invite",
    mode: match.mode,
    modeLabel: modeLabel(match.mode),
    difficulty: match.difficulty,
    state: match.state || {},
    isMine: playerIds.includes(Number(sessionUser.id)),
    canStart: Number(match.host_id) === Number(sessionUser.id)
      && match.status === "pending"
      && waitingFor.length === 0
      && playerIds.length >= ((match.state?.game || "hangman") === "bingo" ? 1 : Math.min(2, maxPlayersForMode(match.mode, "hangman"))),
    createdAt: match.created_at,
  };
}

async function getMatchForUser(matchId, userId) {
  const matches = await supabaseRequest(`game_matches?select=*&id=${eq(matchId)}&limit=1`);
  const match = matches[0];

  if (!match || !(match.player_ids || []).map(Number).includes(Number(userId))) {
    return null;
  }

  return match;
}

async function createUniqueRoomCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const roomCode = createRoomCode();
    const matches = await supabaseRequest("game_matches?select=id,state,status&or=(status.eq.pending,status.eq.active)&limit=200");
    const exists = matches.some((match) => String(match.state?.roomCode || "").toUpperCase() === roomCode);

    if (!exists) {
      return roomCode;
    }
  }

  throw new Error("Nao foi possivel gerar codigo da sala.");
}

async function findMatchByRoomCode(roomCode) {
  const code = String(roomCode || "").trim().toUpperCase();

  if (!code) {
    return null;
  }

  const matches = await supabaseRequest("game_matches?select=*&or=(status.eq.pending,status.eq.active)&order=created_at.desc&limit=200");
  return matches.find((match) => String(match.state?.roomCode || "").toUpperCase() === code) || null;
}

function maxPlayersForMode(mode, game) {
  if (game === "bingo") return 30;
  if (mode === "teams") return 4;
  if (mode === "duel") return 2;
  return 1;
}

function createBingoCard() {
  const ranges = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
  ];

  const columns = ranges.map(([start, end]) => {
    const numbers = [];
    for (let number = start; number <= end; number += 1) numbers.push(number);
    numbers.sort(() => crypto.randomInt(3) - 1);
    return numbers.slice(0, 5);
  });

  const card = [];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      card.push(columns[column][row]);
    }
  }
  return card;
}

function ensureBingoPlayerState(state, user, confirmed = false) {
  const playerCards = { ...(state.playerCards || {}) };
  const userId = String(user.id);

  if (!playerCards[userId]) {
    playerCards[userId] = {
      userId: Number(user.id),
      nickname: user.nickname,
      card: createBingoCard(),
      marked: [],
      confirmed,
    };
  }

  return { ...state, playerCards };
}

function hasBingoLine(card, marked) {
  const markedSet = new Set((marked || []).map(Number));
  const lines = [];

  for (let row = 0; row < 5; row += 1) lines.push([0, 1, 2, 3, 4].map((column) => row * 5 + column));
  for (let column = 0; column < 5; column += 1) lines.push([0, 1, 2, 3, 4].map((row) => row * 5 + column));
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);

  return lines.some((line) => line.every((index) => markedSet.has(Number(card[index]))));
}

function hasBingoWin(playerCard, winCondition) {
  if (!playerCard?.card?.length) return false;
  const marked = playerCard.marked || [];
  if (winCondition === "full") {
    return playerCard.card.every((number) => marked.map(Number).includes(Number(number)));
  }
  return hasBingoLine(playerCard.card, marked);
}

function nextBingoNumber(state) {
  const called = new Set((state.calledNumbers || []).map(Number));
  const available = [];
  for (let number = 1; number <= 75; number += 1) {
    if (!called.has(number)) available.push(number);
  }
  return available.length ? available[crypto.randomInt(available.length)] : null;
}

function advanceBingoDraw(state) {
  if (state.locked || !state.started) return state;

  const drawMs = Math.max(3, Number(state.drawSeconds || 8)) * 1000;
  const now = Date.now();
  let nextDrawAt = Number(state.nextDrawAt || now);
  let updated = { ...state, calledNumbers: [...(state.calledNumbers || [])] };

  while (nextDrawAt <= now && !updated.locked) {
    const number = nextBingoNumber(updated);
    if (!number) {
      updated.locked = true;
      updated.message = "Todos os numeros foram sorteados.";
      updated.messageType = "success";
      break;
    }
    updated.calledNumbers.push(number);
    updated.currentNumber = number;
    updated.message = `Numero sorteado: ${number}`;
    updated.messageType = "success";
    nextDrawAt += drawMs;
  }

  updated.nextDrawAt = nextDrawAt;
  return updated;
}

async function cleanupOldInvites() {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const oldMatches = await supabaseRequest(`game_matches?select=id,state&status=eq.pending&created_at=lt.${encodeURIComponent(cutoff)}&limit=100`);
  const oldInviteMatches = oldMatches.filter((match) => (match.state?.accessMode || "invite") === "invite");

  await Promise.allSettled([
    supabaseRequest(`friendships?status=eq.pending&created_at=lt.${encodeURIComponent(cutoff)}`, { method: "DELETE" }),
    ...oldInviteMatches.map((match) => supabaseRequest(`game_matches?id=${eq(match.id)}`, { method: "DELETE" })),
  ]);
}

async function handleNotifications(request, response) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    await cleanupOldInvites();

    const friendRows = await supabaseRequest(
      `friendships?select=id,requester_id,created_at&addressee_id=${eq(sessionUser.id)}&status=eq.pending&order=created_at.desc`,
    );
    const friendUserIds = friendRows.map((item) => Number(item.requester_id));
    const friendUsers = await getUsersMap(friendUserIds);
    const friendInvites = friendRows.map((item) => {
      const user = friendUsers.get(Number(item.requester_id));
      return {
        friendshipId: Number(item.id),
        fromId: Number(item.requester_id),
        nickname: user?.nickname || `Usuario ${item.requester_id}`,
        publicId: user ? getPublicId(user) : String(item.requester_id),
      };
    });

    const matches = await supabaseRequest("game_matches?select=*&status=eq.pending&order=created_at.desc&limit=80");
    const myPendingMatches = matches.filter((match) => (
      (match.player_ids || []).map(Number).includes(Number(sessionUser.id))
    ));
    const userIds = myPendingMatches.flatMap((match) => match.player_ids || []);
    const usersMap = await getUsersMap(userIds);
    const matchInvites = myPendingMatches
      .filter((match) => !(match.accepted_ids || []).map(Number).includes(Number(sessionUser.id)))
      .map((match) => serializeMatch(match, sessionUser, usersMap));
    const waitingMatches = myPendingMatches
      .filter((match) => (match.accepted_ids || []).map(Number).includes(Number(sessionUser.id)))
      .map((match) => serializeMatch(match, sessionUser, usersMap));

    send(response, 200, { ok: true, friendInvites, matchInvites, waitingMatches });
  } catch (error) {
    logSafeError("notifications", error);
    if (isSchemaError(error, "game_matches")) {
      sendSchemaError(response, "sistema de convites de partida");
      return;
    }
    send(response, 500, { ok: false, message: "Nao foi possivel carregar notificacoes." });
  }
}

async function handleRoomCreate(request, response) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const body = await parseJsonBody(request);
    const game = String(body.game || "hangman");
    const mode = String(body.mode || (game === "bingo" ? "bingo" : "duel"));
    const difficulty = String(body.difficulty || "normal");
    const accessMode = String(body.accessMode || "code");
    const friendIds = [...new Set((body.friendIds || []).map(Number).filter(Boolean))];

    if (!["hangman", "bingo"].includes(game)) {
      send(response, 400, { ok: false, message: "Jogo invalido." });
      return;
    }

    const acceptedFriends = await getAcceptedFriendIds(sessionUser.id);
    const invalidFriend = friendIds.find((friendId) => !acceptedFriends.has(friendId));

    if (invalidFriend) {
      send(response, 403, { ok: false, message: "Selecione apenas amigos aceitos para convidar." });
      return;
    }

    const maxPlayers = maxPlayersForMode(mode, game);
    const playerIds = [Number(sessionUser.id), ...friendIds].slice(0, maxPlayers);
    const roomCode = await createUniqueRoomCode();
    let state = {
      game,
      roomCode,
      accessMode,
      message: "Sala criada. Aguarde os jogadores entrarem.",
      messageType: "success",
    };

    if (game === "bingo") {
      state = ensureBingoPlayerState({
        ...state,
        drawSeconds: Math.max(3, Math.min(60, Number(body.drawSeconds || 8))),
        winCondition: body.winCondition === "full" ? "full" : "line",
        calledNumbers: [],
        started: false,
      }, sessionUser, false);
    }

    const created = await supabaseRequest("game_matches", {
      method: "POST",
      body: JSON.stringify({
        host_id: sessionUser.id,
        player_ids: playerIds,
        accepted_ids: [Number(sessionUser.id)],
        status: "pending",
        mode,
        difficulty,
        state,
      }),
    });
    const usersMap = await getUsersMap(playerIds);

    send(response, 201, {
      ok: true,
      message: `Sala criada. Codigo: ${roomCode}`,
      match: serializeMatch(created[0], sessionUser, usersMap),
    });
  } catch (error) {
    logSafeError("room-create", error);
    if (isSchemaError(error, "game_matches")) {
      sendSchemaError(response, "sistema de salas");
      return;
    }
    send(response, 500, { ok: false, message: "Nao foi possivel criar a sala." });
  }
}

async function handleRoomJoin(request, response) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const body = await parseJsonBody(request);
    const match = await findMatchByRoomCode(body.roomCode);

    if (!match || match.status !== "pending") {
      send(response, 404, { ok: false, message: "Sala nao encontrada ou ja iniciada." });
      return;
    }

    if (match.state?.accessMode === "invite") {
      send(response, 403, { ok: false, message: "Essa sala aceita apenas jogadores convidados." });
      return;
    }

    const playerIds = (match.player_ids || []).map(Number);
    const acceptedIds = (match.accepted_ids || []).map(Number);
    const game = match.state?.game || "hangman";
    const maxPlayers = maxPlayersForMode(match.mode, game);

    if (!playerIds.includes(Number(sessionUser.id))) {
      if (playerIds.length >= maxPlayers) {
        send(response, 400, { ok: false, message: "Sala cheia." });
        return;
      }
      playerIds.push(Number(sessionUser.id));
    }

    if (!acceptedIds.includes(Number(sessionUser.id))) {
      acceptedIds.push(Number(sessionUser.id));
    }

    let state = {
      ...(match.state || {}),
      message: `${sessionUser.nickname} entrou na sala.`,
      messageType: "success",
    };

    if (game === "bingo") {
      state = ensureBingoPlayerState(state, sessionUser, false);
    }

    const updated = await supabaseRequest(`game_matches?id=${eq(match.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        player_ids: playerIds,
        accepted_ids: acceptedIds,
        state,
        updated_at: new Date().toISOString(),
      }),
    });
    const usersMap = await getUsersMap(updated[0].player_ids || []);

    send(response, 200, {
      ok: true,
      message: "Voce entrou na sala.",
      match: serializeMatch(updated[0], sessionUser, usersMap),
    });
  } catch (error) {
    logSafeError("room-join", error);
    send(response, 500, { ok: false, message: "Nao foi possivel entrar na sala." });
  }
}

async function handleMatchInvite(request, response) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const body = await parseJsonBody(request);
    const mode = String(body.mode || "solo");
    const difficulty = String(body.difficulty || "normal");
    const friendIds = [...new Set((body.friendIds || []).map(Number).filter(Boolean))];
    const requiredFriends = mode === "teams" ? 3 : mode === "duel" ? 1 : 0;

    if (!["duel", "teams"].includes(mode)) {
      send(response, 400, { ok: false, message: "Convite de partida e usado apenas para 1x1 ou 2x2 com amigos." });
      return;
    }

    if (friendIds.length !== requiredFriends) {
      send(response, 400, {
        ok: false,
        message: mode === "teams" ? "Para 2x2, selecione exatamente 3 amigos." : "Para 1x1, selecione exatamente 1 amigo.",
      });
      return;
    }

    const acceptedFriends = await getAcceptedFriendIds(sessionUser.id);
    const invalidFriend = friendIds.find((friendId) => !acceptedFriends.has(friendId));

    if (invalidFriend) {
      send(response, 403, { ok: false, message: "Selecione apenas amigos aceitos para convidar." });
      return;
    }

    const playerIds = [Number(sessionUser.id), ...friendIds];
    const created = await supabaseRequest("game_matches", {
      method: "POST",
      body: JSON.stringify({
        host_id: sessionUser.id,
        player_ids: playerIds,
        accepted_ids: [Number(sessionUser.id)],
        status: "pending",
        mode,
        difficulty,
        state: {
          message: "Aguardando amigos aceitarem o convite.",
          messageType: "success",
        },
      }),
    });
    const usersMap = await getUsersMap(playerIds);

    send(response, 201, {
      ok: true,
      message: "Convite de partida enviado. Aguardando os amigos aceitarem.",
      match: serializeMatch(created[0], sessionUser, usersMap),
    });
  } catch (error) {
    logSafeError("match-invite", error);
    if (isSchemaError(error, "game_matches")) {
      sendSchemaError(response, "sistema de convites de partida");
      return;
    }
    send(response, 500, { ok: false, message: "Nao foi possivel criar o convite de partida." });
  }
}

async function handleMatchAccept(request, response) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const body = await parseJsonBody(request);
    const match = await getMatchForUser(Number(body.matchId), sessionUser.id);

    if (!match || match.status !== "pending") {
      send(response, 404, { ok: false, message: "Convite de partida nao encontrado." });
      return;
    }

    const acceptedIds = [...new Set([...(match.accepted_ids || []).map(Number), Number(sessionUser.id)])];
    const allAccepted = (match.player_ids || []).every((userId) => acceptedIds.includes(Number(userId)));
    let state = {
      ...(match.state || {}),
      message: allAccepted
        ? "Todos entraram na sala. Aguardando o criador iniciar o jogo."
        : "Voce entrou na sala. Aguardando os outros jogadores.",
      messageType: "success",
    };

    if (state.game === "bingo") {
      state = ensureBingoPlayerState(state, sessionUser, false);
    }

    const updated = await supabaseRequest(`game_matches?id=${eq(match.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        accepted_ids: acceptedIds,
        status: "pending",
        state,
        updated_at: new Date().toISOString(),
      }),
    });
    const usersMap = await getUsersMap(updated[0].player_ids || []);

    send(response, 200, {
      ok: true,
      message: allAccepted ? "Voce entrou na sala. Aguarde o criador iniciar." : "Voce entrou na sala. Aguardando os outros jogadores.",
      match: serializeMatch(updated[0], sessionUser, usersMap),
    });
  } catch (error) {
    logSafeError("match-accept", error);
    send(response, 500, { ok: false, message: "Nao foi possivel aceitar o convite da partida." });
  }
}

async function handleMatchGet(request, response, matchId) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const match = await getMatchForUser(matchId, sessionUser.id);

    if (!match) {
      send(response, 404, { ok: false, message: "Partida nao encontrada." });
      return;
    }

    let currentMatch = match;

    if (match.status === "active" && match.state?.game === "bingo") {
      const state = advanceBingoDraw(match.state || {});
      if (JSON.stringify(state) !== JSON.stringify(match.state || {})) {
        const updated = await supabaseRequest(`game_matches?id=${eq(match.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: state.locked ? "finished" : "active",
            state,
            updated_at: new Date().toISOString(),
          }),
        });
        currentMatch = updated[0];
      }
    }

    if ((match.state?.game || "hangman") === "hangman" && match.status === "finished" && Number(match.state?.nextRoundAt || 0) <= Date.now()) {
      const state = await createHangmanState(match);
      const updated = await supabaseRequest(`game_matches?id=${eq(match.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "active",
          state,
          updated_at: new Date().toISOString(),
        }),
      });
      currentMatch = updated[0];
    }

    const usersMap = await getUsersMap(currentMatch.player_ids || []);
    send(response, 200, { ok: true, match: serializeMatch(currentMatch, sessionUser, usersMap) });
  } catch (error) {
    logSafeError("match-get", error);
    send(response, 500, { ok: false, message: "Nao foi possivel carregar a partida." });
  }
}

async function handleMatchStart(request, response, matchId) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const match = await getMatchForUser(matchId, sessionUser.id);

    if (!match || match.status !== "pending") {
      send(response, 404, { ok: false, message: "Sala de partida nao encontrada." });
      return;
    }

    if (Number(match.host_id) !== Number(sessionUser.id)) {
      send(response, 403, { ok: false, message: "Somente quem criou a sala pode iniciar o jogo." });
      return;
    }

    const acceptedIds = (match.accepted_ids || []).map(Number);
    const waiting = (match.player_ids || []).filter((userId) => !acceptedIds.includes(Number(userId)));

    if (waiting.length) {
      send(response, 400, { ok: false, message: "Ainda tem jogador sem entrar na sala." });
      return;
    }

    if ((match.state?.game || "hangman") === "hangman" && (match.player_ids || []).length < Math.min(2, maxPlayersForMode(match.mode, "hangman"))) {
      send(response, 400, { ok: false, message: "Aguarde pelo menos um jogador entrar na sala." });
      return;
    }

    let state;

    if (match.state?.game === "bingo") {
      state = {
        ...(match.state || {}),
        started: true,
        locked: false,
        calledNumbers: [],
        currentNumber: null,
        nextDrawAt: Date.now() + 1000,
        message: "Bingo iniciado. O primeiro numero sera sorteado em instantes.",
        messageType: "success",
      };
    } else {
      state = await createHangmanState(match);
    }

    const updated = await supabaseRequest(`game_matches?id=${eq(match.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "active",
        state,
        updated_at: new Date().toISOString(),
      }),
    });
    const usersMap = await getUsersMap(updated[0].player_ids || []);

    send(response, 200, {
      ok: true,
      message: "Partida iniciada.",
      match: serializeMatch(updated[0], sessionUser, usersMap),
    });
  } catch (error) {
    logSafeError("match-start", error);
    send(response, 500, { ok: false, message: "Nao foi possivel iniciar a partida." });
  }
}

async function saveMatchState(match, state) {
  if (state.locked && !state.nextRoundAt) {
    state.nextRoundAt = Date.now() + 5000;
    state.message = `${state.message} Nova rodada em 5 segundos.`;
  }

  const status = state.locked ? "finished" : "active";
  const updated = await supabaseRequest(`game_matches?id=${eq(match.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      state,
      updated_at: new Date().toISOString(),
    }),
  });

  return updated[0];
}

async function handleMatchGuessLetter(request, response, matchId) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const match = await getMatchForUser(matchId, sessionUser.id);

    if (!match || match.status !== "active") {
      send(response, 404, { ok: false, message: "Partida ativa nao encontrada." });
      return;
    }

    const body = await parseJsonBody(request);
    const letter = normalizeText(body.letter).slice(0, 1);
    let state = match.state || {};

    if (!letter || state.locked) {
      send(response, 400, { ok: false, message: "Jogada invalida." });
      return;
    }

    if (!userCanPlayTurn(state, sessionUser.id)) {
      send(response, 403, { ok: false, message: "Aguarde sua vez." });
      return;
    }

    if ((state.guessed || []).includes(letter)) {
      send(response, 409, { ok: false, message: "Essa letra ja foi escolhida." });
      return;
    }

    const active = currentMatchPlayer(state);
    state.guessed = [...(state.guessed || []), letter];
    const occurrences = [...state.normalized].filter((item) => item === letter).length;

    if (occurrences) {
      active.hits += occurrences;
      active.streak += 1;
      state.message = `${active.name} acertou ${occurrences} letra(s) e continua jogando.`;
      state.messageType = "success";
    } else {
      active.misses += 1;
      active.streak = 0;
      state.message = `${active.name} errou a letra ${letter}. A vez passou.`;
      state.messageType = "error";
    }

    const solved = [...state.normalized].every((item) => state.guessed.includes(item));

    if (solved) {
      state.locked = true;
      state.winnerUserIds = active.userIds || [];
      state.message = `${active.name} completou a palavra e venceu!`;
      state.messageType = "success";
    } else if (active.misses >= state.maxMisses) {
      const winner = state.players[(state.turn + 1) % state.players.length];
      state.locked = true;
      state.winnerUserIds = winner.userIds || [];
      state.message = `${active.name} foi enforcado. ${winner.name} venceu!`;
      state.messageType = "error";
    } else if (!occurrences) {
      state.turn = (state.turn + 1) % state.players.length;
    }

    state = await awardMatchIfNeeded(match, state);
    const updated = await saveMatchState(match, state);
    const usersMap = await getUsersMap(updated.player_ids || []);
    send(response, 200, { ok: true, match: serializeMatch(updated, sessionUser, usersMap) });
  } catch (error) {
    logSafeError("match-guess-letter", error);
    send(response, 500, { ok: false, message: "Nao foi possivel registrar a letra." });
  }
}

async function handleMatchGuessWord(request, response, matchId) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const match = await getMatchForUser(matchId, sessionUser.id);

    if (!match || match.status !== "active") {
      send(response, 404, { ok: false, message: "Partida ativa nao encontrada." });
      return;
    }

    const body = await parseJsonBody(request);
    const guess = normalizeText(body.guess);
    let state = match.state || {};
    const active = currentMatchPlayer(state);

    if (!userCanPlayTurn(state, sessionUser.id)) {
      send(response, 403, { ok: false, message: "Aguarde sua vez." });
      return;
    }

    if (active.streak < 3) {
      send(response, 400, { ok: false, message: "A equipe precisa acertar 3 letras seguidas para chutar." });
      return;
    }

    if (guess === state.normalized) {
      state.locked = true;
      state.winnerUserIds = active.userIds || [];
      state.message = `${active.name} acertou a palavra e venceu!`;
      state.messageType = "success";
    } else {
      const winner = state.players[(state.turn + 1) % state.players.length];
      state.locked = true;
      state.winnerUserIds = winner.userIds || [];
      state.message = `${active.name} errou a palavra e perdeu automaticamente. ${winner.name} venceu!`;
      state.messageType = "error";
    }

    state = await awardMatchIfNeeded(match, state);
    const updated = await saveMatchState(match, state);
    const usersMap = await getUsersMap(updated.player_ids || []);
    send(response, 200, { ok: true, match: serializeMatch(updated, sessionUser, usersMap) });
  } catch (error) {
    logSafeError("match-guess-word", error);
    send(response, 500, { ok: false, message: "Nao foi possivel chutar a palavra." });
  }
}

async function handleBingoAction(request, response, matchId) {
  try {
    const sessionUser = await requireSessionUser(request, response);

    if (!sessionUser) {
      return;
    }

    const match = await getMatchForUser(matchId, sessionUser.id);

    if (!match || match.state?.game !== "bingo") {
      send(response, 404, { ok: false, message: "Sala de Bingo nao encontrada." });
      return;
    }

    const body = await parseJsonBody(request);
    const action = String(body.action || "");
    let state = ensureBingoPlayerState(match.state || {}, sessionUser, false);
    const userId = String(sessionUser.id);
    const playerCard = state.playerCards[userId];

    if (action === "reroll") {
      if (match.status !== "pending") {
        send(response, 400, { ok: false, message: "A cartela so pode ser trocada antes de iniciar." });
        return;
      }
      playerCard.card = createBingoCard();
      playerCard.marked = [];
      playerCard.confirmed = false;
      state.message = `${sessionUser.nickname} trocou a cartela.`;
      state.messageType = "success";
    } else if (action === "confirm") {
      if (match.status !== "pending") {
        send(response, 400, { ok: false, message: "A cartela so pode ser confirmada antes de iniciar." });
        return;
      }
      playerCard.confirmed = true;
      state.message = `${sessionUser.nickname} confirmou a cartela.`;
      state.messageType = "success";
    } else if (action === "mark") {
      if (match.status !== "active" || state.locked) {
        send(response, 400, { ok: false, message: "O Bingo ainda nao esta ativo." });
        return;
      }

      const number = Number(body.number);
      const called = (state.calledNumbers || []).map(Number);

      if (!called.includes(number)) {
        send(response, 400, { ok: false, message: "Esse numero ainda nao foi sorteado." });
        return;
      }

      if (!playerCard.card.map(Number).includes(number)) {
        send(response, 400, { ok: false, message: "Esse numero nao esta na sua cartela." });
        return;
      }

      if (!playerCard.marked.map(Number).includes(number)) {
        playerCard.marked = [...(playerCard.marked || []), number];
      }

      if (hasBingoWin(playerCard, state.winCondition)) {
        state.locked = true;
        state.winnerUserId = Number(sessionUser.id);
        state.winnerName = sessionUser.nickname;
        state.message = `BINGO! ${sessionUser.nickname} venceu.`;
        state.messageType = "success";
        await awardScoreForUser(sessionUser.id, {
          game: "bingo",
          mode: "bingo",
          difficulty: state.winCondition || "line",
        });
      } else {
        state.message = `${sessionUser.nickname} marcou o numero ${number}.`;
        state.messageType = "success";
      }
    } else {
      send(response, 400, { ok: false, message: "Acao invalida." });
      return;
    }

    const updated = await supabaseRequest(`game_matches?id=${eq(match.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: state.locked ? "finished" : match.status,
        state,
        updated_at: new Date().toISOString(),
      }),
    });
    const usersMap = await getUsersMap(updated[0].player_ids || []);

    send(response, 200, { ok: true, match: serializeMatch(updated[0], sessionUser, usersMap) });
  } catch (error) {
    logSafeError("bingo-action", error);
    send(response, 500, { ok: false, message: "Nao foi possivel atualizar o Bingo." });
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

  if (request.method === "GET" && url.pathname === "/api/notifications") {
    handleNotifications(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/rooms/create") {
    handleRoomCreate(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/rooms/join") {
    handleRoomJoin(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/matches/invite") {
    handleMatchInvite(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/matches/accept") {
    handleMatchAccept(request, response);
    return;
  }

  const matchGuessLetter = url.pathname.match(/^\/api\/matches\/(\d+)\/guess-letter$/);

  if (request.method === "POST" && matchGuessLetter) {
    handleMatchGuessLetter(request, response, Number(matchGuessLetter[1]));
    return;
  }

  const matchStart = url.pathname.match(/^\/api\/matches\/(\d+)\/start$/);

  if (request.method === "POST" && matchStart) {
    handleMatchStart(request, response, Number(matchStart[1]));
    return;
  }

  const matchGuessWord = url.pathname.match(/^\/api\/matches\/(\d+)\/guess-word$/);

  if (request.method === "POST" && matchGuessWord) {
    handleMatchGuessWord(request, response, Number(matchGuessWord[1]));
    return;
  }

  const bingoAction = url.pathname.match(/^\/api\/bingo\/(\d+)\/action$/);

  if (request.method === "POST" && bingoAction) {
    handleBingoAction(request, response, Number(bingoAction[1]));
    return;
  }

  const matchGet = url.pathname.match(/^\/api\/matches\/(\d+)$/);

  if (request.method === "GET" && matchGet) {
    handleMatchGet(request, response, Number(matchGet[1]));
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

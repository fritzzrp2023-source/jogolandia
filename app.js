const SESSION_KEY = "jogarium_session_token";
const OLD_SESSION_KEY = "jogolandia_session_token";
const API_BASE = location.protocol === "file:" ? "http://127.0.0.1:8080" : "";

const authView = document.querySelector("#authView");
const dashboardView = document.querySelector("#dashboardView");
const toast = document.querySelector("#toast");
const userMenu = document.querySelector("#userMenu");
const userMenuButton = document.querySelector("#userMenuButton");
const dashboardTitle = document.querySelector("#dashboardTitle");
const dashboardEyebrow = document.querySelector("#dashboardEyebrow");

const views = {
  games: document.querySelector("#gamesView"),
  account: document.querySelector("#accountView"),
  friends: document.querySelector("#friendsView"),
  notifications: document.querySelector("#notificationsView"),
  ranking: document.querySelector("#rankingView"),
};

const forms = {
  login: document.querySelector("#loginForm"),
  register: document.querySelector("#registerForm"),
  profile: document.querySelector("#profileForm"),
  changePassword: document.querySelector("#changePasswordForm"),
  friendInvite: document.querySelector("#friendInviteForm"),
};

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
  easy: { label: "Facil", maxMisses: 7, botHitChance: 0.35 },
  normal: { label: "Normal", maxMisses: 6, botHitChance: 0.5 },
  hard: { label: "Dificil", maxMisses: 5, botHitChance: 0.65 },
};

let currentUser = null;
let hangman = null;
let setupFriends = [];
let setupInviteIds = [];
let lastAwardedMatchId = null;
let notificationsTimer = null;
let remoteMatchTimer = null;
let activeRemoteMatchId = null;
let lastNotificationCount = 0;
let localNextRoundTimer = null;
let selectedGameType = "hangman";
let bingo = null;
let bingoSetupFriends = [];
let bingoInviteIds = [];
let bingoTimer = null;
let lastBingoWinnerKey = "";

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatCpf(value) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

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

  const word = candidates[Math.floor(Math.random() * candidates.length)];
  usedWords.add(word);
  return { word, usedWords };
}

function setFieldState(input, state, message) {
  const field = input.closest(".field");
  const helper = field.querySelector(".field-message");
  field.classList.remove("valid", "invalid");
  if (state) field.classList.add(state);
  helper.textContent = message || "";
}

function setMessage(element, text, type = "") {
  element.textContent = text;
  element.className = `form-message ${type}`.trim();
}

function clearFieldStates(form) {
  form.querySelectorAll(".field").forEach((field) => {
    field.classList.remove("valid", "invalid");
    const helper = field.querySelector(".field-message");
    if (helper) helper.textContent = "";
  });
}

function validateNickname(input) {
  const value = input.value.trim();
  if (!value) {
    setFieldState(input, "", "");
    return false;
  }
  if (value.length < 3) {
    setFieldState(input, "invalid", "Use pelo menos 3 caracteres.");
    return false;
  }
  setFieldState(input, "valid", "Nickname pronto.");
  return true;
}

function validateCpf(input) {
  input.value = formatCpf(input.value);
  if (!input.value) {
    setFieldState(input, "", "");
    return false;
  }
  if (onlyDigits(input.value).length !== 11) {
    setFieldState(input, "invalid", "Digite 11 numeros.");
    return false;
  }
  setFieldState(input, "valid", "CPF valido.");
  return true;
}

function validatePassword(input) {
  if (!input.value) {
    setFieldState(input, "", "");
    return false;
  }
  if (input.value.length < 6) {
    setFieldState(input, "invalid", "Use pelo menos 6 caracteres.");
    return false;
  }
  setFieldState(input, "valid", "Senha valida.");
  return true;
}

function validatePasswordPair(passwordInput, confirmInput) {
  const passwordOk = validatePassword(passwordInput);
  if (!confirmInput.value) {
    setFieldState(confirmInput, "", "");
    return false;
  }
  if (passwordInput.value !== confirmInput.value) {
    setFieldState(confirmInput, "invalid", "Senhas diferentes.");
    return false;
  }
  if (passwordOk) setFieldState(confirmInput, "valid", "Senhas iguais.");
  return passwordOk;
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = localStorage.getItem(SESSION_KEY) || localStorage.getItem(OLD_SESSION_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || "Nao foi possivel concluir a acao.");
    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("O servidor demorou para responder. Recarregue a pagina e tente novamente.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function showForm(name) {
  [forms.login, forms.register].forEach((form) => form.classList.remove("active"));
  forms[name].classList.add("active");
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authTab === name);
  });
}

function showToast(html) {
  toast.innerHTML = html;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 7000);
}

function updateHeader(user) {
  document.querySelector("#userNickname").textContent = user.nickname;
  document.querySelector("#userPublicId").textContent = `ID ${user.publicId}`;
  document.querySelector("#friendsMyId").textContent = user.publicId;
}

function updateNotificationBadge(count) {
  const badge = document.querySelector("#notificationBadge");
  badge.hidden = count <= 0;
  badge.textContent = String(count);
}

function stopNotifications() {
  window.clearInterval(notificationsTimer);
  notificationsTimer = null;
  lastNotificationCount = 0;
  updateNotificationBadge(0);
}

function startNotifications() {
  stopNotifications();
  loadNotifications(false);
  notificationsTimer = window.setInterval(() => loadNotifications(false), 4000);
}

function renderDashboard(user) {
  currentUser = user;
  authView.hidden = true;
  dashboardView.hidden = false;
  authView.style.display = "none";
  dashboardView.style.display = "block";
  updateHeader(user);
  startNotifications();
  showPanel("games");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderAuth() {
  currentUser = null;
  stopNotifications();
  stopRemotePolling();
  stopLocalNextRound();
  authView.hidden = false;
  dashboardView.hidden = true;
  authView.style.display = "grid";
  dashboardView.style.display = "none";
}

function showPanel(name) {
  Object.entries(views).forEach(([key, view]) => {
    view.hidden = key !== name;
    view.classList.toggle("active", key === name);
  });
  userMenu.hidden = true;
  userMenuButton.setAttribute("aria-expanded", "false");

  const titles = {
    games: ["Painel", "Todos os jogos"],
    account: ["Minha conta", "Dados da conta"],
    friends: ["Amigos", "Convites e jogadores online"],
    notifications: ["Convites", "Notificacoes recebidas"],
    ranking: ["Ranking", "Melhores jogadores"],
  };
  dashboardEyebrow.textContent = titles[name][0];
  dashboardTitle.textContent = titles[name][1];
  if (name === "games") {
    showGamesHome();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showGamesHome() {
  stopRemotePolling();
  stopLocalNextRound();
  stopBingoPolling();
  document.querySelector("#gamesGrid").hidden = false;
  document.querySelector("#roomChoice").hidden = true;
  document.querySelector("#hangmanSetup").hidden = true;
  document.querySelector("#hangmanPanel").hidden = true;
  document.querySelector("#bingoSetup").hidden = true;
  document.querySelector("#bingoPanel").hidden = true;
}

function showRoomChoice(gameType) {
  selectedGameType = gameType;
  document.querySelector("#gamesGrid").hidden = true;
  document.querySelector("#roomChoice").hidden = false;
  document.querySelector("#hangmanSetup").hidden = true;
  document.querySelector("#hangmanPanel").hidden = true;
  document.querySelector("#bingoSetup").hidden = true;
  document.querySelector("#bingoPanel").hidden = true;
  document.querySelector("#roomChoiceEyebrow").textContent = gameType === "bingo" ? "Bingo" : "Jogo da Forca";
  document.querySelector("#roomChoiceTitle").textContent = gameType === "bingo" ? "Criar ou entrar em uma sala de Bingo" : "Criar ou entrar em uma sala da Forca";
  document.querySelector("#joinRoomCode").value = "";
  setMessage(document.querySelector("#joinRoomMessage"), "");
}

function prepareHangmanHome() {
  document.querySelector("#gamesGrid").hidden = true;
  document.querySelector("#roomChoice").hidden = true;
  document.querySelector("#hangmanSetup").hidden = false;
  document.querySelector("#hangmanPanel").hidden = true;
  document.querySelector("#bingoSetup").hidden = true;
  document.querySelector("#bingoPanel").hidden = true;
  document.querySelector("#hangmanRoomCodeBox").hidden = true;
  loadSetupFriends();
}

function prepareBingoHome() {
  document.querySelector("#gamesGrid").hidden = true;
  document.querySelector("#roomChoice").hidden = true;
  document.querySelector("#hangmanSetup").hidden = true;
  document.querySelector("#hangmanPanel").hidden = true;
  document.querySelector("#bingoSetup").hidden = false;
  document.querySelector("#bingoPanel").hidden = true;
  document.querySelector("#bingoRoomCodeBox").hidden = true;
  loadBingoSetupFriends();
}

async function loadProfile() {
  const result = await apiRequest("/api/profile", { method: "GET" });
  currentUser = result.user;
  updateHeader(result.user);
  document.querySelector("#profileId").value = result.user.publicId;
  document.querySelector("#profileNickname").value = result.user.nickname;
  document.querySelector("#profileCpf").value = formatCpf(result.user.cpf);
}

async function loadFriends() {
  const list = document.querySelector("#friendList");
  list.innerHTML = '<p class="muted-label">Carregando amigos...</p>';
  try {
    const result = await apiRequest("/api/friends", { method: "GET" });
    if (!result.friends.length) {
      list.innerHTML = '<p class="muted-label">Nenhum amigo ainda. Convide pelo ID.</p>';
      return;
    }
    list.innerHTML = result.friends.map((friend) => `
      <article class="friend-item">
        <div>
          <strong>${friend.nickname}</strong>
          <span>ID ${friend.publicId} - ${friend.online ? "online" : "offline"} - ${friend.statusText}</span>
        </div>
        ${friend.canAccept ? `<button type="button" data-accept-friend="${friend.friendshipId}">Aceitar</button>` : ""}
        ${friend.status === "accepted" ? `<button type="button" ${friend.online ? "" : "disabled"}>Convidar para jogar</button>` : ""}
      </article>
    `).join("");
  } catch (error) {
    list.innerHTML = `<p class="form-message error">${error.message}</p>`;
  }
}

async function loadRanking() {
  const list = document.querySelector("#rankingList");
  list.innerHTML = '<p class="muted-label">Carregando ranking...</p>';

  try {
    const result = await apiRequest("/api/ranking", { method: "GET" });

    if (!result.ranking.length) {
      list.innerHTML = '<p class="muted-label">Ainda nao ha pontuacao. Venca uma partida para aparecer aqui.</p>';
      return;
    }

    list.innerHTML = result.ranking.map((item, index) => `
      <article class="ranking-item ${Number(item.userId) === Number(currentUser?.id) ? "current-player" : ""}">
        <span class="ranking-position">${index + 1}</span>
        <div>
          <strong>${item.nickname}</strong>
          <small>ID ${item.publicId} - ${item.wins} vitoria(s)</small>
        </div>
        <strong>${item.points} pts</strong>
      </article>
    `).join("");
  } catch (error) {
    list.innerHTML = `<p class="form-message error">${error.message}</p>`;
  }
}

async function loadSetupFriends() {
  const list = document.querySelector("#setupFriendsList");
  list.innerHTML = '<p class="muted-label">Carregando amigos...</p>';
  setupInviteIds = [];

  try {
    const result = await apiRequest("/api/friends", { method: "GET" });
    setupFriends = result.friends.filter((friend) => friend.status === "accepted");

    if (!setupFriends.length) {
      list.innerHTML = '<p class="muted-label">Nenhum amigo aceito ainda. Voce pode iniciar solo contra o bot.</p>';
      return;
    }

    list.innerHTML = setupFriends.map((friend) => `
      <div class="friend-check">
        <span>
          <strong>${friend.nickname}</strong>
          <small>ID ${friend.publicId} - ${friend.online ? "online" : "offline"}</small>
        </span>
        <button type="button" data-setup-invite="${friend.id}" ${friend.online ? "" : "disabled"}>
          ${friend.online ? "Convidar" : "Offline"}
        </button>
      </div>
    `).join("");
  } catch (error) {
    list.innerHTML = `<p class="form-message error">${error.message}</p>`;
  }
}

async function loadBingoSetupFriends() {
  const list = document.querySelector("#bingoFriendsList");
  list.innerHTML = '<p class="muted-label">Carregando amigos...</p>';
  bingoInviteIds = [];

  try {
    const result = await apiRequest("/api/friends", { method: "GET" });
    bingoSetupFriends = result.friends.filter((friend) => friend.status === "accepted");

    if (!bingoSetupFriends.length) {
      list.innerHTML = '<p class="muted-label">Nenhum amigo aceito ainda. Voce ainda pode criar sala por codigo.</p>';
      return;
    }

    list.innerHTML = bingoSetupFriends.map((friend) => `
      <div class="friend-check">
        <span>
          <strong>${friend.nickname}</strong>
          <small>ID ${friend.publicId} - ${friend.online ? "online" : "offline"}</small>
        </span>
        <button type="button" data-bingo-invite="${friend.id}" ${friend.online ? "" : "disabled"}>
          ${friend.online ? "Convidar" : "Offline"}
        </button>
      </div>
    `).join("");
  } catch (error) {
    list.innerHTML = `<p class="form-message error">${error.message}</p>`;
  }
}

function renderNotifications(data) {
  const list = document.querySelector("#notificationList");
  const friendInvites = data.friendInvites || [];
  const matchInvites = data.matchInvites || [];
  const waitingMatches = data.waitingMatches || [];

  if (!friendInvites.length && !matchInvites.length && !waitingMatches.length) {
    list.innerHTML = '<p class="muted-label">Nenhum convite pendente agora.</p>';
    return;
  }

  const friendHtml = friendInvites.map((invite) => `
    <article class="notification-item">
      <div>
        <strong>Convite de amizade</strong>
        <span>${invite.nickname} quer ser seu amigo. ID ${invite.publicId}</span>
      </div>
      <button type="button" data-notification-friend="${invite.friendshipId}">Aceitar amizade</button>
    </article>
  `).join("");

  const matchHtml = matchInvites.map((match) => `
    <article class="notification-item highlight">
      <div>
        <strong>Convite de partida</strong>
        <span>${(match.game || match.state?.game) === "bingo" ? "Bingo" : `${match.modeLabel} na forca`}. Aceite para entrar na sala com seus amigos.</span>
      </div>
      <button type="button" data-accept-match="${match.id}">Aceitar partida</button>
    </article>
  `).join("");

  const waitingHtml = waitingMatches.map((match) => `
    <article class="notification-item">
      <div>
        <strong>Partida aguardando</strong>
        <span>${match.waitingFor.length ? `Falta aceitar: ${match.waitingFor.map((user) => user.nickname).join(", ")}` : "Todos aceitaram."}</span>
      </div>
      <button type="button" data-open-match="${match.id}">Abrir sala</button>
    </article>
  `).join("");

  list.innerHTML = friendHtml + matchHtml + waitingHtml;
}

async function loadNotifications(renderList = false) {
  if (!currentUser) return null;

  try {
    const result = await apiRequest("/api/notifications", { method: "GET" });
    const count = (result.friendInvites || []).length + (result.matchInvites || []).length;
    updateNotificationBadge(count);

    if (count > lastNotificationCount && lastNotificationCount !== 0) {
      showToast("Voce recebeu um novo convite.");
    }

    lastNotificationCount = count;
    if (renderList) renderNotifications(result);
    return result;
  } catch (error) {
    if (renderList) {
      document.querySelector("#notificationList").innerHTML = `<p class="form-message error">${error.message}</p>`;
    }
    return null;
  }
}

async function restoreSession() {
  const token = localStorage.getItem(SESSION_KEY);
  const oldToken = localStorage.getItem(OLD_SESSION_KEY);
  if (!token && oldToken) {
    localStorage.setItem(SESSION_KEY, oldToken);
  }

  if (!token && !oldToken) {
    renderAuth();
    return;
  }
  try {
    const result = await apiRequest("/api/session", { method: "GET" });
    renderDashboard(result.user);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    renderAuth();
  }
}

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => showForm(button.dataset.authTab));
});

document.querySelector("#logoutButton").addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(OLD_SESSION_KEY);
  renderAuth();
  showForm("login");
});

userMenuButton.addEventListener("click", () => {
  userMenu.hidden = !userMenu.hidden;
  userMenuButton.setAttribute("aria-expanded", String(!userMenu.hidden));
});

document.querySelector("#openAccountPage").addEventListener("click", async () => {
  showPanel("account");
  await loadProfile();
});

document.querySelector("#friendsButton").addEventListener("click", async () => {
  showPanel("friends");
  await loadFriends();
});

document.querySelector("#notificationsButton").addEventListener("click", async () => {
  showPanel("notifications");
  await loadNotifications(true);
});

document.querySelector("#rankingButton").addEventListener("click", async () => {
  showPanel("ranking");
  await loadRanking();
});

document.querySelector("#backToGamesFromMenu").addEventListener("click", () => showPanel("games"));
document.querySelector("#backToGamesFromAccount").addEventListener("click", () => showPanel("games"));
document.querySelector("#backToGamesFromFriends").addEventListener("click", () => showPanel("games"));
document.querySelector("#backToGamesFromNotifications").addEventListener("click", () => showPanel("games"));
document.querySelector("#backToGamesFromRanking").addEventListener("click", () => showPanel("games"));
document.querySelector("#openHangmanGame").addEventListener("click", () => showRoomChoice("hangman"));
document.querySelector("#openBingoGame").addEventListener("click", () => showRoomChoice("bingo"));
document.querySelector("#closeRoomChoice").addEventListener("click", () => showGamesHome());
document.querySelector("#createGameRoom").addEventListener("click", () => {
  if (selectedGameType === "bingo") {
    prepareBingoHome();
    return;
  }
  prepareHangmanHome();
});
document.querySelector("#closeHangmanSetup").addEventListener("click", () => showGamesHome());
document.querySelector("#closeBingoSetup").addEventListener("click", () => showGamesHome());

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast("Codigo copiado.");
  } catch {
    showToast(`Codigo da sala: ${value}`);
  }
}

document.querySelector("#joinGameRoom").addEventListener("click", async () => {
  const message = document.querySelector("#joinRoomMessage");
  const roomCode = document.querySelector("#joinRoomCode").value.trim().toUpperCase();

  if (!roomCode) {
    setMessage(message, "Digite o codigo da sala.", "error");
    return;
  }

  setMessage(message, "Entrando na sala...", "success");

  try {
    const result = await apiRequest("/api/rooms/join", {
      method: "POST",
      body: { roomCode },
    });
    showToast(result.message);
    showRemoteMatch(result.match);
  } catch (error) {
    setMessage(message, error.message, "error");
  }
});

document.querySelector("#copyHangmanRoomCode").addEventListener("click", () => copyText(document.querySelector("#hangmanRoomCode").textContent));
document.querySelector("#copyBingoRoomCode").addEventListener("click", () => copyText(document.querySelector("#bingoRoomCode").textContent));
document.querySelector("#copyActiveBingoCode").addEventListener("click", () => copyText(document.querySelector("#activeBingoCode").textContent));

document.addEventListener("click", (event) => {
  if (!userMenu.hidden && !event.target.closest(".user-box")) {
    userMenu.hidden = true;
    userMenuButton.setAttribute("aria-expanded", "false");
  }
});

document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.querySelector(`#${button.dataset.togglePassword}`);
    const shouldShow = input.type === "password";
    input.type = shouldShow ? "text" : "password";
    button.textContent = shouldShow ? "Ocultar" : "Mostrar";
  });
});

document.querySelector("#nickname").addEventListener("input", (event) => validateNickname(event.target));
document.querySelector("#cpf").addEventListener("input", (event) => validateCpf(event.target));
document.querySelector("#loginCpf").addEventListener("input", (event) => validateCpf(event.target));
document.querySelector("#profileNickname").addEventListener("input", (event) => validateNickname(event.target));
document.querySelector("#friendIdInput").addEventListener("input", (event) => {
  event.target.value = onlyDigits(event.target.value).slice(0, 10);
});

["#registerPassword", "#confirmPassword"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", () => {
    validatePasswordPair(document.querySelector("#registerPassword"), document.querySelector("#confirmPassword"));
  });
});

["#accountNewPassword", "#accountNewPasswordConfirm"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", () => {
    validatePasswordPair(document.querySelector("#accountNewPassword"), document.querySelector("#accountNewPasswordConfirm"));
  });
});

forms.register.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nickname = document.querySelector("#nickname");
  const cpf = document.querySelector("#cpf");
  const password = document.querySelector("#registerPassword");
  const confirmPassword = document.querySelector("#confirmPassword");
  const message = document.querySelector("#registerMessage");
  if (!validateNickname(nickname) || !validateCpf(cpf) || !validatePasswordPair(password, confirmPassword)) {
    setMessage(message, "Confira os campos marcados antes de continuar.", "error");
    return;
  }
  setMessage(message, "Criando conta...", "success");
  try {
    const result = await apiRequest("/api/register", {
      method: "POST",
      body: { nickname: nickname.value.trim(), cpf: onlyDigits(cpf.value), password: password.value },
    });
    forms.register.reset();
    clearFieldStates(forms.register);
    setMessage(message, result.message, "success");
    showToast("Conta criada. Entrando no painel...");
    localStorage.setItem(SESSION_KEY, result.token);
    renderDashboard(result.user);
  } catch (error) {
    setMessage(message, error.message, "error");
  }
});

forms.login.addEventListener("submit", async (event) => {
  event.preventDefault();
  const cpf = document.querySelector("#loginCpf");
  const password = document.querySelector("#loginPassword");
  const message = document.querySelector("#loginMessage");
  if (!validateCpf(cpf) || !password.value) {
    setMessage(message, "Digite CPF e senha para entrar.", "error");
    return;
  }
  const submitButton = forms.login.querySelector('button[type="submit"]');
  setMessage(message, "Entrando...", "success");
  submitButton.disabled = true;
  submitButton.textContent = "Entrando...";
  try {
    const result = await apiRequest("/api/login", {
      method: "POST",
      body: { cpf: onlyDigits(cpf.value), password: password.value },
    });
    setMessage(message, "");
    localStorage.setItem(SESSION_KEY, result.token);
    renderDashboard(result.user);
  } catch (error) {
    setMessage(message, error.message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Entrar";
  }
});

forms.profile.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nickname = document.querySelector("#profileNickname");
  const message = document.querySelector("#profileMessage");
  if (!validateNickname(nickname)) {
    setMessage(message, "Confira o nickname.", "error");
    return;
  }
  try {
    const result = await apiRequest("/api/profile", {
      method: "PATCH",
      body: { nickname: nickname.value.trim() },
    });
    currentUser = result.user;
    updateHeader(result.user);
    setMessage(message, "Dados salvos.", "success");
  } catch (error) {
    setMessage(message, error.message, "error");
  }
});

forms.changePassword.addEventListener("submit", async (event) => {
  event.preventDefault();
  const currentPassword = document.querySelector("#currentPassword");
  const password = document.querySelector("#accountNewPassword");
  const confirmPassword = document.querySelector("#accountNewPasswordConfirm");
  const message = document.querySelector("#changePasswordMessage");
  if (!validatePasswordPair(password, confirmPassword)) {
    setMessage(message, "A nova senha e a confirmacao precisam ser iguais.", "error");
    return;
  }
  try {
    const result = await apiRequest("/api/change-password", {
      method: "POST",
      body: { currentPassword: currentPassword.value, newPassword: password.value },
    });
    forms.changePassword.reset();
    clearFieldStates(forms.changePassword);
    setMessage(message, result.message, "success");
  } catch (error) {
    setMessage(message, error.message, "error");
  }
});

forms.friendInvite.addEventListener("submit", async (event) => {
  event.preventDefault();
  const friendId = onlyDigits(document.querySelector("#friendIdInput").value);
  const message = document.querySelector("#friendsMessage");
  if (friendId.length !== 10) {
    setMessage(message, "O ID do amigo precisa ter 10 numeros.", "error");
    return;
  }
  try {
    const result = await apiRequest("/api/friends/invite", {
      method: "POST",
      body: { friendId },
    });
    forms.friendInvite.reset();
    setMessage(message, result.message, "success");
    await loadFriends();
  } catch (error) {
    setMessage(message, error.message, "error");
  }
});

document.querySelector("#friendList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-accept-friend]");
  if (!button) return;
  await apiRequest("/api/friends/accept", {
    method: "POST",
    body: { friendshipId: Number(button.dataset.acceptFriend) },
  });
  await loadFriends();
  await loadNotifications(false);
});

document.querySelector("#notificationList").addEventListener("click", async (event) => {
  const friendButton = event.target.closest("[data-notification-friend]");
  const matchButton = event.target.closest("[data-accept-match]");
  const openMatchButton = event.target.closest("[data-open-match]");

  if (friendButton) {
    await apiRequest("/api/friends/accept", {
      method: "POST",
      body: { friendshipId: Number(friendButton.dataset.notificationFriend) },
    });
    showToast("Convite de amizade aceito.");
    await loadNotifications(true);
    return;
  }

  if (matchButton) {
    const result = await apiRequest("/api/matches/accept", {
      method: "POST",
      body: { matchId: Number(matchButton.dataset.acceptMatch) },
    });
    showToast(result.message);
    showRemoteMatch(result.match);
    await loadNotifications(false);
    return;
  }

  if (openMatchButton) {
    await loadRemoteMatch(Number(openMatchButton.dataset.openMatch), true);
  }
});

document.querySelector("#setupFriendsList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-setup-invite]");
  if (!button) return;

  const friendId = Number(button.dataset.setupInvite);
  const alreadySelected = setupInviteIds.includes(friendId);
  setupInviteIds = alreadySelected
    ? setupInviteIds.filter((id) => id !== friendId)
    : [...setupInviteIds, friendId];

  button.classList.toggle("selected", !alreadySelected);
  button.textContent = alreadySelected ? "Convidar" : "Convidado";
  setMessage(document.querySelector("#setupMessage"), `${setupInviteIds.length} amigo(s) selecionado(s).`, "success");
});

document.querySelector("#bingoFriendsList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-bingo-invite]");
  if (!button) return;

  const friendId = Number(button.dataset.bingoInvite);
  const alreadySelected = bingoInviteIds.includes(friendId);
  bingoInviteIds = alreadySelected
    ? bingoInviteIds.filter((id) => id !== friendId)
    : [...bingoInviteIds, friendId];

  button.classList.toggle("selected", !alreadySelected);
  button.textContent = alreadySelected ? "Convidar" : "Convidado";
  setMessage(document.querySelector("#bingoSetupMessage"), `${bingoInviteIds.length} amigo(s) selecionado(s).`, "success");
});

function getSelectedHangmanConfig() {
  const difficulty = document.querySelector('input[name="difficulty"]:checked')?.value || "normal";
  const mode = document.querySelector('input[name="gameMode"]:checked')?.value || "solo";
  const invitedFriends = setupFriends.filter((friend) => setupInviteIds.includes(Number(friend.id)));

  return {
    game: "hangman",
    difficulty,
    mode,
    accessMode: document.querySelector('input[name="hangmanAccess"]:checked')?.value || "code",
    invitedFriends,
  };
}

function getSelectedBingoConfig() {
  return {
    game: "bingo",
    difficulty: "normal",
    mode: "bingo",
    accessMode: document.querySelector('input[name="bingoAccess"]:checked')?.value || "code",
    drawSeconds: Math.max(3, Math.min(60, Number(document.querySelector("#bingoDrawSeconds").value || 8))),
    winCondition: document.querySelector('input[name="bingoWin"]:checked')?.value || "line",
    invitedFriends: bingoSetupFriends.filter((friend) => bingoInviteIds.includes(Number(friend.id))),
  };
}

function createPlayers(mode, invitedFriends = []) {
  if (mode === "solo") return [
    { name: currentUser.nickname, misses: 0, hits: 0, streak: 0 },
    { name: "Bot", misses: 0, hits: 0, streak: 0, bot: true },
  ];
  if (mode === "teams") return [
    { name: invitedFriends[0] ? `${currentUser.nickname} + ${invitedFriends[0].nickname}` : "Dupla 1", misses: 0, hits: 0, streak: 0 },
    { name: invitedFriends[1] && invitedFriends[2] ? `${invitedFriends[1].nickname} + ${invitedFriends[2].nickname}` : "Dupla 2", misses: 0, hits: 0, streak: 0 },
  ];
  return [
    { name: currentUser.nickname, misses: 0, hits: 0, streak: 0 },
    { name: invitedFriends[0]?.nickname || "Jogador 2", misses: 0, hits: 0, streak: 0 },
  ];
}

function stopRemotePolling() {
  window.clearInterval(remoteMatchTimer);
  remoteMatchTimer = null;
  activeRemoteMatchId = null;
}

function stopBingoPolling() {
  window.clearInterval(bingoTimer);
  bingoTimer = null;
}

function stopLocalNextRound() {
  window.clearTimeout(localNextRoundTimer);
  localNextRoundTimer = null;
}

function isMyRemoteTurn() {
  if (!hangman?.remoteMatchId) return true;
  const active = hangman.players[hangman.turn] || {};
  return (active.userIds || []).map(Number).includes(Number(currentUser?.id));
}

function openHangmanMatchView() {
  Object.entries(views).forEach(([key, view]) => {
    view.hidden = key !== "games";
    view.classList.toggle("active", key === "games");
  });
  userMenu.hidden = true;
  userMenuButton.setAttribute("aria-expanded", "false");
  dashboardEyebrow.textContent = "Forca";
  dashboardTitle.textContent = "Sala de jogo";
  document.querySelector("#gamesGrid").hidden = true;
  document.querySelector("#roomChoice").hidden = true;
  document.querySelector("#hangmanSetup").hidden = true;
  document.querySelector("#hangmanPanel").hidden = false;
  document.querySelector("#bingoSetup").hidden = true;
  document.querySelector("#bingoPanel").hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openBingoMatchView() {
  Object.entries(views).forEach(([key, view]) => {
    view.hidden = key !== "games";
    view.classList.toggle("active", key === "games");
  });
  userMenu.hidden = true;
  userMenuButton.setAttribute("aria-expanded", "false");
  dashboardEyebrow.textContent = "Bingo";
  dashboardTitle.textContent = "Sala de Bingo";
  document.querySelector("#gamesGrid").hidden = true;
  document.querySelector("#roomChoice").hidden = true;
  document.querySelector("#hangmanSetup").hidden = true;
  document.querySelector("#hangmanPanel").hidden = true;
  document.querySelector("#bingoSetup").hidden = true;
  document.querySelector("#bingoPanel").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderBingoCard(playerCard, match) {
  const grid = document.querySelector("#bingoCardGrid");

  if (!playerCard?.card?.length) {
    grid.innerHTML = '<p class="muted-label">Cartela sendo preparada...</p>';
    return;
  }

  const called = new Set((match.state?.calledNumbers || []).map(Number));
  const marked = new Set((playerCard.marked || []).map(Number));
  const canMark = match.status === "active" && !match.state?.locked;
  grid.innerHTML = playerCard.card.map((number) => `
    <button type="button" data-bingo-number="${number}" class="${marked.has(Number(number)) ? "marked" : ""}" ${canMark && called.has(Number(number)) ? "" : "disabled"}>
      ${number}
    </button>
  `).join("");
}

function showBingoMatch(match) {
  const state = match.state || {};
  const playerCard = state.playerCards?.[String(currentUser.id)];
  const alreadyOpen = !document.querySelector("#bingoPanel").hidden && bingo?.remoteMatchId === match.id;
  bingo = { remoteMatchId: match.id, match };
  if (!alreadyOpen) {
    openBingoMatchView();
  }
  document.querySelector("#activeBingoCode").textContent = match.roomCode || state.roomCode || "----";
  document.querySelector("#bingoSummary").innerHTML = `
    <span>${state.winCondition === "full" ? "Cartela cheia" : "Fileira"}</span>
    <span>${state.drawSeconds || 8}s</span>
    <span>${match.status === "pending" ? "Aguardando" : match.status === "active" ? "Em jogo" : "Encerrado"}</span>
  `;
  document.querySelector("#startBingoMatch").hidden = !match.canStart || match.status !== "pending";
  document.querySelector("#startBingoMatch").dataset.matchId = match.id;
  document.querySelector("#rerollBingoCard").disabled = match.status !== "pending";
  document.querySelector("#confirmBingoCard").disabled = match.status !== "pending" || Boolean(playerCard?.confirmed);
  document.querySelector("#drawnNumbers").innerHTML = (state.calledNumbers || []).length
    ? state.calledNumbers.slice(-20).map((number) => `<span>${number}</span>`).join("")
    : '<p class="muted-label">Os numeros sorteados aparecerao aqui.</p>';
  document.querySelector("#bingoPlayers").innerHTML = match.players.map((player) => {
    const card = state.playerCards?.[String(player.id)];
    const status = match.status === "pending"
      ? card?.confirmed ? "Cartela confirmada" : "Escolhendo cartela"
      : `${card?.marked?.length || 0} numero(s) marcado(s)`;
    return `
      <div class="${Number(player.id) === Number(state.winnerUserId) ? "active-score" : ""}">
        <strong>${player.nickname}</strong>
        <span>${status}</span>
      </div>
    `;
  }).join("");
  renderBingoCard(playerCard, match);
  setMessage(document.querySelector("#bingoMessage"), state.message || "Sala de Bingo aberta.", state.messageType || "success");

  const winner = document.querySelector("#bingoWinner");
  const winnerKey = state.winnerName ? `${match.id}-${state.winnerName}-${state.calledNumbers?.length || 0}` : "";
  if (state.winnerName && winnerKey !== lastBingoWinnerKey) {
    lastBingoWinnerKey = winnerKey;
    winner.hidden = false;
    winner.textContent = `BINGO! ${state.winnerName}`;
    window.setTimeout(() => { winner.hidden = true; }, 4500);
  } else if (!state.winnerName) {
    winner.hidden = true;
  }

  if (!alreadyOpen || !bingoTimer) {
    startBingoPolling(match.id);
  }
}

function startBingoPolling(matchId) {
  stopRemotePolling();
  window.clearInterval(bingoTimer);
  bingoTimer = window.setInterval(() => loadRemoteMatch(matchId, false), 900);
}

function showWaitingMatch(match) {
  stopRemotePolling();
  activeRemoteMatchId = match.id;
  openHangmanMatchView();
  document.querySelector("#wordGuess").value = "";
  document.querySelector("#turnLabel").textContent = "Aguardando inicio da partida";
  document.querySelector("#wordSlots").innerHTML = "<span>...</span>";
  document.querySelector("#letterKeyboard").innerHTML = `
    ${match.roomCode ? `<button class="room-start-button" type="button" data-copy-room="${match.roomCode}">Copiar codigo ${match.roomCode}</button>` : ""}
    ${match.canStart ? `<button class="room-start-button" type="button" data-start-match="${match.id}">Iniciar jogo</button>` : ""}
  `;
  document.querySelector("#teamScore").innerHTML = match.playerIds.map((userId) => {
    const accepted = match.acceptedIds.includes(Number(userId));
    const player = match.players?.find((user) => Number(user.id) === Number(userId));
    const label = player?.nickname || (Number(userId) === Number(currentUser.id) ? currentUser.nickname : `Usuario ${userId}`);
    return `
      <div class="${accepted ? "active-score" : ""}">
        <strong>${label}</strong>
        <span>${accepted ? "Dentro da sala - aguardando inicio" : "Convite enviado - aguardando entrar"}</span>
      </div>
    `;
  }).join("");
  document.querySelector("#matchSummary").innerHTML = `
    <span>${match.modeLabel}</span>
    <span>${difficultyRules[match.difficulty]?.label || "Normal"}</span>
    ${match.roomCode ? `<span>Codigo ${match.roomCode}</span>` : ""}
    <span>Aguardando</span>
  `;
  document.querySelector("#guessWordButton").disabled = true;
  document.querySelector("#newHangmanRound").disabled = true;
  setMessage(
    document.querySelector("#hangmanMessage"),
    match.canStart
      ? "Todos entraram na sala. Clique em Iniciar jogo."
      : match.waitingFor.length
        ? `Aguardando entrar: ${match.waitingFor.map((user) => user.nickname).join(", ")}.`
        : match.roomCode && match.playerIds.length < 2
          ? `Compartilhe o codigo ${match.roomCode} para outro jogador entrar.`
        : "Todos entraram na sala. Aguardando o criador iniciar o jogo.",
    "success",
  );
  startRemotePolling(match.id);
}

function showRemoteMatch(match) {
  if ((match.game || match.state?.game) === "bingo") {
    showBingoMatch(match);
    return;
  }

  if (match.status === "pending") {
    showWaitingMatch(match);
    return;
  }

  const state = match.state || {};
  hangman = {
    matchId: `remote-${match.id}`,
    remoteMatchId: match.id,
    mode: match.mode,
    difficulty: match.difficulty,
    maxMisses: state.maxMisses || (difficultyRules[match.difficulty] || difficultyRules.normal).maxMisses,
    word: state.word || "",
    normalized: state.normalized || "",
    guessed: new Set(state.guessed || []),
    turn: Number(state.turn || 0),
    locked: Boolean(state.locked || match.status === "finished"),
    players: state.players || [],
  };
  openHangmanMatchView();
  document.querySelector("#newHangmanRound").disabled = true;
  setMessage(document.querySelector("#hangmanMessage"), state.message || "Partida carregada.", state.messageType || "success");
  renderHangman();
  startRemotePolling(match.id);
}

function startRemotePolling(matchId) {
  activeRemoteMatchId = matchId;
  window.clearInterval(remoteMatchTimer);
  remoteMatchTimer = window.setInterval(() => loadRemoteMatch(matchId, false), 800);
}

async function loadRemoteMatch(matchId, showErrors = true) {
  try {
    const result = await apiRequest(`/api/matches/${matchId}`, { method: "GET" });
    showRemoteMatch(result.match);
  } catch (error) {
    if (showErrors) {
      showToast(error.message);
    }
  }
}

async function startSharedHangman(config) {
  const message = document.querySelector("#setupMessage");
  const requiredFriends = config.mode === "teams" ? 3 : 1;

  if (config.accessMode === "invite" && config.invitedFriends.length !== requiredFriends) {
    setMessage(
      message,
      config.mode === "teams" ? "Para 2x2, selecione exatamente 3 amigos online." : "Para 1x1, selecione exatamente 1 amigo online.",
      "error",
    );
    return;
  }

  setMessage(message, "Enviando convite de partida...", "success");

  try {
    const result = await apiRequest("/api/rooms/create", {
      method: "POST",
      body: {
        game: "hangman",
        mode: config.mode,
        difficulty: config.difficulty,
        accessMode: config.accessMode,
        friendIds: config.invitedFriends.map((friend) => friend.id),
      },
    });
    showToast(result.message);
    if (result.match.roomCode) {
      document.querySelector("#hangmanRoomCode").textContent = result.match.roomCode;
      document.querySelector("#hangmanRoomCodeBox").hidden = false;
    }
    showRemoteMatch(result.match);
    await loadNotifications(false);
  } catch (error) {
    setMessage(message, error.message, "error");
  }
}

function startHangman(config = getSelectedHangmanConfig()) {
  stopRemotePolling();
  stopLocalNextRound();
  const rules = difficultyRules[config.difficulty] || difficultyRules.normal;
  const dictionary = hangmanWords[config.difficulty] || hangmanWords.normal;
  const previousUsedWords = hangman?.difficulty === config.difficulty ? hangman.usedWords : [];
  const pickedWord = pickHangmanWord(dictionary, previousUsedWords);
  const word = pickedWord.word;
  hangman = {
    matchId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mode: config.mode,
    difficulty: config.difficulty,
    invitedFriends: config.invitedFriends || [],
    maxMisses: rules.maxMisses,
    botHitChance: rules.botHitChance,
    word,
    normalized: normalizeText(word),
    usedWords: pickedWord.usedWords,
    guessed: new Set(),
    turn: 0,
    locked: false,
    players: createPlayers(config.mode, config.invitedFriends || []),
  };
  document.querySelector("#hangmanSetup").hidden = true;
  document.querySelector("#hangmanPanel").hidden = false;
  document.querySelector("#newHangmanRound").disabled = false;
  document.querySelector("#wordGuess").value = "";
  setMessage(document.querySelector("#hangmanMessage"), "Partida iniciada. Boa sorte!", "success");
  renderHangman();
}

function renderHangman() {
  const active = hangman.players[hangman.turn];
  const myTurn = isMyRemoteTurn();
  document.querySelector("#turnLabel").textContent = hangman.locked
    ? "Rodada encerrada"
    : `${myTurn ? "Sua vez" : "Aguarde"} - vez de ${active.name}`;
  document.querySelector("#wordSlots").innerHTML = [...hangman.normalized].map((letter) => (
    hangman.guessed.has(letter) ? `<span>${letter}</span>` : "<span>_</span>"
  )).join("");
  document.querySelector("#teamScore").innerHTML = hangman.players.map((player, index) => `
    <div class="${index === hangman.turn && !hangman.locked ? "active-score" : ""}">
      <strong>${player.name}</strong>
      <span>Acertos ${player.hits} - Erros ${player.misses}/${hangman.maxMisses} - Sequencia ${player.streak}</span>
    </div>
  `).join("");
  document.querySelectorAll(".body-part").forEach((part, index) => {
    const visibleParts = Math.ceil((active.misses / hangman.maxMisses) * 6);
    part.classList.toggle("visible", visibleParts > index);
  });
  document.querySelector("#guessWordButton").disabled = hangman.locked || active.streak < 3 || !myTurn;
  const modeLabel = hangman.mode === "solo" ? "Solo vs bot" : hangman.mode === "duel" ? "1x1" : "2x2";
  document.querySelector("#matchSummary").innerHTML = `
    <span>${modeLabel}</span>
    <span>${difficultyRules[hangman.difficulty].label}</span>
    <span>${hangman.maxMisses} erros</span>
  `;
  renderKeyboard();
}

function renderKeyboard() {
  const keyboard = document.querySelector("#letterKeyboard");
  const myTurn = isMyRemoteTurn();
  keyboard.innerHTML = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => `
    <button type="button" data-letter="${letter}" ${hangman.guessed.has(letter) || hangman.locked || !myTurn ? "disabled" : ""}>${letter}</button>
  `).join("");
}

function nextTurn() {
  hangman.turn = (hangman.turn + 1) % hangman.players.length;
  renderHangman();
  const active = hangman.players[hangman.turn];
  if (active.bot && !hangman.locked) {
    window.setTimeout(playBotTurn, 700);
  }
}

function finishHangman(message, type = "success") {
  hangman.locked = true;
  setMessage(document.querySelector("#hangmanMessage"), `${message} Nova rodada em 5 segundos.`, type);
  renderHangman();
  stopLocalNextRound();
  localNextRoundTimer = window.setTimeout(() => startHangman({
    difficulty: hangman?.difficulty || getSelectedHangmanConfig().difficulty,
    mode: hangman?.mode || getSelectedHangmanConfig().mode,
    invitedFriends: hangman?.invitedFriends || [],
  }), 5000);
}

async function awardHangmanWin(winner, reason) {
  if (!winner || winner.bot || lastAwardedMatchId === hangman.matchId) {
    return;
  }

  const winnerBelongsToCurrentUser = winner.name === currentUser.nickname || winner.name.includes(currentUser.nickname);

  if (!winnerBelongsToCurrentUser) {
    return;
  }

  lastAwardedMatchId = hangman.matchId;

  try {
    const result = await apiRequest("/api/score/win", {
      method: "POST",
      body: {
        game: "hangman",
        mode: hangman.mode,
        difficulty: hangman.difficulty,
        reason,
      },
    });
    setMessage(
      document.querySelector("#hangmanMessage"),
      `${document.querySelector("#hangmanMessage").textContent} +${result.pointsEarned} pontos. Total: ${result.score.points}.`,
      "success",
    );
  } catch (error) {
    showToast(`Partida vencida, mas a pontuacao nao foi salva: ${error.message}`);
  }
}

async function guessRemoteLetter(letter) {
  try {
    const result = await apiRequest(`/api/matches/${hangman.remoteMatchId}/guess-letter`, {
      method: "POST",
      body: { letter },
    });
    showRemoteMatch(result.match);
  } catch (error) {
    setMessage(document.querySelector("#hangmanMessage"), error.message, "error");
  }
}

function guessLetter(letter) {
  if (hangman?.remoteMatchId) {
    guessRemoteLetter(letter);
    return;
  }

  if (hangman.locked || hangman.guessed.has(letter)) return;
  const active = hangman.players[hangman.turn];
  hangman.guessed.add(letter);
  const occurrences = [...hangman.normalized].filter((item) => item === letter).length;
  if (occurrences) {
    active.hits += occurrences;
    active.streak += 1;
    const canGuessWord = active.streak >= 3 ? " Ja pode chutar a palavra ou continuar nas letras." : "";
    setMessage(document.querySelector("#hangmanMessage"), `${active.name} acertou ${occurrences} letra(s) e continua jogando.${canGuessWord}`, "success");
  } else {
    active.misses += 1;
    active.streak = 0;
    setMessage(document.querySelector("#hangmanMessage"), `${active.name} errou a letra ${letter}. A vez passou.`, "error");
  }
  const solved = [...hangman.normalized].every((item) => hangman.guessed.has(item));
  if (solved) {
    finishHangman(`${active.name} completou a palavra e venceu!`);
    awardHangmanWin(active, "word_completed");
    return;
  }
  if (active.misses >= hangman.maxMisses) {
    const winner = hangman.players[(hangman.turn + 1) % hangman.players.length];
    finishHangman(`${active.name} foi enforcado. ${winner.name} venceu!`, "error");
    awardHangmanWin(winner, "opponent_hanged");
    return;
  }
  if (occurrences) {
    renderHangman();
    if (active.bot) {
      window.setTimeout(playBotTurn, 700);
    }
    return;
  }
  nextTurn();
}

function playBotTurn() {
  const available = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter((letter) => !hangman.guessed.has(letter));
  if (!available.length) return;
  const smartLetters = [...new Set(hangman.normalized.split(""))].filter((letter) => !hangman.guessed.has(letter));
  const shouldHit = Math.random() < hangman.botHitChance && smartLetters.length;
  guessLetter(shouldHit ? smartLetters[0] : available[Math.floor(Math.random() * available.length)]);
}

document.querySelector("#closeHangmanGame").addEventListener("click", () => {
  stopRemotePolling();
  stopLocalNextRound();
  document.querySelector("#hangmanPanel").hidden = true;
  showGamesHome();
});

document.querySelector("#changeHangmanConfig").addEventListener("click", () => {
  stopRemotePolling();
  stopLocalNextRound();
  document.querySelector("#hangmanPanel").hidden = true;
  document.querySelector("#hangmanSetup").hidden = false;
  loadSetupFriends();
});

document.querySelector("#newHangmanRound").addEventListener("click", () => startHangman({
  difficulty: hangman?.difficulty || getSelectedHangmanConfig().difficulty,
  mode: hangman?.mode || getSelectedHangmanConfig().mode,
  invitedFriends: hangman?.invitedFriends || [],
}));

document.querySelector("#startConfiguredHangman").addEventListener("click", () => {
  const config = getSelectedHangmanConfig();
  if (config.mode !== "solo") {
    startSharedHangman(config);
    return;
  }
  startHangman(config);
});

document.querySelector("#createBingoRoom").addEventListener("click", async () => {
  const config = getSelectedBingoConfig();
  const message = document.querySelector("#bingoSetupMessage");

  if (config.accessMode === "invite" && !config.invitedFriends.length) {
    setMessage(message, "Selecione pelo menos um amigo online ou use entrada por codigo.", "error");
    return;
  }

  setMessage(message, "Criando sala de Bingo...", "success");

  try {
    const result = await apiRequest("/api/rooms/create", {
      method: "POST",
      body: {
        game: "bingo",
        mode: "bingo",
        difficulty: "normal",
        accessMode: config.accessMode,
        drawSeconds: config.drawSeconds,
        winCondition: config.winCondition,
        friendIds: config.invitedFriends.map((friend) => friend.id),
      },
    });
    document.querySelector("#bingoRoomCode").textContent = result.match.roomCode;
    document.querySelector("#bingoRoomCodeBox").hidden = false;
    showToast(result.message);
    showBingoMatch(result.match);
  } catch (error) {
    setMessage(message, error.message, "error");
  }
});

document.querySelector("#letterKeyboard").addEventListener("click", (event) => {
  const startButton = event.target.closest("[data-start-match]");
  if (startButton) {
    startRemoteMatch(Number(startButton.dataset.startMatch));
    return;
  }

  const copyButton = event.target.closest("[data-copy-room]");
  if (copyButton) {
    copyText(copyButton.dataset.copyRoom);
    return;
  }

  const button = event.target.closest("[data-letter]");
  if (button) guessLetter(button.dataset.letter);
});

async function startRemoteMatch(matchId) {
  try {
    const result = await apiRequest(`/api/matches/${matchId}/start`, { method: "POST" });
    showToast(result.message);
    showRemoteMatch(result.match);
  } catch (error) {
    setMessage(document.querySelector("#hangmanMessage"), error.message, "error");
  }
}

async function sendBingoAction(action, extra = {}) {
  if (!bingo?.remoteMatchId) return;

  try {
    const result = await apiRequest(`/api/bingo/${bingo.remoteMatchId}/action`, {
      method: "POST",
      body: { action, ...extra },
    });
    showBingoMatch(result.match);
  } catch (error) {
    setMessage(document.querySelector("#bingoMessage"), error.message, "error");
  }
}

document.querySelector("#startBingoMatch").addEventListener("click", async () => {
  const matchId = Number(document.querySelector("#startBingoMatch").dataset.matchId);
  if (matchId) await startRemoteMatch(matchId);
});

document.querySelector("#rerollBingoCard").addEventListener("click", () => sendBingoAction("reroll"));
document.querySelector("#confirmBingoCard").addEventListener("click", () => sendBingoAction("confirm"));
document.querySelector("#bingoCardGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-bingo-number]");
  if (button) sendBingoAction("mark", { number: Number(button.dataset.bingoNumber) });
});

document.querySelector("#closeBingoGame").addEventListener("click", () => {
  stopBingoPolling();
  showGamesHome();
});

document.querySelector("#guessWordButton").addEventListener("click", async () => {
  const guess = normalizeText(document.querySelector("#wordGuess").value);
  const active = hangman.players[hangman.turn];

  if (hangman?.remoteMatchId) {
    try {
      const result = await apiRequest(`/api/matches/${hangman.remoteMatchId}/guess-word`, {
        method: "POST",
        body: { guess },
      });
      showRemoteMatch(result.match);
    } catch (error) {
      setMessage(document.querySelector("#hangmanMessage"), error.message, "error");
    }
    return;
  }

  if (!guess) {
    setMessage(document.querySelector("#hangmanMessage"), "Digite uma palavra antes de chutar.", "error");
    return;
  }
  if (active.streak < 3) {
    setMessage(document.querySelector("#hangmanMessage"), "A equipe precisa acertar 3 letras seguidas para chutar.", "error");
    return;
  }
  if (guess === hangman.normalized) {
    finishHangman(`${active.name} acertou a palavra e venceu!`);
    awardHangmanWin(active, "word_guess");
  } else {
    const winner = hangman.players[(hangman.turn + 1) % hangman.players.length];
    finishHangman(`${active.name} errou a palavra e perdeu automaticamente. ${winner.name} venceu!`, "error");
    awardHangmanWin(winner, "opponent_missed_word");
  }
});

restoreSession();

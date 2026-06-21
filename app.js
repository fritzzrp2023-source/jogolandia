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
};

const forms = {
  login: document.querySelector("#loginForm"),
  register: document.querySelector("#registerForm"),
  profile: document.querySelector("#profileForm"),
  changePassword: document.querySelector("#changePasswordForm"),
  friendInvite: document.querySelector("#friendInviteForm"),
};

const hangmanWords = {
  easy: ["amizade", "equipe", "desafio", "segredo", "palavra", "jogador", "vitoria", "rodada", "dupla", "missao", "atalho", "memoria"],
  normal: ["campeonato", "controle", "tabuleiro", "aventura", "partida", "estrategia", "conquista", "diversao", "energia", "convite", "ranking", "resposta"],
  hard: ["raciocinio", "colaboracao", "comunicacao", "sobrevivencia", "inteligencia", "competitividade", "entretenimento", "planejamento", "concentracao", "persistencia"],
};

const difficultyRules = {
  easy: { label: "Facil", maxMisses: 7, botHitChance: 0.35 },
  normal: { label: "Normal", maxMisses: 6, botHitChance: 0.5 },
  hard: { label: "Dificil", maxMisses: 5, botHitChance: 0.65 },
};

let currentUser = null;
let hangman = null;
let setupFriends = [];

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
  document.querySelector("#userPublicId").textContent = `ID ${user.id}`;
  document.querySelector("#friendsMyId").textContent = user.id;
}

function renderDashboard(user) {
  currentUser = user;
  authView.hidden = true;
  dashboardView.hidden = false;
  authView.style.display = "none";
  dashboardView.style.display = "block";
  updateHeader(user);
  showPanel("games");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderAuth() {
  currentUser = null;
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
    games: ["Painel", "Escolha o jogo"],
    account: ["Minha conta", "Dados da conta"],
    friends: ["Amigos", "Convites e jogadores online"],
  };
  dashboardEyebrow.textContent = titles[name][0];
  dashboardTitle.textContent = titles[name][1];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadProfile() {
  const result = await apiRequest("/api/profile", { method: "GET" });
  currentUser = result.user;
  updateHeader(result.user);
  document.querySelector("#profileId").value = result.user.id;
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
          <span>ID ${friend.id} • ${friend.online ? "online" : "offline"} • ${friend.statusText}</span>
        </div>
        ${friend.canAccept ? `<button type="button" data-accept-friend="${friend.friendshipId}">Aceitar</button>` : ""}
        ${friend.status === "accepted" ? `<button type="button" ${friend.online ? "" : "disabled"}>Convidar para jogar</button>` : ""}
      </article>
    `).join("");
  } catch (error) {
    list.innerHTML = `<p class="form-message error">${error.message}</p>`;
  }
}

async function loadSetupFriends() {
  const list = document.querySelector("#setupFriendsList");
  list.innerHTML = '<p class="muted-label">Carregando amigos...</p>';

  try {
    const result = await apiRequest("/api/friends", { method: "GET" });
    setupFriends = result.friends.filter((friend) => friend.status === "accepted");

    if (!setupFriends.length) {
      list.innerHTML = '<p class="muted-label">Nenhum amigo aceito ainda. Voce pode iniciar solo, 1x1 local ou 2x2 local.</p>';
      return;
    }

    list.innerHTML = setupFriends.map((friend) => `
      <label class="friend-check">
        <input type="checkbox" value="${friend.id}" ${friend.online ? "" : "disabled"} />
        <span>
          <strong>${friend.nickname}</strong>
          <small>ID ${friend.id} • ${friend.online ? "online" : "offline"}</small>
        </span>
      </label>
    `).join("");
  } catch (error) {
    list.innerHTML = `<p class="form-message error">${error.message}</p>`;
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

document.querySelector("#backToGamesFromMenu").addEventListener("click", () => showPanel("games"));
document.querySelector("#backToGamesFromAccount").addEventListener("click", () => showPanel("games"));
document.querySelector("#backToGamesFromFriends").addEventListener("click", () => showPanel("games"));

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
  const friendId = Number(document.querySelector("#friendIdInput").value);
  const message = document.querySelector("#friendsMessage");
  if (!friendId) {
    setMessage(message, "Digite o ID do amigo.", "error");
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
});

function getSelectedHangmanConfig() {
  const difficulty = document.querySelector('input[name="difficulty"]:checked')?.value || "normal";
  const mode = document.querySelector('input[name="gameMode"]:checked')?.value || "solo";
  const selectedFriendIds = [...document.querySelectorAll("#setupFriendsList input:checked")].map((input) => Number(input.value));
  const invitedFriends = setupFriends.filter((friend) => selectedFriendIds.includes(Number(friend.id)));

  return { difficulty, mode, invitedFriends };
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

function startHangman(config = getSelectedHangmanConfig()) {
  const rules = difficultyRules[config.difficulty] || difficultyRules.normal;
  const dictionary = hangmanWords[config.difficulty] || hangmanWords.normal;
  const word = dictionary[Math.floor(Math.random() * dictionary.length)];
  hangman = {
    mode: config.mode,
    difficulty: config.difficulty,
    invitedFriends: config.invitedFriends || [],
    maxMisses: rules.maxMisses,
    botHitChance: rules.botHitChance,
    word,
    normalized: normalizeText(word),
    guessed: new Set(),
    turn: 0,
    locked: false,
    players: createPlayers(config.mode, config.invitedFriends || []),
  };
  document.querySelector("#hangmanSetup").hidden = true;
  document.querySelector("#hangmanPanel").hidden = false;
  document.querySelector("#wordGuess").value = "";
  setMessage(document.querySelector("#hangmanMessage"), "Partida iniciada. Boa sorte!", "success");
  renderHangman();
}

function renderHangman() {
  const active = hangman.players[hangman.turn];
  document.querySelector("#turnLabel").textContent = hangman.locked ? "Rodada encerrada" : `Vez de ${active.name}`;
  document.querySelector("#wordSlots").innerHTML = [...hangman.normalized].map((letter) => (
    hangman.guessed.has(letter) ? `<span>${letter}</span>` : "<span>_</span>"
  )).join("");
  document.querySelector("#teamScore").innerHTML = hangman.players.map((player, index) => `
    <div class="${index === hangman.turn && !hangman.locked ? "active-score" : ""}">
      <strong>${player.name}</strong>
      <span>Acertos ${player.hits} • Erros ${player.misses}/${hangman.maxMisses} • Sequencia ${player.streak}</span>
    </div>
  `).join("");
  document.querySelectorAll(".body-part").forEach((part, index) => {
    const visibleParts = Math.ceil((active.misses / hangman.maxMisses) * 6);
    part.classList.toggle("visible", visibleParts > index);
  });
  document.querySelector("#guessWordButton").disabled = hangman.locked || active.streak < 3;
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
  keyboard.innerHTML = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => `
    <button type="button" data-letter="${letter}" ${hangman.guessed.has(letter) || hangman.locked ? "disabled" : ""}>${letter}</button>
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
  setMessage(document.querySelector("#hangmanMessage"), message, type);
  renderHangman();
}

function guessLetter(letter) {
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
    const winner = [...hangman.players].sort((a, b) => b.hits - a.hits)[0];
    finishHangman(`${winner.name} venceu com mais letras acertadas!`);
    return;
  }
  if (active.misses >= hangman.maxMisses) {
    finishHangman(`${active.name} foi enforcado. ${hangman.players[(hangman.turn + 1) % hangman.players.length].name} venceu!`, "error");
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

document.querySelector("#openHangmanGame").addEventListener("click", () => {
  document.querySelector("#hangmanSetup").hidden = false;
  document.querySelector("#hangmanPanel").hidden = true;
  loadSetupFriends();
});

document.querySelector("#closeHangmanSetup").addEventListener("click", () => {
  document.querySelector("#hangmanSetup").hidden = true;
});

document.querySelector("#closeHangmanGame").addEventListener("click", () => {
  document.querySelector("#hangmanPanel").hidden = true;
  document.querySelector("#hangmanSetup").hidden = true;
});

document.querySelector("#changeHangmanConfig").addEventListener("click", () => {
  document.querySelector("#hangmanPanel").hidden = true;
  document.querySelector("#hangmanSetup").hidden = false;
  loadSetupFriends();
});

document.querySelector("#newHangmanRound").addEventListener("click", () => startHangman({
  difficulty: hangman?.difficulty || getSelectedHangmanConfig().difficulty,
  mode: hangman?.mode || getSelectedHangmanConfig().mode,
  invitedFriends: hangman?.invitedFriends || [],
}));

document.querySelector("#startConfiguredHangman").addEventListener("click", () => startHangman(getSelectedHangmanConfig()));

document.querySelector("#letterKeyboard").addEventListener("click", (event) => {
  const button = event.target.closest("[data-letter]");
  if (button) guessLetter(button.dataset.letter);
});

document.querySelector("#guessWordButton").addEventListener("click", () => {
  const guess = normalizeText(document.querySelector("#wordGuess").value);
  const active = hangman.players[hangman.turn];
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
  } else {
    finishHangman(`${active.name} errou a palavra e perdeu automaticamente.`, "error");
  }
});

restoreSession();

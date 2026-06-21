const SESSION_KEY = "jogolandia_session_token";
const API_BASE = location.protocol === "file:" ? "http://127.0.0.1:8080" : "";

const authView = document.querySelector("#authView");
const dashboardView = document.querySelector("#dashboardView");
const toast = document.querySelector("#toast");

const forms = {
  login: document.querySelector("#loginForm"),
  register: document.querySelector("#registerForm"),
  reset: document.querySelector("#resetForm"),
  newPassword: document.querySelector("#newPasswordForm"),
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
let activeResetToken = null;

function setFieldState(input, state, message) {
  const field = input.closest(".field");
  const helper = field.querySelector(".field-message");
  field.classList.remove("valid", "invalid");

  if (state) {
    field.classList.add(state);
  }

  helper.textContent = message || "";
}

function setMessage(element, text, type = "") {
  element.textContent = text;
  element.className = `form-message ${type}`.trim();
}

function validateEmail(input) {
  const email = input.value.trim();

  if (!email) {
    setFieldState(input, "", "");
    return false;
  }

  if (!emailPattern.test(email)) {
    setFieldState(input, "invalid", "Email invalido.");
    return false;
  }

  setFieldState(input, "valid", "Email valido.");
  return true;
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

  if (passwordOk) {
    setFieldState(confirmInput, "valid", "Senhas iguais.");
  }

  return passwordOk;
}

function showForm(name) {
  Object.values(forms).forEach((form) => form.classList.remove("active"));
  forms[name].classList.add("active");

  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authTab === name);
  });
}

function makeToken() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function showToast(html) {
  toast.innerHTML = html;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 12000);
}

function clearFieldStates(form) {
  form.querySelectorAll(".field").forEach((field) => {
    field.classList.remove("valid", "invalid");
    field.querySelector(".field-message").textContent = "";
  });
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = localStorage.getItem(SESSION_KEY);

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.ok) {
    throw new Error(result.message || "Nao foi possivel concluir a acao.");
  }

  return result;
}

function loginUser(token, user) {
  localStorage.setItem(SESSION_KEY, token);
  renderDashboard(user);
}

function renderDashboard(user) {
  authView.hidden = true;
  dashboardView.hidden = false;
  document.querySelector("#userNickname").textContent = user.nickname;
}

function renderAuth() {
  authView.hidden = false;
  dashboardView.hidden = true;
}

async function checkHashAction() {
  const hash = location.hash.replace("#", "");

  if (hash.startsWith("verify=")) {
    const token = hash.replace("verify=", "");

    try {
      const result = await apiRequest("/api/verify-email", {
        method: "POST",
        body: { token },
      });
      showForm("login");
      renderAuth();
      setMessage(document.querySelector("#loginMessage"), result.message, "success");
      history.replaceState(null, "", location.pathname);
    } catch (error) {
      showForm("login");
      renderAuth();
      setMessage(document.querySelector("#loginMessage"), error.message, "error");
    }

    return true;
  }

  if (hash.startsWith("reset=")) {
    activeResetToken = hash.replace("reset=", "");
    showForm("newPassword");
    renderAuth();
    return true;
  }

  return false;
}

async function restoreSession() {
  const token = localStorage.getItem(SESSION_KEY);

  if (!token) {
    renderAuth();
    return;
  }

  try {
    const result = await apiRequest("/api/session", { method: "GET" });
    renderDashboard(result.user);
  } catch (error) {
    localStorage.removeItem(SESSION_KEY);
    renderAuth();
  }
}

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => showForm(button.dataset.authTab));
});

document.querySelector("#showReset").addEventListener("click", () => showForm("reset"));
document.querySelector("#backToLogin").addEventListener("click", () => showForm("login"));

document.querySelector("#logoutButton").addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  renderAuth();
  showForm("login");
});

document.querySelectorAll('input[type="email"]').forEach((input) => {
  input.addEventListener("input", () => validateEmail(input));
});

document.querySelector("#nickname").addEventListener("input", (event) => validateNickname(event.target));

["#registerPassword", "#confirmPassword"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", () => {
    validatePasswordPair(document.querySelector("#registerPassword"), document.querySelector("#confirmPassword"));
  });
});

["#newPassword", "#newPasswordConfirm"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", () => {
    validatePasswordPair(document.querySelector("#newPassword"), document.querySelector("#newPasswordConfirm"));
  });
});

forms.register.addEventListener("submit", async (event) => {
  event.preventDefault();

  const nickname = document.querySelector("#nickname");
  const email = document.querySelector("#registerEmail");
  const password = document.querySelector("#registerPassword");
  const confirmPassword = document.querySelector("#confirmPassword");
  const message = document.querySelector("#registerMessage");

  const nicknameOk = validateNickname(nickname);
  const emailOk = validateEmail(email);
  const passwordOk = validatePasswordPair(password, confirmPassword);
  const isValid = nicknameOk && emailOk && passwordOk;

  if (!isValid) {
    setMessage(message, "Confira os campos marcados antes de continuar.", "error");
    return;
  }

  setMessage(message, "Conta criada. Enviando autenticacao por email...", "success");

  try {
    const registeredEmail = email.value.trim();
    const result = await apiRequest("/api/register", {
      method: "POST",
      body: {
        nickname: nickname.value.trim(),
        email: registeredEmail,
        password: password.value,
      },
    });
    forms.register.reset();
    clearFieldStates(forms.register);
    setMessage(message, result.message, "success");
    showToast(`Email de autenticacao enviado para <strong>${registeredEmail}</strong>.`);
  } catch (error) {
    setMessage(message, error.message, "error");
  }
});

forms.login.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.querySelector("#loginEmail");
  const password = document.querySelector("#loginPassword");
  const message = document.querySelector("#loginMessage");

  if (!validateEmail(email) || !password.value) {
    setMessage(message, "Digite email e senha para entrar.", "error");
    return;
  }

  try {
    const result = await apiRequest("/api/login", {
      method: "POST",
      body: {
        email: email.value.trim(),
        password: password.value,
      },
    });
    setMessage(message, "");
    loginUser(result.token, result.user);
  } catch (error) {
    setMessage(message, error.message, "error");
  }
});

forms.reset.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.querySelector("#resetEmail");
  const message = document.querySelector("#resetMessage");

  if (!validateEmail(email)) {
    setMessage(message, "Digite um email valido.", "error");
    return;
  }

  setMessage(message, "Enviando link de redefinicao...", "success");

  try {
    const result = await apiRequest("/api/request-reset", {
      method: "POST",
      body: { email: email.value.trim() },
    });
    setMessage(message, result.message, "success");
    showToast(`Link de redefinicao enviado para <strong>${email.value.trim()}</strong>.`);
  } catch (error) {
    setMessage(message, error.message, "error");
  }
});

forms.newPassword.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = document.querySelector("#newPassword");
  const confirmPassword = document.querySelector("#newPasswordConfirm");
  const message = document.querySelector("#newPasswordMessage");

  if (!validatePasswordPair(password, confirmPassword)) {
    setMessage(message, "As senhas precisam ser iguais.", "error");
    return;
  }

  try {
    const result = await apiRequest("/api/reset-password", {
      method: "POST",
      body: {
        token: activeResetToken,
        password: password.value,
      },
    });
    forms.newPassword.reset();
    setMessage(document.querySelector("#loginMessage"), result.message, "success");
    history.replaceState(null, "", location.pathname);
    showForm("login");
  } catch (error) {
    setMessage(message, error.message, "error");
  }
});

(async function boot() {
  const handledHash = await checkHashAction();

  if (!handledHash) {
    await restoreSession();
  }
})();

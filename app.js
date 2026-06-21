const SESSION_KEY = "jogolandia_session_token";
const API_BASE = location.protocol === "file:" ? "http://127.0.0.1:8080" : "";

const authView = document.querySelector("#authView");
const dashboardView = document.querySelector("#dashboardView");
const toast = document.querySelector("#toast");

const forms = {
  login: document.querySelector("#loginForm"),
  register: document.querySelector("#registerForm"),
  changePassword: document.querySelector("#changePasswordForm"),
};

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

function isCpfValid(value) {
  const cpf = onlyDigits(value);
  return cpf.length === 11;
}

function validateCpf(input) {
  input.value = formatCpf(input.value);

  if (!input.value) {
    setFieldState(input, "", "");
    return false;
  }

  if (!isCpfValid(input.value)) {
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

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    throw new Error("Nao foi possivel falar com o servidor. Tente recarregar a pagina.");
  }

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

document.querySelector("#logoutButton").addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  renderAuth();
  showForm("login");
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

  const nicknameOk = validateNickname(nickname);
  const cpfOk = validateCpf(cpf);
  const passwordOk = validatePasswordPair(password, confirmPassword);
  const isValid = nicknameOk && cpfOk && passwordOk;

  if (!isValid) {
    setMessage(message, "Confira os campos marcados antes de continuar.", "error");
    return;
  }

  setMessage(message, "Criando conta...", "success");

  try {
    const registeredCpf = cpf.value;
    const result = await apiRequest("/api/register", {
      method: "POST",
      body: {
        nickname: nickname.value.trim(),
        cpf: onlyDigits(cpf.value),
        password: password.value,
      },
    });
    forms.register.reset();
    clearFieldStates(forms.register);
    setMessage(message, result.message, "success");
    document.querySelector("#loginCpf").value = registeredCpf;
    validateCpf(document.querySelector("#loginCpf"));
    showForm("login");
    setMessage(document.querySelector("#loginMessage"), "Conta criada. Entre com a senha cadastrada.", "success");
    showToast("Conta criada. Use seu CPF e senha para entrar.");
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

  setMessage(message, "Entrando...", "success");

  try {
    const result = await apiRequest("/api/login", {
      method: "POST",
      body: {
        cpf: onlyDigits(cpf.value),
        password: password.value,
      },
    });
    setMessage(message, "");
    loginUser(result.token, result.user);
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
      body: {
        currentPassword: currentPassword.value,
        newPassword: password.value,
      },
    });
    forms.changePassword.reset();
    clearFieldStates(forms.changePassword);
    setMessage(message, result.message, "success");
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

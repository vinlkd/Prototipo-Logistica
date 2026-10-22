import "./auth.css";

const root = document.querySelector("#app");
const params = new URLSearchParams(location.search);
let resetToken = params.get("resetToken"),
  mode = resetToken ? "reset" : "login",
  busy = false;
if (resetToken) {
  params.delete("resetToken");
  history.replaceState(
    null,
    "",
    location.pathname + (params.size ? "?" + params : ""),
  );
}
const cooldowns = new Map();
const routeForMode = () =>
  ({
    login: "login",
    register: "register",
    forgot: "forgot-password",
    reset: "reset-password",
  })[mode];
const submitLabels = {
  login: "Entrar",
  register: "Criar conta",
  forgot: "Enviar link de recuperação",
  reset: "Salvar nova senha",
};
function cooldownSeconds() {
  return Math.max(
    0,
    Math.ceil(((cooldowns.get(routeForMode()) ?? 0) - Date.now()) / 1000),
  );
}
function updateCooldown() {
  const button = root.querySelector(".auth-submit");
  if (!button) return;
  const seconds = cooldownSeconds();
  button.disabled = busy || seconds > 0;
  button.textContent = busy
    ? "Aguarde…"
    : seconds > 0
      ? `Tentar novamente em ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
      : submitLabels[mode];
}
setInterval(updateCooldown, 1000);
async function api(path, data) {
  let response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method: data ? "POST" : "GET",
      credentials: "include",
      headers: data
        ? {
            "Content-Type": "application/json",
            "X-Requested-With": "Logistica",
          }
        : {},
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch {
    throw new Error(
      "Não foi possível conectar. Confira se o servidor do projeto está em execução.",
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) {
      const header = Number(response.headers.get("Retry-After"));
      const seconds = Number.isFinite(header) && header > 0 ? header : 60;
      cooldowns.set(path, Date.now() + seconds * 1000);
    }
    throw new Error(
      body.error ?? "Não foi possível concluir. Tente novamente.",
    );
  }
  return body;
}
const eyeIcon = (visible) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${visible ? '<path d="m3 3 18 18"/>' : ""}</svg>`;
const titles = {
  login: "Entre no laboratório",
  register: "Crie sua conta",
  forgot: "Recupere seu acesso",
  reset: "Escolha uma nova senha",
};
const descriptions = {
  login: "Acesse sua bancada de produção e logística.",
  register: "Seu acesso ao simulador de processos industriais.",
  forgot: "Informe seu e-mail para receber o link de recuperação.",
  reset: "Use uma senha nova com pelo menos 8 caracteres.",
};
function screen(message = "") {
  root.innerHTML = `<main class="auth-screen"><section class="auth-intro"><img src="${import.meta.env.BASE_URL}senai-logo.png" alt="SENAI" width="166" height="72"><div><span class="auth-kicker">Laboratório de logística</span><h1>Da matéria-prima<br>à panela pronta.</h1><p>Explore os equipamentos, conduza cada operação e acompanhe a transformação do seu produto.</p><svg class="auth-pan" viewBox="0 0 380 200" fill="none" aria-hidden="true"><ellipse cx="165" cy="161" rx="133" ry="14" fill="#102c60" opacity=".32"/><path d="M67 68L78 143Q165 175 252 143L263 68" fill="#bacbdf" stroke="#eef3fa" stroke-width="3"/><ellipse cx="165" cy="68" rx="98" ry="23" fill="#dfe7f1" stroke="#fff" stroke-width="3"/><ellipse cx="165" cy="68" rx="83" ry="16" fill="#829ab8"/><path d="M262 84L348 52" stroke="#102b56" stroke-width="19" stroke-linecap="round"/><path d="M87 91L92 137" stroke="#fff" stroke-width="8" opacity=".7"/><path d="M62 182H267" stroke="#e7490f" stroke-width="4"/></svg></div><span class="auth-footnote">Simulador de Logística · Processos industriais</span></section><section class="auth-form-area"><form id="access-form" class="auth-form"><div class="auth-rule"></div><h2>${titles[mode]}</h2><p class="auth-description">${descriptions[mode]}</p>${mode === "register" ? '<div class="student-fields"><label>Nome<input name="name" autocomplete="name" maxlength="80" required></label><label>Matrícula do aluno<input name="enrollment" type="text" autocomplete="off" minlength="3" maxlength="30" pattern="([A-Za-z0-9]|-){3,30}" title="Use de 3 a 30 letras, números ou hífens." spellcheck="false" required></label></div>' : ""}${mode !== "reset" ? '<label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required></label>' : ""}${["login", "register", "reset"].includes(mode) ? `<label>Senha<div class="password-field"><input name="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" ${mode === "login" ? "" : 'minlength="8"'} maxlength="128" required><button type="button" id="show-password" aria-label="Mostrar senha" title="Mostrar senha">${eyeIcon(false)}</button></div></label>` : ""}${["register", "reset"].includes(mode) ? '<label>Confirmar senha<input name="confirmation" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><small class="password-hint">Use pelo menos 8 caracteres. Combine palavras e símbolos.</small>' : ""}<p id="access-message" role="status" aria-live="polite">${message}</p><button class="auth-submit" type="submit">${{ login: "Entrar", register: "Criar conta", forgot: "Enviar link de recuperação", reset: "Salvar nova senha" }[mode]}</button><div class="auth-links">${mode === "login" ? '<button type="button" data-auth-mode="forgot">Esqueci minha senha</button><span>Ainda não tem conta? <button type="button" data-auth-mode="register">Criar conta</button></span>' : '<button type="button" data-auth-mode="login">Voltar para entrar</button>'}</div></form></section></main>`;
  for (const button of root.querySelectorAll("[data-auth-mode]"))
    button.onclick = () => {
      if (busy) return;
      mode = button.dataset.authMode;
      screen();
    };
  const show = root.querySelector("#show-password");
  if (show)
    show.onclick = () => {
      const input = root.querySelector('[name="password"]');
      input.type = input.type === "password" ? "text" : "password";
      const visible = input.type === "text";
      show.innerHTML = eyeIcon(visible);
      const label = visible ? "Ocultar senha" : "Mostrar senha";
      show.setAttribute("aria-label", label);
      show.title = label;
    };
  root.querySelector("#access-form").onsubmit = async (event) => {
    event.preventDefault();
    if (busy || cooldownSeconds() > 0) return;
    const form = event.currentTarget,
      fields = new FormData(form),
      message = root.querySelector("#access-message");
    const password = fields.get("password");
    if (fields.has("confirmation") && password !== fields.get("confirmation")) {
      message.textContent = "As senhas precisam ser iguais.";
      return;
    }
    busy = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Aguarde…";
    message.textContent = "";
    try {
      const data = { email: fields.get("email")?.trim(), password };
      if (mode === "register") {
        data.name = fields.get("name").trim();
        data.enrollment = fields.get("enrollment").trim();
      }
      if (mode === "reset") data.token = resetToken;
      const result = await api(
        {
          login: "login",
          register: "register",
          forgot: "forgot-password",
          reset: "reset-password",
        }[mode],
        data,
      );
      if (mode === "forgot") {
        message.textContent =
          "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.";
      } else if (mode === "reset") {
        resetToken = null;
        mode = "login";
        screen("Senha atualizada. Entre com sua nova senha.");
      } else await launch(result.user);
    } catch (error) {
      message.textContent = error.message;
    } finally {
      busy = false;
      updateCooldown();
    }
  };
  updateCooldown();
}
let launched = false;
async function launch(user) {
  if (!user || launched) return;
  launched = true;
  await import("./simulator/app.js");
  if (user.enrollment) {
    const caption = root.querySelector(".brand>span");
    if (caption) {
      caption.textContent = `Matrícula ${user.enrollment}`;
      caption.title = `${user.name} · Matrícula ${user.enrollment}`;
    }
  }
  document.addEventListener("auth:logout", async () => {
    try {
      await api("logout", {});
      location.reload();
    } catch (error) {
      alert(error.message);
    }
  });
  const verify = async () => {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.status === 401) location.reload();
    } catch {}
  };
  setInterval(verify, 60000);
  window.addEventListener("focus", verify);
}
if (resetToken) screen();
else {
  root.innerHTML =
    '<main class="auth-loading" role="status">Abrindo o laboratório…</main>';
  try {
    const result = await api("me");
    await launch(result.user);
  } catch {
    screen();
  }
}

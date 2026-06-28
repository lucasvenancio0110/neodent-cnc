import "../core/config.js";

const token = localStorage.getItem("nc_token");
const user = JSON.parse(localStorage.getItem("nc_user") || "null");
const form = document.getElementById("usuarioForm");
const main = document.querySelector("main");

function message(text, type = "") {
  let box = document.getElementById("adminMessage");
  if (!box) {
    box = document.createElement("div");
    box.id = "adminMessage";
    box.className = "machine-detail";
    form.after(box);
  }
  box.textContent = text;
  box.style.color = type === "bad" ? "var(--bad)" : "var(--ok)";
}

function api(path, options = {}) {
  return fetch(`${window.NC_CONFIG.apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  }).then(async (res) => {
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Erro na API");
    return data;
  });
}

async function loadUsers() {
  const data = await api("/admin/usuarios");
  let list = document.getElementById("usuariosLista");
  if (!list) {
    list = document.createElement("section");
    list.id = "usuariosLista";
    list.className = "stack";
    main.appendChild(list);
  }

  list.innerHTML = `<div class="section-title"><strong>Usuarios cadastrados</strong><span>${data.usuarios.length}</span></div>`;

  data.usuarios.forEach((u) => {
    const card = document.createElement("article");
    card.className = "machine-card status-ok";
    card.innerHTML = `
      <div class="machine-head">
        <div class="machine-main">
          <div class="machine-token">${u.funcao?.slice(0, 2) || "US"}</div>
          <div class="machine-name">
            <strong>${u.nome}</strong>
            <div class="machine-mini"><span>@${u.login}</span><span>${u.funcao}</span><span>${u.ativo ? "Ativo" : "Inativo"}</span></div>
          </div>
        </div>
        <span class="badge ${u.ativo ? "ok" : "bad"}">${u.nivel_acesso}</span>
      </div>
    `;
    list.appendChild(card);
  });
}

if (!token || !user) {
  window.location.href = "login.html";
} else if (user.funcao !== "ADMIN") {
  main.innerHTML = `<section class="page-hero"><div class="eyebrow">Acesso negado</div><h1>Somente ADMIN</h1><p>Entre com um usuario administrador.</p></section>`;
} else {
  loadUsers().catch((err) => message(err.message, "bad"));
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Criando...";

  const data = Object.fromEntries(new FormData(form).entries());
  const body = {
    nome: data.nome,
    login: data.login,
    senha: data.senha,
    funcao: data.nivel_acesso,
    linha_padrao: data.linha_padrao,
    celula_padrao: data.celula_padrao,
  };

  try {
    await api("/admin/usuarios", { method: "POST", body: JSON.stringify(body) });
    form.reset();
    message("Usuario criado com sucesso.");
    await loadUsers();
  } catch (err) {
    message(err.message, "bad");
  } finally {
    button.disabled = false;
    button.textContent = "Criar usuário";
  }
});

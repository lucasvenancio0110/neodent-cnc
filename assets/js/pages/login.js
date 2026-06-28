import "../core/config.js";

const form = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");

function setError(msg) {
  errorBox.textContent = msg || "";
  errorBox.style.display = msg ? "block" : "none";
}

setError("");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");

  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Entrando...";

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch(`${window.NC_CONFIG.apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: data.login, senha: data.senha }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || "Falha no login");

    localStorage.setItem("nc_token", json.token);
    localStorage.setItem("nc_user", JSON.stringify(json.usuario));

    window.location.href = "index.html";
  } catch (err) {
    setError(err.message || "Nao foi possivel entrar");
  } finally {
    button.disabled = false;
    button.textContent = "Entrar";
  }
});

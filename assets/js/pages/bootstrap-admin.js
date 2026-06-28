import "../core/config.js";

const form = document.getElementById("bootstrapForm");
const msg = document.getElementById("bootstrapMsg");

function show(text, bad = false) {
  msg.textContent = text;
  msg.style.color = bad ? "var(--bad)" : "var(--ok)";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  show("");

  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Criando...";

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch(`${window.NC_CONFIG.apiBase}/auth/bootstrap-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || "Erro ao criar admin");
    show("ADMIN criado. Agora va para login.html e entre com esse usuario.");
  } catch (err) {
    show(err.message || "Erro ao criar admin", true);
  } finally {
    button.disabled = false;
    button.textContent = "Criar primeiro ADMIN";
  }
});

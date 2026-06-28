const API_BASE = "https://neodent-cnc-api.lucassantanals0110.workers.dev";

const form = document.getElementById("bootstrapForm");
const msg = document.getElementById("bootstrapMsg");

function show(text, bad = false) {
  msg.textContent = text;
  msg.style.color = bad ? "var(--bad)" : "var(--ok)";
}

show("API: " + API_BASE);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  show("Criando ADMIN...");

  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Criando...";

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch(API_BASE + "/auth/bootstrap-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    if (!res.ok) {
      throw new Error((json && json.error) || text || "Erro ao criar admin");
    }

    show("ADMIN criado. Agora va para login.html e entre com esse usuario.");
  } catch (err) {
    show("Falha ao chamar a API. Confira se o SQL foi executado no D1 e se o Worker esta publicado. Detalhe: " + (err.message || err), true);
  } finally {
    button.disabled = false;
    button.textContent = "Criar primeiro ADMIN";
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav-principal");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("abierto");
      const expandido = nav.classList.contains("abierto");
      toggle.setAttribute("aria-expanded", String(expandido));
    });
    nav.querySelectorAll("a").forEach((enlace) => {
      enlace.addEventListener("click", () => nav.classList.remove("abierto"));
    });
  }

  const formulario = document.querySelector("#form-participa");
  if (formulario) {
    formulario.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const mensaje = document.querySelector("#mensaje-envio");
      formulario.reset();
      if (mensaje) {
        mensaje.classList.add("visible");
        mensaje.setAttribute("tabindex", "-1");
        mensaje.focus();
      }
    });
  }
});

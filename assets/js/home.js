document.addEventListener("DOMContentLoaded", () => {
  if (typeof MNA === "undefined") return;

  let archivoPostPendiente = null;
  let archivoNovedadImagen = null;
  let archivoNovedadPdf = null;
  let archivoDocumento = null;
  let hiloActivoId = null;

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function escaparHtml(texto) {
    const div = document.createElement("div");
    div.textContent = texto == null ? "" : texto;
    return div.innerHTML;
  }

  function idVideoEmbebible(url) {
    if (!url) return null;
    const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    return null;
  }

  // ==================== Menú móvil ====================
  const toggle = $(".menu-toggle");
  const nav = $(".nav-principal");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("abierto");
      toggle.setAttribute("aria-expanded", String(nav.classList.contains("abierto")));
    });
  }

  // ==================== Sesión / header ====================
  function iniciales(nombre) {
    return (nombre || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }

  function pintarUsuarioWidget() {
    const usuario = MNA.obtenerSesion();
    const widget = $("#usuario-widget");
    if (!usuario) {
      widget.innerHTML = `<button type="button" class="boton boton-secundario boton-chico" id="usuario-boton-invitado">Usuario</button>`;
      $("#usuario-boton-invitado").addEventListener("click", () => {
        $(".panel-comunidad").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    widget.innerHTML = `
      <button type="button" class="usuario-chip" id="usuario-chip">
        <span class="usuario-chip__avatar">${escaparHtml(iniciales(usuario.nombre))}</span>
        <span class="usuario-chip__nombre">${escaparHtml(usuario.nombre)}</span>
      </button>
    `;
    $("#usuario-chip").addEventListener("click", () => {
      $(".panel-comunidad").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function pintarSesion() {
    const usuario = MNA.obtenerSesion();
    const vistaInvitado = $("#vista-invitado");
    const vistaSesion = $("#vista-sesion");
    pintarUsuarioWidget();
    pintarPanelesAdminVisibles(usuario);
    if (!usuario) {
      vistaInvitado.style.display = "";
      vistaSesion.style.display = "none";
      return;
    }
    vistaInvitado.style.display = "none";
    vistaSesion.style.display = "";
    $("#saludo-nombre").textContent = usuario.nombre;
    const esAdmin = usuario.rol === "admin";
    $("#insignia-rol").style.display = esAdmin ? "" : "none";
    $("#pestana-admin").style.display = esAdmin ? "" : "none";
    const pestanaMensajes = $('.panel-comunidad .pestana[data-panel="mensajes"]');
    pestanaMensajes.style.display = esAdmin ? "none" : "";

    cambiarPanelPrincipal(esAdmin ? "admin" : "muro");
    renderMuro();
    if (!esAdmin) renderHiloUsuario();
    if (esAdmin) {
      cambiarAdminPanel("pendientes");
      renderPendientes();
      renderUsuarios();
      renderHilosAdmin();
      cargarFormColaborar();
    }
  }

  // Los formularios de "publicar" en Documentos y Novedades solo se muestran
  // en esos paneles cuando hay una sesión de administrador activa.
  function pintarPanelesAdminVisibles(usuario) {
    const esAdmin = !!usuario && usuario.rol === "admin";
    $("#admin-documentos-panel").hidden = !esAdmin;
    $("#admin-novedad-panel").hidden = !esAdmin;
  }

  // ==================== Auth: tabs login/registro ====================
  $$(".pestana[data-auth]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".pestana[data-auth]").forEach((b) => b.classList.remove("activa"));
      btn.classList.add("activa");
      const esLogin = btn.dataset.auth === "login";
      $("#form-login").style.display = esLogin ? "" : "none";
      $("#form-registro").style.display = esLogin ? "none" : "";
      $("#form-recuperar").style.display = "none";
    });
  });

  $("#form-login").addEventListener("submit", (e) => {
    e.preventDefault();
    const error = $("#error-login");
    error.classList.remove("visible");
    try {
      MNA.iniciarSesion({ email: $("#login-email").value.trim(), clave: $("#login-clave").value });
      pintarSesion();
      e.target.reset();
    } catch (err) {
      error.textContent = err.message;
      error.classList.add("visible");
    }
  });

  $("#form-registro").addEventListener("submit", (e) => {
    e.preventDefault();
    const error = $("#error-registro");
    error.classList.remove("visible");
    try {
      MNA.registrar({
        nombre: $("#registro-nombre").value.trim(),
        email: $("#registro-email").value.trim(),
        clave: $("#registro-clave").value,
      });
      pintarSesion();
      e.target.reset();
    } catch (err) {
      error.textContent = err.message;
      error.classList.add("visible");
    }
  });

  $("#boton-google").addEventListener("click", () => {
    const email = prompt("Ingresá tu correo de Gmail para continuar:");
    if (!email) return;
    const nombre = prompt("Nombre y apellido (solo la primera vez):", "") || "";
    try {
      MNA.continuarConGoogle({ nombre, email: email.trim() });
      pintarSesion();
    } catch (err) {
      alert(err.message);
    }
  });

  $("#abrir-recuperar").addEventListener("click", () => {
    $("#form-login").style.display = "none";
    $("#form-registro").style.display = "none";
    $("#form-recuperar").style.display = "";
    $("#mensaje-recuperar").classList.remove("visible");
  });
  $("#volver-login").addEventListener("click", () => {
    $("#form-recuperar").style.display = "none";
    $("#form-login").style.display = "";
    $$(".pestana[data-auth]").forEach((b) => b.classList.toggle("activa", b.dataset.auth === "login"));
  });
  $("#form-recuperar").addEventListener("submit", (e) => {
    e.preventDefault();
    MNA.recuperarClave($("#recuperar-email").value.trim());
    $("#mensaje-recuperar").classList.add("visible");
    e.target.reset();
  });

  $("#boton-salir").addEventListener("click", () => {
    MNA.cerrarSesion();
    pintarSesion();
  });

  // ==================== Navegación por pestañas (comunidad) ====================
  function cambiarPanelPrincipal(id) {
    $$('.panel-comunidad .pestana[data-panel]').forEach((b) => b.classList.toggle("activa", b.dataset.panel === id));
    $$(".panel-comunidad .panel-pestana").forEach((p) => p.classList.toggle("activo", p.id === `panel-${id}`));
  }
  $$('.panel-comunidad .pestana[data-panel]').forEach((btn) => {
    btn.addEventListener("click", () => cambiarPanelPrincipal(btn.dataset.panel));
  });

  function cambiarAdminPanel(id) {
    $$(".admin-subnav button").forEach((b) => b.classList.toggle("activa", b.dataset.admin === id));
    $$(".admin-panel").forEach((p) => p.classList.toggle("activo", p.id === `admin-${id}`));
  }
  $$(".admin-subnav button").forEach((btn) => {
    btn.addEventListener("click", () => cambiarAdminPanel(btn.dataset.admin));
  });

  // ==================== Muro ====================
  const inputPostImagen = $("#post-imagen");
  inputPostImagen.addEventListener("change", async () => {
    const archivo = inputPostImagen.files[0];
    try {
      archivoPostPendiente = await MNA.archivoADataUrl(archivo);
      const prev = $("#post-preview");
      if (archivoPostPendiente) {
        $("img", prev).src = archivoPostPendiente.datos;
        prev.classList.add("visible");
      }
    } catch (err) {
      alert(err.message);
      inputPostImagen.value = "";
    }
  });
  $("#post-preview-quitar").addEventListener("click", () => {
    archivoPostPendiente = null;
    inputPostImagen.value = "";
    $("#post-preview").classList.remove("visible");
  });

  $("#form-post").addEventListener("submit", (e) => {
    e.preventDefault();
    const usuario = MNA.obtenerSesion();
    const texto = $("#post-texto").value.trim();
    if (!texto) return;
    MNA.crearPost({ autor: usuario, texto, imagen: archivoPostPendiente });
    e.target.reset();
    archivoPostPendiente = null;
    $("#post-preview").classList.remove("visible");
    renderMuro();
  });

  function renderMuro() {
    const contenedor = $("#lista-muro");
    const posts = MNA.listarPosts({ soloAprobados: true });
    if (!posts.length) {
      contenedor.innerHTML = '<p class="vacio">Todavía no hay publicaciones aprobadas.</p>';
      return;
    }
    contenedor.innerHTML = posts.map((post) => {
      const comentarios = MNA.listarComentarios(post.id, { soloAprobados: true });
      return `
        <article class="publicacion" data-post="${post.id}">
          <div class="publicacion__cabecera">
            <span class="publicacion__autor">${escaparHtml(post.autorNombre)}</span>
            <span class="publicacion__fecha">${MNA.fechaLegible(post.fecha)}</span>
          </div>
          <p class="publicacion__texto">${escaparHtml(post.texto)}</p>
          ${post.imagen ? `<img class="publicacion__imagen" src="${post.imagen.datos}" alt="Imagen publicada por ${escaparHtml(post.autorNombre)}">` : ""}
          <div class="lista-comentarios">
            ${comentarios.map((c) => `
              <div class="comentario">
                <div class="comentario__cabecera">
                  <span class="comentario__autor">${escaparHtml(c.autorNombre)}</span>
                  <span class="comentario__fecha">${MNA.fechaLegible(c.fecha)}</span>
                </div>
                <div>${escaparHtml(c.texto)}</div>
              </div>
            `).join("") || '<p style="font-size:.82rem;color:#8b93a7;margin:0;">Todavía no hay comentarios.</p>'}
          </div>
          <form class="form-comentario" data-post-comentario="${post.id}">
            <input type="text" placeholder="Comentar..." required>
            <button type="submit" class="boton boton-secundario boton-chico">Enviar</button>
          </form>
        </article>
      `;
    }).join("");

    $$(".form-comentario", contenedor).forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const usuario = MNA.obtenerSesion();
        const input = $("input", form);
        const texto = input.value.trim();
        if (!texto) return;
        MNA.crearComentario({ postId: form.dataset.postComentario, autor: usuario, texto });
        input.value = "";
        input.placeholder = "Enviado, pendiente de aprobación ✓";
      });
    });
  }

  // ==================== Mensajes (usuario) ====================
  function renderBurbujas(contenedorId, mensajes, vistaAdmin, nombreOtraParte) {
    const contenedor = $(`#${contenedorId}`);
    if (!mensajes.length) {
      contenedor.innerHTML = '<p class="vacio">Todavía no hay mensajes.</p>';
      return;
    }
    contenedor.innerHTML = mensajes.map((m) => {
      const esMio = vistaAdmin ? m.de === "admin" : m.de === "usuario";
      const etiqueta = esMio ? "Vos" : (vistaAdmin ? nombreOtraParte : "Administración");
      return `
        <div class="mensaje-burbuja ${esMio ? "mensaje-usuario" : "mensaje-admin"}">
          ${escaparHtml(m.texto)}
          <span class="mensaje-burbuja__fecha">${escaparHtml(etiqueta)} · ${MNA.fechaLegible(m.fecha)}</span>
        </div>
      `;
    }).join("");
    contenedor.scrollTop = contenedor.scrollHeight;
  }

  function renderHiloUsuario() {
    const usuario = MNA.obtenerSesion();
    renderBurbujas("hilo-mensajes", MNA.listarMensajes(usuario.id), false, "Administración");
  }

  $("#form-mensaje").addEventListener("submit", (e) => {
    e.preventDefault();
    const usuario = MNA.obtenerSesion();
    const input = $("#mensaje-texto");
    const texto = input.value.trim();
    if (!texto) return;
    MNA.enviarMensaje({ usuarioId: usuario.id, de: "usuario", texto });
    input.value = "";
    renderHiloUsuario();
  });

  // ==================== Admin: moderación ====================
  function renderPendientes() {
    const contenedor = $("#lista-pendientes");
    const posts = MNA.listarPosts({ soloAprobados: false }).filter((p) => p.estado === "pendiente");
    const comentarios = MNA.listarTodosComentarios({ soloAprobados: false }).filter((c) => c.estado === "pendiente");

    if (!posts.length && !comentarios.length) {
      contenedor.innerHTML = '<p class="vacio">No hay nada pendiente. ✓</p>';
      return;
    }

    const bloquesPosts = posts.map((post) => `
      <div class="item-moderacion" data-post-mod="${post.id}">
        <span class="estado-pill estado-pendiente">Publicación</span>
        <p class="publicacion__cabecera" style="margin-top:8px;"><strong>${escaparHtml(post.autorNombre)}</strong> · ${MNA.fechaLegible(post.fecha)}</p>
        <p>${escaparHtml(post.texto)}</p>
        ${post.imagen ? `<img class="publicacion__imagen" style="max-width:220px;" src="${post.imagen.datos}" alt="">` : ""}
        <div class="item-moderacion__acciones">
          <button class="boton boton-chico boton-aprobar" data-aprobar-post="${post.id}">Aprobar</button>
          <button class="boton boton-chico boton-rechazar" data-rechazar-post="${post.id}">Rechazar</button>
        </div>
      </div>
    `);

    const bloquesComentarios = comentarios.map((c) => {
      const post = MNA.obtenerPost(c.postId);
      return `
        <div class="item-moderacion" data-comentario-mod="${c.id}">
          <span class="estado-pill estado-pendiente">Comentario</span>
          <p class="publicacion__cabecera" style="margin-top:8px;"><strong>${escaparHtml(c.autorNombre)}</strong> · ${MNA.fechaLegible(c.fecha)}</p>
          <p>${escaparHtml(c.texto)}</p>
          <p style="font-size:.78rem;color:#8b93a7;">Sobre: "${escaparHtml(post ? post.texto.slice(0, 60) : "publicación eliminada")}"</p>
          <div class="item-moderacion__acciones">
            <button class="boton boton-chico boton-aprobar" data-aprobar-comentario="${c.id}">Aprobar</button>
            <button class="boton boton-chico boton-rechazar" data-rechazar-comentario="${c.id}">Rechazar</button>
          </div>
        </div>
      `;
    });

    contenedor.innerHTML = bloquesPosts.join("") + bloquesComentarios.join("");

    $$("[data-aprobar-post]", contenedor).forEach((b) => b.addEventListener("click", () => { MNA.cambiarEstadoPost(b.dataset.aprobarPost, "aprobado"); renderPendientes(); renderMuro(); }));
    $$("[data-rechazar-post]", contenedor).forEach((b) => b.addEventListener("click", () => { MNA.cambiarEstadoPost(b.dataset.rechazarPost, "rechazado"); renderPendientes(); renderMuro(); }));
    $$("[data-aprobar-comentario]", contenedor).forEach((b) => b.addEventListener("click", () => { MNA.cambiarEstadoComentario(b.dataset.aprobarComentario, "aprobado"); renderPendientes(); renderMuro(); }));
    $$("[data-rechazar-comentario]", contenedor).forEach((b) => b.addEventListener("click", () => { MNA.cambiarEstadoComentario(b.dataset.rechazarComentario, "rechazado"); renderPendientes(); renderMuro(); }));
  }

  // ==================== Admin: usuarios ====================
  function renderUsuarios() {
    const contenedor = $("#lista-usuarios");
    const usuarios = MNA.listarUsuarios();
    if (!usuarios.length) {
      contenedor.innerHTML = '<p class="vacio">Todavía no se registró ningún usuario.</p>';
      return;
    }
    contenedor.innerHTML = usuarios.map((u) => `
      <div class="usuario-fila" data-usuario="${u.id}">
        <div class="usuario-fila__info">
          <strong>${escaparHtml(u.nombre)}</strong>
          <span>${escaparHtml(u.email)}${u.suspendido ? ` · <span class="estado-suspendido">Suspendido</span>` : ""}</span>
        </div>
        <div class="usuario-fila__acciones">
          ${u.suspendido
            ? `<button class="boton boton-chico boton-aprobar" data-levantar="${u.id}">Levantar suspensión</button>`
            : `<button class="boton boton-chico" data-suspender="${u.id}">Suspender 7 días</button>`}
          <button class="boton boton-chico boton-eliminar" data-eliminar-usuario="${u.id}">Eliminar</button>
        </div>
      </div>
    `).join("");

    $$("[data-suspender]", contenedor).forEach((b) => b.addEventListener("click", () => { MNA.suspenderUsuario(b.dataset.suspender, 7); renderUsuarios(); }));
    $$("[data-levantar]", contenedor).forEach((b) => b.addEventListener("click", () => { MNA.levantarSuspension(b.dataset.levantar); renderUsuarios(); }));
    $$("[data-eliminar-usuario]", contenedor).forEach((b) => b.addEventListener("click", () => {
      if (confirm("¿Eliminar esta cuenta de forma permanente?")) {
        MNA.eliminarUsuario(b.dataset.eliminarUsuario);
        renderUsuarios();
        renderHilosAdmin();
      }
    }));
  }

  // ==================== Admin: mensajes de usuarios ====================
  function renderHilosAdmin() {
    const contenedor = $("#lista-hilos");
    const hilos = MNA.listarHilos();
    if (!hilos.length) {
      contenedor.innerHTML = '<p class="vacio">Todavía nadie escribió a la administración.</p>';
      $("#hilo-admin-mensajes").innerHTML = "";
      $("#form-admin-mensaje").style.display = "none";
      return;
    }
    contenedor.innerHTML = hilos.map((h) => `
      <button class="hilo-item ${h.usuarioId === hiloActivoId ? "activo" : ""}" data-hilo="${h.usuarioId}">
        <span>
          <span class="hilo-item__nombre">${escaparHtml(h.nombre)}</span><br>
          <span class="hilo-item__preview">${escaparHtml(h.ultimoTexto)}</span>
        </span>
        ${h.sinLeer ? `<span class="contador-sin-leer">${h.sinLeer}</span>` : ""}
      </button>
    `).join("");

    $$("[data-hilo]", contenedor).forEach((btn) => {
      btn.addEventListener("click", () => {
        hiloActivoId = btn.dataset.hilo;
        MNA.marcarHiloLeido(hiloActivoId);
        renderHilosAdmin();
        abrirHiloAdmin();
      });
    });

    if (hiloActivoId && hilos.some((h) => h.usuarioId === hiloActivoId)) {
      abrirHiloAdmin();
    }
  }

  function abrirHiloAdmin() {
    $("#form-admin-mensaje").style.display = "flex";
    const hilo = MNA.listarHilos().find((h) => h.usuarioId === hiloActivoId);
    renderBurbujas("hilo-admin-mensajes", MNA.listarMensajes(hiloActivoId), true, hilo ? hilo.nombre : "Usuario");
  }

  $("#form-admin-mensaje").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!hiloActivoId) return;
    const input = $("#admin-mensaje-texto");
    const texto = input.value.trim();
    if (!texto) return;
    MNA.enviarMensaje({ usuarioId: hiloActivoId, de: "admin", texto });
    input.value = "";
    abrirHiloAdmin();
    renderHilosAdmin();
  });

  // ==================== Admin: colaboración económica ====================
  function cargarFormColaborar() {
    const datos = MNA.obtenerColaborar();
    $("#colaborar-activo").checked = !!datos.activo;
    $("#colaborar-texto").value = datos.texto || "";
    $("#colaborar-datos").value = datos.datos || "";
  }
  $("#form-colaborar").addEventListener("submit", (e) => {
    e.preventDefault();
    MNA.actualizarColaborar({
      activo: $("#colaborar-activo").checked,
      texto: $("#colaborar-texto").value.trim(),
      datos: $("#colaborar-datos").value.trim(),
    });
    renderColaborarPublico();
    alert("Guardado.");
  });

  function renderColaborarPublico() {
    const datos = MNA.obtenerColaborar();
    const bloque = $("#colaborar-bloque");
    bloque.hidden = !datos.activo;
    if (datos.activo) {
      $("#colaborar-texto-publico").textContent = datos.texto;
      $("#colaborar-datos-publico").textContent = datos.datos;
    }
  }

  // ==================== Documentos ====================
  $("#doc-archivo").addEventListener("change", async (e) => {
    try {
      archivoDocumento = await MNA.archivoADataUrl(e.target.files[0]);
    } catch (err) {
      alert(err.message);
      e.target.value = "";
    }
  });

  $("#form-documento-hub").addEventListener("submit", (e) => {
    e.preventDefault();
    const error = $("#error-documento");
    error.classList.remove("visible");
    if (!archivoDocumento) {
      error.textContent = "Elegí un archivo PDF para subir.";
      error.classList.add("visible");
      return;
    }
    MNA.crearDocumento({
      titulo: $("#doc-titulo").value.trim(),
      descripcion: $("#doc-descripcion").value.trim(),
      archivo: archivoDocumento,
    });
    e.target.reset();
    archivoDocumento = null;
    renderDocumentos();
  });

  function renderDocumentos() {
    const contenedor = $("#lista-documentos");
    const documentos = MNA.listarDocumentos();
    const usuario = MNA.obtenerSesion();
    const esAdmin = !!usuario && usuario.rol === "admin";
    if (!documentos.length) {
      contenedor.innerHTML = '<p class="vacio">Todavía no hay documentos publicados.</p>';
      return;
    }
    contenedor.innerHTML = documentos.map((d) => `
      <div class="documento-item" data-documento="${d.id}">
        <div class="documento-item__icono">📄</div>
        <div class="documento-item__cuerpo">
          <h4>${escaparHtml(d.titulo)}</h4>
          ${d.descripcion ? `<p>${escaparHtml(d.descripcion)}</p>` : ""}
          <a href="${d.archivo.datos}" download="${escaparHtml(d.archivo.nombre)}">Descargar PDF</a>
        </div>
        ${esAdmin ? `<button class="documento-item__quitar" data-eliminar-documento="${d.id}">Eliminar</button>` : ""}
      </div>
    `).join("");

    $$("[data-eliminar-documento]", contenedor).forEach((b) => {
      b.addEventListener("click", () => {
        if (confirm("¿Eliminar este documento?")) {
          MNA.eliminarDocumento(b.dataset.eliminarDocumento);
          renderDocumentos();
        }
      });
    });
  }

  // ==================== Novedades ====================
  $("#novedad-imagen").addEventListener("change", async (e) => {
    try {
      archivoNovedadImagen = await MNA.archivoADataUrl(e.target.files[0]);
    } catch (err) {
      alert(err.message);
      e.target.value = "";
    }
  });
  $("#novedad-pdf").addEventListener("change", async (e) => {
    try {
      archivoNovedadPdf = await MNA.archivoADataUrl(e.target.files[0]);
    } catch (err) {
      alert(err.message);
      e.target.value = "";
    }
  });

  $("#form-novedad-hub").addEventListener("submit", (e) => {
    e.preventDefault();
    MNA.crearNovedad({
      titulo: $("#novedad-titulo").value.trim(),
      texto: $("#novedad-texto").value.trim(),
      video: $("#novedad-video").value.trim() || null,
      imagen: archivoNovedadImagen,
      pdf: archivoNovedadPdf,
    });
    e.target.reset();
    archivoNovedadImagen = null;
    archivoNovedadPdf = null;
    renderNovedades();
  });

  function renderNovedades() {
    const contenedor = $("#lista-novedades");
    const novedades = MNA.listarNovedades();
    const usuario = MNA.obtenerSesion();
    const esAdmin = !!usuario && usuario.rol === "admin";
    if (!novedades.length) {
      contenedor.innerHTML = '<p class="vacio">Todavía no hay novedades publicadas.</p>';
      return;
    }
    contenedor.innerHTML = novedades.map((n) => {
      const video = idVideoEmbebible(n.video);
      return `
        <article class="tarjeta tarjeta--noticia" data-novedad="${n.id}">
          <span class="fecha">${escaparHtml(n.fecha)}</span>
          <h3>${escaparHtml(n.titulo)}</h3>
          ${video ? `<div class="video-incrustado"><iframe src="${video}" title="${escaparHtml(n.titulo)}" allowfullscreen></iframe></div>` : ""}
          ${!video && n.imagen ? `<img class="publicacion__imagen" src="${n.imagen.datos}" alt="${escaparHtml(n.titulo)}">` : ""}
          <p>${escaparHtml(n.texto)}</p>
          ${n.pdf ? `<a class="adjunto-tag" href="${n.pdf.datos}" download="${escaparHtml(n.pdf.nombre)}">📄 Descargar ${escaparHtml(n.pdf.nombre)}</a>` : ""}
          ${esAdmin ? `<button class="boton boton-chico boton-eliminar" style="margin-top:10px;" data-eliminar-novedad="${n.id}">Eliminar</button>` : ""}
        </article>
      `;
    }).join("");

    $$("[data-eliminar-novedad]", contenedor).forEach((b) => {
      b.addEventListener("click", () => {
        if (confirm("¿Eliminar esta novedad?")) {
          MNA.eliminarNovedad(b.dataset.eliminarNovedad);
          renderNovedades();
        }
      });
    });
  }

  // ==================== Buscador ====================
  const buscadorInput = $("#buscador-input");
  const buscadorResultados = $("#buscador-resultados");

  function cerrarBuscador() {
    buscadorResultados.hidden = true;
  }

  buscadorInput.addEventListener("input", () => {
    const q = buscadorInput.value.trim();
    if (!q) { cerrarBuscador(); return; }
    const { novedades, documentos } = MNA.buscar(q);
    if (!novedades.length && !documentos.length) {
      buscadorResultados.innerHTML = '<p class="buscador__vacio">Sin resultados para "' + escaparHtml(q) + '".</p>';
      buscadorResultados.hidden = false;
      return;
    }
    let html = "";
    if (novedades.length) {
      html += '<p class="buscador__grupo-titulo">Novedades</p>';
      html += novedades.map((n) => `
        <button type="button" class="buscador__item" data-ir-novedad="${n.id}">
          <strong>${escaparHtml(n.titulo)}</strong><span>${escaparHtml(n.texto.slice(0, 70))}…</span>
        </button>
      `).join("");
    }
    if (documentos.length) {
      html += '<p class="buscador__grupo-titulo">Documentos</p>';
      html += documentos.map((d) => `
        <button type="button" class="buscador__item" data-ir-documento="${d.id}">
          <strong>${escaparHtml(d.titulo)}</strong><span>${escaparHtml(d.descripcion || "Documento PDF")}</span>
        </button>
      `).join("");
    }
    buscadorResultados.innerHTML = html;
    buscadorResultados.hidden = false;

    $$("[data-ir-novedad]", buscadorResultados).forEach((b) => b.addEventListener("click", () => {
      cerrarBuscador();
      buscadorInput.value = "";
      $(`[data-novedad="${b.dataset.irNovedad}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
    $$("[data-ir-documento]", buscadorResultados).forEach((b) => b.addEventListener("click", () => {
      cerrarBuscador();
      buscadorInput.value = "";
      $(`[data-documento="${b.dataset.irDocumento}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".buscador")) cerrarBuscador();
  });

  // ==================== Inicio ====================
  renderDocumentos();
  renderNovedades();
  renderColaborarPublico();
  pintarSesion();
});

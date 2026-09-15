/* ==========================================================================
   Movimiento Nacional Artiguista — capa de datos (MODO DEMO)
   Simula un backend con localStorage: cuentas, muro, mensajes y novedades.
   Pensado para reemplazarse por Supabase sin tocar la interfaz: todas las
   pantallas hablan únicamente a través del objeto MNA de este archivo.
   ========================================================================== */

const MNA = (() => {
  const KEYS = {
    users: "mna_v1_users",
    session: "mna_v1_session",
    posts: "mna_v1_posts",
    comments: "mna_v1_comments",
    messages: "mna_v1_messages",
    novedades: "mna_v1_novedades",
    documentos: "mna_v1_documentos",
    colaborar: "mna_v1_colaborar",
  };

  const NOVEDADES_INICIALES = [
    {
      id: "seed-1",
      titulo: "El Movimiento presenta su nueva identidad visual",
      texto: "Renovamos el escudo y la imagen institucional del Movimiento Nacional Artiguista, manteniendo los símbolos que nos representan: la estrella, la unión y los colores patrios.",
      fecha: "Septiembre 2026",
      imagen: null,
      pdf: null,
      video: null,
    },
    {
      id: "seed-2",
      titulo: "Jornada de difusión del ideario artiguista",
      texto: "Militantes del movimiento realizaron actividades de difusión en distintos puntos del país, presentando la tercera posición y el legado de Artigas.",
      fecha: "Agosto 2026",
      imagen: null,
      pdf: null,
      video: null,
    },
    {
      id: "seed-3",
      titulo: "Comunicado: soberanía, libertad y justicia",
      texto: "El movimiento reafirma su compromiso con la soberanía nacional, la libertad de los pueblos y la justicia social como ejes irrenunciables.",
      fecha: "Agosto 2026",
      imagen: null,
      pdf: null,
      video: null,
    },
    {
      id: "seed-4",
      titulo: "Encuentro abierto de formación artiguista",
      texto: "Estamos organizando instancias de formación para quienes quieran conocer más sobre nuestro ideario y sumarse al movimiento.",
      fecha: "Próximamente",
      imagen: null,
      pdf: null,
      video: null,
    },
  ];

  function leer(key, porDefecto) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : porDefecto;
    } catch (e) {
      return porDefecto;
    }
  }

  function escribir(key, valor) {
    localStorage.setItem(key, JSON.stringify(valor));
  }

  function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function ahora() {
    return new Date().toISOString();
  }

  function fechaLegible(iso) {
    try {
      return new Date(iso).toLocaleString("es-UY", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch (e) {
      return iso;
    }
  }

  const DOCUMENTOS_INICIALES = [];

  function inicializar() {
    if (!localStorage.getItem(KEYS.users)) {
      escribir(KEYS.users, [
        { id: "admin-1", nombre: "Administración MNA", email: "admin@mna.uy", clave: "admin123", rol: "admin" },
      ]);
    }
    if (!localStorage.getItem(KEYS.novedades)) escribir(KEYS.novedades, NOVEDADES_INICIALES);
    if (!localStorage.getItem(KEYS.posts)) escribir(KEYS.posts, []);
    if (!localStorage.getItem(KEYS.comments)) escribir(KEYS.comments, []);
    if (!localStorage.getItem(KEYS.messages)) escribir(KEYS.messages, []);
    if (!localStorage.getItem(KEYS.documentos)) escribir(KEYS.documentos, DOCUMENTOS_INICIALES);
    if (!localStorage.getItem(KEYS.colaborar)) {
      escribir(KEYS.colaborar, {
        activo: true,
        texto: "Si querés colaborar económicamente con el movimiento, podés hacerlo mediante transferencia bancaria.",
        datos: "Banco República · Cuenta N.º 000-0000000-0 · A nombre de Movimiento Nacional Artiguista",
      });
    }
  }

  // ---------- Autenticación ----------
  function estaSuspendido(usuario) {
    return !!usuario.suspendidoHasta && new Date(usuario.suspendidoHasta) > new Date();
  }

  function registrar({ nombre, email, clave }) {
    const usuarios = leer(KEYS.users, []);
    if (usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("Ya existe una cuenta registrada con ese correo.");
    }
    const nuevo = { id: generarId(), nombre, email, clave, rol: "usuario", proveedor: "email" };
    usuarios.push(nuevo);
    escribir(KEYS.users, usuarios);
    localStorage.setItem(KEYS.session, nuevo.id);
    return nuevo;
  }

  function iniciarSesion({ email, clave }) {
    const usuarios = leer(KEYS.users, []);
    const usuario = usuarios.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.clave === clave
    );
    if (!usuario) throw new Error("Correo o contraseña incorrectos.");
    if (estaSuspendido(usuario)) {
      throw new Error(`Esta cuenta está suspendida hasta ${fechaLegible(usuario.suspendidoHasta)}.`);
    }
    localStorage.setItem(KEYS.session, usuario.id);
    return usuario;
  }

  // Alta / ingreso con Gmail. En este modo demo no hay OAuth real: se simula
  // la cuenta de Google a partir del correo que ingresa la persona, tal como
  // funcionaría "Continuar con Google" una vez conectado el backend definitivo.
  function continuarConGoogle({ nombre, email }) {
    const usuarios = leer(KEYS.users, []);
    let usuario = usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (usuario) {
      if (estaSuspendido(usuario)) {
        throw new Error(`Esta cuenta está suspendida hasta ${fechaLegible(usuario.suspendidoHasta)}.`);
      }
      localStorage.setItem(KEYS.session, usuario.id);
      return usuario;
    }
    usuario = { id: generarId(), nombre: nombre || email.split("@")[0], email, clave: null, rol: "usuario", proveedor: "google" };
    usuarios.push(usuario);
    escribir(KEYS.users, usuarios);
    localStorage.setItem(KEYS.session, usuario.id);
    return usuario;
  }

  // Recuperar contraseña: en producción esto dispara un correo real a la
  // casilla de Gmail de la cuenta. En modo demo solo confirmamos el envío.
  function recuperarClave(email) {
    const usuarios = leer(KEYS.users, []);
    const existe = usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase());
    return { enviado: true, existe };
  }

  function cerrarSesion() {
    localStorage.removeItem(KEYS.session);
  }

  function obtenerSesion() {
    const id = localStorage.getItem(KEYS.session);
    if (!id) return null;
    const usuarios = leer(KEYS.users, []);
    const usuario = usuarios.find((u) => u.id === id) || null;
    if (usuario && estaSuspendido(usuario)) {
      cerrarSesion();
      return null;
    }
    return usuario;
  }

  // ---------- Administración de usuarios ----------
  function listarUsuarios() {
    return leer(KEYS.users, [])
      .filter((u) => u.rol !== "admin")
      .map((u) => ({ ...u, suspendido: estaSuspendido(u) }));
  }

  function suspenderUsuario(id, dias) {
    const usuarios = leer(KEYS.users, []);
    const usuario = usuarios.find((u) => u.id === id);
    if (!usuario) return;
    const hasta = new Date();
    hasta.setDate(hasta.getDate() + Number(dias || 1));
    usuario.suspendidoHasta = hasta.toISOString();
    escribir(KEYS.users, usuarios);
  }

  function levantarSuspension(id) {
    const usuarios = leer(KEYS.users, []);
    const usuario = usuarios.find((u) => u.id === id);
    if (!usuario) return;
    delete usuario.suspendidoHasta;
    escribir(KEYS.users, usuarios);
  }

  function eliminarUsuario(id) {
    escribir(KEYS.users, leer(KEYS.users, []).filter((u) => u.id !== id));
    escribir(KEYS.posts, leer(KEYS.posts, []).filter((p) => p.autorId !== id));
    escribir(KEYS.comments, leer(KEYS.comments, []).filter((c) => c.autorId !== id));
    escribir(KEYS.messages, leer(KEYS.messages, []).filter((m) => m.usuarioId !== id));
  }

  // ---------- Muro (posts) ----------
  function crearPost({ autor, texto, imagen }) {
    const posts = leer(KEYS.posts, []);
    const post = {
      id: generarId(),
      autorId: autor.id,
      autorNombre: autor.nombre,
      texto,
      imagen: imagen || null,
      fecha: ahora(),
      estado: "pendiente",
    };
    posts.unshift(post);
    escribir(KEYS.posts, posts);
    return post;
  }

  function listarPosts({ soloAprobados = true } = {}) {
    const posts = leer(KEYS.posts, []);
    return soloAprobados ? posts.filter((p) => p.estado === "aprobado") : posts;
  }

  function cambiarEstadoPost(id, estado) {
    const posts = leer(KEYS.posts, []);
    const post = posts.find((p) => p.id === id);
    if (post) {
      post.estado = estado;
      escribir(KEYS.posts, posts);
    }
  }

  function eliminarPost(id) {
    escribir(KEYS.posts, leer(KEYS.posts, []).filter((p) => p.id !== id));
    escribir(KEYS.comments, leer(KEYS.comments, []).filter((c) => c.postId !== id));
  }

  // ---------- Comentarios ----------
  function crearComentario({ postId, autor, texto }) {
    const comentarios = leer(KEYS.comments, []);
    const comentario = {
      id: generarId(),
      postId,
      autorId: autor.id,
      autorNombre: autor.nombre,
      texto,
      fecha: ahora(),
      estado: "pendiente",
    };
    comentarios.push(comentario);
    escribir(KEYS.comments, comentarios);
    return comentario;
  }

  function listarComentarios(postId, { soloAprobados = true } = {}) {
    const comentarios = leer(KEYS.comments, []).filter((c) => c.postId === postId);
    return soloAprobados ? comentarios.filter((c) => c.estado === "aprobado") : comentarios;
  }

  function listarTodosComentarios({ soloAprobados = false } = {}) {
    const comentarios = leer(KEYS.comments, []);
    return soloAprobados ? comentarios.filter((c) => c.estado === "aprobado") : comentarios;
  }

  function obtenerPost(id) {
    return leer(KEYS.posts, []).find((p) => p.id === id) || null;
  }

  function cambiarEstadoComentario(id, estado) {
    const comentarios = leer(KEYS.comments, []);
    const comentario = comentarios.find((c) => c.id === id);
    if (comentario) {
      comentario.estado = estado;
      escribir(KEYS.comments, comentarios);
    }
  }

  function eliminarComentario(id) {
    escribir(KEYS.comments, leer(KEYS.comments, []).filter((c) => c.id !== id));
  }

  // ---------- Mensajes directos con la administración ----------
  function enviarMensaje({ usuarioId, de, texto }) {
    const mensajes = leer(KEYS.messages, []);
    const mensaje = { id: generarId(), usuarioId, de, texto, fecha: ahora() };
    mensajes.push(mensaje);
    escribir(KEYS.messages, mensajes);
    return mensaje;
  }

  function listarMensajes(usuarioId) {
    return leer(KEYS.messages, []).filter((m) => m.usuarioId === usuarioId);
  }

  function listarHilos() {
    const mensajes = leer(KEYS.messages, []);
    const usuarios = leer(KEYS.users, []);
    const idsUnicos = [...new Set(mensajes.map((m) => m.usuarioId))];
    return idsUnicos
      .map((id) => {
        const usuario = usuarios.find((u) => u.id === id);
        const propios = mensajes.filter((m) => m.usuarioId === id);
        const ultimo = propios[propios.length - 1];
        const sinLeer = propios.filter((m) => m.de === "usuario" && !m.leidoAdmin).length;
        return {
          usuarioId: id,
          nombre: usuario ? usuario.nombre : "Usuario eliminado",
          email: usuario ? usuario.email : "",
          ultimoTexto: ultimo.texto,
          ultimaFecha: ultimo.fecha,
          sinLeer,
        };
      })
      .sort((a, b) => new Date(b.ultimaFecha) - new Date(a.ultimaFecha));
  }

  function marcarHiloLeido(usuarioId) {
    const mensajes = leer(KEYS.messages, []);
    mensajes.forEach((m) => {
      if (m.usuarioId === usuarioId && m.de === "usuario") m.leidoAdmin = true;
    });
    escribir(KEYS.messages, mensajes);
  }

  // ---------- Novedades ----------
  function crearNovedad(datos) {
    const novedades = leer(KEYS.novedades, []);
    const novedad = {
      id: generarId(),
      fecha: new Date().toLocaleDateString("es-UY", { month: "long", year: "numeric" }),
      ...datos,
    };
    novedades.unshift(novedad);
    escribir(KEYS.novedades, novedades);
    return novedad;
  }

  function listarNovedades() {
    return leer(KEYS.novedades, []);
  }

  function eliminarNovedad(id) {
    escribir(KEYS.novedades, leer(KEYS.novedades, []).filter((n) => n.id !== id));
  }

  // ---------- Documentos (PDFs, informes) ----------
  function crearDocumento({ titulo, descripcion, archivo }) {
    const documentos = leer(KEYS.documentos, []);
    const documento = {
      id: generarId(),
      titulo,
      descripcion: descripcion || "",
      archivo,
      fecha: ahora(),
    };
    documentos.unshift(documento);
    escribir(KEYS.documentos, documentos);
    return documento;
  }

  function listarDocumentos() {
    return leer(KEYS.documentos, []);
  }

  function eliminarDocumento(id) {
    escribir(KEYS.documentos, leer(KEYS.documentos, []).filter((d) => d.id !== id));
  }

  // ---------- Colaboración económica ----------
  function obtenerColaborar() {
    return leer(KEYS.colaborar, { activo: false, texto: "", datos: "" });
  }

  function actualizarColaborar(datos) {
    escribir(KEYS.colaborar, datos);
    return datos;
  }

  // ---------- Búsqueda ----------
  function buscar(consulta) {
    const q = (consulta || "").trim().toLowerCase();
    if (!q) return { novedades: [], documentos: [] };
    const novedades = leer(KEYS.novedades, []).filter(
      (n) => n.titulo.toLowerCase().includes(q) || n.texto.toLowerCase().includes(q)
    );
    const documentos = leer(KEYS.documentos, []).filter(
      (d) => d.titulo.toLowerCase().includes(q) || (d.descripcion || "").toLowerCase().includes(q)
    );
    return { novedades, documentos };
  }

  // ---------- Archivos ----------
  const LIMITE_ARCHIVO_MB = 4;

  function archivoADataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (file.size > LIMITE_ARCHIVO_MB * 1024 * 1024) {
        reject(new Error(`En modo demo el archivo no puede superar ${LIMITE_ARCHIVO_MB} MB (se guarda en este navegador). Con Supabase conectado este límite desaparece.`));
        return;
      }
      const lector = new FileReader();
      lector.onload = () => resolve({ nombre: file.name, tipo: file.type, datos: lector.result });
      lector.onerror = reject;
      lector.readAsDataURL(file);
    });
  }

  inicializar();

  return {
    registrar,
    iniciarSesion,
    continuarConGoogle,
    recuperarClave,
    cerrarSesion,
    obtenerSesion,
    listarUsuarios,
    suspenderUsuario,
    levantarSuspension,
    eliminarUsuario,
    crearPost,
    listarPosts,
    cambiarEstadoPost,
    eliminarPost,
    crearComentario,
    listarComentarios,
    listarTodosComentarios,
    obtenerPost,
    cambiarEstadoComentario,
    eliminarComentario,
    enviarMensaje,
    listarMensajes,
    listarHilos,
    marcarHiloLeido,
    crearNovedad,
    listarNovedades,
    eliminarNovedad,
    crearDocumento,
    listarDocumentos,
    eliminarDocumento,
    obtenerColaborar,
    actualizarColaborar,
    buscar,
    archivoADataUrl,
    fechaLegible,
  };
})();

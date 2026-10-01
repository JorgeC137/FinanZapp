/* ============================================================
   FinanApp — Lógica de la aplicación
   Control de gastos mes a mes. El saldo inicial es opcional:
   puedes registrar solo gastos, y si quieres, un presupuesto
   mensual o tus ingresos para ver cuánto te queda.
   ============================================================ */

// -------------------- ESTADO GLOBAL --------------------
const CLAVE_MOVIMIENTOS = "finanapp_movimientos";   // misma clave de antes: no se pierden datos
const CLAVE_TEMA = "finanapp_tema";
const CLAVE_PRESUPUESTO = "finanapp_presupuesto";
const CLAVE_OCULTAR = "finanapp_ocultar_montos";

let movimientos = [];
let presupuestoMensual = 0;           // 0 = sin presupuesto
let ocultarMontos = false;            // botón del ojo
let seccionActual = "inicio";
let mesSeleccionado = obtenerFechaHoy().slice(0, 7);   // "AAAA-MM"
let accionConfirmar = null;

const CATEGORIAS = {
  gasto: {
    "Alimentación": "🍔",
    "Transporte": "🚌",
    "Vivienda": "🏠",
    "Servicios": "💡",
    "Educación": "🎓",
    "Tecnología": "💻",
    "Entretenimiento": "🎬",
    "Compras": "🛍️",
    "Salud": "💊",
    "Otros": "📦"
  },
  ingreso: {
    "Salario": "💼",
    "Trabajo extra": "🛵",
    "Ventas": "🏷️",
    "Regalo": "🎁",
    "Otros ingresos": "💰"
  }
};

// -------------------- INICIALIZACIÓN --------------------
document.addEventListener("DOMContentLoaded", function () {
  cargarTema();
  cargarDatos();
  refrescarTodo();
  mostrarSeccion("inicio");
});

function refrescarTodo() {
  actualizarBotonOjo();
  actualizarBarraMes();
  actualizarDashboard();
  mostrarMovimientos();
  mostrarEstadisticas();
}

// -------------------- PERSISTENCIA --------------------
function cargarDatos() {
  try {
    const datosGuardados = localStorage.getItem(CLAVE_MOVIMIENTOS);
    const parseado = datosGuardados ? JSON.parse(datosGuardados) : [];
    movimientos = Array.isArray(parseado) ? parseado.filter(esMovimientoValido) : [];
  } catch (error) {
    console.error("Error al leer los movimientos, se inicia una lista vacía:", error);
    movimientos = [];
  }

  try {
    const valor = parseFloat(localStorage.getItem(CLAVE_PRESUPUESTO));
    presupuestoMensual = isNaN(valor) || valor < 0 ? 0 : valor;
  } catch (error) {
    presupuestoMensual = 0;
  }

  try {
    ocultarMontos = localStorage.getItem(CLAVE_OCULTAR) === "1";
  } catch (error) {
    ocultarMontos = false;
  }

  const inputPresupuesto = document.getElementById("input-presupuesto");
  if (inputPresupuesto && presupuestoMensual > 0) {
    inputPresupuesto.value = presupuestoMensual;
  }
}

// Evita que un registro dañado rompa toda la app
function esMovimientoValido(m) {
  return m && (m.tipo === "ingreso" || m.tipo === "gasto") &&
    typeof m.monto === "number" && m.monto > 0 &&
    typeof m.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m.fecha);
}

function guardarDatos() {
  try {
    localStorage.setItem(CLAVE_MOVIMIENTOS, JSON.stringify(movimientos));
  } catch (error) {
    console.error("Error al guardar en localStorage:", error);
    mostrarToast("⚠️ No se pudo guardar la información");
  }
}

// -------------------- MES SELECCIONADO --------------------
function cambiarMes(delta) {
  const [anio, mes] = mesSeleccionado.split("-").map(Number);
  const fecha = new Date(anio, mes - 1 + delta, 1);
  const nuevoMes = fecha.getFullYear() + "-" + String(fecha.getMonth() + 1).padStart(2, "0");

  // No se navega a meses futuros
  if (nuevoMes > obtenerFechaHoy().slice(0, 7)) return;

  mesSeleccionado = nuevoMes;
  refrescarTodo();
}

function actualizarBarraMes() {
  document.getElementById("mes-actual-texto").textContent = nombreMes(mesSeleccionado, true);
  document.getElementById("btn-mes-siguiente").disabled = esMesActual();
}

function esMesActual() {
  return mesSeleccionado === obtenerFechaHoy().slice(0, 7);
}

function movimientosDelMes() {
  return movimientos.filter(function (m) {
    return m.fecha.slice(0, 7) === mesSeleccionado;
  });
}

// -------------------- NAVEGACIÓN --------------------
function mostrarSeccion(nombreSeccion) {
  document.querySelectorAll(".seccion").forEach(function (s) { s.classList.remove("activa"); });
  const seccionElegida = document.getElementById("seccion-" + nombreSeccion);
  if (seccionElegida) seccionElegida.classList.add("activa");

  document.querySelectorAll(".nav-item").forEach(function (i) { i.classList.remove("activo"); });
  const navElegido = document.getElementById("nav-" + nombreSeccion);
  if (navElegido) navElegido.classList.add("activo");

  // El selector de mes no aplica en Configuración
  document.getElementById("barra-mes").hidden = nombreSeccion === "configuracion";

  seccionActual = nombreSeccion;
  if (nombreSeccion === "estadisticas") mostrarEstadisticas();
  if (nombreSeccion === "movimientos") mostrarMovimientos();

  window.scrollTo(0, 0);
}

// -------------------- BOTÓN FLOTANTE --------------------
function toggleMenuFab() {
  document.getElementById("fab-menu").classList.toggle("abierto");
  document.getElementById("fab-overlay").classList.toggle("abierto");
}

// -------------------- FORMULARIO / MODAL --------------------
function poblarCategorias(tipo, seleccion) {
  const select = document.getElementById("input-categoria");
  select.innerHTML = '<option value="">Selecciona una categoría</option>';
  Object.keys(CATEGORIAS[tipo]).forEach(function (nombre) {
    const opcion = document.createElement("option");
    opcion.value = nombre;
    opcion.textContent = CATEGORIAS[tipo][nombre] + " " + nombre;
    select.appendChild(opcion);
  });
  select.value = seleccion || "";
}

function abrirFormulario(tipo) {
  limpiarFormulario();
  document.getElementById("input-tipo").value = tipo;
  document.getElementById("input-id").value = "";
  poblarCategorias(tipo);

  const esIngreso = tipo === "ingreso";
  document.getElementById("modal-titulo").textContent = esIngreso ? "Agregar ingreso" : "Agregar gasto";
  document.getElementById("modal-subtitulo").textContent = esIngreso
    ? "Opcional: sirve para ver tu balance del mes"
    : "¿En qué gastaste?";
  document.getElementById("btn-guardar-movimiento").textContent = esIngreso ? "Guardar ingreso" : "Guardar gasto";
  document.getElementById("btn-eliminar-movimiento").hidden = true;

  // Si estás viendo un mes anterior, la fecha sugerida queda dentro de ese mes
  document.getElementById("input-fecha").value = esMesActual() ? obtenerFechaHoy() : mesSeleccionado + "-01";

  document.getElementById("modal-formulario").classList.add("abierto");
  setTimeout(function () { document.getElementById("input-monto").focus(); }, 250);
}

function abrirEdicion(id) {
  const movimiento = movimientos.find(function (m) { return m.id === id; });
  if (!movimiento) return;

  limpiarFormulario();
  document.getElementById("input-tipo").value = movimiento.tipo;
  document.getElementById("input-id").value = movimiento.id;
  poblarCategorias(movimiento.tipo, movimiento.categoria);

  document.getElementById("input-monto").value = movimiento.monto;
  document.getElementById("input-descripcion").value = movimiento.descripcion || "";
  document.getElementById("input-fecha").value = movimiento.fecha;
  

  document.getElementById("modal-titulo").textContent = movimiento.tipo === "ingreso" ? "Editar ingreso" : "Editar gasto";
  document.getElementById("modal-subtitulo").textContent = "Corrige los datos o elimina el registro";
  document.getElementById("btn-guardar-movimiento").textContent = "Guardar cambios";
  document.getElementById("btn-eliminar-movimiento").hidden = false;

  document.getElementById("modal-formulario").classList.add("abierto");
}

function cerrarFormulario() {
  document.getElementById("modal-formulario").classList.remove("abierto");
  limpiarFormulario();
}

function limpiarFormulario() {
  document.getElementById("form-movimiento").reset();
  ["monto", "categoria", "fecha"].forEach(function (campo) {
    document.getElementById("error-" + campo).textContent = "";
  });
}

function guardarMovimiento(evento) {
  evento.preventDefault();

  const tipo = document.getElementById("input-tipo").value;
  const idEdicion = Number(document.getElementById("input-id").value) || null;
  const monto = parseFloat(document.getElementById("input-monto").value);
  const categoria = document.getElementById("input-categoria").value;
  const fecha = document.getElementById("input-fecha").value;
  // La descripción es opcional: si queda vacía se usa la categoría
  const descripcion = document.getElementById("input-descripcion").value.trim() || categoria;

  let esValido = true;
  ["monto", "categoria", "fecha"].forEach(function (campo) {
    document.getElementById("error-" + campo).textContent = "";
  });

  if (isNaN(monto) || monto <= 0) {
    document.getElementById("error-monto").textContent = "Escribe un monto mayor que 0";
    esValido = false;
  }
  if (!categoria) {
    document.getElementById("error-categoria").textContent = "Elige en qué fue";
    esValido = false;
  }
  if (!fecha) {
    document.getElementById("error-fecha").textContent = "Elige la fecha";
    esValido = false;
  } else if (fecha > obtenerFechaHoy()) {
    document.getElementById("error-fecha").textContent = "La fecha no puede ser futura";
    esValido = false;
  }
  if (!esValido) return;

    const datos = { tipo: tipo, monto: monto, descripcion: descripcion, categoria: categoria, fecha: fecha };

  if (idEdicion) {
    const indice = movimientos.findIndex(function (m) { return m.id === idEdicion; });
    if (indice !== -1) movimientos[indice] = Object.assign({ id: idEdicion }, datos);
  } else {
    movimientos.push(Object.assign({ id: Date.now() }, datos));
  }

  guardarDatos();
  mesSeleccionado = fecha.slice(0, 7);   // muestra el mes donde quedó el registro
  refrescarTodo();
  cerrarFormulario();

  if (idEdicion) {
    mostrarToast("✅ Cambios guardados");
  } else {
    mostrarToast(tipo === "ingreso" ? "✅ Ingreso guardado" : "✅ Gasto guardado");
  }
}

function pedirEliminarMovimiento() {
  const id = Number(document.getElementById("input-id").value);
  abrirConfirmacion(
    "¿Eliminar este registro?",
    "Se borra solo este movimiento. No se puede deshacer.",
    "Eliminar",
    function () {
      movimientos = movimientos.filter(function (m) { return m.id !== id; });
      guardarDatos();
      cerrarFormulario();
      refrescarTodo();
      mostrarToast("✅ Registro eliminado");
    }
  );
}

// -------------------- CÁLCULOS --------------------
function calcularTotales(lista) {
  let ingresos = 0;
  let gastos = 0;
  lista.forEach(function (m) {
    if (m.tipo === "ingreso") ingresos += m.monto;
    else gastos += m.monto;
  });
  return { ingresos: ingresos, gastos: gastos, balance: ingresos - gastos };
}

function diasTranscurridos() {
  if (esMesActual()) return new Date().getDate();
  const [anio, mes] = mesSeleccionado.split("-").map(Number);
  return new Date(anio, mes, 0).getDate();   // días del mes
}

function gastosPorCategoria(lista) {
  const porCategoria = {};
  lista.forEach(function (m) {
    if (m.tipo === "gasto") {
      const categoria = m.categoria || "Otros";
      porCategoria[categoria] = (porCategoria[categoria] || 0) + m.monto;
    }
  });
  return porCategoria;
}

// Fechas ISO (AAAA-MM-DD) se comparan como texto: evita el desfase de zona horaria de new Date("AAAA-MM-DD")
function ordenarRecientes(lista) {
  return [...lista].sort(function (a, b) {
    if (a.fecha === b.fecha) return b.id - a.id;
    return a.fecha < b.fecha ? 1 : -1;
  });
}

// -------------------- DASHBOARD (INICIO) --------------------
function actualizarDashboard() {
  const delMes = movimientosDelMes();
  const totales = calcularTotales(delMes);

  document.getElementById("etiqueta-gastado").textContent = "Gastado en " + nombreMes(mesSeleccionado, false);
  document.getElementById("total-gastado").textContent = formatearMoneda(totales.gastos);

  // Línea secundaria: presupuesto, balance o nada (todo es opcional)
  const linea = document.getElementById("linea-resumen");
  const barra = document.getElementById("barra-presupuesto");
  const relleno = document.getElementById("barra-presupuesto-relleno");

  if (presupuestoMensual > 0) {
    const restante = presupuestoMensual - totales.gastos;
    const porcentaje = Math.min(100, (totales.gastos / presupuestoMensual) * 100);
    barra.hidden = false;
    relleno.style.width = porcentaje + "%";
    barra.classList.toggle("excedido", restante < 0);
    linea.textContent = restante >= 0
      ? "Te quedan " + formatearMoneda(restante) + " de " + formatearMoneda(presupuestoMensual)
      : "Te pasaste " + formatearMoneda(-restante) + " del presupuesto";
  } else if (totales.ingresos > 0) {
    barra.hidden = true;
    linea.textContent = "Balance del mes: " + privado(formatearMoneda(totales.balance));
  } else {
    barra.hidden = true;
    linea.textContent = "Anota cada gasto el día que lo hagas";
  }
  // Tarjetas del día: gastos en rojo, ingresos en verde
  const promedioDiario = totales.gastos / diasTranscurridos();
  if (esMesActual()) {
    const hoy = calcularTotales(delMes.filter(function (m) { return m.fecha === obtenerFechaHoy(); }));
    ponerTexto("etiqueta-dia-gastos", "Gastado hoy");
    ponerTexto("valor-dia-gastos", conSigno(hoy.gastos, "-"));
    ponerTexto("subdato-dia-gastos", "Promedio diario: " + formatearMoneda(promedioDiario));
    ponerTexto("etiqueta-dia-ingresos", "Ingresos hoy");
    ponerTexto("valor-dia-ingresos", privado(conSigno(hoy.ingresos, "+")));
    ponerTexto("subdato-dia-ingresos", "Balance de hoy: " + privado(formatearMoneda(hoy.balance)));
  } else {
    // En meses anteriores no hay "hoy": se muestra el resumen del mes
    ponerTexto("etiqueta-dia-gastos", "Promedio diario");
    ponerTexto("valor-dia-gastos", conSigno(promedioDiario, "-"));
    ponerTexto("subdato-dia-gastos", "Día con más gasto: " + formatearMoneda(mayorGastoDiario(delMes)));
    ponerTexto("etiqueta-dia-ingresos", "Ingresos del mes");
    ponerTexto("valor-dia-ingresos", privado(conSigno(totales.ingresos, "+")));
    ponerTexto("subdato-dia-ingresos", "Balance del mes: " + privado(formatearMoneda(totales.balance)));
  }
    renderizarLista("lista-movimientos-recientes", ordenarRecientes(delMes).slice(0, 5), false);
}

// -------------------- MOVIMIENTOS --------------------
function mostrarMovimientos() {
  renderizarLista("lista-movimientos-todos", ordenarRecientes(movimientosDelMes()), true);
}

function renderizarLista(idContenedor, lista, agruparPorDia) {
  const contenedor = document.getElementById(idContenedor);
  if (!contenedor) return;
  contenedor.innerHTML = "";

  if (lista.length === 0) {
    contenedor.innerHTML =
      '<div class="estado-vacio">' +
      '<span class="estado-vacio-icono">📋</span>' +
      '<p class="estado-vacio-titulo">Sin movimientos en ' + escaparTexto(nombreMes(mesSeleccionado, false)) + '</p>' +
      '<p class="estado-vacio-subtitulo">Toca “Agregar gasto” para anotar el primero</p>' +
      "</div>";
    return;
  }

  let diaActual = null;
  lista.forEach(function (m) {
    if (agruparPorDia && m.fecha !== diaActual) {
      diaActual = m.fecha;
      const gastoDia = calcularTotales(lista.filter(function (x) { return x.fecha === diaActual; })).gastos;
      const encabezado = document.createElement("div");
      encabezado.className = "dia-encabezado";
      encabezado.innerHTML =
        "<span>" + escaparTexto(nombreDia(m.fecha)) + "</span>" +
        (gastoDia > 0 ? "<span>" + formatearMoneda(gastoDia) + "</span>" : "");
      contenedor.appendChild(encabezado);
    }
    contenedor.appendChild(crearItemMovimiento(m, agruparPorDia));
  });
}

function crearItemMovimiento(m, ocultarFecha) {
  const esIngreso = m.tipo === "ingreso";
  const icono = (CATEGORIAS[m.tipo] && CATEGORIAS[m.tipo][m.categoria]) || (esIngreso ? "💰" : "💸");
  // Si el detalle quedó vacío se guardó la categoría como descripción: no repetirla
    const detalle = m.descripcion === m.categoria ? [] : [m.categoria];
  if (!ocultarFecha) detalle.push(formatearFecha(m.fecha));

  const item = document.createElement("button");
  item.type = "button";
  item.className = "movimiento-item";
  item.setAttribute("aria-label", "Editar " + (m.descripcion || m.categoria));
  item.onclick = function () { abrirEdicion(m.id); };
  item.innerHTML =
    '<div class="movimiento-icono">' + icono + "</div>" +
    '<div class="movimiento-info">' +
    '<p class="movimiento-descripcion">' + escaparTexto(m.descripcion) + "</p>" +
    '<p class="movimiento-detalle">' + escaparTexto(detalle.join(", ")) + "</p>" +
    "</div>" +
    '<div class="movimiento-monto ' + (esIngreso ? "positivo" : "negativo") + '">' +
    (esIngreso ? privado("+ " + formatearMoneda(m.monto)) : "- " + formatearMoneda(m.monto)) + "</div>";
  return item;
}

// -------------------- ESTADÍSTICAS --------------------
function mostrarEstadisticas() {
  const delMes = movimientosDelMes();
  const totales = calcularTotales(delMes);

  document.getElementById("stat-ingresos").textContent = privado(formatearMoneda(totales.ingresos));
  document.getElementById("stat-gastos").textContent = formatearMoneda(totales.gastos);
  document.getElementById("stat-saldo").textContent = privado(formatearMoneda(totales.balance));
  document.getElementById("stat-cantidad").textContent = delMes.length;
  document.getElementById("btn-exportar").textContent = "Descargar informe de " + nombreMes(mesSeleccionado, false);

  const porCategoria = gastosPorCategoria(delMes);
  const contenedor = document.getElementById("lista-categorias");
  contenedor.innerHTML = "";

  const ordenadas = Object.keys(porCategoria).sort(function (a, b) { return porCategoria[b] - porCategoria[a]; });

  if (ordenadas.length === 0) {
    contenedor.innerHTML =
      '<div class="estado-vacio">' +
      '<span class="estado-vacio-icono">📊</span>' +
      '<p class="estado-vacio-titulo">Sin gastos en este mes</p>' +
      '<p class="estado-vacio-subtitulo">Cuando anotes gastos verás en qué se va tu plata</p>' +
      "</div>";
    return;
  }

  ordenadas.forEach(function (categoria) {
    const porcentaje = totales.gastos > 0 ? (porCategoria[categoria] / totales.gastos) * 100 : 0;
    const fila = document.createElement("div");
    fila.className = "categoria-item";
    fila.innerHTML =
      '<div class="categoria-fila">' +
      '<span class="categoria-nombre">' + (CATEGORIAS.gasto[categoria] || "📦") + " " + escaparTexto(categoria) + "</span>" +
      '<span class="categoria-monto">' + formatearMoneda(porCategoria[categoria]) +
      ' <small>' + Math.round(porcentaje) + "%</small></span>" +
      "</div>" +
      '<div class="categoria-barra"><div style="width:' + porcentaje.toFixed(1) + '%"></div></div>';
    contenedor.appendChild(fila);
  });
}

// -------------------- EXPORTAR INFORME DEL MES (CSV) --------------------
async function exportarInforme() {
  const delMes = movimientosDelMes().sort(function (a, b) {
    if (a.fecha === b.fecha) return a.id - b.id;
    return a.fecha < b.fecha ? -1 : 1;
  });

  if (delMes.length === 0) {
    mostrarToast("No hay movimientos en este mes");
    return;
  }

  const totales = calcularTotales(delMes);
  const porCategoria = gastosPorCategoria(delMes);
  const filas = [];

  filas.push(["Informe de gastos", nombreMes(mesSeleccionado, true)]);
  filas.push(["Generado el", formatearFecha(obtenerFechaHoy())]);
  filas.push([]);
  filas.push(["Fecha", "Descripción", "Categoría", "Gasto", "Ingreso"]);
  delMes.forEach(function (m) {
    filas.push([
        formatearFecha(m.fecha), m.descripcion, m.categoria,
      m.tipo === "gasto" ? m.monto : "",
      m.tipo === "ingreso" ? m.monto : ""
    ]);
  });

  filas.push([]);
  filas.push(["Gastos por categoría", "Total", "% del gasto"]);
  Object.keys(porCategoria)
    .sort(function (a, b) { return porCategoria[b] - porCategoria[a]; })
    .forEach(function (c) {
      filas.push([c, porCategoria[c], Math.round((porCategoria[c] / totales.gastos) * 100) + "%"]);
    });

  filas.push([]);
  filas.push(["Total gastos", totales.gastos]);
  filas.push(["Total ingresos", totales.ingresos]);
  filas.push(["Balance del mes", totales.balance]);
  filas.push(["Promedio de gasto diario", Math.round(totales.gastos / diasTranscurridos())]);
  if (presupuestoMensual > 0) {
    filas.push(["Presupuesto mensual", presupuestoMensual]);
    filas.push(["Diferencia con el presupuesto", presupuestoMensual - totales.gastos]);
  }

  // Punto y coma: es el separador que espera Excel en español (Colombia).
  // El BOM (\uFEFF) hace que Excel lea bien las tildes.
  const contenido = "\uFEFF" + filas.map(function (fila) {
    return fila.map(celdaCsv).join(";");
  }).join("\r\n");

  await guardarArchivo("gastos-" + mesSeleccionado + ".csv", contenido);
}

function celdaCsv(valor) {
  if (typeof valor === "number") return String(Math.round(valor));
  let texto = valor == null ? "" : String(valor);
  // Evita que Excel interprete el texto como fórmula (inyección CSV)
  if (/^[=+\-@]/.test(texto)) texto = "'" + texto;
  if (/[";\r\n]/.test(texto)) texto = '"' + texto.replace(/"/g, '""') + '"';
  return texto;
}

async function guardarArchivo(nombre, contenido) {
  const cap = window.Capacitor;
  const esNativo = cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform();

  if (esNativo) {
    // En el celular el WebView no descarga archivos: se escribe con Filesystem y se abre el menú de compartir
    const Filesystem = cap.Plugins && cap.Plugins.Filesystem;
    const Share = cap.Plugins && cap.Plugins.Share;
    if (!Filesystem || !Share) {
      mostrarToast("⚠️ Faltan los plugins Filesystem y Share");
      console.error("Instala @capacitor/filesystem y @capacitor/share y ejecuta npx cap sync android");
      return;
    }
    try {
      const resultado = await Filesystem.writeFile({
        path: nombre,
        data: contenido,
        directory: "CACHE",
        encoding: "utf8"
      });
      await Share.share({
        title: "Informe " + nombreMes(mesSeleccionado, true),
        url: resultado.uri,
        dialogTitle: "Guardar o enviar el informe"
      });
    } catch (error) {
      if (!String(error && error.message).toLowerCase().includes("cancel")) {
        console.error("Error al exportar:", error);
        mostrarToast("⚠️ No se pudo crear el archivo");
      }
    }
    return;
  }

  // Navegador: descarga normal
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  mostrarToast("✅ Informe descargado");
}

// -------------------- CONFIGURACIÓN: PRESUPUESTO --------------------
function guardarPresupuesto() {
  const valor = parseFloat(document.getElementById("input-presupuesto").value);
  presupuestoMensual = isNaN(valor) || valor <= 0 ? 0 : valor;
  try {
    if (presupuestoMensual > 0) localStorage.setItem(CLAVE_PRESUPUESTO, String(presupuestoMensual));
    else localStorage.removeItem(CLAVE_PRESUPUESTO);
  } catch (error) {
    console.error("Error al guardar el presupuesto:", error);
  }
  if (presupuestoMensual === 0) document.getElementById("input-presupuesto").value = "";
  actualizarDashboard();
  mostrarToast(presupuestoMensual > 0 ? "✅ Presupuesto guardado" : "✅ Presupuesto quitado");
}

// -------------------- CONFIGURACIÓN: TEMA --------------------
function cargarTema() {
  let temaGuardado = "sistema";
  try {
    temaGuardado = localStorage.getItem(CLAVE_TEMA) || "sistema";
  } catch (error) {
    console.error("Error al leer el tema guardado:", error);
  }
  aplicarTema(temaGuardado);
  const radio = document.getElementById("tema-" + temaGuardado);
  if (radio) radio.checked = true;
}

function cambiarTema(tema) {
  aplicarTema(tema);
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch (error) {
    console.error("Error al guardar el tema:", error);
  }
}

function aplicarTema(tema) {
  let esOscuro = tema === "oscuro";
  if (tema === "sistema") {
    esOscuro = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  document.body.classList.toggle("tema-oscuro", !!esOscuro);
}

if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    let temaGuardado = "sistema";
    try {
      temaGuardado = localStorage.getItem(CLAVE_TEMA) || "sistema";
    } catch (error) {
      temaGuardado = "sistema";
    }
    if (temaGuardado === "sistema") aplicarTema("sistema");
  });
}

// -------------------- CONFIRMACIONES --------------------
function abrirConfirmacion(titulo, texto, textoBoton, accion) {
  document.getElementById("confirmar-titulo").textContent = titulo;
  document.getElementById("confirmar-texto").textContent = texto;
  document.getElementById("btn-confirmar-accion").textContent = textoBoton;
  accionConfirmar = accion;
  document.getElementById("modal-confirmar").classList.add("abierto");
}

function ejecutarConfirmacion() {
  const accion = accionConfirmar;
  cerrarModalConfirmar();
  if (accion) accion();
}

function cerrarModalConfirmar() {
  document.getElementById("modal-confirmar").classList.remove("abierto");
  accionConfirmar = null;
}

function confirmarEliminarMovimientos() {
  abrirConfirmacion(
    "¿Eliminar todos los movimientos?",
    "Se borran los registros de todos los meses. Si los necesitas, descarga antes los informes.",
    "Eliminar todo",
    function () {
      movimientos = [];
      try {
        localStorage.removeItem(CLAVE_MOVIMIENTOS);
      } catch (error) {
        console.error("Error al eliminar localStorage:", error);
      }
      refrescarTodo();
      mostrarToast("✅ Movimientos eliminados");
    }
  );
}

// -------------------- UTILIDADES --------------------
function formatearMoneda(valor) {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(valor);
  } catch (error) {
    return "$ " + Math.round(valor);
  }
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return "";
  const partes = fechaISO.split("-");
  if (partes.length !== 3) return fechaISO;
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

// "2026-10" -> "octubre" u "Octubre de 2026"
function nombreMes(anioMes, conAnio) {
  const [anio, mes] = anioMes.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, 1);
  const mostrarAnio = conAnio || anio !== new Date().getFullYear();
  const texto = new Intl.DateTimeFormat("es-CO", mostrarAnio ? { month: "long", year: "numeric" } : { month: "long" }).format(fecha);
  return conAnio ? capitalizar(texto) : texto;
}

// "2026-10-01" -> "Jueves, 1 de octubre" (o "Hoy" / "Ayer")
function nombreDia(fechaISO) {
  if (fechaISO === obtenerFechaHoy()) return "Hoy";
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  if (fechaISO === aFechaISO(ayer)) return "Ayer";
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return capitalizar(new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" })
    .format(new Date(anio, mes - 1, dia)));
}

// -------------------- BOTÓN DEL OJO --------------------
function alternarMontos() {
  ocultarMontos = !ocultarMontos;
  try {
    localStorage.setItem(CLAVE_OCULTAR, ocultarMontos ? "1" : "0");
  } catch (error) {
    console.error("Error al guardar la preferencia del ojo:", error);
  }
  refrescarTodo();
}

// Si el ojo está cerrado, cambia el monto por $$$$$
function privado(texto) {
  return ocultarMontos ? "$$$$$" : texto;
}

function actualizarBotonOjo() {
  // Los íconos son SVG: se usa toggleAttribute porque .hidden no funciona en SVG
  document.getElementById("icono-ojo-abierto").toggleAttribute("hidden", ocultarMontos);
  document.getElementById("icono-ojo-cerrado").toggleAttribute("hidden", !ocultarMontos);
  document.getElementById("btn-ojo").setAttribute("aria-label", ocultarMontos ? "Mostrar montos" : "Ocultar montos");
}

function ponerTexto(id, texto) {
  document.getElementById(id).textContent = texto;
}

// Agrega "- " o "+ " al monto; si es 0 lo deja sin signo
function conSigno(valor, signo) {
  return valor > 0 ? signo + " " + formatearMoneda(valor) : formatearMoneda(0);
}

function mayorGastoDiario(lista) {
  const porDia = {};
  lista.forEach(function (m) {
    if (m.tipo === "gasto") porDia[m.fecha] = (porDia[m.fecha] || 0) + m.monto;
  });
  return Object.values(porDia).reduce(function (a, b) { return Math.max(a, b); }, 0);
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function aFechaISO(fecha) {
  return fecha.getFullYear() + "-" + String(fecha.getMonth() + 1).padStart(2, "0") + "-" + String(fecha.getDate()).padStart(2, "0");
}

function obtenerFechaHoy() {
  return aFechaISO(new Date());
}

function escaparTexto(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : texto;
  return div.innerHTML;
}

let temporizadorToast = null;
function mostrarToast(mensaje) {
  const toast = document.getElementById("toast");
  toast.textContent = mensaje;
  toast.classList.add("visible");
  if (temporizadorToast) clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(function () { toast.classList.remove("visible"); }, 2200);
}

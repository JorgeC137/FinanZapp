/* ============================================================
   FinanZapp — Lógica de la aplicación
   Control de gastos mes a mes. El saldo inicial es opcional:
   puedes registrar solo gastos, y si quieres, un presupuesto
   mensual o tus ingresos para ver cuánto te queda.
   ============================================================ */

// -------------------- ESTADO GLOBAL --------------------
const CLAVE_MOVIMIENTOS = "finanzapp_movimientos";   // misma clave de antes: no se pierden datos
const CLAVE_TEMA = "finanzapp_tema";
const CLAVE_PRESUPUESTO = "finanzapp_presupuesto";
const CLAVE_OCULTAR = "finanzapp_ocultar_montos";


// FinanApp -> FinanZapp: si hay datos guardados con el nombre viejo, se pasan al nuevo una sola vez
(function migrarClavesAntiguas() {
  try {
    ["movimientos", "tema", "presupuesto", "ocultar_montos", "fijos", "fijos_descartados"].forEach(function (nombre) {
      const vieja = "finanapp_" + nombre;
      const nueva = "finanzapp_" + nombre;
      if (localStorage.getItem(nueva) === null && localStorage.getItem(vieja) !== null) {
        localStorage.setItem(nueva, localStorage.getItem(vieja));
        localStorage.removeItem(vieja);
      }
    });
  } catch (error) {
    console.error("No se pudieron migrar los datos guardados:", error);
  }
})();

let movimientos = [];
let presupuestoMensual = 0;           // 0 = sin presupuesto
let ocultarMontos = false;            // botón del ojo
let seccionActual = "inicio";
let periodo = rangoDelMes(obtenerFechaHoy().slice(0, 7));   // { inicio, fin } en AAAA-MM-DD
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
  actualizarFijos();
  actualizarBarraPeriodo();
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

// -------------------- PERIODO SELECCIONADO --------------------
// Un periodo es un rango de días { inicio, fin } en formato AAAA-MM-DD:
// un mes completo, una semana, un solo día o cualquier rango de hasta 31 días.
const MAX_DIAS_PERIODO = 31;
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function rangoDelMes(anioMes) {
  const [anio, mes] = anioMes.split("-").map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return { inicio: anioMes + "-01", fin: anioMes + "-" + String(ultimoDia).padStart(2, "0") };
}

function sumarDias(fechaISO, dias) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return aFechaISO(new Date(anio, mes - 1, dia + dias));
}

// Días entre dos fechas, contando ambas (del 1 al 3 son 3 días)
function diasEntre(inicio, fin) {
  const [a1, m1, d1] = inicio.split("-").map(Number);
  const [a2, m2, d2] = fin.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000) + 1;
}

function esMesCompleto(p) {
  const mes = p.inicio.slice(0, 7);
  return p.inicio === mes + "-01" && p.fin === rangoDelMes(mes).fin;
}

function periodoIncluyeHoy() {
  const hoy = obtenerFechaHoy();
  return periodo.inicio <= hoy && hoy <= periodo.fin;
}

function movimientosDelPeriodo() {
  return movimientos.filter(function (m) {
    return m.fecha >= periodo.inicio && m.fecha <= periodo.fin;
  });
}

// El periodo anterior (-1) o siguiente (1), con la misma duración
function periodoVecino(p, delta) {
  if (esMesCompleto(p)) {
    const [anio, mes] = p.inicio.split("-").map(Number);
    return rangoDelMes(aFechaISO(new Date(anio, mes - 1 + delta, 1)).slice(0, 7));
  }
  const dias = diasEntre(p.inicio, p.fin);
  return { inicio: sumarDias(p.inicio, delta * dias), fin: sumarDias(p.fin, delta * dias) };
}

function moverPeriodo(delta) {
  const nuevo = periodoVecino(periodo, delta);
  if (nuevo.inicio > obtenerFechaHoy()) return;   // no se navega al futuro
  periodo = nuevo;
  refrescarTodo();
}

function actualizarBarraPeriodo() {
  ponerTexto("periodo-texto", nombrePeriodo(true));
  document.getElementById("btn-periodo-siguiente").disabled = periodoVecino(periodo, 1).inicio > obtenerFechaHoy();
}

// "2026-10-01" -> "1 oct" (con el año si no es el actual)
function fechaCorta(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return dia + " " + MESES_CORTOS[mes - 1] + (anio !== new Date().getFullYear() ? " " + anio : "");
}

function nombrePeriodo(largo) {
  if (esMesCompleto(periodo)) return nombreMes(periodo.inicio.slice(0, 7), largo);
  if (periodo.inicio === periodo.fin) return largo ? nombreDia(periodo.inicio) : fechaCorta(periodo.inicio);
  return fechaCorta(periodo.inicio) + " – " + fechaCorta(periodo.fin);
}

function textoGastado() {
  if (esMesCompleto(periodo)) return "Gastado en " + nombreMes(periodo.inicio.slice(0, 7), false);
  if (periodo.inicio === periodo.fin) {
    return periodo.inicio === obtenerFechaHoy() ? "Gastado hoy" : "Gastado el " + fechaCorta(periodo.inicio);
  }
  return "Gastado del " + fechaCorta(periodo.inicio) + " al " + fechaCorta(periodo.fin);
}

// Presupuesto mensual completo, o la parte proporcional a los días elegidos
function presupuestoDelPeriodo() {
  if (esMesCompleto(periodo)) return presupuestoMensual;
  return Math.round((presupuestoMensual / 30) * diasEntre(periodo.inicio, periodo.fin));
}

// -------------------- CALENDARIO --------------------
let calMes = "";            // mes que se ve en el calendario (AAAA-MM)
let seleccion = null;       // { inicio, fin } mientras eliges
let esperandoFin = false;   // true después del primer toque

function abrirCalendario() {
  const hoy = obtenerFechaHoy();
  seleccion = { inicio: periodo.inicio, fin: periodo.fin };
  esperandoFin = false;
  calMes = (periodo.fin > hoy ? hoy : periodo.fin).slice(0, 7);
  dibujarCalendario();
  document.getElementById("modal-calendario").classList.add("abierto");
}

function cerrarCalendario() {
  document.getElementById("modal-calendario").classList.remove("abierto");
}

function moverCalendario(delta) {
  const [anio, mes] = calMes.split("-").map(Number);
  const nuevo = aFechaISO(new Date(anio, mes - 1 + delta, 1)).slice(0, 7);
  if (nuevo > obtenerFechaHoy().slice(0, 7)) return;
  calMes = nuevo;
  dibujarCalendario();
}

// Primer toque: elige un día. Segundo toque: cierra el rango.
function tocarDia(fecha) {
  if (!esperandoFin) {
    seleccion = { inicio: fecha, fin: fecha };
    esperandoFin = true;
  } else {
    const inicio = fecha < seleccion.inicio ? fecha : seleccion.inicio;
    const fin = fecha < seleccion.inicio ? seleccion.inicio : fecha;
    if (diasEntre(inicio, fin) > MAX_DIAS_PERIODO) {
      mostrarToast("Puedes elegir máximo " + MAX_DIAS_PERIODO + " días");
      seleccion = { inicio: fecha, fin: fecha };
      return dibujarCalendario();
    }
    seleccion = { inicio: inicio, fin: fin };
    esperandoFin = false;
  }
  dibujarCalendario();
}

function dibujarCalendario() {
  const [anio, mes] = calMes.split("-").map(Number);
  const hoy = obtenerFechaHoy();
  ponerTexto("cal-mes-texto", nombreMes(calMes, true));
  document.getElementById("cal-siguiente").disabled = calMes >= hoy.slice(0, 7);

  const grilla = document.getElementById("cal-dias");
  grilla.innerHTML = "";
  const espacios = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;   // la semana empieza el lunes
  for (let i = 0; i < espacios; i++) grilla.appendChild(document.createElement("span"));

  const totalDias = new Date(anio, mes, 0).getDate();
  for (let dia = 1; dia <= totalDias; dia++) {
    const fecha = calMes + "-" + String(dia).padStart(2, "0");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "cal-dia";
    boton.textContent = dia;
    boton.disabled = fecha > hoy;
    if (fecha === hoy) boton.classList.add("es-hoy");
    if (fecha >= seleccion.inicio && fecha <= seleccion.fin) boton.classList.add("en-rango");
    if (fecha === seleccion.inicio || fecha === seleccion.fin) boton.classList.add("extremo");
    boton.onclick = function () { tocarDia(fecha); };
    grilla.appendChild(boton);
  }

  const dias = diasEntre(seleccion.inicio, seleccion.fin);
  ponerTexto("cal-resumen", dias === 1
    ? nombreDia(seleccion.inicio) + (esperandoFin ? ". Toca otro día para elegir un rango." : "")
    : fechaCorta(seleccion.inicio) + " – " + fechaCorta(seleccion.fin) + " (" + dias + " días)");
}

function aplicarCalendario() {
  periodo = { inicio: seleccion.inicio, fin: seleccion.fin };
  cerrarCalendario();
  refrescarTodo();
}

function atajoPeriodo(tipo) {
  const hoy = obtenerFechaHoy();
  if (tipo === "hoy") periodo = { inicio: hoy, fin: hoy };
  if (tipo === "semana") {
    const [anio, mes, dia] = hoy.split("-").map(Number);
    const lunes = sumarDias(hoy, -((new Date(anio, mes - 1, dia).getDay() + 6) % 7));
    periodo = { inicio: lunes, fin: sumarDias(lunes, 6) };
  }
  if (tipo === "mes") periodo = rangoDelMes(hoy.slice(0, 7));
  if (tipo === "mes-anterior") periodo = periodoVecino(rangoDelMes(hoy.slice(0, 7)), -1);
  cerrarCalendario();
  refrescarTodo();
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
  document.getElementById("input-fecha").value = periodoIncluyeHoy() ? obtenerFechaHoy() : periodo.fin;

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
  document.getElementById("input-fijo").value = "";
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
  const fijoId = Number(document.getElementById("input-fijo").value) || null;
  let nuevo = null;

  if (idEdicion) {
    const indice = movimientos.findIndex(function (m) { return m.id === idEdicion; });
    // Se parte del registro existente para no perder datos extra, como el fijo al que pertenece
    if (indice !== -1) movimientos[indice] = Object.assign({}, movimientos[indice], datos);
  } else {
    nuevo = Object.assign({ id: Date.now() }, datos);
    if (fijoId) nuevo.fijoId = fijoId;
    movimientos.push(nuevo);
  }

  guardarDatos();
  // Si el registro quedó fuera de los días que estás viendo, salta a su mes
  if (fecha < periodo.inicio || fecha > periodo.fin) periodo = rangoDelMes(fecha.slice(0, 7));
  refrescarTodo();
  cerrarFormulario();

  if (idEdicion) {
    mostrarToast("✅ Cambios guardados");
  } else {
    mostrarToast(tipo === "ingreso" ? "✅ Ingreso guardado" : "✅ Gasto guardado");
    
  // Si lo mismo se repite en varios meses, se sugiere volverlo fijo (está en fijos.js)
  if (nuevo && !fijoId) sugerirFijoSiSeRepite(nuevo);
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
  const hoy = obtenerFechaHoy();
  const fin = periodo.fin < hoy ? periodo.fin : hoy;
  return Math.max(1, diasEntre(periodo.inicio, fin));
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
  const delPeriodo = movimientosDelPeriodo();
  const totales = calcularTotales(delPeriodo);
  const sufijo = esMesCompleto(periodo) ? "del mes" : "del periodo";

  ponerTexto("etiqueta-gastado", textoGastado());
  ponerTexto("total-gastado", formatearMoneda(totales.gastos));

  // Línea secundaria: presupuesto, balance o nada (todo es opcional)
  const linea = document.getElementById("linea-resumen");
  const barra = document.getElementById("barra-presupuesto");
  const relleno = document.getElementById("barra-presupuesto-relleno");

  if (presupuestoMensual > 0) {
    const presupuesto = presupuestoDelPeriodo();
    const restante = presupuesto - totales.gastos;
    barra.hidden = false;
    relleno.style.width = Math.min(100, (totales.gastos / presupuesto) * 100) + "%";
    barra.classList.toggle("excedido", restante < 0);
    linea.textContent = restante >= 0
      ? "Te quedan " + formatearMoneda(restante) + " de " + formatearMoneda(presupuesto)
      : "Te pasaste " + formatearMoneda(-restante) + " del presupuesto";
  } else if (totales.ingresos > 0) {
    barra.hidden = true;
    linea.textContent = "Balance " + sufijo + ": " + privado(formatearMoneda(totales.balance));
  } else {
    barra.hidden = true;
    linea.textContent = "Anota cada gasto el día que lo hagas";
  }

  // Tarjetas del día: gastos en rojo, ingresos en verde
  const promedioDiario = totales.gastos / diasTranscurridos();
  if (periodoIncluyeHoy()) {
    const hoy = calcularTotales(delPeriodo.filter(function (m) { return m.fecha === obtenerFechaHoy(); }));
    ponerTexto("etiqueta-dia-gastos", "Gastado hoy");
    ponerTexto("valor-dia-gastos", conSigno(hoy.gastos, "-"));
    ponerTexto("subdato-dia-gastos", "Promedio diario: " + formatearMoneda(promedioDiario));
    ponerTexto("etiqueta-dia-ingresos", "Ingresos hoy");
    ponerTexto("valor-dia-ingresos", privado(conSigno(hoy.ingresos, "+")));
    ponerTexto("subdato-dia-ingresos", "Balance de hoy: " + privado(formatearMoneda(hoy.balance)));
  } else {
    // Si los días elegidos no incluyen hoy, se muestra el resumen de esos días
    ponerTexto("etiqueta-dia-gastos", "Promedio diario");
    ponerTexto("valor-dia-gastos", conSigno(promedioDiario, "-"));
    ponerTexto("subdato-dia-gastos", "Día con más gasto: " + formatearMoneda(mayorGastoDiario(delPeriodo)));
    ponerTexto("etiqueta-dia-ingresos", "Ingresos " + sufijo);
    ponerTexto("valor-dia-ingresos", privado(conSigno(totales.ingresos, "+")));
    ponerTexto("subdato-dia-ingresos", "Balance " + sufijo + ": " + privado(formatearMoneda(totales.balance)));
  }

  renderizarLista("lista-movimientos-recientes", ordenarRecientes(delPeriodo).slice(0, 5), false);
}

// -------------------- MOVIMIENTOS --------------------
function mostrarMovimientos() {
  renderizarLista("lista-movimientos-todos", ordenarRecientes(movimientosDelPeriodo()), true);
}

function renderizarLista(idContenedor, lista, agruparPorDia) {
  const contenedor = document.getElementById(idContenedor);
  if (!contenedor) return;
  contenedor.innerHTML = "";

  if (lista.length === 0) {
    contenedor.innerHTML =
      '<div class="estado-vacio">' +
      '<span class="estado-vacio-icono">📋</span>' +
      '<p class="estado-vacio-titulo">Sin movimientos en estos días</p>' +
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
  poblarAnios();
  const delMes = movimientosDelPeriodo();
  const totales = calcularTotales(delMes);

  document.getElementById("stat-ingresos").textContent = privado(formatearMoneda(totales.ingresos));
  document.getElementById("stat-gastos").textContent = formatearMoneda(totales.gastos);
  document.getElementById("stat-saldo").textContent = privado(formatearMoneda(totales.balance));
  document.getElementById("stat-cantidad").textContent = delMes.length;
  ponerTexto("btn-exportar", esMesCompleto(periodo) ? "Descargar informe de " + nombrePeriodo(false) : "Descargar informe de estos días");

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
  const delMes = movimientosDelPeriodo().sort(function (a, b) {
    if (a.fecha === b.fecha) return a.id - b.id;
    return a.fecha < b.fecha ? -1 : 1;
  });

  if (delMes.length === 0) {
    mostrarToast("No hay movimientos en estos días");
    return;
  }

  const totales = calcularTotales(delMes);
  const porCategoria = gastosPorCategoria(delMes);
  const filas = [];

  filas.push(["Informe de gastos", nombrePeriodo(true)]);
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
    filas.push(["Presupuesto " + (esMesCompleto(periodo) ? "del mes" : "proporcional de estos días"), presupuestoDelPeriodo()]);
    filas.push(["Diferencia con el presupuesto", presupuestoDelPeriodo() - totales.gastos]);
  }

  // Punto y coma: es el separador que espera Excel en español (Colombia).
  // El BOM (\uFEFF) hace que Excel lea bien las tildes.
  const contenido = "\uFEFF" + filas.map(function (fila) {
    return fila.map(celdaCsv).join(separadorCsv());
  }).join("\r\n");

  const nombreArchivo = esMesCompleto(periodo)
    ? "gastos-" + periodo.inicio.slice(0, 7)
    : "gastos-" + periodo.inicio + "_a_" + periodo.fin;
  await guardarArchivo(nombreArchivo + ".csv", contenido);
}

// Separador de columnas y decimales según el país, para que Excel lo abra bien
function separadorCsv() {
  return usaComaDecimal() ? ";" : ",";
}

function celdaCsv(valor) {
  if (typeof valor === "number") {
    const numero = valor.toFixed(decimalesMoneda());
    return usaComaDecimal() ? numero.replace(".", ",") : numero;
  }
  let texto = valor == null ? "" : String(valor);
  // Evita que Excel interprete el texto como fórmula (inyección CSV)
  if (/^[=+\-@]/.test(texto)) texto = "'" + texto;
  if (/[";,\r\n]/.test(texto)) texto = '"' + texto.replace(/"/g, '""') + '"';
  return texto;
}

// opciones: { titulo, tipo, base64 }. Para PDF el contenido llega en base64.
async function guardarArchivo(nombre, contenido, opciones) {
  const config = Object.assign({
    titulo: "Informe " + nombrePeriodo(true),
    tipo: "text/csv;charset=utf-8",
    base64: false
  }, opciones);

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
      const archivo = { path: nombre, data: contenido, directory: "CACHE" };
      if (!config.base64) archivo.encoding = "utf8";   // sin encoding, Filesystem espera base64
      const resultado = await Filesystem.writeFile(archivo);
      await Share.share({
        title: config.titulo,
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
  const datos = config.base64
    ? Uint8Array.from(atob(contenido), function (c) { return c.charCodeAt(0); })
    : contenido;
  const blob = new Blob([datos], { type: config.tipo });
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

// -------------------- INFORME ANUAL --------------------
const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Llena el selector con los años que tienen movimientos (y el actual)
function poblarAnios() {
  const select = document.getElementById("select-anio");
  const elegido = select.value;
  const anios = new Set([String(new Date().getFullYear())]);
  movimientos.forEach(function (m) { anios.add(m.fecha.slice(0, 4)); });
  const lista = Array.from(anios).sort().reverse();
  select.innerHTML = lista.map(function (a) { return '<option value="' + a + '">' + a + "</option>"; }).join("");
  select.value = lista.includes(elegido) ? elegido : lista[0];
}

function datosAnuales(anio) {
  const delAnio = movimientos
    .filter(function (m) { return m.fecha.slice(0, 4) === anio; })
    .sort(function (a, b) {
      if (a.fecha === b.fecha) return a.id - b.id;
      return a.fecha < b.fecha ? -1 : 1;
    });

  const meses = MESES_LARGOS.map(function () { return { gastos: 0, ingresos: 0 }; });
  const categorias = {};   // { "Alimentación": [12 montos, uno por mes] }

  delAnio.forEach(function (m) {
    const i = Number(m.fecha.slice(5, 7)) - 1;
    if (m.tipo === "gasto") {
      meses[i].gastos += m.monto;
      if (!categorias[m.categoria]) categorias[m.categoria] = new Array(12).fill(0);
      categorias[m.categoria][i] += m.monto;
    } else {
      meses[i].ingresos += m.monto;
    }
  });

  // Meses transcurridos: si es el año actual, hasta el mes de hoy
  const mesesTranscurridos = anio === String(new Date().getFullYear()) ? new Date().getMonth() + 1 : 12;
  return { anio: anio, lista: delAnio, meses: meses, categorias: categorias,
    totales: calcularTotales(delAnio), mesesTranscurridos: mesesTranscurridos };
}

function categoriasOrdenadas(categorias) {
  return Object.keys(categorias)
    .map(function (c) {
      return { nombre: c, porMes: categorias[c], total: categorias[c].reduce(function (a, b) { return a + b; }, 0) };
    })
    .sort(function (a, b) { return b.total - a.total; });
}

async function exportarAnualCsv() {
  const datos = datosAnuales(document.getElementById("select-anio").value);
  if (datos.lista.length === 0) {
    mostrarToast("No hay movimientos en " + datos.anio);
    return;
  }

  const filas = [];
  filas.push(["Informe anual de FinanZapp", datos.anio]);
  filas.push(["Generado el", formatearFecha(obtenerFechaHoy())]);
  filas.push([]);

  filas.push(["Resumen por mes"]);
  filas.push(["Mes", "Gastos", "Ingresos", "Balance"]);
  datos.meses.forEach(function (m, i) {
    filas.push([MESES_LARGOS[i], m.gastos, m.ingresos, m.ingresos - m.gastos]);
  });
  filas.push(["Total", datos.totales.gastos, datos.totales.ingresos, datos.totales.balance]);
  filas.push(["Promedio mensual", Math.round(datos.totales.gastos / datos.mesesTranscurridos),
    Math.round(datos.totales.ingresos / datos.mesesTranscurridos)]);
  filas.push([]);

  filas.push(["Gastos por categoría y mes"]);
  filas.push(["Categoría"].concat(MESES_CORTOS, ["Total"]));
  categoriasOrdenadas(datos.categorias).forEach(function (c) {
    filas.push([c.nombre].concat(c.porMes, [c.total]));
  });
  filas.push([]);

  filas.push(["Detalle de movimientos"]);
  filas.push(["Fecha", "Tipo", "Descripción", "Categoría", "Monto"]);
  datos.lista.forEach(function (m) {
    filas.push([formatearFecha(m.fecha), m.tipo === "gasto" ? "Gasto" : "Ingreso", m.descripcion, m.categoria, m.monto]);
  });

  const contenido = "\uFEFF" + filas.map(function (fila) {
    return fila.map(celdaCsv).join(separadorCsv());
  }).join("\r\n");

  await guardarArchivo("informe-anual-" + datos.anio + ".csv", contenido, { titulo: "Informe anual " + datos.anio });
}

// 1600000 -> "1,6M", 850000 -> "850k" (para los ejes de la gráfica)
function abreviarMonto(valor) {
  if (valor >= 1000000) return (valor / 1000000).toFixed(1).replace(".", ",") + "M";
  if (valor >= 1000) return Math.round(valor / 1000) + "k";
  return String(Math.round(valor));
}

async function exportarAnualPdf() {
  if (!window.jspdf) {
    mostrarToast("⚠️ Falta la librería de PDF");
    return;
  }
  const datos = datosAnuales(document.getElementById("select-anio").value);
  if (datos.lista.length === 0) {
    mostrarToast("No hay movimientos en " + datos.anio);
    return;
  }

  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  const ANCHO = 210;
  const MARGEN = 16;
  const AZUL = [37, 99, 235], ROJO = [220, 38, 38], VERDE = [22, 163, 74];
  const GRIS = [100, 116, 139], OSCURO = [15, 23, 42], LINEA = [226, 232, 240];
  const t = datos.totales;

  // --- Encabezado ---
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, ANCHO, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Informe anual " + datos.anio, MARGEN, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("FinanZapp, generado el " + formatearFecha(obtenerFechaHoy()), MARGEN, 26);

  // --- Cuatro recuadros de resumen ---
  const resumen = [
    ["Gastos del año", formatearMoneda(t.gastos), ROJO],
    ["Ingresos del año", formatearMoneda(t.ingresos), VERDE],
    ["Balance", formatearMoneda(t.balance), t.balance < 0 ? ROJO : OSCURO],
    ["Gasto promedio al mes", formatearMoneda(t.gastos / datos.mesesTranscurridos), OSCURO]
  ];
  const anchoCaja = (ANCHO - MARGEN * 2 - 9) / 4;
  resumen.forEach(function (item, i) {
    const x = MARGEN + i * (anchoCaja + 3);
    doc.setDrawColor(...LINEA);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, 42, anchoCaja, 22, 3, 3, "FD");
    doc.setTextColor(...GRIS);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(item[0], x + 4, 49);
    doc.setTextColor(...item[2]);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(item[1], x + 4, 58);
  });

  // --- Gráfica de barras: gastos e ingresos por mes ---
  doc.setTextColor(...OSCURO);
  doc.setFontSize(12);
  doc.text("Gastos e ingresos por mes", MARGEN, 76);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setFillColor(...ROJO);
  doc.rect(140, 73, 3, 3, "F");
  doc.text("Gastos", 145, 75.6);
  doc.setFillColor(...VERDE);
  doc.rect(162, 73, 3, 3, "F");
  doc.text("Ingresos", 167, 75.6);

  const graficaX = MARGEN + 12;
  const graficaArriba = 84;
  const graficaAlto = 52;
  const graficaAncho = ANCHO - MARGEN - graficaX;
  const base = graficaArriba + graficaAlto;
  const maximo = Math.max.apply(null, datos.meses.map(function (m) { return Math.max(m.gastos, m.ingresos); })) || 1;

  doc.setDrawColor(...LINEA);
  doc.setTextColor(...GRIS);
  for (let i = 0; i <= 4; i++) {
    const yLinea = base - (graficaAlto * i) / 4;
    doc.line(graficaX, yLinea, graficaX + graficaAncho, yLinea);
    doc.text(abreviarMonto((maximo * i) / 4), graficaX - 2, yLinea + 1, { align: "right" });
  }

  const anchoGrupo = graficaAncho / 12;
  const anchoBarra = anchoGrupo * 0.32;
  datos.meses.forEach(function (m, i) {
    const x = graficaX + i * anchoGrupo + anchoGrupo * 0.16;
    const altoGasto = (m.gastos / maximo) * graficaAlto;
    const altoIngreso = (m.ingresos / maximo) * graficaAlto;
    doc.setFillColor(...ROJO);
    if (altoGasto > 0) doc.rect(x, base - altoGasto, anchoBarra, altoGasto, "F");
    doc.setFillColor(...VERDE);
    if (altoIngreso > 0) doc.rect(x + anchoBarra, base - altoIngreso, anchoBarra, altoIngreso, "F");
    doc.text(MESES_CORTOS[i], graficaX + i * anchoGrupo + anchoGrupo / 2, base + 5, { align: "center" });
  });

  // --- Tabla por mes ---
  let y = 152;
  doc.setTextColor(...OSCURO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Resumen por mes", MARGEN, y);
  y += 5;

  const columnas = [MARGEN + 2, 100, 140, ANCHO - MARGEN - 2];   // Mes (izq.) y montos (der.)
  function filaTabla(valores, negrita, fondo, colorBalance) {
    if (fondo) {
      doc.setFillColor(...fondo);
      doc.rect(MARGEN, y, ANCHO - MARGEN * 2, 6.5, "F");
    }
    doc.setFont("helvetica", negrita ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(...OSCURO);
    doc.text(valores[0], columnas[0], y + 4.5);
    doc.text(valores[1], columnas[1], y + 4.5, { align: "right" });
    doc.text(valores[2], columnas[2], y + 4.5, { align: "right" });
    doc.setTextColor(...(colorBalance || OSCURO));
    doc.text(valores[3], columnas[3], y + 4.5, { align: "right" });
    y += 6.5;
  }

  filaTabla(["Mes", "Gastos", "Ingresos", "Balance"], true, [241, 245, 249]);
  datos.meses.forEach(function (m, i) {
    const balance = m.ingresos - m.gastos;
    filaTabla([MESES_LARGOS[i], formatearMoneda(m.gastos), formatearMoneda(m.ingresos), formatearMoneda(balance)],
      false, i % 2 ? [248, 250, 252] : null, balance < 0 ? ROJO : OSCURO);
  });
  filaTabla(["Total", formatearMoneda(t.gastos), formatearMoneda(t.ingresos), formatearMoneda(t.balance)],
    true, [241, 245, 249], t.balance < 0 ? ROJO : OSCURO);

  // --- Página 2: categorías ---
  doc.addPage();
  y = 22;
  doc.setTextColor(...OSCURO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("¿En qué se fue la plata en " + datos.anio + "?", MARGEN, y);
  y += 10;

  const categorias = categoriasOrdenadas(datos.categorias);
  categorias.forEach(function (c) {
    if (y > 270) {
      doc.addPage();
      y = 22;
    }
    const porcentaje = t.gastos > 0 ? (c.total / t.gastos) * 100 : 0;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...OSCURO);
    doc.text(c.nombre, MARGEN, y);
    doc.text(formatearMoneda(c.total) + "  (" + Math.round(porcentaje) + "%)", ANCHO - MARGEN, y, { align: "right" });
    doc.setFillColor(...LINEA);
    doc.roundedRect(MARGEN, y + 2.5, ANCHO - MARGEN * 2, 3, 1.5, 1.5, "F");
    if (porcentaje > 0) {
      doc.setFillColor(...ROJO);
      doc.roundedRect(MARGEN, y + 2.5, Math.max(3, ((ANCHO - MARGEN * 2) * porcentaje) / 100), 3, 1.5, 1.5, "F");
    }
    y += 13;
  });

  // --- Pie de página en todas las hojas ---
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text("FinanZapp", MARGEN, 290);
    doc.text("Página " + i + " de " + paginas, ANCHO - MARGEN, 290, { align: "right" });
  }

  const base64 = doc.output("datauristring").split(",")[1];
  await guardarArchivo("informe-anual-" + datos.anio + ".pdf", base64, {
    titulo: "Informe anual " + datos.anio,
    tipo: "application/pdf",
    base64: true
  });
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
// Usa el idioma y la moneda elegidos (están en i18n.js)
function formatearMoneda(valor) {
  const decimales = decimalesMoneda();
  try {
    return new Intl.NumberFormat(localeApp(), {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    }).format(valor);
  } catch (error) {
    return moneda + " " + Number(valor).toFixed(decimales);
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
  const texto = new Intl.DateTimeFormat(localeApp(), mostrarAnio ? { month: "long", year: "numeric" } : { month: "long" }).format(fecha);
  return conAnio ? capitalizar(texto) : texto;
}

// "2026-10-01" -> "Jueves, 1 de octubre" (o "Hoy" / "Ayer")
function nombreDia(fechaISO) {
  if (fechaISO === obtenerFechaHoy()) return "Hoy";
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  if (fechaISO === aFechaISO(ayer)) return "Ayer";
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return capitalizar(new Intl.DateTimeFormat(localeApp(), { weekday: "long", day: "numeric", month: "long" })
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

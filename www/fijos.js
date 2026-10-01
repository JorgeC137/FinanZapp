/* ============================================================
   FinanZapp — Gastos e ingresos fijos
   Cada fijo puede anotarse solo cada mes ("auto") o quedar como
   recordatorio que el usuario confirma ("confirmar").
   ============================================================ */

// -------------------- DATOS --------------------
const CLAVE_FIJOS = "finanzapp_fijos";
const CLAVE_DESCARTADOS = "finanzapp_fijos_descartados";

// Cada fijo: { id, tipo, nombre, monto, categoria, dia (o null), modo, desde, procesadoHasta }
let fijos = leerLista(CLAVE_FIJOS);
let descartados = leerLista(CLAVE_DESCARTADOS);   // nombres que el usuario no quiso volver como fijos
let sugerenciaPendiente = null;

function leerLista(clave) {
  try {
    const valor = JSON.parse(localStorage.getItem(clave));
    return Array.isArray(valor) ? valor : [];
  } catch (error) {
    return [];
  }
}

function guardarLista(clave, lista) {
  try {
    localStorage.setItem(clave, JSON.stringify(lista));
  } catch (error) {
    console.error("Error al guardar " + clave + ":", error);
  }
}

// Esto corre después de que app.js cargó los movimientos
document.addEventListener("DOMContentLoaded", function () {
  procesarFijosAutomaticos();
  refrescarTodo();
});

// -------------------- FECHAS --------------------
function siguienteMes(anioMes) {
  const [anio, mes] = anioMes.split("-").map(Number);
  return aFechaISO(new Date(anio, mes, 1)).slice(0, 7);
}

// Fecha del fijo en un mes; si el día no existe (ej. 31 en febrero) usa el último día
function fechaDelFijo(fijo, anioMes) {
  const ultimoDia = Number(rangoDelMes(anioMes).fin.slice(8));
  const dia = Math.min(fijo.dia || 1, ultimoDia);
  return anioMes + "-" + String(dia).padStart(2, "0");
}

function estaConfirmadoEnMes(fijo, anioMes) {
  return movimientos.some(function (m) {
    return m.fijoId === fijo.id && m.fecha.slice(0, 7) === anioMes;
  });
}

// -------------------- AUTOMÁTICOS --------------------
// Anota los fijos automáticos cuyo día ya llegó, incluso si la app no se abrió en meses
function procesarFijosAutomaticos() {
  const hoy = obtenerFechaHoy();
  let siguienteId = Date.now();
  let anotados = 0;

  fijos.forEach(function (fijo) {
    if (fijo.modo !== "auto") return;
    let mes = fijo.procesadoHasta ? siguienteMes(fijo.procesadoHasta) : fijo.desde;

    while (mes <= hoy.slice(0, 7)) {
      const fecha = fechaDelFijo(fijo, mes);
      if (fecha > hoy) break;   // todavía no llega el día de este mes
      movimientos.push({
        id: siguienteId++,
        tipo: fijo.tipo,
        monto: fijo.monto,
        descripcion: fijo.nombre,
        categoria: fijo.categoria,
        fecha: fecha,
        fijoId: fijo.id
      });
      fijo.procesadoHasta = mes;   // así no se vuelve a anotar aunque borres el registro
      anotados++;
      mes = siguienteMes(mes);
    }
  });

  if (anotados > 0) {
    guardarDatos();
    guardarLista(CLAVE_FIJOS, fijos);
    mostrarToast(anotados === 1 ? "✅ Se anotó 1 fijo automático" : "✅ Se anotaron " + anotados + " fijos automáticos");
  }
}

// -------------------- MOSTRAR EN PANTALLA --------------------
// app.js la llama desde refrescarTodo()
function actualizarFijos() {
  mostrarFijosDelMes();
  mostrarFijosEnConfiguracion();
}

function mostrarFijosDelMes() {
  const bloque = document.getElementById("bloque-fijos-mes");
  const contenedor = document.getElementById("lista-fijos-mes");
  const hoy = obtenerFechaHoy();
  const mesHoy = hoy.slice(0, 7);

  // Se calcula el estado de cada fijo en el mes actual
  const delMes = fijos
    .filter(function (f) { return f.desde <= mesHoy; })
    .map(function (f) {
      const fecha = fechaDelFijo(f, mesHoy);
      const confirmado = estaConfirmadoEnMes(f, mesHoy);
      return {
        fijo: f,
        fecha: fecha,
        confirmado: confirmado,
        pendiente: !confirmado && f.modo === "confirmar" && !!f.dia && fecha < hoy
      };
    })
    // Primero los pendientes atrasados, luego por fecha, y al final los ya confirmados
    .sort(function (a, b) {
      if (a.pendiente !== b.pendiente) return a.pendiente ? -1 : 1;
      if (a.confirmado !== b.confirmado) return a.confirmado ? 1 : -1;
      return (a.fijo.dia || 99) - (b.fijo.dia || 99);
    });

  // Solo aparece si los días que estás viendo incluyen hoy
  bloque.hidden = delMes.length === 0 || !periodoIncluyeHoy();
  if (bloque.hidden) return;

  contenedor.innerHTML = "";
  delMes.forEach(function (item) {
    const fijo = item.fijo;
    const dia = Number(item.fecha.slice(8));

    let estado;
    if (item.confirmado) estado = "Confirmado este mes";
    else if (fijo.modo === "auto") estado = "Se anota solo el " + dia;
    else if (!fijo.dia) estado = "Sin fecha estimada";
    else if (item.pendiente) estado = "Pendiente desde el " + dia;
    else if (item.fecha === hoy) estado = "Estimado para hoy";
    else estado = "Estimado para el " + dia;

    const fila = document.createElement("div");
    fila.className = "fijo-item" + (item.pendiente ? " pendiente" : "");
    fila.innerHTML =
      '<div class="movimiento-icono">' + iconoCategoria(fijo) + "</div>" +
      '<div class="movimiento-info">' +
      '<p class="movimiento-descripcion">' + escaparTexto(fijo.nombre) + "</p>" +
      '<p class="fijo-estado">' + escaparTexto(estado + ", " + montoFijo(fijo)) + "</p>" +
      "</div>";

    if (item.confirmado) {
      fila.insertAdjacentHTML("beforeend", '<span class="fijo-confirmado">✓</span>');
    } else if (fijo.modo === "confirmar") {
      const boton = document.createElement("button");
      boton.className = "btn-confirmar-fijo";
      boton.textContent = "Confirmar";
      boton.onclick = function () { confirmarFijo(fijo.id); };
      fila.appendChild(boton);
    }
    contenedor.appendChild(fila);
  });
}

function mostrarFijosEnConfiguracion() {
  const contenedor = document.getElementById("lista-fijos-config");
  contenedor.innerHTML = "";
  if (fijos.length === 0) {
    contenedor.innerHTML = '<p class="config-ayuda">Todavía no tienes fijos.</p>';
    return;
  }
  fijos.forEach(function (fijo) {
    const detalle = (fijo.dia ? "Día " + fijo.dia : "Sin día") + ", " +
      (fijo.modo === "auto" ? "se anota solo" : "con recordatorio");
    const item = document.createElement("button");
    item.type = "button";
    item.className = "fijo-item";
    item.onclick = function () { abrirFormularioFijo(fijo.id); };
    item.innerHTML =
      '<div class="movimiento-icono">' + iconoCategoria(fijo) + "</div>" +
      '<div class="movimiento-info">' +
      '<p class="movimiento-descripcion">' + escaparTexto(fijo.nombre) + "</p>" +
      '<p class="fijo-estado">' + escaparTexto(detalle) + "</p>" +
      "</div>" +
      '<div class="movimiento-monto ' + (fijo.tipo === "ingreso" ? "positivo" : "negativo") + '">' +
      escaparTexto(montoFijo(fijo)) + "</div>";
    contenedor.appendChild(item);
  });
}

function iconoCategoria(fijo) {
  return (CATEGORIAS[fijo.tipo] && CATEGORIAS[fijo.tipo][fijo.categoria]) || "📌";
}

// Los ingresos fijos también se ocultan con el ojo
function montoFijo(fijo) {
  return fijo.tipo === "ingreso" ? privado(formatearMoneda(fijo.monto)) : formatearMoneda(fijo.monto);
}

// Abre el formulario normal con los datos del fijo ya escritos, para confirmar o cambiar el monto
function confirmarFijo(id) {
  const fijo = fijos.find(function (f) { return f.id === id; });
  if (!fijo) return;
  abrirFormulario(fijo.tipo);
  poblarCategorias(fijo.tipo, fijo.categoria);
  document.getElementById("input-monto").value = fijo.monto;
  document.getElementById("input-descripcion").value = fijo.nombre;
  document.getElementById("input-fijo").value = fijo.id;
  document.getElementById("modal-subtitulo").textContent = "Confirma el monto o cámbialo si este mes fue distinto";
}

// -------------------- FORMULARIO DE FIJOS --------------------
// datosIniciales sirve para la sugerencia: llega con nombre, monto, categoría, tipo y día ya puestos
function abrirFormularioFijo(id, datosIniciales) {
  const fijo = id ? fijos.find(function (f) { return f.id === id; }) : null;
  const datos = fijo || datosIniciales || { tipo: "gasto", modo: "confirmar" };

  document.getElementById("fijo-id").value = fijo ? fijo.id : "";
  document.getElementById("fijo-tipo-" + datos.tipo).checked = true;
  poblarCategoriasFijo(datos.tipo, datos.categoria);
  document.getElementById("fijo-nombre").value = datos.nombre || "";
  document.getElementById("fijo-monto").value = datos.monto || "";
  document.getElementById("fijo-dia").value = datos.dia || "";
  document.getElementById("fijo-modo-" + (datos.modo || "confirmar")).checked = true;
  ["nombre", "monto", "categoria", "dia"].forEach(function (campo) {
    document.getElementById("error-fijo-" + campo).textContent = "";
  });

  document.getElementById("fijo-titulo").textContent = fijo ? "Editar fijo" : "Agregar fijo";
  document.getElementById("btn-eliminar-fijo").hidden = !fijo;
  document.getElementById("modal-fijo").classList.add("abierto");
}

function cerrarFormularioFijo() {
  document.getElementById("modal-fijo").classList.remove("abierto");
}

function cambiarTipoFijo(tipo) {
  poblarCategoriasFijo(tipo);
}

function poblarCategoriasFijo(tipo, seleccion) {
  const select = document.getElementById("fijo-categoria");
  select.innerHTML = '<option value="">Selecciona una categoría</option>';
  Object.keys(CATEGORIAS[tipo]).forEach(function (nombre) {
    const opcion = document.createElement("option");
    opcion.value = nombre;
    opcion.textContent = CATEGORIAS[tipo][nombre] + " " + nombre;
    select.appendChild(opcion);
  });
  select.value = seleccion || "";
}

function guardarFijo() {
  const id = Number(document.getElementById("fijo-id").value) || null;
  const tipo = document.getElementById("fijo-tipo-ingreso").checked ? "ingreso" : "gasto";
  const nombre = document.getElementById("fijo-nombre").value.trim();
  const monto = parseFloat(document.getElementById("fijo-monto").value);
  const categoria = document.getElementById("fijo-categoria").value;
  const diaTexto = document.getElementById("fijo-dia").value;
  const dia = diaTexto ? Number(diaTexto) : null;
  const modo = document.getElementById("fijo-modo-auto").checked ? "auto" : "confirmar";

  const errores = {
    nombre: !nombre ? "Escribe un nombre" : "",
    monto: isNaN(monto) || monto <= 0 ? "Escribe un monto mayor que 0" : "",
    categoria: !categoria ? "Elige una categoría" : "",
    dia: dia !== null && (!Number.isInteger(dia) || dia < 1 || dia > 31) ? "El día debe ser entre 1 y 31" : ""
  };
  Object.keys(errores).forEach(function (campo) {
    document.getElementById("error-fijo-" + campo).textContent = errores[campo];
  });
  if (Object.values(errores).some(Boolean)) return;

  const datos = { tipo: tipo, nombre: nombre, monto: monto, categoria: categoria, dia: dia, modo: modo };
  let mensaje = "✅ Fijo guardado";

  if (id) {
    const indice = fijos.findIndex(function (f) { return f.id === id; });
    if (indice !== -1) fijos[indice] = Object.assign({}, fijos[indice], datos);
  } else {
    // Si el día de este mes ya pasó, empieza el mes siguiente, para no anotar registros atrasados
    const hoy = obtenerFechaHoy();
    const mesHoy = hoy.slice(0, 7);
    const empiezaYa = fechaDelFijo(datos, mesHoy) >= hoy || (modo === "confirmar" && !dia);
    datos.desde = empiezaYa ? mesHoy : siguienteMes(mesHoy);
    datos.id = Date.now();
    fijos.push(datos);
    if (!empiezaYa) mensaje = "✅ Guardado. Empieza a contar desde " + nombreMes(datos.desde, false);
  }

  guardarLista(CLAVE_FIJOS, fijos);
  cerrarFormularioFijo();
  mostrarToast(mensaje);
  procesarFijosAutomaticos();
  refrescarTodo();
}

function pedirEliminarFijo() {
  const id = Number(document.getElementById("fijo-id").value);
  abrirConfirmacion(
    "¿Eliminar este fijo?",
    "Deja de recordarse o anotarse cada mes. Los movimientos que ya quedaron anotados no se borran.",
    "Eliminar",
    function () {
      fijos = fijos.filter(function (f) { return f.id !== id; });
      guardarLista(CLAVE_FIJOS, fijos);
      cerrarFormularioFijo();
      refrescarTodo();
      mostrarToast("✅ Fijo eliminado");
    }
  );
}

// -------------------- SUGERIR FIJOS QUE SE REPITEN --------------------
// "Netflix ", "netflix" y "Nétflix" cuentan como lo mismo
function normalizar(texto) {
  return String(texto || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// app.js la llama después de guardar un movimiento nuevo
function sugerirFijoSiSeRepite(movimiento) {
  const nombre = normalizar(movimiento.descripcion);
  // Si la descripción es solo la categoría (porque quedó vacía), es muy general para sugerir
  if (!nombre || nombre === normalizar(movimiento.categoria)) return;
  if (descartados.includes(nombre)) return;
  if (fijos.some(function (f) { return normalizar(f.nombre) === nombre; })) return;

  // ¿En cuántos meses anteriores aparece lo mismo?
  const mesActual = movimiento.fecha.slice(0, 7);
  const mesesAnteriores = new Set();
  movimientos.forEach(function (m) {
    if (m.tipo === movimiento.tipo && normalizar(m.descripcion) === nombre && m.fecha.slice(0, 7) !== mesActual) {
      mesesAnteriores.add(m.fecha.slice(0, 7));
    }
  });
  if (mesesAnteriores.size < 2) return;

  sugerenciaPendiente = {
    tipo: movimiento.tipo,
    nombre: movimiento.descripcion,
    monto: movimiento.monto,
    categoria: movimiento.categoria,
    dia: Number(movimiento.fecha.slice(8)),
    modo: "confirmar"
  };
  document.getElementById("sugerencia-texto").textContent =
    "\u201C" + movimiento.descripcion + "\u201D aparece en " + (mesesAnteriores.size + 1) +
    " meses distintos. Si lo agregas como fijo, la app te lo recuerda o lo anota sola cada mes.";
  setTimeout(function () {
    document.getElementById("modal-sugerencia").classList.add("abierto");
  }, 400);
}

function descartarSugerencia() {
  if (sugerenciaPendiente) {
    descartados.push(normalizar(sugerenciaPendiente.nombre));
    guardarLista(CLAVE_DESCARTADOS, descartados);
  }
  sugerenciaPendiente = null;
  document.getElementById("modal-sugerencia").classList.remove("abierto");
}

function aceptarSugerencia() {
  const datos = sugerenciaPendiente;
  sugerenciaPendiente = null;
  document.getElementById("modal-sugerencia").classList.remove("abierto");
  if (datos) abrirFormularioFijo(null, datos);
}


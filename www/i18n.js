/* ============================================================
   FinanZapp — Idioma y moneda
   Detecta el idioma y la moneda del celular, y permite cambiarlos
   en Configuración. Se carga antes que app.js.
   ============================================================ */

// -------------------- CONFIGURACIÓN REGIONAL --------------------
const CLAVE_IDIOMA = "finanzapp_idioma";
const CLAVE_MONEDA = "finanzapp_moneda";

const IDIOMAS = { es: "Español", en: "English", pt: "Português" };
const LOCALE_POR_IDIOMA = { es: "es-CO", en: "en-US", pt: "pt-BR" };   // si el celular no trae país

// Idioma y país del celular, ej. "es-CO" -> idioma "es", país "CO"
const LOCALE_DISPOSITIVO = (navigator.languages && navigator.languages[0]) || navigator.language || "es-CO";
const IDIOMA_DISPOSITIVO = LOCALE_DISPOSITIVO.split("-")[0].toLowerCase();
const PAIS_DISPOSITIVO = (LOCALE_DISPOSITIVO.split("-")[1] || "").toUpperCase();

const MONEDA_POR_PAIS = {
  CO: "COP", MX: "MXN", AR: "ARS", CL: "CLP", PE: "PEN", EC: "USD", BO: "BOB", PY: "PYG",
  UY: "UYU", VE: "VES", GT: "GTQ", HN: "HNL", NI: "NIO", CR: "CRC", PA: "USD", SV: "USD",
  DO: "DOP", PR: "USD", US: "USD", CA: "CAD", BR: "BRL", PT: "EUR", ES: "EUR", FR: "EUR",
  DE: "EUR", IT: "EUR", GB: "GBP", AO: "AOA", MZ: "MZN"
};

// Monedas que se muestran en el selector de Configuración
const MONEDAS = ["COP", "USD", "EUR", "MXN", "ARS", "CLP", "PEN", "BRL", "UYU", "BOB", "PYG",
  "GTQ", "CRC", "DOP", "HNL", "NIO", "VES", "CAD", "GBP", "AOA", "MZN"];

// En la práctica estas monedas no usan centavos
const MONEDAS_SIN_DECIMALES = ["COP", "CLP", "PYG"];

let idioma = leerPreferencia(CLAVE_IDIOMA) || (IDIOMAS[IDIOMA_DISPOSITIVO] ? IDIOMA_DISPOSITIVO : "en");
let moneda = leerPreferencia(CLAVE_MONEDA) || MONEDA_POR_PAIS[PAIS_DISPOSITIVO] || "USD";

function leerPreferencia(clave) {
  try {
    return localStorage.getItem(clave);
  } catch (error) {
    return null;
  }
}

function guardarPreferencia(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch (error) {
    console.error("Error al guardar " + clave + ":", error);
  }
}

// Formato de números y fechas: idioma elegido + país del celular si coinciden (ej. "es-MX", "pt-BR")
function localeApp() {
  if (IDIOMA_DISPOSITIVO === idioma && PAIS_DISPOSITIVO) return idioma + "-" + PAIS_DISPOSITIVO;
  return LOCALE_POR_IDIOMA[idioma];
}

function decimalesMoneda() {
  return MONEDAS_SIN_DECIMALES.includes(moneda) ? 0 : 2;
}

// Nombre de la moneda en el idioma de la app, ej. "peso colombiano"
function nombreMoneda(codigo) {
  try {
    return new Intl.DisplayNames([localeApp()], { type: "currency" }).of(codigo);
  } catch (error) {
    return codigo;
  }
}

// Si el país usa coma decimal, Excel espera punto y coma entre columnas
function usaComaDecimal() {
  return (1.5).toLocaleString(localeApp()).includes(",");
}

// Los campos de monto aceptan centavos solo si la moneda los usa
function ajustarCamposMonto() {
  const decimales = decimalesMoneda();
  ["input-monto", "fijo-monto", "input-presupuesto"].forEach(function (id) {
    const campo = document.getElementById(id);
    if (!campo) return;
    campo.step = decimales ? "0.01" : "1";
    campo.inputMode = decimales ? "decimal" : "numeric";
  });
}

// -------------------- TRADUCCIONES --------------------
// La clave de cada traducción es el texto en español. Si falta una, se muestra

const TRADUCCIONES = {
  en: {
    "Te damos la bienvenida a FinanZapp": "Welcome to FinanZapp",
    "Elige tu idioma y tu moneda. Puedes cambiarlos cuando quieras en Configuración.":
      "Choose your language and currency. You can change them anytime in Settings.",
    "Idioma": "Language",
    "Moneda": "Currency",
    "Empezar": "Get started"
  },
  pt: {
    "Te damos la bienvenida a FinanZapp": "Boas-vindas ao FinanZapp",
    "Elige tu idioma y tu moneda. Puedes cambiarlos cuando quieras en Configuración.":
      "Escolha seu idioma e sua moeda. Você pode alterá-los quando quiser em Configurações.",
    "Idioma": "Idioma",
    "Moneda": "Moeda",
    "Empezar": "Começar"
  }
};

// t("Gastado hoy") -> "Spent today" en inglés. Las {variables} se reemplazan: t("Hola {nombre}", { nombre: "Ana" })
function t(texto, variables) {
  let resultado = (TRADUCCIONES[idioma] && TRADUCCIONES[idioma][texto]) || texto;
  if (variables) {
    Object.keys(variables).forEach(function (clave) {
      resultado = resultado.replace("{" + clave + "}", variables[clave]);
    });
  }
  return resultado;
}

// -------------------- SELECTORES --------------------
function llenarSelectIdioma(select) {
  select.innerHTML = Object.keys(IDIOMAS).map(function (codigo) {
    return '<option value="' + codigo + '">' + IDIOMAS[codigo] + "</option>";
  }).join("");
  select.value = idioma;
}

function llenarSelectMoneda(select) {
  const lista = MONEDAS.includes(moneda) ? MONEDAS : [moneda].concat(MONEDAS);
  select.innerHTML = lista.map(function (codigo) {
    return '<option value="' + codigo + '">' + codigo + " — " + nombreMoneda(codigo) + "</option>";
  }).join("");
  select.value = moneda;
}

function poblarSelectoresRegionales() {
  llenarSelectIdioma(document.getElementById("select-idioma"));
  llenarSelectMoneda(document.getElementById("select-moneda"));
}

function cambiarIdioma(nuevoIdioma) {
  idioma = nuevoIdioma;
  guardarPreferencia(CLAVE_IDIOMA, idioma);
  poblarSelectoresRegionales();   // los nombres de las monedas cambian de idioma
  refrescarTodo();
}

function cambiarMoneda(nuevaMoneda) {
  moneda = nuevaMoneda;
  guardarPreferencia(CLAVE_MONEDA, moneda);
  ajustarCamposMonto();
  refrescarTodo();
}

// -------------------- BIENVENIDA (primera vez) --------------------
function mostrarBienvenida() {
  llenarSelectIdioma(document.getElementById("bienvenida-idioma"));
  llenarSelectMoneda(document.getElementById("bienvenida-moneda"));
  traducirBienvenida();
  document.getElementById("bienvenida").hidden = false;
}

// Al elegir un idioma, la misma pantalla cambia de idioma para que el usuario lo vea al instante
function elegirIdiomaBienvenida(nuevoIdioma) {
  idioma = nuevoIdioma;
  llenarSelectMoneda(document.getElementById("bienvenida-moneda"));   // nombres de monedas en el nuevo idioma
  traducirBienvenida();
}

function traducirBienvenida() {
  document.getElementById("bienvenida-titulo").textContent = t("Te damos la bienvenida a FinanZapp");
  document.getElementById("bienvenida-texto").textContent =
    t("Elige tu idioma y tu moneda. Puedes cambiarlos cuando quieras en Configuración.");
  document.getElementById("bienvenida-etiqueta-idioma").textContent = t("Idioma");
  document.getElementById("bienvenida-etiqueta-moneda").textContent = t("Moneda");
  document.getElementById("bienvenida-boton").textContent = t("Empezar");
}

function terminarBienvenida() {
  guardarPreferencia(CLAVE_IDIOMA, idioma);
  guardarPreferencia(CLAVE_MONEDA, moneda);
  document.getElementById("bienvenida").hidden = true;
  poblarSelectoresRegionales();
  ajustarCamposMonto();
  refrescarTodo();
}

document.addEventListener("DOMContentLoaded", function () {
  poblarSelectoresRegionales();
  ajustarCamposMonto();
  // Si nunca se ha elegido idioma, es la primera vez que se abre la app
  if (leerPreferencia(CLAVE_IDIOMA) === null) mostrarBienvenida();
});
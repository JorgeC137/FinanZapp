# FinanZapp

App para llevar el control de gastos del día a día, mes a mes, y saber en qué se va la plata.

## Créditos

- **Sebastian Torres**: autor de la versión original de la app.
- **Jorge Carrillo** ([@JorgeC137](https://github.com/JorgeC137)): mejoras y nuevas funciones.
- Desarrollado con apoyo de Claude (Anthropic) como asistente de programación.

## Funciones

- Registro rápido de gastos, con ingresos opcionales (no hace falta poner un saldo inicial).
- Vista mes a mes, con lo gastado hoy, el promedio diario y los ingresos del día.
- Botón para ocultar los montos de ingresos y balances.
- Presupuesto mensual opcional.
- Resumen de gastos por categoría.
- Exportar el informe del mes en CSV (Excel o Google Sheets).
- Tema claro y oscuro.
- Calendario para ver un día, una semana o cualquier rango de hasta 31 días.
- Informe anual en CSV (para analizar) y en PDF (con gráfica, para guardar o imprimir).
- Gastos e ingresos fijos, con recordatorio para confirmarlos o anotados automáticamente cada mes.
- Sugerencia automática cuando un gasto se repite en varios meses.

## Próximas mejoras

- Varios idiomas y monedas, para usar la app en otros países.
- Límites por categoría para controlar los gastos hormiga.
- Comparación con el mes anterior.
- Copia de seguridad en Google Drive.

## Tecnologías

HTML, CSS, JavaScript y Capacitor para generar la app de Android.

## Cómo probarla

Instalar dependencias:

```
npm install
```

Para verla en el navegador, abrir `www/index.html` con la extensión Live Server de VS Code.

Para generar el APK (requiere Android Studio):

```
npx cap add android
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```
# ENERSINC Harness

**El asistente de ENERSINC para preguntas de regulación de energía.** Se maneja
como WhatsApp: escribes una pregunta en español y te responde usando la
información de la **CREG** (Comisión de Regulación de Energía y Gas).

No hay que programar nada. Solo copiar un comando, pegar tu llave y escribir tus
preguntas.

> Arriba, en la ventana del asistente, verás el logo de ENERSINC junto al de
> DeepSeek. Así sabes que es el asistente de la empresa.

---

## 1. Instalar (una sola vez)

Abre la **Terminal** (en Windows, **PowerShell**), copia y pega **esta línea** y
pulsa Enter:

**Mac / Linux**

```sh
curl -fsSL https://raw.githubusercontent.com/gamejia/enersinc-harness/main/install.sh | sh
```

**Windows**

```powershell
irm https://raw.githubusercontent.com/gamejia/enersinc-harness/main/install.ps1 | iex
```

Va a trabajar unos minutos (la primera vez descarga cosas). Sigue las
instrucciones en pantalla. **Cuando te pida la llave, pégala y pulsa Enter**: no
se ve mientras la escribes, es normal.

### ¿Qué es "la llave"?

Es como una **contraseña personal** que te da DeepSeek para poder usar el
asistente. Empieza con `sk-`. La pide quien administra la cuenta del equipo. Se
guarda solo en tu computador y no se comparte con nadie.

> Si no tienes llave todavía, deja que el instalador termine y pídesela a quien
> administra el asistente; luego corre `~/.enersinc-harness/scripts/setup-key.sh`
> (o `scripts\setup-key.ps1` en Windows) para agregarla.

## 2. Usarlo

### Abrir la ventana del asistente

Copia y pega:

**Mac / Linux**

```sh
~/.enersinc-harness/scripts/web.sh
```

**Windows**

```powershell
powershell -ExecutionPolicy Bypass -File $env:USERPROFILE\.enersinc-harness\scripts\web.ps1
```

Se abre el asistente en el navegador. Escribe tu pregunta como se la harías a un
compañero.

### O hacer una sola pregunta aquí mismo

**Mac / Linux**

```sh
~/.enersinc-harness/scripts/run.sh "¿Qué es el Mecanismo de Sostenimiento de la Confiabilidad?"
```

**Windows**

```powershell
powershell -ExecutionPolicy Bypass -File $env:USERPROFILE\.enersinc-harness\scripts\run.ps1 "¿Qué es el Mecanismo de Sostenimiento de la Confiabilidad?"
```

## 3. Qué le puedes preguntar

Ejemplos reales:

- "¿Qué es el Mecanismo de Sostenimiento de la Confiabilidad?"
- "Explícame cómo funciona el cargo por confiabilidad."
- "¿Qué dice la CREG sobre las tarifas de energía para usuarios residenciales?"
- "Resume la última resolución sobre comercialización de energía."

El asistente responde con lo que encuentre en la CREG. Si algo no lo sabe, te lo
dice en vez de inventarlo.

## 4. Si algo no funciona

| Lo que ves | Qué hacer |
| --- | --- |
| "no pude levantar el servicio CREG" | Cierra la ventana y vuelve a abrirla con el comando del punto 2. |
| "falta tu llave" o no responde nada | Corre `~/.enersinc-harness/scripts/setup-key.sh` (o `scripts\setup-key.ps1` en Windows) y pega tu llave. |
| Te cambió la llave | Corre `scripts/setup-key.sh` (o `scripts\setup-key.ps1`) y pega la nueva. |
| Cualquier otra cosa | Corre `~/.enersinc-harness/scripts/doctor.sh` y envía lo que salga a soporte. |

## 5. Requisitos

Solo necesitas **Node.js** y **git** instalados. Si no los tienes, pídele a
soporte que te los instale (o corre el instalador y sigue las instrucciones que
aparezcan). El resto lo hace solo.

---

<details>
<summary><strong>Para el área técnica</strong> (arquitectura, variables, cómo se modificó la interfaz)</summary>

### Qué es

Un **DeepSeek Harness** congelado (ver [`dsh.lock`](dsh.lock), tag
`dsh-v0.2.1-alpha.2`) más:

- un **plugin de cliente** que pone el logo ENERSINC en la barra lateral
  (`sidebar.brand.name`) sin tocar el núcleo del harness
  ([`docs/BRANDING.md`](docs/BRANDING.md));
- la capacidad **CREG** como bundle nativo (`creg_ask`, `creg_health`,
  `creg_stats`) activa por defecto en los perfiles `enersinc` y `enersinc-cli`
  ([`docs/CREG.md`](docs/CREG.md));
- el servicio CREG local en `services/creg/` (Express + cliente, modo `direct`
  sin Chromium).

### Estructura

```
install.sh · install.ps1        instaladores de una línea
scripts/setup.sh                congela dsh, aplica marca, pide la llave, crea perfiles
scripts/setup-key.sh · .ps1     cambiar/agregar la llave
scripts/run.sh · web.sh         ejecución headless / interfaz web
scripts/run.ps1 · web.ps1       equivalentes Windows
scripts/doctor.sh               diagnóstico
scripts/lib.sh                  utilidades (llave, .env)
scripts/brand/apply.mjs         aplica el overlay de marca al checkout de dsh
scripts/brand/gen-logo.mjs      regenera el componente del logo
branding/dsh-client-ui-brand-enersinc/   plugin de marca (Web UI)
packages/dsh-bundle-creg/       plugin nativo creg_*
packages/mcp-creg/              puente MCP (opcional)
services/creg/                  servicio CREG
skills/uso-de-creg/             skill que orienta al modelo
docs/                           arquitectura, marca, CREG
```

### Variables y configuración

- La llave se guarda en `.env` (`DEEPSEEK_API_KEY`), que **no** se sube al repo
  (está en `.gitignore`). La interfaz los esconde tras el prompt del instalador.
- Sin interacción: `DEEPSEEK_API_KEY=sk-... ./scripts/setup.sh`.
- Volver a pedir la llave: `ENERSINC_FORCE_KEY=1 ./scripts/setup.sh`.
- CREG: `CREG_URL` (default `http://127.0.0.1:3100`), `CREG_MODE` (`direct` por
  defecto).
- Título de la pestaña: `DSH_CLIENT_TITLE` (default `ENERSINC Harness`).
- Omitir la marca: `ENERSINC_SKIP_BRAND=1 ./scripts/setup.sh`.

### Verificación

```bash
bash scripts/ci-check.sh      # sintaxis, generador de logo y overlay idempotente
./scripts/doctor.sh           # entorno, marca y CREG
```

### Licencia

[MIT](LICENSE). El logo ENERSINC es marca de ENERSINC. "DeepSeek Harness" es
marca de DeepSeek; este es un proyecto independiente de ENERSINC, no afiliado ni
patrocinado por DeepSeek.

</details>

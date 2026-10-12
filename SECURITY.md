# Seguridad

## Alcance

Este repo orquesta un harness local. No incluye servidores de producción ni
recibe tráfico de Internet.

## Secretos

- **Nunca** subas `.env` (está en `.gitignore`). Usa `.env.example` como
  plantilla y pega tu `DEEPSEEK_API_KEY` localmente.
- Este repo no contiene ninguna llave.

## Superficie local

- El servicio CREG (`services/creg`) escucha en `127.0.0.1:3100` por defecto.
  **No** lo expongas a redes no confiables sin autenticación por delante.
- El modo `browser` usa Playwright/Chromium; el modo `direct` (default) no abre
  navegador.
- El build del harness descarga paquetes desde npm y clona
  `deepseek-ai/deepseek-harness` en el tag fijado en `dsh.lock`.

## Reportar

Abre un *issue* privado o contacta al equipo de ENERSINC con:
- versión de Node y sistema operativo,
- salida de `./scripts/doctor.sh`,
- pasos para reproducir.

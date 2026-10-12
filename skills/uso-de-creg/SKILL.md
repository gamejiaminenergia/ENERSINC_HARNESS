---
name: uso-de-creg
description: Como consultar al asistente de la CREG (Comision de Regulacion de Energia y Gas de Colombia) usando las herramientas del cliente CREG.
whenToUse: Cuando el usuario pregunte por regulacion energetica o de gas colombiana, tarifas, confiabilidad, mercados, normativa, resoluciones o conceptos de la CREG.
---

# Uso del cliente CREG desde el harness

El **CREG AI Client** (`regulatorio/`) es un servicio que consulta al asistente de
IA de la **Comision de Regulacion de Energia y Gas** de Colombia y devuelve
respuestas estructuradas (titulo, contenido, enlaces, listas).

## Herramientas disponibles

Todas se llaman con el prefijo `mcp__creg__` (o `creg_*` si usas el plugin nativo):

| Herramienta | Para que |
| --- | --- |
| `creg_health` | Comprobar que el servicio responde (modo y pool). **Llamala primero** si algo falla. |
| `creg_ask` | Hacer **una** pregunta sobre regulacion. Puede tardar 12-180 s. |
| `creg_stats` | Ver pool, cola y cache. |

## Como preguntar bien

- **Una pregunta por llamada**, en lenguaje natural y concreta.
- **Se consistente** con la frase: la cache ignora mayusculas y espacios, asi que
  la misma pregunta repetida sale instantanea.
- Preguntas normales: `timeout` 180000 ms. Complejas: hasta 300000 ms.
- Si recibes error `504` (timeout), **reintenta la misma pregunta**.
- El sistema responde sobre: regulacion energia/gas, tarifas, confiabilidad,
  mercados, normativa CREG, resoluciones.

## Respuesta

`creg_ask` devuelve `{ success, data: { title, content, rawHtml, links, lists } }`.
Usa `data.title` y `data.content` para responder; cita los `links` cuando aporten.

## Reglas

- **Cita la norma o el concepto** que traiga la respuesta (no inventes resoluciones).
- Si `creg_health` falla, di que el servicio CREG no esta levantado y para.
- No uses `creg_ask` para aritmetica ni para datos que ya tengas.

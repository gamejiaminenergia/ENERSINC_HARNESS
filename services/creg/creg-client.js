const crypto = require('crypto');

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000;
const MAX_STABLE_CHECKS = 3;
const STABLE_CHECK_INTERVAL = 1500;
// La CREG migró su asistente a una UI Angular ("Alejandría 2.0") que renderiza
// la respuesta inline en un panel. Las versiones antiguas usaban un iframe.
const RESPONSE_PANEL_ID = 'ia-respuesta-panel';
const ANSWER_SELECTOR = '[class*="panel-respuesta-ia-externa__respuesta"]';
const ERROR_SELECTOR = '[class*="estado--error"], [class*="respuesta-automatica__mensaje--error"]';
const MIN_ANSWER_LENGTH = 50;

// Endpoint que consume la propia web de la CREG (Alejandría v3) y base de los
// documentos citados. Permiten responder sin abrir un navegador.
const DIRECT_API_URL = process.env.CREG_API_URL || 'https://gacetas-constitucion.normograma.com/creg3/conversation';
const DOC_BASE_URL = process.env.CREG_DOC_BASE_URL || 'https://gestornormativo.creg.gov.co/gestor/entorno/docs/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// auto = intenta la API directa y cae al navegador si falla | direct | browser
const CREG_MODE = (process.env.CREG_MODE || 'auto').toLowerCase();

function stripCitationMarkers(markdown) {
  let clean = markdown
    .replace(/\[doc\d+\]/g, '')
    .replace(/[ \t]+([.,;:)])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  // La lista final de referencias se entrega aparte, en "links"
  const referencesAt = clean.search(/\n\s*(?:-{3,}\s*\n\s*)?\*{0,2}Referencias\*{0,2}\s*:?\s*(?:\n|$)/i);
  if (referencesAt > 0) clean = clean.slice(0, referencesAt);

  return clean
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

class CregDirectClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 180000;
  }

  async ask(question) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(DIRECT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'User-Agent': USER_AGENT,
          'Origin': 'https://gestornormativo.creg.gov.co',
          'Referer': 'https://gestornormativo.creg.gov.co/'
        },
        body: JSON.stringify({
          messages: [{
            id: crypto.randomUUID(),
            role: 'user',
            content: question,
            date: new Date().toISOString()
          }]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`API CREG respondió HTTP ${response.status}`);
      }

      const { content, citations } = await this._readStream(response);
      const built = this._buildResponse(content, citations);
      if (!built.content) throw new Error('API CREG devolvió una respuesta vacía');
      return built;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(`API CREG agotó el tiempo (${this.timeout}ms)`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async _readStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let citations = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
        let chunk;
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }

        const messages = (chunk.choices && chunk.choices[0] && chunk.choices[0].messages) || [];
        for (const message of messages) {
          if (message.role === 'assistant' && message.content) {
            content += message.content;
          } else if (message.role === 'tool' && message.content) {
            try {
              const parsed = JSON.parse(message.content);
              if (Array.isArray(parsed.citations) && parsed.citations.length) {
                citations = parsed.citations;
              }
            } catch {
              // El mensaje de herramienta no siempre es JSON válido
            }
          }
        }
      }
    }

    return { content, citations };
  }

  _buildResponse(rawContent, citations) {
    const clean = stripCitationMarkers(rawContent);
    const headingMatch = clean.match(/^#{1,6}\s+(.+)$/m);
    const title = headingMatch
      ? headingMatch[1].trim()
      : (clean.split('\n')[0] || '').slice(0, 200).trim();

    let content = clean;
    if (headingMatch && clean.startsWith('#')) {
      content = clean.replace(/^#{1,6}\s+.+\n?/, '').trim();
    }

    const links = [];
    const seen = new Set();
    for (const citation of citations) {
      const name = (citation.title || '').trim();
      if (!name) continue;

      const isDocument = /\.(?:html?|pdf|docx?|xlsx?)$/i.test(name);
      const href = citation.url || citation.filepath || (isDocument ? DOC_BASE_URL + name : null);
      if (!href || seen.has(href)) continue;

      seen.add(href);
      links.push({
        text: name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim(),
        href
      });
    }

    const lists = [];
    let current = null;
    for (const line of content.split('\n')) {
      const bullet = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)$/);
      if (bullet && bullet[1].trim()) {
        if (!current) {
          current = [];
          lists.push(current);
        }
        current.push(bullet[1].trim());
      } else if (!line.trim()) {
        current = null;
      }
    }

    return {
      title,
      content,
      rawHtml: rawContent,
      links,
      lists,
      mode: 'direct'
    };
  }
}

class BrowserManager {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.timeout = options.timeout || 180000;
    this.browser = null;
    this.page = null;
    this.failedRequests = 0;
  }

  async init() {
    const { chromium } = require('playwright');
    this.browser = await chromium.launch({
      headless: this.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const context = await this.browser.newContext({
      userAgent: USER_AGENT
    });
    this.page = await context.newPage();

    // Capturar crashes de página para recuperación automática
    this.page.on('crash', () => {
      console.error('[BrowserManager] Page crashed, marking for recovery');
      this.page = null;
    });

    this.page.on('close', () => {
      this.page = null;
    });

    await this._navigateToBase();
  }

  async _navigateToBase() {
    const baseUrl = process.env.BASE_URL || 'https://gestornormativo.creg.gov.co/gestor/entorno/respuestas.html';
    await this.page.goto(baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: this.timeout
    });
    await this.page.waitForSelector('#editor', { timeout: 15000 });
    // Pequeña pausa para que termine de cargar cualquier script
    await this.page.waitForTimeout(500);
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        console.error('[BrowserManager] Error closing browser:', e.message);
      }
      this.browser = null;
      this.page = null;
    }
  }

  async isHealthy() {
    try {
      if (!this.page || !this.browser) return false;
      // Verificar que la aplicación siga viva. El editor desaparece mientras se
      // muestra una respuesta, así que también se acepta el panel de respuesta.
      const result = await this.page.evaluate(() => {
        const alive = document.readyState === 'complete' || document.readyState === 'interactive';
        const app = !!(
          document.getElementById('editor') ||
          document.getElementById('generateButton') ||
          document.getElementById('ia-respuesta-panel')
        );
        return { alive, app };
      }).catch(() => null);
      return !!(result && result.alive && result.app);
    } catch {
      return false;
    }
  }

  async recover() {
    console.log('[BrowserManager] Attempting recovery...');
    try {
      await this.close();
    } catch {}
    await this.init();
    this.failedRequests = 0;
    console.log('[BrowserManager] Recovery successful');
  }

  getPage() {
    return this.page;
  }
}

class CregClient {
  constructor(options = {}) {
    this.mode = (options.mode || CREG_MODE).toLowerCase();
    this.browserManager = new BrowserManager(options);
    this.directClient = new CregDirectClient(options);
    this.page = null;
  }

  usesBrowser() {
    return this.mode === 'browser';
  }

  async init() {
    await this.browserManager.init();
    this.page = this.browserManager.getPage();
  }

  async ask(question) {
    if (this.mode !== 'browser') {
      try {
        return await this.directClient.ask(question);
      } catch (error) {
        if (this.mode === 'direct') throw error;
        console.warn(`[CregClient] Consulta directa falló (${error.message}), usando navegador...`);
      }
    }

    return this._askWithBrowser(question);
  }

  async _askWithBrowser(question) {
    if (!this.page) await this.init();

    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this._attemptAsk(question);
      } catch (error) {
        lastError = error;
        console.warn(`[CregClient] Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1) + Math.random() * 1000;
          console.log(`[CregClient] Retrying in ${Math.round(delay / 1000)}s...`);
          await this._sleep(delay);

          // Si el error es de crash/navegador, intentar recuperar
          if (error.message.includes('crash') || error.message.includes('closed') ||
              error.message.includes('detached') || error.message.includes('Target closed')) {
            console.log('[CregClient] Browser issue detected, re-initializing...');
            await this.browserManager.recover();
            this.page = this.browserManager.getPage();
          } else {
            // Intentar resetear la página antes de reintentar
            await this._resetPage();
          }
        }
      }
    }

    throw new Error(`Failed after ${MAX_RETRIES} attempts. Last error: ${lastError.message}`);
  }

  async _attemptAsk(question) {
    // 1. Resetear la página para un nuevo query (sin reload completo si es posible)
    await this._resetPage();

    // 2. Escribir la pregunta en el editor
    await this._setQuestion(question);

    // 3. Hacer clic en el botón de generar
    await this._clickGenerate();

    // 4. Esperar a que aparezca la respuesta (panel inline v3 o iframe legado)
    const target = await this._waitForResponse();
    if (!target) throw new Error('No response found - page did not generate a response');

    // 5. Esperar a que el contenido se estabilice y extraer la respuesta
    let response;
    if (target.kind === 'panel') {
      await this._waitForPanelStable();
      response = await this._extractPanelResponse();
    } else {
      await this._waitForContentStable(target.frame);
      response = await this._extractResponse(target.frame);
    }

    // 6. Verificar que la respuesta no esté vacía
    if (!response.content || response.content.trim().length < 10) {
      throw new Error('Response content is too short or empty');
    }

    this.browserManager.failedRequests = 0;
    return response;
  }

  async _resetPage() {
    try {
      if (!this.page || !await this._isPageAlive()) {
        await this.browserManager.recover();
        this.page = this.browserManager.getPage();
        return;
      }

      // v3: el botón "Nueva consulta" reinicia la vista y el estado de Angular
      if (await this.page.$('#newQueryButton')) {
        await this.page.click('#newQueryButton').catch(() => {});
        await this.page.waitForTimeout(400);
      }

      // Intentar resetear la página sin recargar: limpiar editor y eliminar iframe
      await this.page.evaluate(() => {
        const editor = document.getElementById('editor');
        if (editor) {
          editor.innerHTML = '';
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        // Eliminar iframes de respuestas anteriores
        document.querySelectorAll('iframe').forEach(iframe => iframe.remove());
      });
    } catch {
      // Si falla el reset, recargar la página
      console.warn('[CregClient] Page reset failed, reloading...');
      await this._reloadPage();
    }
  }

  async _isPageAlive() {
    try {
      await this.page.evaluate(() => document.readyState);
      return true;
    } catch {
      return false;
    }
  }

  async _reloadPage() {
    const baseUrl = process.env.BASE_URL || 'https://gestornormativo.creg.gov.co/gestor/entorno/respuestas.html';
    await this.page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: this.browserManager.timeout });
    await this.page.waitForSelector('#editor', { timeout: 15000 });
    await this.page.waitForTimeout(500);
  }

  async _setQuestion(question) {
    // La UI v3 (Angular) sólo habilita el botón "Consultar" cuando el evento de
    // entrada es real, por eso se escribe con el teclado en vez de innerHTML.
    const editor = await this.page.$('#editor');
    if (!editor) throw new Error('Editor not found');

    try {
      await editor.click({ timeout: 10000 });
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
      await this.page.keyboard.press(`${modifier}+A`).catch(() => {});
      await this.page.keyboard.press('Delete').catch(() => {});
      await this.page.keyboard.insertText(question);
      await this.page.waitForTimeout(200);
    } catch (error) {
      // Fallback para la UI antigua (basada en innerHTML)
      console.warn(`[CregClient] Fallback al escribir la pregunta: ${error.message}`);
      await this.page.evaluate(q => {
        const el = document.getElementById('editor');
        if (!el) throw new Error('Editor not found');
        el.innerHTML = q;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, question);
    }

    const written = await this.page.evaluate(() => {
      const el = document.getElementById('editor');
      return el ? el.innerText.trim() : '';
    }).catch(() => '');
    if (!written) throw new Error('Question could not be written into the editor');
  }

  async _clickGenerate() {
    // El botón permanece deshabilitado hasta que el editor tiene contenido
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('generateButton');
      return btn && !btn.disabled;
    }, { timeout: 15000 }).catch(() => {});

    const button = await this.page.$('#generateButton');
    if (!button) throw new Error('Generate button not found');

    try {
      await button.click({ timeout: 10000 });
    } catch {
      await this.page.evaluate(() => {
        const btn = document.getElementById('generateButton');
        if (!btn) throw new Error('Generate button not found');
        btn.click();
      });
    }
  }

  async _readPanelState() {
    return this.page.evaluate(({ panelId, answerSel, errorSel }) => {
      const panel = document.getElementById(panelId);
      if (!panel) return null;
      const answer = panel.querySelector(answerSel);
      const error = panel.querySelector(errorSel);
      return {
        answerLength: answer ? answer.innerText.trim().length : 0,
        error: error ? error.innerText.trim().slice(0, 300) : ''
      };
    }, { panelId: RESPONSE_PANEL_ID, answerSel: ANSWER_SELECTOR, errorSel: ERROR_SELECTOR }).catch(() => null);
  }

  async _waitForResponse() {
    const start = Date.now();
    const maxWait = this.browserManager.timeout;

    while (Date.now() - start < maxWait) {
      // Si la página se cayó, salir inmediatamente para que el retry lo maneje
      if (!this.page) return null;

      const panelState = await this._readPanelState();
      if (panelState) {
        if (panelState.error) throw new Error(`CREG devolvió un error: ${panelState.error}`);
        if (panelState.answerLength >= MIN_ANSWER_LENGTH) return { kind: 'panel' };
      }

      try {
        const iframe = this.page.frames().find(f => f !== this.page.mainFrame());
        if (iframe) {
          const hasContent = await iframe.evaluate(() => {
            return document.body && document.body.children.length > 0;
          }).catch(() => false);

          if (hasContent) return { kind: 'iframe', frame: iframe };
        }
      } catch {
        // Ignorar errores de evaluación, reintentar
      }
      await this._sleep(500);
    }
    return null;
  }

  async _waitForPanelStable() {
    const start = Date.now();
    const maxWait = this.browserManager.timeout;
    let stableCount = 0;
    let lastContent = '';

    while (Date.now() - start < maxWait) {
      if (!this.page) return;

      await this._sleep(STABLE_CHECK_INTERVAL);

      try {
        const content = await this.page.evaluate(({ panelId, answerSel }) => {
          const panel = document.getElementById(panelId);
          if (!panel) return '';
          const answer = panel.querySelector(answerSel);
          return answer ? answer.innerText.trim() : '';
        }, { panelId: RESPONSE_PANEL_ID, answerSel: ANSWER_SELECTOR });

        if (content.length >= MIN_ANSWER_LENGTH && content === lastContent) {
          stableCount++;
          if (stableCount >= MAX_STABLE_CHECKS) {
            console.log(`[CregClient] Content stable (${content.length} chars)`);
            return;
          }
        } else if (content.length >= MIN_ANSWER_LENGTH) {
          stableCount = 0;
          lastContent = content;
        }
      } catch {
        stableCount = 0;
      }
    }
    console.warn('[CregClient] Content stability wait timed out, proceeding with current content');
  }

  async _waitForIframe() {
    const start = Date.now();
    const maxWait = this.browserManager.timeout;

    while (Date.now() - start < maxWait) {
      // Si la página se cayó, salir inmediatamente para que el retry lo maneje
      if (!this.page) return null;

      try {
        const iframe = this.page.frames().find(f => f !== this.page.mainFrame());
        if (iframe) {
          // Verificar que el iframe tenga contenido
          const hasContent = await iframe.evaluate(() => {
            return document.body && document.body.children.length > 0;
          }).catch(() => false);

          if (hasContent) return iframe;
        }
      } catch {
        // Ignorar errores de evaluación, reintentar
      }
      await this._sleep(500);
    }
    return null;
  }

  async _waitForContentStable(frame) {
    const start = Date.now();
    const maxWait = this.browserManager.timeout;
    let stableCount = 0;
    let lastFullContent = '';
    const MIN_CONTENT_LENGTH = 80; // Ignorar mensajes de carga tipo "Analizando..."

    while (Date.now() - start < maxWait) {
      // Si la página se cayó durante la espera, salir inmediatamente
      if (!this.page) return;

      await this._sleep(STABLE_CHECK_INTERVAL);

      try {
        // Monitorear el contenido total del iframe (body.innerText)
        const fullContent = await frame.evaluate(() => {
          return document.body ? document.body.innerText.trim() : '';
        });

        // Solo considerar estable si hay suficiente contenido (ignorar "Analizando...")
        if (fullContent.length >= MIN_CONTENT_LENGTH && fullContent === lastFullContent) {
          stableCount++;
          if (stableCount >= MAX_STABLE_CHECKS) {
            console.log(`[CregClient] Content stable (${fullContent.length} chars)`);
            return;
          }
        } else if (fullContent.length >= MIN_CONTENT_LENGTH) {
          // Nuevo contenido real detectado
          stableCount = 0;
          lastFullContent = fullContent;
        } else if (fullContent.length > 0 && fullContent !== lastFullContent) {
          // Contenido de carga (ej: "Analizando..."), registrar pero no contar como estable
          lastFullContent = fullContent;
        }
      } catch {
        stableCount = 0;
      }
    }

    console.warn('[CregClient] Content stability wait timed out, proceeding with current content');
  }

  async _extractResponse(frame) {
    return frame.evaluate(() => {
      const titleEl = document.querySelector('h2');
      const title = titleEl ? titleEl.textContent.trim() : '';

      // Capturar TODO el contenido después del h2 (no solo el primer hermano)
      let content = '';
      if (titleEl && titleEl.parentElement) {
        // Recorrer todos los hermanos que siguen al h2
        let el = titleEl.nextElementSibling;
        const parts = [];
        while (el) {
          const text = el.textContent.trim();
          if (text && !parts.includes(text)) {
            parts.push(text);
          }
          el = el.nextElementSibling;
        }
        content = parts.join('\n\n');
      }

      // Fallback: body completo si no hay contenido capturado
      if (!content) {
        content = document.body.innerText.trim();
      }

      // Extraer todos los enlaces
      const links = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim(),
        href: a.href
      }));

      // Extraer todas las listas
      const lists = Array.from(document.querySelectorAll('ul, ol')).map(list =>
        Array.from(list.querySelectorAll('li')).map(li => li.textContent.trim())
      );

      return {
        title,
        content,
        rawHtml: document.body.innerHTML,
        links,
        lists
      };
    });
  }

  async _extractPanelResponse() {
    return this.page.evaluate(({ panelId, answerSel }) => {
      const panel = document.getElementById(panelId);
      if (!panel) throw new Error('Response panel not found');

      const answerEl = panel.querySelector(answerSel);
      const source = answerEl || panel;

      // Copia sin los marcadores de nota "(1)" para obtener texto limpio
      const clone = source.cloneNode(true);
      clone.querySelectorAll('[class*="nota-enlace"]').forEach(node => node.remove());

      const titleEl = clone.querySelector('h1, h2, h3');
      const title = titleEl ? titleEl.textContent.trim() : '';

      let content = '';
      if (titleEl && titleEl.parentElement) {
        let el = titleEl.nextElementSibling;
        const parts = [];
        while (el) {
          const text = el.textContent.trim();
          if (text && !parts.includes(text)) parts.push(text);
          el = el.nextElementSibling;
        }
        content = parts.join('\n\n');
      }
      if (!content) content = clone.innerText.trim();

      const links = Array.from(panel.querySelectorAll('a'))
        .map(a => ({ text: a.textContent.trim(), href: a.href }))
        .filter(link => link.text && /^https?:/i.test(link.href));

      const lists = Array.from(clone.querySelectorAll('ul, ol')).map(list =>
        Array.from(list.querySelectorAll('li')).map(li => li.textContent.trim())
      );

      return {
        title,
        content,
        rawHtml: source.innerHTML,
        links,
        lists
      };
    }, { panelId: RESPONSE_PANEL_ID, answerSel: ANSWER_SELECTOR });
  }

  format(response) {
    if (!response) return 'Sin respuesta';

    let formatted = '';

    if (response.title) {
      formatted += `## ${response.title}\n\n`;
    }

    if (response.content) {
      formatted += response.content + '\n\n';
    }

    if (response.lists && response.lists.length > 0) {
      formatted += '### Listas:\n';
      for (const list of response.lists) {
        for (const item of list) {
          formatted += `- ${item}\n`;
        }
      }
    }

    if (response.links && response.links.length > 0) {
      formatted += '\n### Enlaces:\n';
      for (const link of response.links) {
        if (link.text && link.href) {
          formatted += `- [${link.text}](${link.href})\n`;
        }
      }
    }

    return formatted.trim();
  }

  async close() {
    await this.browserManager.close();
  }

  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CregClient;

if (require.main === module) {
  const question = process.argv[2];
  if (!question) {
    console.log('Usage: node creg-client.js "tu pregunta aquí"');
    process.exit(1);
  }

  (async () => {
    const client = new CregClient({ headless: true });
    try {
      const resp = await client.ask(question);
      console.log(client.format(resp));
    } catch (e) {
      console.error('Error:', e.message);
      process.exit(1);
    } finally {
      await client.close();
    }
  })();
}

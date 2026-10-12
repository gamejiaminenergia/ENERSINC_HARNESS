const express = require('express');
const CregClient = require('./creg-client');

const app = express();
app.use(express.json({ limit: '100kb' }));

const CONFIG = {
  poolSize: parseInt(process.env.POOL_SIZE) || 2,
  queueLimit: parseInt(process.env.QUEUE_LIMIT) || 10,
  defaultTimeout: parseInt(process.env.TIMEOUT) || 180000,
  cacheMaxAge: parseInt(process.env.CACHE_MAX_AGE) || 3600000,
  maxFailedRequests: parseInt(process.env.MAX_FAILED) || 3,
  healthCheckInterval: parseInt(process.env.HEALTH_INTERVAL) || 60000,
  // auto = API directa con respaldo en navegador | direct | browser
  cregMode: (process.env.CREG_MODE || 'auto').toLowerCase(),
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT) || 0
};

// En modo navegador la concurrencia está limitada por el pool de Chromium;
// en modo directo cada request es una simple llamada HTTP.
if (!CONFIG.maxConcurrent) {
  CONFIG.maxConcurrent = CONFIG.cregMode === 'browser' ? CONFIG.poolSize : 4;
}

const browserPool = [];
const requestQueue = [];
let activeRequests = 0;
const responseCache = new Map();
const pendingRequests = new Map(); // Para cancelar requests si es necesario
let nextRequestId = 0;

class PooledCregClient {
  constructor() {
    this.client = null;
    this.inUse = false;
    this.failedRequests = 0;
    this.lastUsed = 0;
  }

  async get() {
    if (!this.client) {
      this.client = new CregClient({ headless: true, timeout: CONFIG.defaultTimeout, mode: CONFIG.cregMode });
      if (this.client.usesBrowser()) await this.client.init();
    }
    return this.client;
  }

  markInUse() {
    this.inUse = true;
    this.lastUsed = Date.now();
  }

  markFree() {
    this.inUse = false;
  }

  isFree() {
    return !this.inUse;
  }

  recordFailure() {
    this.failedRequests++;
  }

  async isHealthy() {
    if (!this.client) return true;
    // En modo directo no hay navegador que revisar
    if (!this.client.usesBrowser()) return true;
    try {
      return await this.client.browserManager.isHealthy();
    } catch {
      return false;
    }
  }

  async recycle() {
    console.log('[Pool] Recycling browser client...');
    try {
      if (this.client) await this.client.close();
    } catch {}
    this.client = null;
    this.failedRequests = 0;
    await this.get();
    console.log('[Pool] Browser client recycled successfully');
  }
}

async function initPool() {
  const wrappers = CONFIG.cregMode === 'browser'
    ? CONFIG.poolSize
    : Math.max(CONFIG.poolSize, CONFIG.maxConcurrent);

  for (let i = 0; i < wrappers; i++) {
    browserPool.push(new PooledCregClient());
  }

  if (CONFIG.cregMode === 'browser') {
    console.log(`[Pool] Inicializando pool de ${CONFIG.poolSize} navegadores...`);
    const initPromises = browserPool.map((pooledClient, i) =>
      pooledClient.get().then(() => {
        console.log(`[Pool] Navegador ${i + 1}/${CONFIG.poolSize} listo`);
      }).catch(err => {
        console.error(`[Pool] Error inicializando navegador ${i + 1}:`, err.message);
      })
    );
    await Promise.allSettled(initPromises);
    console.log(`[Pool] Pool inicializado (${browserPool.filter(c => c.client).length}/${CONFIG.poolSize} disponibles)`);
  } else {
    console.log(`[Pool] Modo ${CONFIG.cregMode}: consultas por API directa (max ${CONFIG.maxConcurrent} en paralelo). Los navegadores quedan como respaldo y se abren sólo si se necesitan.`);
  }

  // Iniciar health checks periódicos
  startHealthChecks();
}

function getFreeClient() {
  return browserPool.find(c => c.isFree());
}

function getBestClient() {
  // Preferir clientes con menos fallos
  const free = browserPool.filter(c => c.isFree());
  if (free.length === 0) return null;
  return free.reduce((best, current) =>
    current.failedRequests < best.failedRequests ? current : best
  );
}

let healthCheckTimer = null;

function startHealthChecks() {
  healthCheckTimer = setInterval(async () => {
    for (let i = 0; i < browserPool.length; i++) {
      const pooled = browserPool[i];
      if (pooled.inUse) continue; // No molestar a los que están en uso

      try {
        const healthy = await pooled.isHealthy();
        if (!healthy) {
          console.warn(`[HealthCheck] Browser ${i + 1} unhealthy, recycling...`);
          await pooled.recycle();
        } else if (pooled.failedRequests >= CONFIG.maxFailedRequests) {
          console.warn(`[HealthCheck] Browser ${i + 1} has ${pooled.failedRequests} failures, recycling...`);
          await pooled.recycle();
        }
      } catch (err) {
        console.error(`[HealthCheck] Error checking browser ${i + 1}:`, err.message);
        try {
          await pooled.recycle();
        } catch {}
      }
    }
  }, CONFIG.healthCheckInterval);
}

const crypto = require('crypto');

function generateCacheKey(question) {
  const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function getFromCache(question) {
  const key = generateCacheKey(question);
  const cached = responseCache.get(key);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CONFIG.cacheMaxAge) {
      console.log(`[Cache] Hit para: ${question.slice(0, 50)}...`);
      return cached.response;
    }
    responseCache.delete(key);
  }
  return null;
}

function saveToCache(question, response) {
  const key = generateCacheKey(question);
  responseCache.set(key, {
    response,
    timestamp: Date.now()
  });
  // Limitar tamaño del cache a 1000 entradas para evitar memory leak
  if (responseCache.size > 1000) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
}

async function processQueue() {
  while (requestQueue.length > 0 && activeRequests < CONFIG.maxConcurrent) {
    const entry = requestQueue.shift();
    processRequest(entry.req, entry.res, entry.question, entry.timeout).catch(() => {});
  }
}

async function processRequest(req, res, question, timeout) {
  const cached = getFromCache(question);
  if (cached) {
    return res.json({ success: true, data: cached, cached: true });
  }

  if (activeRequests >= CONFIG.maxConcurrent) {
    console.log(`[Queue] Pool lleno, encolando request (cola: ${requestQueue.length})`);
    requestQueue.push({
      req, res, question, timeout
    });
    return;
  }

  activeRequests++;
  const clientWrapper = getBestClient();
  if (!clientWrapper) {
    activeRequests--;
    return res.status(503).json({
      success: false,
      error: 'No hay navegadores disponibles, intente de nuevo'
    });
  }

  clientWrapper.markInUse();

  // Configurar timeout por request
  const requestTimeout = timeout || CONFIG.defaultTimeout;
  const requestId = nextRequestId++;
  let timedOut = false;

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    console.warn(`[Request ${requestId}] Timeout after ${requestTimeout}ms`);
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        error: `Request timed out after ${requestTimeout}ms`
      });
    }
  }, requestTimeout + 5000); // 5s extra para enviar respuesta

  try {
    const creg = await clientWrapper.get();
    const response = await creg.ask(question);

    if (timedOut) return; // Ya se envió respuesta de timeout

    clearTimeout(timeoutHandle);

    const result = {
      title: response.title,
      content: response.content,
      rawHtml: response.rawHtml,
      links: response.links || [],
      lists: response.lists || []
    };

    saveToCache(question, result);

    if (!res.headersSent) {
      res.json({ success: true, data: result });
    }
  } catch (error) {
    if (timedOut) return;

    clearTimeout(timeoutHandle);
    clientWrapper.recordFailure();
    console.error(`[Request ${requestId}] Error:`, error.message);

    // Si el cliente falló demasiado, reciclarlo
    if (clientWrapper.failedRequests >= CONFIG.maxFailedRequests) {
      console.warn(`[Pool] Client exceeded max failures, recycling in background...`);
      clientWrapper.recycle().catch(() => {});
    }

    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  } finally {
    activeRequests--;
    clientWrapper.markFree();
    processQueue();
  }
}

// Endpoints
app.post('/api/ask', async (req, res) => {
  const { question, timeout } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ success: false, error: 'Question is required and must be a string' });
  }

  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length === 0) {
    return res.status(400).json({ success: false, error: 'Question cannot be empty' });
  }

  if (trimmedQuestion.length > 2000) {
    return res.status(400).json({ success: false, error: 'Question too long (max 2000 chars)' });
  }

  if (requestQueue.length >= CONFIG.queueLimit) {
    return res.status(429).json({ success: false, error: 'Server busy, try again later' });
  }

  const finalTimeout = timeout
    ? Math.min(Math.max(timeout, 30000), 300000)
    : CONFIG.defaultTimeout;

  processRequest(req, res, trimmedQuestion, finalTimeout);
});

app.get('/health', (req, res) => {
  const availableBrowsers = browserPool.filter(c => c.client).length;
  res.json({
    status: 'ok',
    mode: CONFIG.cregMode,
    pool: {
      size: CONFIG.poolSize,
      maxConcurrent: CONFIG.maxConcurrent,
      active: activeRequests,
      queued: requestQueue.length,
      cacheSize: responseCache.size,
      available: availableBrowsers
    }
  });
});

app.get('/api/cache/clear', (req, res) => {
  const size = responseCache.size;
  responseCache.clear();
  res.json({ success: true, message: `Cache cleared (${size} entries removed)` });
});

app.get('/api/stats', (req, res) => {
  const poolStats = browserPool.map((c, i) => ({
    id: i + 1,
    inUse: c.inUse,
    failures: c.failedRequests,
    hasClient: !!c.client,
    lastUsed: c.lastUsed
  }));

  res.json({
    mode: CONFIG.cregMode,
    pool: {
      total: CONFIG.poolSize,
      active: activeRequests,
      free: CONFIG.poolSize - activeRequests,
      browsers: poolStats
    },
    queue: { current: requestQueue.length, max: CONFIG.queueLimit },
    cache: { entries: responseCache.size, maxAgeMs: CONFIG.cacheMaxAge }
  });
});

app.post('/api/pool/recycle', async (req, res) => {
  const { id } = req.body;
  if (id !== undefined) {
    const idx = id - 1;
    if (idx < 0 || idx >= browserPool.length) {
      return res.status(400).json({ success: false, error: 'Invalid browser ID' });
    }
    const pooled = browserPool[idx];
    if (pooled.inUse) {
      return res.status(409).json({ success: false, error: 'Browser is in use' });
    }
    try {
      await pooled.recycle();
      res.json({ success: true, message: `Browser ${id} recycled` });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  } else {
    // Reciclar todos los navegadores no en uso
    const results = [];
    for (let i = 0; i < browserPool.length; i++) {
      if (!browserPool[i].inUse) {
        try {
          await browserPool[i].recycle();
          results.push({ id: i + 1, status: 'recycled' });
        } catch (err) {
          results.push({ id: i + 1, status: 'error', error: err.message });
        }
      } else {
        results.push({ id: i + 1, status: 'skipped', reason: 'in use' });
      }
    }
    res.json({ success: true, results });
  }
});

// Error handling middleware (Express 4)
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message || err);
  if (!res.headersSent) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  console.log('[Server] Shutting down...');
  // Detener health checks
  if (healthCheckTimer) clearInterval(healthCheckTimer);

  // Cancelar requests pendientes
  for (const [id, controller] of pendingRequests) {
    controller.abort();
  }
  // Cerrar navegadores
  console.log('[Server] Closing browser pool...');
  const closePromises = browserPool.map(pooled => {
    if (pooled.client) return pooled.client.close().catch(() => {});
    return Promise.resolve();
  });
  await Promise.allSettled(closePromises);
  console.log('[Server] All browsers closed');
  process.exit(0);
}

const PORT = process.env.PORT || 3000;

initPool().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] CREG API running on port ${PORT} (modo: ${CONFIG.cregMode}, max ${CONFIG.maxConcurrent} en paralelo)`);
  });
}).catch(err => {
  console.error('[Server] Failed to initialize pool:', err);
  process.exit(1);
});

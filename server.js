require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectToDatabase } = require('./utils/db');
const { connectToReIDDatabase } = require('./utils/reiddb');
const alertsRouter = require('./routes/alerts');
const burstsRouter = require('./routes/bursts');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // bind to all interfaces by default

// Normalize BASE_URL provided in env (examples: '', '/', '/app', 'app/' -> '', '', '/app', '/app')
function normalizeBaseUrl(val) {
  if (!val) return '';
  if (val === '/') return '';
  if (!val.startsWith('/')) val = '/' + val; // ensure leading slash
  return val.replace(/\/+$/, ''); // remove trailing slash(es)
}
const BASE_URL = normalizeBaseUrl(process.env.BASE_URL);

// Middleware
app.use(cors());
app.use(express.json());

// Create a router scoped to BASE_URL so all content (static + API) lives under that path
const baseRouter = express.Router();

// Static assets (index.html, css, js, etc.) served beneath BASE_URL
baseRouter.use(express.static(path.join(__dirname, 'public')));

// Log all requests (scoped under BASE_URL)
baseRouter.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${BASE_URL}${req.path}`);
  next();
});

// Provide a dedicated Burst Preview page at BASE_URL + '/bursts'
baseRouter.get('/bursts', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Burst Preview</title>
  <base href="${BASE_URL || ''}/" />
  <link rel="stylesheet" href="css/style.css" />
  <!-- No inline BASE_URL script; api.js will use <base> fallback -->
</head>
<body>
  <div class="container">
    <header>
      <h1 class="h-section main-title">Burst Preview</h1>
      <div class="header-controls">
        <a href="./" style="margin-right:12px; text-decoration:none; color:#9cc3ff;">Alerts</a>
        <span id="status">Loading...</span>
      </div>
    </header>

    <div class="burst-preview-section" id="burstPreviewSection">
      <div class="burst-preview-header">
        <div class="burst-preview-controls">
          <div class="bp-pagination" id="burstPagination"></div>
          <form class="burst-preview-form" autocomplete="off" onsubmit="return false;">
            <label class="bp-control">
              <span>Date</span>
              <input type="date" id="burstDate" name="lc-burst-date" autocomplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" aria-autocomplete="none" inputmode="none" />
            </label>
            <div class="bp-control">
              <span>Direction</span>
              <div class="bp-radio-group">
                <label><input type="radio" name="burstDirection" value="entry" /> Entry</label>
                <label><input type="radio" name="burstDirection" value="exit" /> Exit</label>
                <label><input type="radio" name="burstDirection" value="both" checked /> Both</label>
              </div>
            </div>
            <label class="bp-control">
              <span>Camera (optional)</span>
              <input type="text" id="burstCamera" name="lc-burst-camera" placeholder="e.g. nc0009-salefloor-270" autocomplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" aria-autocomplete="none" />
            </label>
            <button id="burstLoadBtn" type="button">Load Bursts</button>
          </form>
        </div>
      </div>
      <div class="burst-preview-status" id="burstPreviewStatus"></div>

      <div class="burst-preview-layout">
        <div class="burst-left">
          <div class="burst-preview-grid" id="burstPreviewGrid">
            <p class="placeholder">Select filters above and click “Load Bursts” to preview cutouts.</p>
          </div>
        </div>
        <div class="burst-right">
          <div class="burst-preview-viewer" id="burstPreviewViewer">
            <p class="placeholder">Select a burst to preview.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal for full image view (reused) -->
  <div id="imageModal" class="modal">
    <div class="modal-content">
      <span class="close">&times;</span>
      <div id="imageContainer">
        <canvas id="imageCanvas"></canvas>
      </div>
      <div id="imageMetadata"></div>
    </div>
  </div>

  <script src="js/api.js"></script>
  <script src="js/canvas.js"></script>
  <script src="js/bursts-page.js"></script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// API Routes under BASE_URL (/BASE_URL/api/...)
baseRouter.use('/api/alerts', alertsRouter);
baseRouter.use('/api/bursts', burstsRouter);

baseRouter.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), baseUrl: BASE_URL || '/' });
});

// Mount the base router at BASE_URL ('' mounts at root when BASE_URL empty)
app.use(BASE_URL, baseRouter);

// Optional redirect from root to BASE_URL if BASE_URL is non-empty
if (BASE_URL) {
  app.get('/', (req, res) => {
    // Preserve query string if any
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(`${BASE_URL}/${qs}`);
  });
}

// Start server
async function startServer() {
  try {
    await connectToDatabase();
    console.log('Connected to MongoDB');

    await connectToReIDDatabase();
    console.log('Connected to Re-ID MongoDB');

    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}${BASE_URL}`);
      console.log(`Listening interface: ${HOST}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`BASE_URL: ${BASE_URL || '(root)'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Defensive: mitigate noisy browser extension content_script errors on focus/autocomplete
(function installExtensionMitigations(){
  try {
    // Suppress extension-origin errors
    window.addEventListener('error', function(extEvt){
      try {
        var src = extEvt && (extEvt.filename || (extEvt.error && extEvt.error.fileName) || '');
        if (src && (src.indexOf('content_script.js') !== -1 || src.indexOf('chrome-extension://') === 0 || src.indexOf('moz-extension://') === 0)) {
          extEvt.preventDefault && extEvt.preventDefault();
          extEvt.stopImmediatePropagation && extEvt.stopImmediatePropagation();
          return true;
        }
      } catch(_){}
    }, true);

    // Suppress unhandled promise rejections from extensions
    window.addEventListener('unhandledrejection', function(evt){
      try {
        var reason = evt && evt.reason;
        var msg = reason && (reason.message || String(reason));
        if (msg && msg.indexOf('content_script.js') !== -1) {
          evt.preventDefault && evt.preventDefault();
          evt.stopImmediatePropagation && evt.stopImmediatePropagation();
        }
      } catch(_){}
    }, true);

    // Stop extension focus handlers on the date field
    document.addEventListener('focusin', function(e){
      var t = e && e.target;
      if (t && (t.id === 'burstDate' || t.name === 'lc-burst-date')) {
        e.stopImmediatePropagation && e.stopImmediatePropagation();
      }
    }, true);

    // Intercept input events for the date field and update our state
    document.addEventListener('input', function(e){
      var t = e && e.target;
      if (t && (t.id === 'burstDate' || t.name === 'lc-burst-date')) {
        try {
          // Update our state manually
          var val = t.value || '';
          if (typeof burstPreviewState !== 'undefined') {
            burstPreviewState.date = val;
          }
        } catch(_){}
        // Prevent extension handlers from running
        e.stopImmediatePropagation && e.stopImmediatePropagation();
      }
    }, true);
  } catch(_){}
})();

// Minimal standalone Burst Preview page logic

let burstPreviewState = { date: '', direction: 'both', camera: '' };
let burstSpotlightSelectedCard = null;
let burstSpotlightCurrentImage = null;
let burstPaginationState = { page: 1, limit: 60, totalCount: 0 };

// Keyboard navigation: ArrowUp/ArrowDown to move between cards
function setupBurstKeyboardNavigation() {
  const grid = document.getElementById('burstPreviewGrid');
  if (!grid) return;

  // Ensure the document captures key events; avoid interfering with inputs
  document.addEventListener('keydown', (evt) => {
    const key = evt.key;
    if (key !== 'ArrowDown' && key !== 'ArrowUp') return;

    // Ignore when typing in inputs/selects/textareas
    const t = evt.target;
    const tag = (t && t.tagName) ? t.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;

    const cards = Array.prototype.slice.call(grid.querySelectorAll('.burst-card'));
    if (!cards.length) return;

    evt.preventDefault();

    // Determine current index
    let currentIdx = -1;
    if (burstSpotlightSelectedCard) {
      currentIdx = cards.indexOf(burstSpotlightSelectedCard);
    }
    if (currentIdx === -1) currentIdx = 0;

    // Compute next/prev index
    let nextIdx = currentIdx;
    if (key === 'ArrowDown') nextIdx = Math.min(currentIdx + 1, cards.length - 1);
    if (key === 'ArrowUp') nextIdx = Math.max(currentIdx - 1, 0);

    const nextCard = cards[nextIdx];
    if (!nextCard) return;

    // Simulate selection: find burst data in a lightweight way
    // We don't store burst objects on elements; trigger click handler to reuse existing logic
    nextCard.click();

    // Ensure visibility in left scroll panel
    try {
      const leftPane = document.querySelector('.burst-left') || grid;
      nextCard.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      // If using a custom container, adjust scroll to keep a bit of padding
      if (leftPane && leftPane.contains(nextCard)) {
        // No-op; scrollIntoView with nearest should keep it in view
      }
    } catch(_) {}
  });
}

function formatBurstTimestamp(value) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function setupBurstPreviewControls() {
  const dateInput = document.getElementById('burstDate');
  const cameraInput = document.getElementById('burstCamera');
  const loadBtn = document.getElementById('burstLoadBtn');
  const directionRadios = document.querySelectorAll('input[name="burstDirection"]');
  if (!dateInput || !cameraInput || !loadBtn || !directionRadios.length) return;

  // Reinforce ignore hints programmatically
  try {
    dateInput.setAttribute('autocomplete','off');
    dateInput.setAttribute('aria-autocomplete','none');
    dateInput.setAttribute('data-1p-ignore','true');
    dateInput.setAttribute('data-lpignore','true');
    dateInput.setAttribute('data-bwignore','true');
  } catch(_){}

  const todayIso = new Date().toISOString().slice(0, 10);
  if (!burstPreviewState.date) {
    burstPreviewState.date = todayIso;
  }
  if (!dateInput.value) {
    dateInput.value = burstPreviewState.date;
  }

  dateInput.addEventListener('change', () => {
    burstPreviewState.date = dateInput.value;
  });

  cameraInput.addEventListener('input', (event) => {
    burstPreviewState.camera = event.target.value;
  });

  directionRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        burstPreviewState.direction = radio.value;
      }
    });
    if (radio.checked) {
      burstPreviewState.direction = radio.value;
    }
  });

  loadBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    burstPaginationState.page = 1; // reset to first page on new load
    await loadBurstPreviews();
  });

  // Initial load
  burstPaginationState.page = 1;
  loadBurstPreviews();

  // Setup keyboard navigation
  setupBurstKeyboardNavigation();
}

function renderBurstPagination() {
  const container = document.getElementById('burstPagination');
  if (!container) return;
  const { page, limit, totalCount } = burstPaginationState;
  const totalPages = Math.max(Math.ceil(totalCount / limit), 1);

  container.innerHTML = '';

  const info = document.createElement('div');
  info.className = 'pagination-info';
  const startIdx = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, totalCount);
  info.textContent = `Showing ${startIdx}-${endIdx} of ${totalCount}`;
  container.appendChild(info);

  const controls = document.createElement('div');
  controls.className = 'pagination-controls';

  const firstBtn = document.createElement('button');
  firstBtn.textContent = 'First';
  firstBtn.disabled = page <= 1;
  firstBtn.addEventListener('click', async () => {
    if (burstPaginationState.page !== 1) {
      burstPaginationState.page = 1;
      await loadBurstPreviews();
    }
  });

  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Prev';
  prevBtn.disabled = page <= 1;
  prevBtn.addEventListener('click', async () => {
    if (burstPaginationState.page > 1) {
      burstPaginationState.page -= 1;
      await loadBurstPreviews();
    }
  });

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.disabled = page >= totalPages;
  nextBtn.addEventListener('click', async () => {
    const totalPagesLocal = Math.max(Math.ceil(burstPaginationState.totalCount / burstPaginationState.limit), 1);
    if (burstPaginationState.page < totalPagesLocal) {
      burstPaginationState.page += 1;
      await loadBurstPreviews();
    }
  });

  const lastBtn = document.createElement('button');
  lastBtn.textContent = 'Last';
  lastBtn.disabled = page >= totalPages;
  lastBtn.addEventListener('click', async () => {
    const totalPagesLocal = Math.max(Math.ceil(burstPaginationState.totalCount / burstPaginationState.limit), 1);
    if (burstPaginationState.page !== totalPagesLocal) {
      burstPaginationState.page = totalPagesLocal;
      await loadBurstPreviews();
    }
  });

  const pageIndicator = document.createElement('span');
  pageIndicator.className = 'pagination-page';
  pageIndicator.textContent = `Page ${page} of ${totalPages}`;

  const pageJump = document.createElement('input');
  pageJump.type = 'number';
  pageJump.min = 1;
  pageJump.max = totalPages;
  pageJump.value = page;
  pageJump.className = 'pagination-jump';
  pageJump.title = 'Jump to page';
  pageJump.addEventListener('change', async () => {
    const desired = parseInt(pageJump.value, 10) || 1;
    const bounded = Math.min(Math.max(desired, 1), Math.max(Math.ceil(burstPaginationState.totalCount / burstPaginationState.limit), 1));
    if (bounded !== burstPaginationState.page) {
      burstPaginationState.page = bounded;
      await loadBurstPreviews();
    }
  });

  const pageSize = document.createElement('select');
  pageSize.className = 'pagination-size';
  [30, 60, 120].forEach((sz) => {
    const opt = document.createElement('option');
    opt.value = String(sz);
    opt.textContent = `${sz}/page`;
    if (sz === limit) opt.selected = true;
    pageSize.appendChild(opt);
  });
  pageSize.addEventListener('change', async () => {
    const newLimit = parseInt(pageSize.value, 10) || 60;
    if (newLimit !== burstPaginationState.limit) {
      burstPaginationState.limit = newLimit;
      burstPaginationState.page = 1; // reset to first page when page size changes
      await loadBurstPreviews();
    }
  });

  controls.appendChild(firstBtn);
  controls.appendChild(prevBtn);
  controls.appendChild(pageIndicator);
  controls.appendChild(nextBtn);
  controls.appendChild(lastBtn);
  controls.appendChild(pageJump);
  controls.appendChild(pageSize);
  container.appendChild(controls);
}

async function loadBurstPreviews() {
  const grid = document.getElementById('burstPreviewGrid');
  const statusEl = document.getElementById('burstPreviewStatus');
  if (!grid || !statusEl) return;

  const date = burstPreviewState.date;
  const direction = burstPreviewState.direction || 'entry';
  const camera = (burstPreviewState.camera || '').trim();
  const { page, limit } = burstPaginationState;

  if (!date) {
    statusEl.textContent = 'Select a date to load burst previews.';
    grid.innerHTML = '<p class="placeholder">No date selected.</p>';
    renderBurstPagination();
    return;
  }

  statusEl.textContent = 'Loading burst previews...';
  grid.innerHTML = '<div class="loading">Loading bursts...</div>';

  try {
    const response = await api.getBursts({ date, direction, camera, page, limit });
    const bursts = Array.isArray(response?.bursts) ? response.bursts : [];
    burstPaginationState.totalCount = Number.isFinite(response?.totalCount) ? response.totalCount : bursts.length;
    renderBurstPreviewGrid(bursts);
    renderBurstPagination();

    const directionLabel = direction === 'both' ? 'entry & exit' : direction;
    const cameraLabel = camera ? ` · Camera filter: ${camera}` : '';
    const totalPages = Math.max(Math.ceil(burstPaginationState.totalCount / burstPaginationState.limit), 1);
    statusEl.textContent = `${bursts.length} burst${bursts.length === 1 ? '' : 's'} on page ${page}/${totalPages} for ${directionLabel} on ${date}${cameraLabel}`;
  } catch (error) {
    console.error('Failed to load bursts:', error);
    statusEl.textContent = 'Failed to load burst previews.';
    grid.innerHTML = `<div class="error">Unable to load bursts: ${error.message}</div>`;
    renderBurstPagination();
  }
}

function renderBurstPreviewGrid(bursts) {
  const grid = document.getElementById('burstPreviewGrid');
  if (!grid) return;

  if (!bursts.length) {
    grid.innerHTML = '<p class="placeholder">No burst cutouts found for the selected filters.</p>';
    showBurstSpotlight(null, null);
    return;
  }

  grid.innerHTML = '';
  let firstSelection = null;
  bursts.forEach((burst) => {
    const card = document.createElement('div');
    card.className = 'burst-card';
    card.addEventListener('click', () => showBurstSpotlight(burst, card));

    const header = document.createElement('div');
    header.className = 'burst-card-header';

    const meta = document.createElement('div');
    meta.className = 'burst-meta';
    const cameraLabel = burst.peripheral?.id || burst.peripheral?.name || 'Unknown camera';
    const detectionLabel = burst.detectionId || 'No detection id';
    meta.innerHTML = `
      <span class="burst-id">${cameraLabel}</span>
      <span class="burst-sub">${detectionLabel} · n=${burst.burstCount}</span>
    `;

    header.appendChild(meta);
    card.appendChild(header);

    const strip = document.createElement('div');
    strip.className = 'burst-thumb-strip';
    const images = Array.isArray(burst.burstImages) ? burst.burstImages : [];
    if (images.length === 0 && burst.cutoutImage) images.push(burst.cutoutImage);
    const displayImages = images.slice(0, 11); // cap to 11 thumbnails
    displayImages.forEach((src, index) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = `burst-${index}`;
      img.loading = 'lazy';
      strip.appendChild(img);
    });
    card.appendChild(strip);

    const footer = document.createElement('div');
    footer.className = 'burst-card-footer';
    footer.innerHTML = `
      <span>${(burst.direction || 'unknown').toUpperCase()}</span>
      <span>${formatBurstTimestamp(burst.timestamp)}</span>
    `;
    card.appendChild(footer);

    grid.appendChild(card);
    if (!firstSelection) {
      firstSelection = { burst, card };
    }
  });

  if (firstSelection) {
    showBurstSpotlight(firstSelection.burst, firstSelection.card);
  }

  // One-time resize: adjust thumbnail sizes to fit within cards
  sizeBurstThumbnails();
  // Setup resize observer for dynamic sizing
  setupThumbnailResizeObserver();
}

function sizeBurstThumbnails() {
  const cards = document.querySelectorAll('.burst-card');
  cards.forEach((card) => {
    const strip = card.querySelector('.burst-thumb-strip');
    if (!strip) return;

    const images = strip.querySelectorAll('img');
    const imageCount = images.length;

    if (imageCount === 0) return;

    // Calculate available width: consider card padding, strip padding, and desired gap
    const cardStyle = getComputedStyle(card);
    const stripStyle = getComputedStyle(strip);
    const cardPadding = (parseFloat(cardStyle.paddingLeft) || 0) + (parseFloat(cardStyle.paddingRight) || 0);
    const stripPadding = (parseFloat(stripStyle.paddingLeft) || 0) + (parseFloat(stripStyle.paddingRight) || 0);
    const stripGap = parseFloat(stripStyle.gap) || 0;
    const availableWidth = card.clientWidth - cardPadding - stripPadding - stripGap * (imageCount - 1);

    // Calculate and apply width to each image: respect aspect ratio, max 11 images
    const maxImages = Math.min(imageCount, 11);
    const imageWidth = Math.max(1, Math.floor(availableWidth / maxImages));
    images.forEach((img) => {
      img.style.width = `${imageWidth}px`;
      img.style.height = 'auto'; // Maintain aspect ratio
      img.style.objectFit = 'contain';
      img.style.maxWidth = '100%';
    });
  });
}

function setupThumbnailResizeObserver() {
  const observer = new ResizeObserver(() => {
    // On resize, re-calculate thumbnail sizes for all cards
    sizeBurstThumbnails();
  });

  const cards = document.querySelectorAll('.burst-card');
  cards.forEach((card) => {
    observer.observe(card);
  });

  // Optional: also observe the grid/container if its size impacts the cards
  const grid = document.getElementById('burstPreviewGrid');
  if (grid) {
    observer.observe(grid);
  }
}

function showBurstSpotlight(burst, card) {
  const viewer = document.getElementById('burstPreviewViewer');
  if (!viewer) return;

  if (burstSpotlightSelectedCard) {
    burstSpotlightSelectedCard.classList.remove('selected');
  }
  if (card) {
    card.classList.add('selected');
    burstSpotlightSelectedCard = card;
  } else {
    burstSpotlightSelectedCard = null;
  }

  if (!burst) {
    viewer.innerHTML = '<p class="placeholder">Select a burst to preview.</p>';
    burstSpotlightCurrentImage = null;
    return;
  }

  const images = Array.isArray(burst.burstImages) && burst.burstImages.length
    ? [...burst.burstImages]
    : (burst.cutoutImage ? [burst.cutoutImage] : []);

  if (!images.length) {
    viewer.innerHTML = '<div class="burst-spotlight-empty">No images available for this burst.</div>';
    burstSpotlightCurrentImage = null;
    return;
  }

  viewer.innerHTML = '';

  // Details panel (meta + grid of images)
  const details = document.createElement('div');
  details.className = 'burst-spotlight-details';

  const meta = document.createElement('div');
  meta.className = 'burst-spotlight-meta';
  const cameraLabel = burst.peripheral?.id || burst.peripheral?.name || 'Unknown camera';
  const detectionLabel = burst.detectionId || 'No detection id';
  const directionLabel = (burst.direction || 'unknown').toUpperCase();
  const alertIdLabel = burst.alertId || 'No alert id';
  meta.innerHTML = `
    <span><strong>Camera:</strong> ${cameraLabel}</span>
    <span><strong>Detection:</strong> ${detectionLabel}</span>
    <span><strong>Alert ID:</strong> ${alertIdLabel}</span>
    <span><strong>Direction:</strong> ${directionLabel}</span>
    <span><strong>Frames:</strong> ${burst.burstCount}</span>
    <span><strong>Timestamp:</strong> ${formatBurstTimestamp(burst.timestamp)}</span>
  `;
  details.appendChild(meta);

  // Grid of spotlight images
  const grid = document.createElement('div');
  grid.className = 'burst-spotlight-grid';
  images.forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `burst-frame-${index}`;
    img.loading = 'lazy';
    img.addEventListener('click', () => openBurstImageModal(src, burst));
    grid.appendChild(img);
  });
  details.appendChild(grid);

  const actions = document.createElement('div');
  actions.className = 'burst-spotlight-actions';
  const openAlertBtn = document.createElement('button');
  openAlertBtn.textContent = 'Open Alert';
  openAlertBtn.addEventListener('click', () => openBurstAlert(burst));
  actions.appendChild(openAlertBtn);
  // Remove single-image viewer button; each grid image opens modal
  details.appendChild(actions);

  viewer.appendChild(details);
}

async function openBurstAlert(burst) {
  const statusEl = document.getElementById('burstPreviewStatus');
  const base = ((window.__BASE_URL__ || (document.querySelector('base')?.getAttribute('href') || '')) || '').replace(/\/+$/, '');
  const openAlertInNewTab = (alertId) => {
    const url = `${base}/?alert=${encodeURIComponent(alertId)}`;
    window.open(url, '_blank', 'noopener');
  };
  if (burst && burst.alertId) {
    openAlertInNewTab(burst.alertId);
    if (statusEl) statusEl.textContent = `Opened alert ${burst.alertId} in new tab`;
    return;
  }
  if (!burst || !burst.detectionId) {
    if (statusEl) statusEl.textContent = 'No alert or detection ID available for this burst.';
    return;
  }
  const detectionId = burst.detectionId;
  try {
    const result = await api.getAlerts({ search: detectionId, limit: 1, page: 1 });
    const match = result?.alerts?.[0];
    if (match && (match.id || match._id)) {
      const id = match.id || match._id;
      openAlertInNewTab(id);
      if (statusEl) statusEl.textContent = `Opened alert ${id} in new tab`;
      return;
    }
    if (statusEl) statusEl.textContent = `No alert found for ${detectionId}`;
  } catch (error) {
    console.error('Failed to open alert for burst:', error);
    if (statusEl) statusEl.textContent = `Failed to open alert: ${error.message}`;
  }
}

function setupModalControls() {
  const modal = document.getElementById('imageModal');
  const closeBtn = document.querySelector('#imageModal .close');
  if (!modal || !closeBtn) return;
  closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  window.addEventListener('click', (event) => {
    if (event.target === modal) modal.style.display = 'none';
  });
}

async function initBurstsPage() {
  try {
    await api.healthCheck();
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = 'Connected';
      statusEl.style.background = '#e8f5e9';
      statusEl.style.color = '#2e7d32';
    }
  } catch (error) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = 'Connection Error';
      statusEl.style.background = '#ffebee';
      statusEl.style.color = '#c62828';
    }
    console.warn('Health check failed:', error);
  }

  setupModalControls();
  setupBurstPreviewControls();
}

document.addEventListener('DOMContentLoaded', initBurstsPage);

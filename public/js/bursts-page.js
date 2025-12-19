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
    images.forEach((src, index) => {
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

  const mediaWrapper = document.createElement('div');
  mediaWrapper.className = 'burst-spotlight-media';
  const mainImg = document.createElement('img');
  mainImg.src = images[0];
  mainImg.alt = 'Burst spotlight';
  mainImg.loading = 'lazy';
  mediaWrapper.appendChild(mainImg);
  burstSpotlightCurrentImage = images[0];

  const details = document.createElement('div');
  details.className = 'burst-spotlight-details';

  const meta = document.createElement('div');
  meta.className = 'burst-spotlight-meta';
  const cameraLabel = burst.peripheral?.id || burst.peripheral?.name || 'Unknown camera';
  const detectionLabel = burst.detectionId || 'No detection id';
  const directionLabel = (burst.direction || 'unknown').toUpperCase();
  meta.innerHTML = `
    <span><strong>Camera:</strong> ${cameraLabel}</span>
    <span><strong>Detection:</strong> ${detectionLabel}</span>
    <span><strong>Direction:</strong> ${directionLabel}</span>
    <span><strong>Frames:</strong> ${burst.burstCount}</span>
    <span><strong>Timestamp:</strong> ${formatBurstTimestamp(burst.timestamp)}</span>
  `;

  details.appendChild(meta);

  if (images.length > 1) {
    const thumbs = document.createElement('div');
    thumbs.className = 'burst-spotlight-thumbs';

    images.forEach((src, index) => {
      const thumb = document.createElement('img');
      thumb.src = src;
      thumb.alt = `frame-${index}`;
      thumb.loading = 'lazy';
      thumb.addEventListener('click', () => {
        mainImg.src = src;
        burstSpotlightCurrentImage = src;
      });
      thumbs.appendChild(thumb);
    });

    details.appendChild(thumbs);
  }

  const actions = document.createElement('div');
  actions.className = 'burst-spotlight-actions';
  const openAlertBtn = document.createElement('button');
  openAlertBtn.textContent = 'Open Alert';
  openAlertBtn.addEventListener('click', () => openBurstAlert(burst));
  actions.appendChild(openAlertBtn);
  const viewImageBtn = document.createElement('button');
  viewImageBtn.textContent = 'View Image';
  viewImageBtn.classList.add('secondary');
  viewImageBtn.addEventListener('click', () => openBurstImageModal(burstSpotlightCurrentImage || images[0], burst));
  actions.appendChild(viewImageBtn);
  details.appendChild(actions);

  viewer.appendChild(mediaWrapper);
  viewer.appendChild(details);
}

function openBurstAlert(burst) {
  if (!burst || !burst.detectionId) {
    const statusEl = document.getElementById('burstPreviewStatus');
    if (statusEl) statusEl.textContent = 'No detection ID available for this burst.';
    return;
  }
  const base = (window.__BASE_URL__ || '').replace(/\/+$/, '');
  const url = `${base}/?alert=${encodeURIComponent(burst.detectionId)}`.replace(/^\/\//, '/');
  window.location.href = url;
}

function openBurstImageModal(imageUrl, burst) {
  if (!imageUrl) return;
  const modal = document.getElementById('imageModal');
  const canvas = document.getElementById('imageCanvas');
  const metadataDiv = document.getElementById('imageMetadata');
  if (!modal || !canvas || !metadataDiv) return;

  canvasUtils.loadImage(imageUrl)
    .then((img) => {
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const safeUrl = encodeURI(imageUrl);
      metadataDiv.innerHTML = `
        <div><strong>Image:</strong> <a href="${safeUrl}" target="_blank" rel="noopener">${safeUrl}</a></div>
        <div><strong>Camera:</strong> ${burst?.peripheral?.id || burst?.peripheral?.name || 'Unknown'}</div>
        <div><strong>Direction:</strong> ${(burst?.direction || 'unknown').toUpperCase()}</div>
        <div><strong>Frames:</strong> ${burst?.burstCount ?? 'N/A'}</div>
        <div><strong>Timestamp:</strong> ${formatBurstTimestamp(burst?.timestamp)}</div>
      `;
      modal.style.display = 'block';
    })
    .catch((error) => {
      console.error('Failed to load burst image for viewer:', error);
    });
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

// Main application logic

let currentPage = 1;
let currentFilters = {};
let selectedAlertId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // Check health
  try {
    await api.healthCheck();
    document.getElementById('status').textContent = 'Connected';
    document.getElementById('status').style.background = '#e8f5e9';
    document.getElementById('status').style.color = '#2e7d32';
  } catch (error) {
    document.getElementById('status').textContent = 'Connection Error';
    document.getElementById('status').style.background = '#ffebee';
    document.getElementById('status').style.color = '#c62828';
    showError('Failed to connect to server');
  }

  // Set default date range (last 24 hours)
  setDefaultDateRange();

  // Load initial alerts
  loadAlerts();

  // Setup event listeners
  setupEventListeners();
}

function setupEventListeners() {
  // Search controls
  document.getElementById('searchBtn').addEventListener('click', applySearch);
  document.getElementById('clearBtn').addEventListener('click', clearSearch);

  // Date filters
  document.getElementById('startDate').addEventListener('change', applySearch);
  document.getElementById('endDate').addEventListener('change', applySearch);

  // Allow search on Enter key
  document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      applySearch();
    }
  });

  // Alert modal controls
  const alertModal = document.getElementById('alertModal');
  const closeAlertModal = document.getElementById('closeAlertModal');
  closeAlertModal.addEventListener('click', () => {
    alertModal.style.display = 'none';
  });

  // Modal controls (old image modal)
  const modal = document.getElementById('imageModal');
  const closeBtn = document.querySelector('#imageModal .close');
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
    if (event.target === alertModal) {
      alertModal.style.display = 'none';
    }
  });
}

async function loadAlerts(page = 1) {
  const container = document.getElementById('alertsContainer');
  container.innerHTML = '<div class="loading">Loading alerts...</div>';

  try {
    const filters = { ...currentFilters, page, limit: 20 };
    const data = await api.getAlerts(filters);

    if (data.alerts.length === 0) {
      container.innerHTML = '<p class="placeholder">No alerts found</p>';
      return;
    }

    // Render alerts
    container.innerHTML = '';
    data.alerts.forEach(alert => {
      const alertElement = createAlertElement(alert);
      container.appendChild(alertElement);
    });

    // Render pagination
    renderPagination(data.pagination);

    currentPage = page;
  } catch (error) {
    console.error('Error loading alerts:', error);
    container.innerHTML = `<div class="error">Failed to load alerts: ${error.message}</div>`;
  }
}

function createAlertElement(alert) {
  const div = document.createElement('div');
  div.className = 'alert-item';
  if (selectedAlertId === alert._id) {
    div.classList.add('selected');
  }

  const timestamp = new Date(alert.start_time).toLocaleString();
  const statusClass = `status-${alert.status || 'new'}`;

  div.innerHTML = `
    <div class="alert-item-content">
      <span class="status-badge ${statusClass}">${alert.status || 'new'}</span>
      <span class="alert-id-text">${alert.id || alert._id}</span>
      <span class="alert-meta-item">📷 ${alert.peripheral_id || 'Unknown'}</span>
      <span class="alert-meta-item">🕒 ${timestamp}</span>
    </div>
  `;

  div.addEventListener('click', () => {
    selectAlert(alert._id);
  });

  return div;
}

function renderPagination(pagination) {
  const container = document.getElementById('pagination');

  container.innerHTML = `
    <button id="prevPage" ${pagination.page <= 1 ? 'disabled' : ''}>Previous</button>
    <span>Page ${pagination.page} of ${pagination.pages}</span>
    <button id="nextPage" ${pagination.page >= pagination.pages ? 'disabled' : ''}>Next</button>
  `;

  document.getElementById('prevPage')?.addEventListener('click', () => {
    loadAlerts(currentPage - 1);
  });

  document.getElementById('nextPage')?.addEventListener('click', () => {
    loadAlerts(currentPage + 1);
  });
}

async function selectAlert(alertId) {
  selectedAlertId = alertId;

  // Update selection in list
  document.querySelectorAll('.alert-item').forEach(item => {
    item.classList.remove('selected');
  });
  event.currentTarget.classList.add('selected');

  // Show modal
  const modal = document.getElementById('alertModal');
  const modalContent = document.getElementById('alertModalContent');
  modal.style.display = 'block';
  modalContent.innerHTML = '<div class="loading">Loading alert details...</div>';

  try {
    const alert = await api.getAlert(alertId);
    renderAlertModal(alert);
  } catch (error) {
    console.error('Error loading alert details:', error);
    modalContent.innerHTML = `<div class="error">Failed to load alert details: ${error.message}</div>`;
  }
}

async function renderAlertModal(alert) {
  const container = document.getElementById('alertModalContent');
  const timestamp = new Date(alert.start_time).toLocaleString();
  const endTime = alert.end_time ? new Date(alert.end_time).toLocaleString() : 'N/A';

  // Check annotations status - will be updated after loading
  const annotationsStatusHtml = `<span class="status-badge" id="annotationsStatusBadge" style="background: #999; color: white;">Checking...</span>`;

  container.innerHTML = `
    <div class="alert-modal-header">
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        <h2>Alert Details</h2>
        <span class="status-badge status-${alert.status || 'new'}">${alert.status || 'new'}</span>
        ${annotationsStatusHtml}
      </div>
      <div style="font-family: 'Monaco', 'Courier New', monospace; font-size: 13px; color: #1976D2; margin-top: 8px;">
        ${alert.id || alert._id}
      </div>
    </div>
    
    <div class="alert-modal-media" id="alertMediaContainer">
      <div class="loading">Loading media...</div>
      ${alert.videoUrl ? '<div class="media-hint">Click image to play video</div>' : ''}
    </div>
    
    ${alert.llm_classification && alert.llm_classification.summary ? `
    <div class="alert-modal-summary">
      <h3>🤖 AI Summary</h3>
      <p>${alert.llm_classification.summary}</p>
      ${alert.llm_classification.count_humans ? `
        <div class="summary-stats">
          👥 ${alert.llm_classification.count_humans} human(s) detected
          ${alert.llm_classification.frames_processed ? ` • 🎬 ${alert.llm_classification.frames_processed} frames processed` : ''}
        </div>
      ` : ''}
    </div>
    ` : ''}
    
    <div class="alert-modal-info">
      <div class="info-card">
        <h3>Camera ID</h3>
        <div class="value">${alert.peripheral_id || 'N/A'}</div>
      </div>
      <div class="info-card">
        <h3>Device ID</h3>
        <div class="value">${alert.from_device || 'N/A'}</div>
      </div>
      <div class="info-card">
        <h3>Start Time</h3>
        <div class="value">${timestamp}</div>
      </div>
      <div class="info-card">
        <h3>End Time</h3>
        <div class="value">${endTime}</div>
      </div>
      <div class="info-card">
        <h3>Detection ID</h3>
        <div class="value">${alert.detection_id || 'N/A'}</div>
      </div>
    </div>
  `;

  // Load and display image with option to switch to video
  if (alert.imageUrl) {
    loadAlertImageInModal(alert);
  }
}

async function loadAlertImageInModal(alert) {
  const container = document.getElementById('alertMediaContainer');

  try {
    console.log('Loading image from URL:', alert.imageUrl);

    // Load image
    const image = await canvasUtils.loadImage(alert.imageUrl);
    console.log('Image loaded successfully:', image.width, 'x', image.height);

    // Load metadata if available
    let metadata = null;
    let annotationsData = null;
    let hasDetections = false;

    if (alert.metadataUrl) {
      try {
        console.log('Loading metadata from URL:', alert.metadataUrl);
        annotationsData = await api.getMetadata(alert.metadataUrl);
        console.log('Annotations data loaded:', annotationsData);

        // Process annotations to extract detections
        metadata = processAnnotations(annotationsData);

        // Check if detections are present
        hasDetections = annotationsData?.data?.detections?.length > 0;

        // Update annotations status badge
        updateAnnotationsStatusBadge(hasDetections);
      } catch (error) {
        console.warn('Failed to load metadata:', error);
        // Update badge to show no annotations file
        updateAnnotationsStatusBadge(null);
      }
    } else {
      // No metadata URL provided
      updateAnnotationsStatusBadge(null);
    }

    // Create canvas with image and bounding boxes
    const canvas = document.createElement('canvas');
    canvasUtils.drawBoundingBoxes(canvas, image, metadata, annotationsData);

    container.innerHTML = '';
    container.appendChild(canvas);

    // Add hint if video is available
    if (alert.videoUrl) {
      const hint = document.createElement('div');
      hint.className = 'media-hint';
      hint.textContent = 'Click image to play video';
      container.appendChild(hint);

      // Add click handler to switch to video
      canvas.style.cursor = 'pointer';
      canvas.addEventListener('click', () => {
        switchToVideo(alert, container);
      });
    }

    // Display annotations statistics below the image
    if (annotationsData) {
      const statsDiv = renderAnnotationsStats(annotationsData);
      container.appendChild(statsDiv);
    }

  } catch (error) {
    console.error('Error loading image:', error);
    console.error('Image URL was:', alert.imageUrl);

    // Update badge to show error
    updateAnnotationsStatusBadge(null);

    // Show user-friendly error message
    const errorMessage = error.message.includes('File not found') || error.message.includes('404')
      ? 'Media file not available in storage'
      : 'Failed to load image';

    container.innerHTML = `
      <div class="error" style="padding: 30px; text-align: center; background: #f9f9f9; border-radius: 8px;">
        <div style="font-size: 64px; margin-bottom: 15px; opacity: 0.5;">📷</div>
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #666;">${errorMessage}</div>
        <div style="font-size: 13px; color: #999; margin-bottom: 5px;">
          Path: <code style="background: #fff; padding: 2px 6px; border-radius: 3px; font-size: 11px;">${alert.video_snapshot || 'N/A'}</code>
        </div>
        <div style="font-size: 12px; color: #aaa; margin-top: 10px;">
          The media file may have been deleted, never uploaded, or the path may be incorrect.
        </div>
      </div>
    `;
  }
}

function switchToVideo(alert, container) {
  if (!alert.videoUrl) return;

  container.innerHTML = '';

  const video = document.createElement('video');
  video.controls = true;
  video.autoplay = true;
  video.style.width = '100%';
  video.style.maxHeight = '70vh';
  video.style.objectFit = 'contain';

  const source = document.createElement('source');
  source.src = alert.videoUrl;
  source.type = 'video/mp4';

  video.appendChild(source);
  container.appendChild(video);

  // Handle video load error
  video.addEventListener('error', () => {
    container.innerHTML = `
      <div class="error" style="padding: 30px; text-align: center;">
        <div style="font-size: 64px; margin-bottom: 15px; opacity: 0.5;">🎥</div>
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #666;">Video file not available</div>
        <div style="font-size: 13px; color: #999;">The video file could not be loaded.</div>
      </div>
    `;
  });
}

// Update annotations status badge
function updateAnnotationsStatusBadge(hasDetections) {
  const badge = document.getElementById('annotationsStatusBadge');
  if (!badge) return;

  if (hasDetections === true) {
    // Detections found
    badge.textContent = '✓ Detections Found';
    badge.style.background = '#4CAF50';
    badge.style.color = 'white';
  } else if (hasDetections === false) {
    // No detections (but annotations file exists)
    badge.textContent = '⚠ No Detections';
    badge.style.background = '#FF9800';
    badge.style.color = 'white';
  } else {
    // No annotations file or error loading
    badge.textContent = '✗ No Annotations';
    badge.style.background = '#757575';
    badge.style.color = 'white';
  }
}

// Process annotations data structure to extract detections
function processAnnotations(annotationsData) {
  if (!annotationsData || !annotationsData.data) {
    return null;
  }

  const data = annotationsData.data;
  const detections = data.detections || [];

  // Convert detections to the format expected by canvas utils
  if (detections.length === 0) {
    return null;
  }

  return {
    detections: detections,
    metadata: data.metadata || {},
    imageWidth: null, // Will be determined by canvas
    imageHeight: null
  };
}

// Render annotations statistics
function renderAnnotationsStats(annotationsData) {
  const statsDiv = document.createElement('div');
  statsDiv.className = 'annotations-stats';
  statsDiv.style.cssText = `
    margin-top: 20px;
    padding: 20px;
    background: #f9f9f9;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  `;

  if (!annotationsData || !annotationsData.data) {
    statsDiv.innerHTML = `
      <h3 style="margin: 0 0 10px 0; color: #666; font-size: 16px;">📊 Annotations Data</h3>
      <p style="color: #999; margin: 0;">No annotations data available</p>
    `;
    return statsDiv;
  }

  const data = annotationsData.data;
  const detections = data.detections || [];
  const metadata = data.metadata || {};

  // Check if there are any detections
  const hasDetections = detections.length > 0;

  // Calculate statistics
  const stats = calculateDetectionStats(detections);

  // Time range
  const timeRange = metadata.start_time && metadata.end_time
    ? calculateDuration(metadata.start_time, metadata.end_time)
    : null;

  statsDiv.innerHTML = `
    <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px; display: flex; align-items: center; gap: 8px;">
      📊 Annotations Statistics
      ${hasDetections 
        ? '<span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: normal;">Detections Found</span>'
        : '<span style="background: #FF9800; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: normal;">No Detections</span>'
      }
    </h3>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 15px;">
      <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0;">
        <div style="font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 4px;">Total Detections</div>
        <div style="font-size: 24px; font-weight: bold; color: ${hasDetections ? '#4CAF50' : '#999'};">${detections.length}</div>
      </div>
      
      ${timeRange ? `
      <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0;">
        <div style="font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 4px;">Duration</div>
        <div style="font-size: 18px; font-weight: bold; color: #2196F3;">${timeRange}</div>
      </div>
      ` : ''}
      
      ${stats.uniqueLabels.size > 0 ? `
      <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0;">
        <div style="font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 4px;">Unique Labels</div>
        <div style="font-size: 24px; font-weight: bold; color: #FF9800;">${stats.uniqueLabels.size}</div>
      </div>
      ` : ''}
      
      ${stats.uniqueObjects.size > 0 ? `
      <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0;">
        <div style="font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 4px;">Tracked Objects</div>
        <div style="font-size: 24px; font-weight: bold; color: #9C27B0;">${stats.uniqueObjects.size}</div>
      </div>
      ` : ''}
    </div>
    
    ${hasDetections ? `
      <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e0e0e0; margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: bold; color: #333; margin-bottom: 10px;">Detection Breakdown by Label</div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${Array.from(stats.labelCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => `
              <div style="background: #f5f5f5; padding: 6px 12px; border-radius: 4px; font-size: 12px;">
                <span style="font-weight: bold; color: ${getLabelColor(label)};">${label}</span>
                <span style="color: #666; margin-left: 4px;">${count}</span>
              </div>
            `).join('')}
        </div>
      </div>
      
      ${stats.avgScore !== null ? `
      <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e0e0e0; margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: bold; color: #333; margin-bottom: 8px;">Average Confidence Score</div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="flex: 1; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); width: ${stats.avgScore * 100}%;"></div>
          </div>
          <div style="font-size: 16px; font-weight: bold; color: #4CAF50; min-width: 50px;">${(stats.avgScore * 100).toFixed(1)}%</div>
        </div>
      </div>
      ` : ''}
      
      ${stats.timeRange.earliest && stats.timeRange.latest ? `
      <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e0e0e0;">
        <div style="font-size: 13px; font-weight: bold; color: #333; margin-bottom: 8px;">Detection Time Range</div>
        <div style="font-size: 12px; color: #666;">
          <div>First: ${new Date(stats.timeRange.earliest).toLocaleString()}</div>
          <div style="margin-top: 4px;">Last: ${new Date(stats.timeRange.latest).toLocaleString()}</div>
        </div>
      </div>
      ` : ''}
    ` : `
      <div style="background: #fff3cd; padding: 15px; border-radius: 6px; border: 1px solid #ffeaa7; color: #856404;">
        <div style="font-weight: bold; margin-bottom: 5px;">⚠️ No Detections Found</div>
        <div style="font-size: 13px;">The annotations file was loaded successfully but contains no detection data.</div>
      </div>
    `}
    
    ${metadata.start_time ? `
      <div style="margin-top: 12px; font-size: 11px; color: #999;">
        Metadata time range: ${new Date(metadata.start_time).toLocaleString()} - ${metadata.end_time ? new Date(metadata.end_time).toLocaleString() : 'N/A'}
      </div>
    ` : ''}
  `;

  return statsDiv;
}

// Calculate detection statistics
function calculateDetectionStats(detections) {
  const stats = {
    uniqueLabels: new Set(),
    uniqueObjects: new Set(),
    labelCounts: new Map(),
    avgScore: null,
    timeRange: {
      earliest: null,
      latest: null
    }
  };

  if (detections.length === 0) {
    return stats;
  }

  let totalScore = 0;
  let scoreCount = 0;

  detections.forEach(detection => {
    // Track unique labels
    if (detection.label) {
      stats.uniqueLabels.add(detection.label);
      stats.labelCounts.set(
        detection.label,
        (stats.labelCounts.get(detection.label) || 0) + 1
      );
    }

    // Track unique object IDs
    if (detection.id) {
      stats.uniqueObjects.add(detection.id);
    }

    // Calculate average score
    if (typeof detection.score === 'number') {
      totalScore += detection.score;
      scoreCount++;
    }

    // Track time range
    if (detection.timestamp) {
      const time = new Date(detection.timestamp);
      if (!stats.timeRange.earliest || time < new Date(stats.timeRange.earliest)) {
        stats.timeRange.earliest = detection.timestamp;
      }
      if (!stats.timeRange.latest || time > new Date(stats.timeRange.latest)) {
        stats.timeRange.latest = detection.timestamp;
      }
    }
  });

  if (scoreCount > 0) {
    stats.avgScore = totalScore / scoreCount;
  }

  return stats;
}

// Calculate duration between two timestamps
function calculateDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end - start;

  if (durationMs < 0) return 'N/A';

  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Get color for label
function getLabelColor(label) {
  const colors = {
    'person': '#FF5722',
    'face_cover': '#9C27B0',
    'vehicle': '#2196F3',
    'car': '#2196F3',
    'truck': '#3F51B5',
    'bicycle': '#4CAF50',
    'motorcycle': '#FF9800'
  };
  return colors[label?.toLowerCase()] || '#666';
}


async function renderAlertDetail(alert) {
  const container = document.getElementById('detailContent');
  const timestamp = new Date(alert.start_time).toLocaleString();
  const endTime = alert.end_time ? new Date(alert.end_time).toLocaleString() : 'N/A';

  container.innerHTML = `
    <div class="detail-section">
      <h3>Alert ID</h3>
      <div style="font-family: 'Monaco', 'Courier New', monospace; font-size: 14px; color: #1976D2; padding: 10px; background: #f5f5f5; border-radius: 4px; word-break: break-all;">
        ${alert.id || alert._id}
      </div>
    </div>
    
    <div class="detail-section">
      <h3>Information</h3>
      <div class="detail-meta">
        <div class="detail-meta-item">
          <strong>Camera ID</strong>
          ${alert.peripheral_id || 'N/A'}
        </div>
        <div class="detail-meta-item">
          <strong>Device ID</strong>
          ${alert.from_device || 'N/A'}
        </div>
        <div class="detail-meta-item">
          <strong>Start Time</strong>
          ${timestamp}
        </div>
        <div class="detail-meta-item">
          <strong>End Time</strong>
          ${endTime}
        </div>
        <div class="detail-meta-item">
          <strong>Status</strong>
          <span class="status-badge status-${alert.status || 'new'}">${alert.status || 'new'}</span>
        </div>
        <div class="detail-meta-item">
          <strong>Detection ID</strong>
          ${alert.detection_id || 'N/A'}
        </div>
        <div class="detail-meta-item">
          <strong>Label</strong>
          ${alert.label || 'N/A'}
        </div>
        <div class="detail-meta-item">
          <strong>Duration</strong>
          ${alert.duration || 0}s
        </div>
      </div>
    </div>
    
    ${alert.llm_classification && alert.llm_classification.summary ? `
    <div class="detail-section">
      <h3>AI Summary</h3>
      <div style="padding: 10px; background: #f9f9f9; border-radius: 4px; line-height: 1.6;">
        ${alert.llm_classification.summary}
      </div>
      ${alert.llm_classification.count_humans ? `
        <div style="margin-top: 10px; font-size: 14px; color: #666;">
          👥 ${alert.llm_classification.count_humans} human(s) detected
          ${alert.llm_classification.frames_processed ? ` | 🎬 ${alert.llm_classification.frames_processed} frames processed` : ''}
        </div>
      ` : ''}
    </div>
    ` : ''}
    
    <div class="detail-section">
      <h3>Image Snapshot</h3>
      <div class="detail-image" id="detailImageContainer">
        <div class="loading">Loading image...</div>
      </div>
    </div>
    
    ${alert.videoUrl ? `
    <div class="detail-section">
      <h3>Video</h3>
      <video controls style="max-width: 100%; border-radius: 4px;">
        <source src="${alert.videoUrl}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
    </div>
    ` : ''}
  `;

  // Load and display image with bounding boxes
  if (alert.imageUrl) {
    loadAlertImage(alert);
  }
}

async function loadAlertImage(alert) {
  const container = document.getElementById('detailImageContainer');

  try {
    console.log('Loading image from URL:', alert.imageUrl);

    // Load image
    const image = await canvasUtils.loadImage(alert.imageUrl);
    console.log('Image loaded successfully:', image.width, 'x', image.height);

    // Load metadata if available
    let metadata = null;
    if (alert.metadataUrl) {
      try {
        console.log('Loading metadata from URL:', alert.metadataUrl);
        metadata = await api.getMetadata(alert.metadataUrl);
        console.log('Metadata loaded:', metadata);
      } catch (error) {
        console.warn('Failed to load metadata:', error);
      }
    }

    // Create canvas with image and bounding boxes
    const canvas = document.createElement('canvas');
    canvas.style.maxWidth = '100%';
    canvas.style.cursor = 'pointer';

    canvasUtils.drawBoundingBoxes(canvas, image, metadata);

    container.innerHTML = '';
    container.appendChild(canvas);

    // Add click handler to view full size
    canvas.addEventListener('click', () => {
      showImageModal(alert, image, metadata);
    });

    // Add button to view full size
    const button = document.createElement('button');
    button.className = 'view-full';
    button.textContent = 'View Full Size';
    button.addEventListener('click', () => {
      showImageModal(alert, image, metadata);
    });
    container.appendChild(button);

  } catch (error) {
    console.error('Error loading image:', error);
    console.error('Image URL was:', alert.imageUrl);

    // Show user-friendly error message
    const errorMessage = error.message.includes('File not found') || error.message.includes('404')
      ? 'Media file not available in storage'
      : 'Failed to load image';

    container.innerHTML = `
      <div class="error" style="padding: 30px; text-align: center; background: #f9f9f9; border-radius: 8px;">
        <div style="font-size: 64px; margin-bottom: 15px; opacity: 0.5;">📷</div>
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #666;">${errorMessage}</div>
        <div style="font-size: 13px; color: #999; margin-bottom: 5px;">
          Path: <code style="background: #fff; padding: 2px 6px; border-radius: 3px; font-size: 11px;">${alert.video_snapshot || 'N/A'}</code>
        </div>
        <div style="font-size: 12px; color: #aaa; margin-top: 10px;">
          The media file may have been deleted, never uploaded, or the path may be incorrect.
        </div>
      </div>
    `;
  }
}

function showImageModal(alert, image, metadata) {
  const modal = document.getElementById('imageModal');
  const canvas = document.getElementById('imageCanvas');
  const metadataContainer = document.getElementById('imageMetadata');

  // Draw image on modal canvas
  canvasUtils.drawBoundingBoxes(canvas, image, metadata);

  // Display metadata
  let metadataHtml = '<h3>Detection Details</h3>';
  if (metadata && metadata.boxes && metadata.boxes.length > 0) {
    metadataHtml += '<ul>';
    metadata.boxes.forEach((box, index) => {
      metadataHtml += `
        <li>
          <strong>Object ${index + 1}:</strong> 
          ${box.class || 'unknown'} 
          (${(box.confidence * 100).toFixed(1)}% confidence) - 
          Position: (${Math.round(box.x)}, ${Math.round(box.y)}) 
          Size: ${Math.round(box.width)}x${Math.round(box.height)}
        </li>
      `;
    });
    metadataHtml += '</ul>';
  } else {
    metadataHtml += '<p>No bounding box data available</p>';
  }

  metadataContainer.innerHTML = metadataHtml;
  modal.style.display = 'block';
}

function applySearch() {
  const searchValue = document.getElementById('searchInput').value.trim();
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;

  currentFilters = {};
  if (searchValue) {
    currentFilters.search = searchValue;
  }

  // Add date filters if set
  if (startDate) {
    currentFilters.startDate = new Date(startDate).toISOString();
  }
  if (endDate) {
    currentFilters.endDate = new Date(endDate).toISOString();
  }

  loadAlerts(1);
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  setDefaultDateRange();
  currentFilters = {};
  loadAlerts(1);
}

// Set default date range (last 24 hours)
function setDefaultDateRange() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Format dates for datetime-local input (YYYY-MM-DDTHH:MM)
  const formatDateTimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  document.getElementById('startDate').value = formatDateTimeLocal(oneDayAgo);
  document.getElementById('endDate').value = formatDateTimeLocal(now);
}

function showError(message) {
  const container = document.getElementById('alertsContainer');
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  container.prepend(errorDiv);

  setTimeout(() => errorDiv.remove(), 5000);
}


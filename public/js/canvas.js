// Canvas utilities for drawing bounding boxes on images

const canvasUtils = {
  // Map to persist colors per detection id across draws
  _detectionColorMap: {},
  _colorPoolIndex: 0,
  _colorPool: [
    '#FF5722', '#2196F3', '#4CAF50', '#FF9800',
    '#9C27B0', '#00BCD4', '#FFEB3B', '#795548',
    '#E91E63', '#3F51B5', '#8BC34A', '#607D8B'
  ],

  // Load image from URL (restored after cleanup removal)
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // allow cross-origin snapshots
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.error('Image failed to load:', url);
        reject(new Error(`Failed to load image from ${url}`));
      };
      img.src = url;
    });
  },

  // Generate / fetch stable stroke color per detection id (independent of label)
  getStrokeColorForId(detection, index) {
    if (detection && detection.id) {
      if (this._detectionColorMap[detection.id]) {
        return this._detectionColorMap[detection.id];
      }
      const chosen = this._colorPool[this._colorPoolIndex++ % this._colorPool.length];
      this._detectionColorMap[detection.id] = chosen;
      return chosen;
    }
    // No id: pick deterministic fallback based on index
    return this._colorPool[index % this._colorPool.length];
  },

  // Provide label color (semantic) with fallback
  getLabelColor(label) {
    const classColor = this.getClassColor(label);
    return classColor || '#444';
  },

  // Draw bounding boxes on canvas
  drawBoundingBoxes(canvas, image, metadata, annotationsData, filterOptions) {
    const ctx = canvas.getContext('2d');
    try {
      // Set canvas size to match image
      canvas.width = image.width;
      canvas.height = image.height;

      // Draw base image first
      ctx.drawImage(image, 0, 0, image.width, image.height);

      let detections = [];
      if (annotationsData && annotationsData.data && Array.isArray(annotationsData.data.detections)) {
        detections = annotationsData.data.detections;
      } else if (metadata) {
        if (Array.isArray(metadata.detections)) {
          detections = metadata.detections;
        } else if (Array.isArray(metadata.boxes)) {
          detections = metadata.boxes.map(b => ({ _legacyPixels: true, x: b.x, y: b.y, width: b.width, height: b.height, label: b.class || b.label, score: b.confidence }));
        }
      }
      if (!detections.length) return;

      // Normalize filter options
      const fo = filterOptions || {};
      const labelSet = fo.labels instanceof Set ? fo.labels : (Array.isArray(fo.labels) ? new Set(fo.labels) : null);
      const idSet = fo.ids instanceof Set ? fo.ids : (Array.isArray(fo.ids) ? new Set(fo.ids) : null);
      const showBoxes = fo.showBoxes !== false; // default true
      const showPaths = fo.showPaths !== false; // default true

      // Filter detections upfront
      const filtered = detections.filter((d, idx) => {
        const lbl = d.label ? d.label.toLowerCase() : null;
        if (labelSet && lbl && !labelSet.has(lbl)) return false;
        if (idSet && d.id && !idSet.has(String(d.id))) return false;
        return true;
      });
      if (!filtered.length) return;

      // First pass collect person paths if enabled
      const personPaths = {};
      if (showPaths) {
        filtered.forEach((d, index) => {
          const labelOk = d.label && d.label.toLowerCase() === 'person';
          if (!labelOk) return;
          let x, y, width, height;
          if (d._legacyPixels) { x = d.x; y = d.y; width = d.width; height = d.height; }
          else if (typeof d.x1 === 'number') { x = d.x1 * image.width; y = d.y1 * image.height; width = (d.x2 - d.x1) * image.width; height = (d.y2 - d.y1) * image.height; }
          else if (typeof d.x === 'number') { x = d.x; y = d.y; width = d.width; height = d.height; }
          else return;
          if (width <= 0 || height <= 0) return;
          const midBottomX = x + width / 2;
          const midBottomY = y + height;
          const idKey = d.id || `person_${index}`;
          (personPaths[idKey] ||= []).push({ x: midBottomX, y: midBottomY, ts: d.timestamp || index });
        });
      }

      // Second pass draw boxes & labels if enabled
      if (showBoxes) {
        filtered.forEach((d, index) => {
          let x, y, width, height;
          if (d._legacyPixels) { x = d.x; y = d.y; width = d.width; height = d.height; }
          else if (typeof d.x1 === 'number') { x = d.x1 * image.width; y = d.y1 * image.height; width = (d.x2 - d.x1) * image.width; height = (d.y2 - d.y1) * image.height; }
          else if (typeof d.x === 'number') { x = d.x; y = d.y; width = d.width; height = d.height; }
          else return;
          if (width <= 0 || height <= 0) return;

          const strokeColor = this.getStrokeColorForId(d, index);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, width, height);

          const labelParts = [];
          if (d.label) labelParts.push(d.label);
          if (typeof d.score === 'number') labelParts.push(`${(d.score * 100).toFixed(0)}%`);
          if (d.id) labelParts.push(`#${String(d.id).slice(-6)}`);
          const labelText = labelParts.join(' ');
          if (labelText) {
            ctx.font = '13px Arial';
            const paddingX = 6;
            const metrics = ctx.measureText(labelText);
            const textWidth = metrics.width + paddingX * 2;
            const textHeight = 18;
            const labelY = Math.max(y - textHeight, 0);
            const tabColor = this.getLabelColor(d.label);
            ctx.fillStyle = tabColor;
            ctx.fillRect(x, labelY, textWidth, textHeight);
            ctx.fillStyle = strokeColor; ctx.fillRect(x, labelY, 4, textHeight);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(labelText, x + paddingX, labelY + textHeight - 6);
          }
        });
      }

      // Third pass draw paths for persons
      if (showPaths) {
        Object.entries(personPaths).forEach(([id, points]) => {
          if (points.length < 2) return;
          points.sort((a,b)=> (a.ts > b.ts ? 1 : a.ts < b.ts ? -1 : 0));
          const strokeColor = this._detectionColorMap[id] || '#FFFFFF';
          ctx.save();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([6,4]);
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i=1;i<points.length;i++) ctx.lineTo(points[i].x, points[i].y);
          ctx.stroke();
          ctx.setLineDash([]);
          points.forEach(p => { ctx.beginPath(); ctx.fillStyle = strokeColor; ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill(); });
          ctx.restore();
        });
      }
    } catch (err) { console.error('drawBoundingBoxes error:', err); }
  },

  // Stable color selection per detection id
  getColorForDetection(detection, index) {
    // If we have an id, try to reuse its color
    if (detection && detection.id) {
      if (this._detectionColorMap[detection.id]) {
        return this._detectionColorMap[detection.id];
      }
      // If a known class color exists, prefer that for initial assignment
      const classColor = this.getClassColor(detection.label);
      const chosen = classColor || this._colorPool[this._colorPoolIndex++ % this._colorPool.length];
      this._detectionColorMap[detection.id] = chosen;
      return chosen;
    }
    // Fall back: class color or color array by index
    return this.getClassColor(detection?.label) || this._colorPool[index % this._colorPool.length];
  },

  // Existing class color mapping
  getClassColor(className) {
    if (!className) return null;
    const colors = {
      person: '#FF5722',
      vehicle: '#2196F3',
      car: '#2196F3',
      truck: '#3F51B5',
      bicycle: '#4CAF50',
      motorcycle: '#FF9800',
      face_cover: '#9C27B0'
    };
    return colors[className.toLowerCase()] || null;
  }
};

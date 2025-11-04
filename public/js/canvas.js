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

  drawLineCrossings(ctx, lineConfig, canvasWidth, canvasHeight) {
    if (!lineConfig || !Array.isArray(lineConfig.lines) || lineConfig.lines.length === 0) return;
    const configWidth = lineConfig.configWidth || canvasWidth;
    const configHeight = lineConfig.configHeight || canvasHeight;
    const scaleX = configWidth ? canvasWidth / configWidth : 1;
    const scaleY = configHeight ? canvasHeight / configHeight : 1;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    lineConfig.lines.forEach((line) => {
      const points = Array.isArray(line.points) ? line.points : [];
      if (!Array.isArray(points) || points.length < 2) return;

      ctx.beginPath();
      points.forEach((pt, index) => {
        const x = pt.x * scaleX;
        const y = pt.y * scaleY;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = line.stroke || '#00BCD4';
      ctx.stroke();

      let tailIndex = points.length - 1;
      let headIndex = points.length - 2;
      if (tailIndex >= 0 && points[tailIndex].x === points[0].x && points[tailIndex].y === points[0].y) {
        tailIndex = points.length - 2;
        headIndex = points.length - 3;
      }
      if (tailIndex >= 0 && headIndex >= 0) {
        const tail = points[tailIndex];
        const head = points[headIndex];
        const tailX = tail.x * scaleX;
        const tailY = tail.y * scaleY;
        const headX = head.x * scaleX;
        const headY = head.y * scaleY;
        const angle = Math.atan2(tailY - headY, tailX - headX);
        this.drawTriangleMarker(ctx, tailX, tailY, angle, line.stroke || '#00BCD4', 12);
      }

      if (line.displayLabel) {
        let cx;
        let cy;
        if (line.centroid && Number.isFinite(line.centroid.x) && Number.isFinite(line.centroid.y)) {
          cx = line.centroid.x * scaleX;
          cy = line.centroid.y * scaleY;
        } else {
          const summed = points.reduce((acc, pt) => {
            acc.x += pt.x;
            acc.y += pt.y;
            return acc;
          }, { x: 0, y: 0 });
          cx = (summed.x / points.length) * scaleX;
          cy = (summed.y / points.length) * scaleY;
        }
        const label = line.displayLabel;
        ctx.font = '12px "Helvetica Neue", Arial, sans-serif';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(label);
        const paddingX = 6;
        const boxWidth = metrics.width + paddingX * 2;
        const boxHeight = 18;
        const rectX = cx - boxWidth / 2;
        const rectY = cy - boxHeight / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(rectX, rectY, boxWidth, boxHeight);
        ctx.strokeStyle = line.stroke || '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(rectX, rectY, boxWidth, boxHeight);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, cx - metrics.width / 2, cy);
      }
    });

    ctx.restore();
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
      const fo = filterOptions || {};
      const overlayOnly = !!fo.overlayOnly;

      // Determine target dimensions (from image or stored dataset)
      if (!overlayOnly && image) {
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.dataset.origWidth = image.width;
        canvas.dataset.origHeight = image.height;
      } else if (overlayOnly && (!canvas.width || !canvas.height)) {
        // Fallback if dimensions missing
        const w = parseInt(canvas.dataset.origWidth) || 1280;
        const h = parseInt(canvas.dataset.origHeight) || 720;
        canvas.width = w;
        canvas.height = h;
      }

      const baseWidth = canvas.width;
      const baseHeight = canvas.height;

      // Clear canvas for overlay redraw
      ctx.clearRect(0, 0, baseWidth, baseHeight);

      // Draw base image unless overlayOnly
      if (!overlayOnly && image) {
        ctx.drawImage(image, 0, 0, baseWidth, baseHeight);
      }

      const hasLineCrossings = Array.isArray(fo.lineCrossings?.lines) && fo.lineCrossings.lines.length > 0;
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
      if (!detections.length && !hasLineCrossings) return;

      const labelSet = fo.labels instanceof Set ? fo.labels : (Array.isArray(fo.labels) ? new Set(fo.labels) : null);
      const idSet = fo.ids instanceof Set ? fo.ids : (Array.isArray(fo.ids) ? new Set(fo.ids) : null);
      const showBoxes = fo.showBoxes !== false;
      const showPaths = fo.showPaths !== false;
      const frameCutoff = typeof fo.maxFrameIndex === 'number' ? fo.maxFrameIndex : null;

      const filtered = detections.filter(d => {
        const lbl = d.label ? d.label.toLowerCase() : null;
        if (labelSet && lbl && !labelSet.has(lbl)) return false;
        if (idSet && d.id && !idSet.has(String(d.id))) return false;
        if (frameCutoff !== null) {
          const frameIndex = typeof d.__frameIndex === 'number' ? d.__frameIndex : detections.indexOf(d);
          if (frameIndex > frameCutoff) return false;
        }
        return true;
      });
      const hasFilteredDetections = filtered.length > 0;

      const personPaths = {};
      if (showPaths && hasFilteredDetections) {
        filtered.forEach((d, index) => {
          if (!(d.label && d.label.toLowerCase() === 'person')) return;
          let x, y, width, height;
          if (d._legacyPixels) { x = d.x; y = d.y; width = d.width; height = d.height; }
          else if (typeof d.x1 === 'number') { x = d.x1 * baseWidth; y = d.y1 * baseHeight; width = (d.x2 - d.x1) * baseWidth; height = (d.y2 - d.y1) * baseHeight; }
          else if (typeof d.x === 'number') { x = d.x; y = d.y; width = d.width; height = d.height; }
          else return;
          if (width <= 0 || height <= 0) return;
          const midBottomX = x + width / 2;
          const midBottomY = y + height;
          const idKey = d.id || `person_${index}`;
          (personPaths[idKey] ||= []).push({ x: midBottomX, y: midBottomY, ts: d.timestamp || index });
        });
      }

      if (showBoxes && hasFilteredDetections) {
        filtered.forEach((d, index) => {
          let x, y, width, height;
          if (d._legacyPixels) { x = d.x; y = d.y; width = d.width; height = d.height; }
          else if (typeof d.x1 === 'number') { x = d.x1 * baseWidth; y = d.y1 * baseHeight; width = (d.x2 - d.x1) * baseWidth; height = (d.y2 - d.y1) * baseHeight; }
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
            ctx.fillStyle = strokeColor;
            ctx.fillRect(x, labelY, 4, textHeight);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(labelText, x + paddingX, labelY + textHeight - 6);
          }
        });
      }

      if (showPaths && hasFilteredDetections) {
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
          // Draw directional triangle markers
          for (let i=0;i<points.length;i++) {
            const p = points[i];
            // Determine direction vector: prefer next point; fallback to previous if last
            let dx, dy;
            if (i < points.length - 1) {
              dx = points[i+1].x - p.x;
              dy = points[i+1].y - p.y;
            } else {
              dx = p.x - points[i-1].x;
              dy = p.y - points[i-1].y;
            }
            const angle = Math.atan2(dy, dx);
            this.drawTriangleMarker(ctx, p.x, p.y, angle, strokeColor);
          }
          ctx.restore();
        });
      }

      if (hasLineCrossings) {
        this.drawLineCrossings(ctx, fo.lineCrossings, baseWidth, baseHeight);
      }
    } catch (err) { console.error('drawBoundingBoxes error:', err); }
  },

  // Helper: draw oriented triangle marker pointing along angle
  drawTriangleMarker(ctx, x, y, angle, color, size = 12) {
    // Triangle pointing along +X in local space: tip ahead, base behind
    const tip = { x: size, y: 0 };
    const left = { x: 0, y: -size / 2 };
    const right = { x: 0, y: size / 2 };

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tx = (pt) => ({ x: x + pt.x * cos - pt.y * sin, y: y + pt.x * sin + pt.y * cos });

    const tipT = tx(tip);
    const leftT = tx(left);
    const rightT = tx(right);

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.moveTo(tipT.x, tipT.y);
    ctx.lineTo(leftT.x, leftT.y);
    ctx.lineTo(rightT.x, rightT.y);
    ctx.closePath();
    ctx.fill();
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

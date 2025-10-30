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
  drawBoundingBoxes(canvas, image, metadata, annotationsData) {
    const ctx = canvas.getContext('2d');
    try {
      // Set canvas size to match image
      canvas.width = image.width;
      canvas.height = image.height;

      // Draw base image first
      ctx.drawImage(image, 0, 0, image.width, image.height);

      // Collect detections from annotations or legacy metadata
      let detections = [];

      if (annotationsData && annotationsData.data && Array.isArray(annotationsData.data.detections)) {
        detections = annotationsData.data.detections;
      } else if (metadata) {
        // Legacy format: metadata.boxes (absolute pixel coords) or metadata.detections
        if (Array.isArray(metadata.detections)) {
          detections = metadata.detections;
        } else if (Array.isArray(metadata.boxes)) {
          // Convert legacy boxes to normalized style structure
          detections = metadata.boxes.map(b => ({
            // legacy: x,y,width,height are pixel-based relative to original image dims
            // Attempt normalization if image dimensions known in metadata, else treat as pixel coords with a flag
            _legacyPixels: true,
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            label: b.class || b.label,
            score: b.confidence,
          }));
        }
      }

      if (!detections || detections.length === 0) {
        return; // nothing to draw beyond the image
      }

      detections.forEach((detection, index) => {
        let x, y, width, height;

        if (detection._legacyPixels) {
          // Legacy pixel-based box
            x = detection.x;
            y = detection.y;
            width = detection.width;
            height = detection.height;
        } else if (typeof detection.x1 === 'number' && typeof detection.y1 === 'number' && typeof detection.x2 === 'number' && typeof detection.y2 === 'number') {
          // Normalized coordinates (0..1)
          x = detection.x1 * image.width;
          y = detection.y1 * image.height;
          width = (detection.x2 - detection.x1) * image.width;
          height = (detection.y2 - detection.y1) * image.height;
        } else if (typeof detection.x === 'number' && typeof detection.y === 'number' && typeof detection.width === 'number' && typeof detection.height === 'number') {
          // Possibly already pixel-based (from some pipeline)
          x = detection.x;
          y = detection.y;
          width = detection.width;
          height = detection.height;
        } else {
          return; // skip invalid
        }

        if (width <= 0 || height <= 0) return;

        const strokeColor = this.getStrokeColorForId(detection, index);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Compose label text
        const labelParts = [];
        if (detection.label) labelParts.push(detection.label);
        if (typeof detection.score === 'number') labelParts.push(`${(detection.score * 100).toFixed(0)}%`);
        if (detection.id) labelParts.push(`#${String(detection.id).slice(-6)}`);
        const labelText = labelParts.join(' ');

        if (labelText) {
          ctx.font = '13px Arial';
          const paddingX = 6;
          const metrics = ctx.measureText(labelText);
          const textWidth = metrics.width + paddingX * 2;
          const textHeight = 18;
          const labelY = Math.max(y - textHeight, 0);
          const tabColor = this.getLabelColor(detection.label);
          ctx.fillStyle = tabColor;
          ctx.fillRect(x, labelY, textWidth, textHeight);
          // Optional small stroke color indicator strip at left
          ctx.fillStyle = strokeColor;
          ctx.fillRect(x, labelY, 4, textHeight);
          // Text
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(labelText, x + paddingX, labelY + textHeight - 6);
        }
      });
    } catch (err) {
      console.error('drawBoundingBoxes error:', err);
      // Ensure at least image remains visible; already drawn above.
    }
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

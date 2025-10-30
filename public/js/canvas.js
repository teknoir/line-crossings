// Canvas utilities for drawing bounding boxes on images

const canvasUtils = {
  // Draw bounding boxes on canvas
  drawBoundingBoxes(canvas, image, metadata, annotationsData) {
    const ctx = canvas.getContext('2d');

    // Set canvas size to match image
    canvas.width = image.width;
    canvas.height = image.height;

    // Draw the image
    ctx.drawImage(image, 0, 0, image.width, image.height);

    // If no metadata or annotations, return
    if (!annotationsData || !annotationsData.data || !annotationsData.data.detections) {
      return;
    }

    const detections = annotationsData.data.detections;

    // If no detections, return
    if (detections.length === 0) {
      return;
    }

    // Draw each detection bounding box
    detections.forEach((detection, index) => {
      // Extract normalized coordinates from detection
      const x1 = detection.x1;
      const y1 = detection.y1;
      const x2 = detection.x2;
      const y2 = detection.y2;

      // Skip if coordinates are invalid
      if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
        return;
      }

      // Convert normalized coordinates to pixel coordinates
      const x = x1 * image.width;
      const y = y1 * image.height;
      const width = (x2 - x1) * image.width;
      const height = (y2 - y1) * image.height;

      // Get color based on label
      const color = this.getColorForClass(detection.label, index);

      // Draw rectangle
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // Draw label background
      const label = detection.label || 'object';
      const confidence = detection.score ? ` ${(detection.score * 100).toFixed(0)}%` : '';
      const labelText = `${label}${confidence}`;

      ctx.font = '14px Arial';
      const textMetrics = ctx.measureText(labelText);
      const textHeight = 20;

      ctx.fillStyle = color;
      ctx.fillRect(x, y - textHeight, textMetrics.width + 8, textHeight);

      // Draw label text
      ctx.fillStyle = 'white';
      ctx.fillText(labelText, x + 4, y - 5);
    });
  },

  // Get color for bounding box based on class
  getColorForClass(className, index) {
    const colors = {
      'person': '#FF5722',
      'vehicle': '#2196F3',
      'car': '#2196F3',
      'truck': '#3F51B5',
      'bicycle': '#4CAF50',
      'motorcycle': '#FF9800',
      'default': '#E91E63'
    };

    const colorArray = [
      '#FF5722', '#2196F3', '#4CAF50', '#FF9800',
      '#9C27B0', '#00BCD4', '#FFEB3B', '#795548'
    ];

    if (className && colors[className.toLowerCase()]) {
      return colors[className.toLowerCase()];
    }

    return colorArray[index % colorArray.length];
  },

  // Load image from URL
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Required for cross-origin images
      img.onload = () => resolve(img);
      img.onerror = (err) => {
        console.error('Image failed to load:', url);
        reject(new Error(`Failed to load image from ${url}`));
      };
      img.src = url;
    });
  },

  // Create thumbnail with bounding boxes
  async createThumbnail(imageUrl, metadataUrl, maxWidth = 200) {
    try {
      const image = await this.loadImage(imageUrl);
      const metadata = metadataUrl ? await api.getMetadata(metadataUrl) : null;

      const canvas = document.createElement('canvas');
      const scale = maxWidth / image.width;
      canvas.width = maxWidth;
      canvas.height = image.height * scale;

      const scaledImage = await this.scaleImage(image, canvas.width, canvas.height);
      this.drawBoundingBoxes(canvas, scaledImage, metadata);

      return canvas.toDataURL();
    } catch (error) {
      console.error('Error creating thumbnail:', error);
      return null;
    }
  },

  // Scale image
  scaleImage(image, width, height) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, width, height);

      const scaledImage = new Image();
      scaledImage.onload = () => resolve(scaledImage);
      scaledImage.src = canvas.toDataURL();
    });
  }
};


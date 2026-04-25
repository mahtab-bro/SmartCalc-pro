// ══════════════════════════════════════════════
// ENHANCED DESMOS-STYLE GRAPH ENGINE
// ══════════════════════════════════════════════

const GraphEngine = {
  // State
  graphs: [], // Array of {fn, color, visible, points:[]}
  viewBox: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
  gridScale: 1,
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  panStart: { x: 0, y: 0 },
  pixelRatio: 1,
  canvas: null,
  ctx: null,
  colors: ['#7c6af7', '#f76a8f', '#6af7c8', '#f7c46a', '#a78bfa', '#fb7185', '#22d3ee'],

  init(canvasEl, mathEngine) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.ME = mathEngine;
    this.pixelRatio = window.devicePixelRatio || 1;
    
    // Handle DPI
    const rect = canvasEl.getBoundingClientRect();
    canvasEl.width = rect.width * this.pixelRatio;
    canvasEl.height = rect.height * this.pixelRatio;
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
    
    this.setupInteractions();
    this.draw();
  },

  setupInteractions() {
    const canvas = this.canvas;
    
    // Wheel zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 1.2 : 0.85;
      this.zoomAt(px, py, delta);
      this.draw();
    });

    // Drag pan
    canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.panStart = { ...this.viewBox };
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      const rect = canvas.getBoundingClientRect();
      
      const xRange = this.viewBox.xMax - this.viewBox.xMin;
      const yRange = this.viewBox.yMax - this.viewBox.yMin;
      
      const xShift = -(dx / rect.width) * xRange;
      const yShift = (dy / rect.height) * yRange;
      
      this.viewBox.xMin = this.panStart.xMin + xShift;
      this.viewBox.xMax = this.panStart.xMax + xShift;
      this.viewBox.yMin = this.panStart.yMin + yShift;
      this.viewBox.yMax = this.panStart.yMax + yShift;
      
      this.draw();
    });

    canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
    });

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this.isDragging = true;
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        this.dragStart.dist = Math.hypot(
          touch1.clientX - touch2.clientX,
          touch1.clientY - touch2.clientY
        );
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this.dragStart.dist) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const newDist = Math.hypot(
          touch1.clientX - touch2.clientX,
          touch1.clientY - touch2.clientY
        );
        const delta = newDist / this.dragStart.dist;
        const rect = this.canvas.getBoundingClientRect();
        const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
        const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
        this.zoomAt(centerX, centerY, delta > 1 ? 0.9 : 1.1);
        this.dragStart.dist = newDist;
        this.draw();
      }
    });
  },

  zoomAt(px, py, factor) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = this.viewBox.xMin + (px / rect.width) * (this.viewBox.xMax - this.viewBox.xMin);
    const my = this.viewBox.yMax - (py / rect.height) * (this.viewBox.yMax - this.viewBox.yMin);
    
    const xRange = (this.viewBox.xMax - this.viewBox.xMin) * factor / 2;
    const yRange = (this.viewBox.yMax - this.viewBox.yMin) * factor / 2;
    
    this.viewBox.xMin = mx - xRange;
    this.viewBox.xMax = mx + xRange;
    this.viewBox.yMin = my - yRange;
    this.viewBox.yMax = my + yRange;
  },

  addGraph(fn, color = null) {
    const idx = this.graphs.length;
    const col = color || this.colors[idx % this.colors.length];
    this.graphs.push({ fn, color: col, visible: true, points: [] });
    this.updateGraph(idx);
  },

  removeGraph(idx) {
    this.graphs.splice(idx, 1);
  },

  updateGraph(idx) {
    const g = this.graphs[idx];
    if (!g || !g.visible) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const points = [];
    
    // Sample at higher resolution for smoothness
    for (let px = 0; px <= rect.width; px += 0.5) {
      const x = this.viewBox.xMin + (px / rect.width) * (this.viewBox.xMax - this.viewBox.xMin);
      const { result, error } = this.ME.evaluate(g.fn, x);
      
      if (!error && isFinite(result)) {
        points.push({ x, y: result });
      }
    }
    
    g.points = points;
  },

  autoScale() {
    if (this.graphs.length === 0) {
      this.viewBox = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
      return;
    }

    let minY = Infinity, maxY = -Infinity;
    
    for (const g of this.graphs) {
      if (!g.visible || !g.points.length) continue;
      for (const p of g.points) {
        if (isFinite(p.y)) {
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      }
    }

    if (!isFinite(minY) || !isFinite(maxY)) {
      minY = -10;
      maxY = 10;
    }

    const yPad = Math.max(1, (maxY - minY) * 0.1);
    this.viewBox.yMin = minY - yPad;
    this.viewBox.yMax = maxY + yPad;
  },

  draw() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Clear
    this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--surface2');
    this.ctx.fillRect(0, 0, w, h);

    // Draw grid
    this.drawGrid(w, h);

    // Draw axes
    this.drawAxes(w, h);

    // Draw all graphs
    for (const g of this.graphs) {
      if (g.visible && g.points.length) {
        this.drawFunction(g, w, h);
      }
    }
  },

  drawGrid(w, h) {
    const ctx = this.ctx;
    const xRange = this.viewBox.xMax - this.viewBox.xMin;
    const yRange = this.viewBox.yMax - this.viewBox.yMin;

    // Calculate grid spacing
    const gridX = this.getGridSpacing(xRange);
    const gridY = this.getGridSpacing(yRange);

    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border');
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;

    // Vertical grid lines
    let x = Math.ceil(this.viewBox.xMin / gridX) * gridX;
    while (x <= this.viewBox.xMax) {
      const px = this.xToPx(x, w);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      x += gridX;
    }

    // Horizontal grid lines
    let y = Math.ceil(this.viewBox.yMin / gridY) * gridY;
    while (y <= this.viewBox.yMax) {
      const py = this.yToPy(y, h);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
      y += gridY;
    }

    ctx.globalAlpha = 1;
  },

  drawAxes(w, h) {
    const ctx = this.ctx;
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--text-dim');
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-dim');
    ctx.lineWidth = 1.5;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';

    // X-axis
    const xAxisPy = this.yToPy(0, h);
    if (xAxisPy >= 0 && xAxisPy <= h) {
      ctx.beginPath();
      ctx.moveTo(0, xAxisPy);
      ctx.lineTo(w, xAxisPy);
      ctx.stroke();
    }

    // Y-axis
    const yAxisPx = this.xToPx(0, w);
    if (yAxisPx >= 0 && yAxisPx <= w) {
      ctx.beginPath();
      ctx.moveTo(yAxisPx, 0);
      ctx.lineTo(yAxisPx, h);
      ctx.stroke();
    }

    // X-axis labels
    const gridX = this.getGridSpacing(this.viewBox.xMax - this.viewBox.xMin);
    let x = Math.ceil(this.viewBox.xMin / gridX) * gridX;
    while (x <= this.viewBox.xMax) {
      if (Math.abs(x) < 0.01) x += gridX;
      const px = this.xToPx(x, w);
      const label = Math.abs(x) < 100 ? x.toFixed(1) : x.toExponential(1);
      ctx.fillText(label, px, xAxisPy + 15);
      x += gridX;
    }

    // Y-axis labels
    const gridY = this.getGridSpacing(this.viewBox.yMax - this.viewBox.yMin);
    let y = Math.ceil(this.viewBox.yMin / gridY) * gridY;
    while (y <= this.viewBox.yMax) {
      if (Math.abs(y) < 0.01) y += gridY;
      const py = this.yToPy(y, h);
      const label = Math.abs(y) < 100 ? y.toFixed(1) : y.toExponential(1);
      ctx.textAlign = 'right';
      ctx.fillText(label, yAxisPx - 10, py + 4);
      y += gridY;
    }
  },

  drawFunction(g, w, h) {
    const ctx = this.ctx;
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const points = g.points;
    if (points.length < 2) return;

    ctx.beginPath();
    let moved = false;

    for (let i = 0; i < points.length; i++) {
      const px = this.xToPx(points[i].x, w);
      const py = this.yToPy(points[i].y, h);

      // Skip points outside canvas or after asymptotes
      if (px < -10 || px > w + 10) continue;
      
      if (i > 0) {
        const prevPx = this.xToPx(points[i - 1].x, w);
        const prevPy = this.yToPy(points[i - 1].y, h);
        
        // Detect asymptote
        if (Math.abs(py - prevPy) > h * 0.7) {
          ctx.stroke();
          ctx.beginPath();
          moved = false;
          continue;
        }
      }

      if (!moved) {
        ctx.moveTo(px, py);
        moved = true;
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.stroke();
  },

  getGridSpacing(range) {
    const magnitude = Math.floor(Math.log10(range));
    const normalized = range / Math.pow(10, magnitude);
    
    let spacing;
    if (normalized < 1.5) spacing = 0.1;
    else if (normalized < 3) spacing = 0.2;
    else if (normalized < 7) spacing = 0.5;
    else spacing = 1;
    
    return spacing * Math.pow(10, magnitude);
  },

  xToPx(x, w) {
    return ((x - this.viewBox.xMin) / (this.viewBox.xMax - this.viewBox.xMin)) * w;
  },

  yToPy(y, h) {
    return h - ((y - this.viewBox.yMin) / (this.viewBox.yMax - this.viewBox.yMin)) * h;
  },

  reset() {
    this.viewBox = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
  }
};

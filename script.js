const canvas = document.getElementById('heatmap-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('heatmap-container');
const resetBtn = document.getElementById('reset-btn');
const photoUpload = document.getElementById('photo-upload');
const clearPhotoBtn = document.getElementById('clear-photo-btn');
const toggleImageDimBtn = document.getElementById('toggle-image-dim-btn');
const togglePointOverlaysBtn = document.getElementById('toggle-point-overlays-btn');
const clickCountEl = document.getElementById('click-count');

const defaultWidth = 800;
const defaultHeight = 600;
const maxCanvasWidth = 800;
const maxCanvasHeight = 600;
ctx.imageSmoothingEnabled = true;

const gridSize = 1;
let width = defaultWidth;
let height = defaultHeight;
let gridWidth = Math.ceil(width / gridSize);
let gridHeight = Math.ceil(height / gridSize);
let intensityGrid = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));

const maxIntensity = 20; // Cap for color scaling/Number of clicks
const heatRadius = 16; // Radius in grid cells (pixels when gridSize=1)
const pointLabelMergeRadius = 22; // Merge nearby point labels into one summary / Original: 22
const redRegionIntensityThreshold = maxIntensity * 0.72;
const redRegionMergeRadius = 48;
const dimmedImageOpacity = 0.35;

const backgroundImage = new Image();
let currentImageUrl = null;
let imageLoaded = true;
let clickCount = 0;
let showPointOverlays = false;
let isImageDimmed = false;
const pointClickCounts = new Map();

backgroundImage.onload = function () {
  const { width: fittedWidth, height: fittedHeight } = fitWithinBounds(
    backgroundImage.naturalWidth,
    backgroundImage.naturalHeight,
    maxCanvasWidth,
    maxCanvasHeight
  );
  resizeCanvas(fittedWidth, fittedHeight);
  imageLoaded = true;
  renderHeatmap();
};

backgroundImage.onerror = function () {
  console.error('Failed to load background image. Heatmap will render without it.');
  imageLoaded = true;
  renderHeatmap();
};

function resizeCanvas(nextWidth, nextHeight) {
  width = Math.max(1, Math.floor(nextWidth));
  height = Math.max(1, Math.floor(nextHeight));
  canvas.width = width;
  canvas.height = height;
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  gridWidth = Math.ceil(width / gridSize);
  gridHeight = Math.ceil(height / gridSize);
  intensityGrid = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));
  clearPointData();
}

function fitWithinBounds(sourceWidth, sourceHeight, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

function updateClickCount(value) {
  clickCount = value;
  clickCountEl.textContent = String(clickCount);
}

function updatePointOverlayToggleButton() {
  togglePointOverlaysBtn.textContent = showPointOverlays ? 'Hide Point Labels' : 'Show Point Labels';
}

function updateImageDimToggleButton() {
  toggleImageDimBtn.textContent = isImageDimmed ? 'Restore Photo' : 'Dim Photo';
}

function clearPointData() {
  pointClickCounts.clear();
  updateClickCount(0);
}

function getColor(intensity) {
  const capped = Math.min(intensity, maxIntensity);
  const normalized = capped / maxIntensity;
  const boosted = Math.pow(normalized, 0.7);

  const stops = [
    [0, 120, 255],  // Blue
    [0, 200, 83],   // Green
    [255, 220, 0],  // Yellow
    [255, 48, 48],  // Red
  ];

  const segment = Math.min(Math.floor(boosted * 3), 2);
  const localT = boosted * 3 - segment;
  const [r1, g1, b1] = stops[segment];
  const [r2, g2, b2] = stops[segment + 1];

  const r = Math.floor(r1 + (r2 - r1) * localT);
  const g = Math.floor(g1 + (g2 - g1) * localT);
  const b = Math.floor(b1 + (b2 - b1) * localT);
  const alpha = Math.min(Math.max(boosted, 0.03), 1);
  return `rgba(${r},${g},${b},${alpha})`;
}

function addHeat(x, y) {
  const gridX = Math.floor(x / gridSize);
  const gridY = Math.floor(y / gridSize);
  for (let dy = -heatRadius; dy <= heatRadius; dy++) {
    for (let dx = -heatRadius; dx <= heatRadius; dx++) {
      const gx = gridX + dx;
      const gy = gridY + dy;
      if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > heatRadius) continue;
        // Gaussian falloff for smoother, more natural blending
        const sigma = heatRadius / 2;
        const falloff = Math.exp(-(distance * distance) / (2 * sigma * sigma));
        intensityGrid[gy][gx] += falloff * 1.35;
      }
    }
  }
}

function addPointClick(x, y) {
  const key = `${x},${y}`;
  const current = pointClickCounts.get(key);
  if (current) {
    current.count += 1;
    return;
  }

  pointClickCounts.set(key, { x, y, count: 1 });
}

function getIntensityAtPixel(x, y) {
  const gridX = Math.floor(x / gridSize);
  const gridY = Math.floor(y / gridSize);
  if (gridX < 0 || gridX >= gridWidth || gridY < 0 || gridY >= gridHeight) {
    return 0;
  }
  return intensityGrid[gridY][gridX];
}

function getPointMergeRadius(x, y) {
  const intensity = getIntensityAtPixel(x, y);
  if (intensity >= redRegionIntensityThreshold) {
    return redRegionMergeRadius;
  }
  return pointLabelMergeRadius;
}

function getSummarizedPointLabels() {
  const points = Array.from(pointClickCounts.values()).sort((a, b) => b.count - a.count);
  const clusters = [];

  points.forEach(({ x, y, count }) => {
    const pointMergeRadius = getPointMergeRadius(x, y);
    let closestCluster = null;
    let closestDistance = Infinity;

    for (const cluster of clusters) {
      const dx = x - cluster.x;
      const dy = y - cluster.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const mergeRadius = Math.max(pointMergeRadius, cluster.mergeRadius);
      if (distance <= mergeRadius && distance < closestDistance) {
        closestDistance = distance;
        closestCluster = cluster;
      }
    }

    if (!closestCluster) {
      clusters.push({ x, y, count, mergeRadius: pointMergeRadius });
      return;
    }

    const nextCount = closestCluster.count + count;
    closestCluster.x = (closestCluster.x * closestCluster.count + x * count) / nextCount;
    closestCluster.y = (closestCluster.y * closestCluster.count + y * count) / nextCount;
    closestCluster.count = nextCount;
    closestCluster.mergeRadius = Math.max(closestCluster.mergeRadius, pointMergeRadius);
  });

  return clusters;
}

function drawPointClickOverlays() {
  if (!showPointOverlays) return;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 12px "Segoe UI", sans-serif';

  const summarizedLabels = getSummarizedPointLabels();
  summarizedLabels.forEach(({ x, y, count }) => {
    const px = Math.round(x);
    const py = Math.round(y);

    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(17, 24, 39, 0.85)';
    ctx.lineWidth = 3;
    ctx.strokeText(String(count), px, py);
    ctx.fillText(String(count), px, py);
  });
}

// Render background image then heatmap
function renderHeatmap() {
  ctx.clearRect(0, 0, width, height);
  if (imageLoaded && backgroundImage.src) {
    ctx.save();
    ctx.globalAlpha = isImageDimmed ? dimmedImageOpacity : 1;
    // Draw background image (scaled to fit canvas)
    ctx.drawImage(backgroundImage, 0, 0, width, height);
    ctx.restore();
  }
  // Draw heatmap overlay
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const intensity = intensityGrid[gy][gx];
      if (intensity > 0) {
        ctx.fillStyle = getColor(intensity);
        ctx.fillRect(gx * gridSize, gy * gridSize, gridSize, gridSize);
      }
    }
  }
  drawPointClickOverlays();
}

function handleClick(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x >= 0 && x < width && y >= 0 && y < height) {
    const pointX = Math.round(x);
    const pointY = Math.round(y);
    addHeat(x, y);
    addPointClick(pointX, pointY);
    updateClickCount(clickCount + 1);
    renderHeatmap();
  }
}

function handlePhotoUpload(e) {
  const [file] = e.target.files;
  if (!file) return;

  if (currentImageUrl) {
    URL.revokeObjectURL(currentImageUrl);
  }

  imageLoaded = false;
  currentImageUrl = URL.createObjectURL(file);
  backgroundImage.src = currentImageUrl;
  clearPhotoBtn.disabled = false;
}

function handleClearPhoto() {
  if (currentImageUrl) {
    URL.revokeObjectURL(currentImageUrl);
    currentImageUrl = null;
  }

  backgroundImage.removeAttribute('src');
  photoUpload.value = '';
  resizeCanvas(defaultWidth, defaultHeight);
  imageLoaded = true;
  clearPhotoBtn.disabled = true;
  renderHeatmap();
}

function handleTogglePointOverlays() {
  showPointOverlays = !showPointOverlays;
  updatePointOverlayToggleButton();
  renderHeatmap();
}

function handleToggleImageDim() {
  isImageDimmed = !isImageDimmed;
  updateImageDimToggleButton();
  renderHeatmap();
}

function resetHeatmap() {
  for (let y = 0; y < gridHeight; y++) {
    intensityGrid[y].fill(0);
  }
  clearPointData();
  renderHeatmap();
}

container.addEventListener('click', handleClick);
container.addEventListener('touchend', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  handleClick(touch);
});

photoUpload.addEventListener('change', handlePhotoUpload);
clearPhotoBtn.addEventListener('click', handleClearPhoto);
toggleImageDimBtn.addEventListener('click', handleToggleImageDim);
togglePointOverlaysBtn.addEventListener('click', handleTogglePointOverlays);

resetBtn.addEventListener('click', resetHeatmap);

resizeCanvas(defaultWidth, defaultHeight);
updateImageDimToggleButton();
updatePointOverlayToggleButton();
renderHeatmap();

const canvas = document.getElementById('heatmap-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('heatmap-container');
const resetBtn = document.getElementById('reset-btn');

const width = 800;
const height = 600;
canvas.width = width;
canvas.height = height;
ctx.imageSmoothingEnabled = true;

const gridSize = 3;
const gridWidth = Math.ceil(width / gridSize);
const gridHeight = Math.ceil(height / gridSize);
const intensityGrid = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));

const maxIntensity = 20; // Cap for color scaling
const heatRadius = 6; // Radius in grid cells (30 pixels at gridSize=5)

const backgroundImage = new Image();
backgroundImage.src = '';
let imageLoaded = false;

backgroundImage.onload = function () {
  imageLoaded = true;
  renderHeatmap();
};

backgroundImage.onerror = function () {
  console.error('Failed to load background image. Heatmap will render without it.');
  imageLoaded = true;
  renderHeatmap();
};

function getColor(intensity) {
  const capped = Math.min(intensity, maxIntensity);
  const r = Math.floor((capped / maxIntensity) * 255);
  const g = Math.floor(255 - (capped / maxIntensity) * 255);
  const b = 0;
  const alpha = Math.min(capped / maxIntensity * 0.8, 0.8);
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
        // Gaussian falloff for smoother, more natural blending
        const sigma = heatRadius / 2;
        const falloff = Math.exp(-(distance * distance) / (2 * sigma * sigma));
        intensityGrid[gy][gx] += falloff;
      }
    }
  }
}

//Render background image then heatmap
function renderHeatmap() {
  ctx.clearRect(0, 0, width, height);
  if (imageLoaded) {
    // Draw background image (scaled to fit canvas)
    ctx.drawImage(backgroundImage, 0, 0, width, height);
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
}

function handleClick(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x >= 0 && x < width && y >= 0 && y < height) {
    addHeat(x, y);
    renderHeatmap();
  }
}

container.addEventListener('click', handleClick);
container.addEventListener('touchend', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  handleClick(touch);
});

resetBtn.addEventListener('click', () => {
  for (let y = 0; y < gridHeight; y++) {
    intensityGrid[y].fill(0);
  }
  renderHeatmap();
});
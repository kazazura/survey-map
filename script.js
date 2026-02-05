const canvas = document.getElementById('heatmap-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('heatmap-container');

canvas.width = 800;
canvas.height = 600;

const clickMap = {};

function getColor(intensity) {
  const capped = Math.min(intensity, 10);
  const r = Math.floor((capped / 10) * 255);
  const g = Math.floor(255 - (capped / 10) * 255);
  return `rgba(${r},${g},0,0.3)`;
}

function drawDot(x, y, intensity) {
  const color = getColor(intensity);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, 20);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.6, 'rgba(250, 252, 140, 0)');

  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.arc(x, y, 20, 0, Math.PI * 2, false);
  ctx.fill();
}

container.addEventListener('click', function (e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(e.clientX - rect.left);
  const y = Math.floor(e.clientY - rect.top);
  const key = `${x},${y}`;

  clickMap[key] = (clickMap[key] || 0) + 1;

  drawDot(x, y, clickMap[key]);
});

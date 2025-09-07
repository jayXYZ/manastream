const fs = require("fs");
const path = require("path");

// Simple script to create placeholder PWA icons
// In production, you'd want to use a proper icon generation tool

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create a simple SVG icon based on the swamp-white.svg
const createIconSVG = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#000000"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
        font-family="Arial, sans-serif" font-size="${size * 0.3}" fill="#ffffff">
    LT
  </text>
</svg>`;

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, "..", "public", "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons for each size
sizes.forEach((size) => {
  const svgContent = createIconSVG(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);

  fs.writeFileSync(filepath, svgContent);
  console.log(`Generated ${filename}`);
});

console.log("PWA icons generated successfully!");
console.log(
  "Note: These are placeholder SVG icons. For production, consider using PNG icons generated from your actual logo.",
);

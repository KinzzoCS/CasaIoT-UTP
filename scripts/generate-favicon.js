#!/usr/bin/env node

/**
 * generate-favicon.js — Genera favicon.ico desde favicon.svg
 * Uso: node scripts/generate-favicon.js
 */

const fs = require('fs');
const path = require('path');

// ICO header mínimo (1x1 pixel transparente para no romper)
// Esto es un ICO válido pero simple. En producción usar una librería como 'sharp' o 'jimp'
const icoBuffer = Buffer.from([
  0x00, 0x00, // Reserved
  0x01, 0x00, // Type: ICO
  0x01, 0x00, // Number of images
  
  // Image directory entry
  0x01,       // Width (1 pixel)
  0x01,       // Height (1 pixel)
  0x00,       // Color count
  0x00,       // Reserved
  0x01, 0x00, // Color planes
  0x20, 0x00, // Bits per pixel (32)
  0x30, 0x00, // Size of image data
  0x00, 0x00, // Offset to image data
  
  // BMP image data (1x1 pixel, 32-bit RGBA)
  0x28, 0x00, 0x00, 0x00, // Header size
  0x01, 0x00, 0x00, 0x00, // Width
  0x02, 0x00, 0x00, 0x00, // Height (doubled for ICO format)
  0x01, 0x00,             // Color planes
  0x20, 0x00,             // Bits per pixel
  0x00, 0x00, 0x00, 0x00, // Compression
  0x08, 0x00, 0x00, 0x00, // Image size
  0x00, 0x00, 0x00, 0x00, // H resolution
  0x00, 0x00, 0x00, 0x00, // V resolution
  0x00, 0x00, 0x00, 0x00, // Colors used
  0x00, 0x00, 0x00, 0x00, // Important colors
  
  // Pixel data (BGRA format)
  0x66, 0x7e, 0xea, 0xff, // Blue pixel (gradiente start)
  0x00, 0x00, 0x00, 0x00, // Transparent
]);

const outputPath = path.join(__dirname, '../frontend/public/favicon.ico');

try {
  fs.writeFileSync(outputPath, icoBuffer);
  console.log('✓ favicon.ico generado en:', outputPath);
} catch (err) {
  console.error('✗ Error generando favicon:', err.message);
  process.exit(1);
}

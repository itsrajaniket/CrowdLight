// tools/make-qr.js
// Generates QR code images (PNG & SVG) and prints a terminal QR code
// for the CrowdLight audience URL.

const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const defaultUrl = 'http://localhost:3000/audience/';
const targetUrl = process.argv[2] || process.env.AUDIENCE_URL || defaultUrl;

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const AUDIENCE_DIR = path.join(PUBLIC_DIR, 'audience');

const pngPath1 = path.join(PUBLIC_DIR, 'qr.png');
const pngPath2 = path.join(AUDIENCE_DIR, 'qr.png');
const svgPath = path.join(PUBLIC_DIR, 'qr.svg');

async function generate() {
  console.log('=========================================');
  console.log('CrowdLight QR Code Generator');
  console.log(`Target URL: ${targetUrl}`);
  console.log('=========================================\n');

  try {
    // 1. Print small terminal QR code for quick testing directly from the screen
    const terminalQR = await QRCode.toString(targetUrl, { type: 'terminal', small: true });
    console.log(terminalQR);

    // 2. Generate high-resolution PNG for projectors / printouts
    const qrOptions = {
      width: 800,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    };

    await QRCode.toFile(pngPath1, targetUrl, qrOptions);
    await QRCode.toFile(pngPath2, targetUrl, qrOptions);
    await QRCode.toFile(svgPath, targetUrl, { type: 'svg', margin: 2 });

    console.log('\n[Generated successfully]');
    console.log(`- PNG (Root):     ${pngPath1}`);
    console.log(`- PNG (Audience): ${pngPath2}`);
    console.log(`- SVG Vector:     ${svgPath}`);
    console.log(`\nView in browser at: http://localhost:3000/qr.png`);
    console.log('\nTip: To generate a QR code for your public domain or tunnel:');
    console.log('  node tools/make-qr.js https://your-service.onrender.com/audience/\n');
  } catch (err) {
    console.error('Error generating QR code:', err.message);
    process.exit(1);
  }
}

generate();

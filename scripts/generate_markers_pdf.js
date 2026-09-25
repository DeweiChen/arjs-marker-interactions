#!/usr/bin/env node
/**
 * Generate an A4 PDF containing 8 AR.js barcode markers evenly divided across the page.
 * Pure Node.js built-ins only (fs, path). Zero external dependencies.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Extract width, height, and raw IDAT stream from a PNG file.
 */
function parsePng(filePath) {
  const buf = fs.readFileSync(filePath);
  const signature = '89504e470d0a1a0a';
  if (buf.subarray(0, 8).toString('hex') !== signature) {
    throw new Error(`Invalid PNG signature in ${filePath}`);
  }

  let width = 0;
  let height = 0;
  const idatChunks = [];

  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buf.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  return {
    width,
    height,
    idat: Buffer.concat(idatChunks),
  };
}

/**
 * Build ISO A4 PDF buffer with 8 markers in a 2x4 grid.
 */
function buildPdf({
  imagePaths,
  markerSizeMm = 62.0,
  includeCutLines = true,
}) {
  // ISO A4: 210mm x 297mm in PostScript points (72 points/inch)
  const mmToPt = 72.0 / 25.4;
  const pageWidthPt = 210.0 * mmToPt;   // ~595.28 pt
  const pageHeightPt = 297.0 * mmToPt;  // ~841.89 pt

  const cols = 2;
  const rows = 4;
  const totalCells = cols * rows;

  if (imagePaths.length !== totalCells) {
    throw new Error(`Expected ${totalCells} images, received ${imagePaths.length}`);
  }

  const cellWidthPt = pageWidthPt / cols;   // ~297.64 pt (105mm)
  const cellHeightPt = pageHeightPt / rows; // ~210.47 pt (74.25mm)
  const markerSizePt = markerSizeMm * mmToPt;

  // Parse all PNG markers
  const images = imagePaths.map((p, idx) => {
    const info = parsePng(p);
    return {
      id: `Im${idx}`,
      ...info,
    };
  });

  // Construct PDF Content Stream
  const contentOps = [];

  // Faint dashed cutting guidelines (0.5pt light gray)
  if (includeCutLines) {
    contentOps.push('q');
    contentOps.push('0.85 0.85 0.85 RG');
    contentOps.push('0.5 w');
    contentOps.push('[4 4] 0 d');

    // Horizontal cutting lines
    for (let r = 1; r < rows; r++) {
      const y = (r * cellHeightPt).toFixed(2);
      contentOps.push(`0 ${y} m ${pageWidthPt.toFixed(2)} ${y} l S`);
    }

    // Vertical cutting line
    for (let c = 1; c < cols; c++) {
      const x = (c * cellWidthPt).toFixed(2);
      contentOps.push(`${x} 0 m ${x} ${pageHeightPt.toFixed(2)} l S`);
    }

    contentOps.push('Q');
  }

  // Draw each marker centered inside its 1/8 cell
  images.forEach((img, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;

    const cellXLeft = c * cellWidthPt;
    const cellYBottom = pageHeightPt - (r + 1) * cellHeightPt;

    const markerX = (cellXLeft + (cellWidthPt - markerSizePt) / 2.0).toFixed(2);
    const markerY = (cellYBottom + (cellHeightPt - markerSizePt) / 2.0).toFixed(2);
    const size = markerSizePt.toFixed(2);

    contentOps.push('q');
    contentOps.push(`${size} 0 0 ${size} ${markerX} ${markerY} cm`);
    contentOps.push(`/${img.id} Do`);
    contentOps.push('Q');
  });

  const contentStreamBuffer = Buffer.from(contentOps.join('\n'), 'ascii');

  // Build PDF Objects
  // 1: Catalog, 2: Pages, 3: Page, 4: Content Stream, 5..12: Image XObjects
  const objects = [];

  const catalogObj = Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'ascii');
  const pagesObj = Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>', 'ascii');

  const xobjectDictEntries = [];
  const imageObjs = [];

  let currentObjId = 5;
  images.forEach((img) => {
    const objId = currentObjId++;
    xobjectDictEntries.push(`/${img.id} ${objId} 0 R`);

    const dictStr = `<<
  /Type /XObject
  /Subtype /Image
  /Width ${img.width}
  /Height ${img.height}
  /ColorSpace /DeviceRGB
  /BitsPerComponent 8
  /Filter /FlateDecode
  /DecodeParms << /Predictor 15 /Columns ${img.width} /Colors 3 /BitsPerComponent 8 >>
  /Length ${img.idat.length}
>>\nstream\n`;

    const header = Buffer.from(dictStr, 'ascii');
    const footer = Buffer.from('\nendstream', 'ascii');
    imageObjs.push(Buffer.concat([header, img.idat, footer]));
  });

  const contentHeader = Buffer.from(`<< /Length ${contentStreamBuffer.length} >>\nstream\n`, 'ascii');
  const contentFooter = Buffer.from('\nendstream', 'ascii');
  const contentObj = Buffer.concat([contentHeader, contentStreamBuffer, contentFooter]);

  const pageDictStr = `<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)}]
  /Contents 4 0 R
  /Resources <<
    /XObject << ${xobjectDictEntries.join(' ')} >>
  >>
>>`;
  const pageObj = Buffer.from(pageDictStr, 'ascii');

  objects.push(catalogObj, pagesObj, pageObj, contentObj, ...imageObjs);

  // Assemble cross-reference table and complete PDF
  const chunks = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'binary')];
  const offsets = [];

  let currentOffset = chunks[0].length;

  objects.forEach((obj, idx) => {
    offsets.push(currentOffset);
    const objHeader = Buffer.from(`${idx + 1} 0 obj\n`, 'ascii');
    const objFooter = Buffer.from('\nendobj\n', 'ascii');
    chunks.push(objHeader, obj, objFooter);
    currentOffset += objHeader.length + obj.length + objFooter.length;
  });

  const startxref = currentOffset;
  let xrefStr = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    xrefStr += `${String(off).padStart(10, '0')} 00000 n \n`;
  });

  xrefStr += `trailer\n<<\n  /Size ${objects.length + 1}\n  /Root 1 0 R\n>>\nstartxref\n${startxref}\n%%EOF\n`;
  chunks.push(Buffer.from(xrefStr, 'ascii'));

  return Buffer.concat(chunks);
}

function main() {
  const imagesDir = path.join(projectRoot, 'public', 'markers', 'images');
  const outputPdfPath = path.join(projectRoot, 'public', 'markers', 'markers.pdf');

  const imagePaths = Array.from({ length: 8 }, (_, i) =>
    path.join(imagesDir, `barcode-${i}.png`)
  );

  imagePaths.forEach((p) => {
    if (!fs.existsSync(p)) {
      console.error(`Error: marker image file not found: ${p}`);
      process.exit(1);
    }
  });

  const pdfBuffer = buildPdf({
    imagePaths,
    markerSizeMm: 62.0,
    includeCutLines: true,
  });

  fs.mkdirSync(path.dirname(outputPdfPath), { recursive: true });
  fs.writeFileSync(outputPdfPath, pdfBuffer);

  console.log(`Generated PDF: ${outputPdfPath} (${pdfBuffer.length} bytes)`);
}

main();

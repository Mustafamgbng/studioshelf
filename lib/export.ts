'use client';
import JSZip from 'jszip';
import { THEMES, type Project, type Slide } from './types';
import { getProjectImage } from './samples';
import { getDesign, imagePlacement } from './creative';

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const safeName = (name: string) =>
  name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'launch-kit';

export async function readPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPG, PNG or WebP photo.');
  if (file.size > 12000000) throw new Error('Choose a photo smaller than 12 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (img.width * img.height > 80000000)
      throw new Error('This image is too large. Resize it and try again.');
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.82);
    if (image.length > 1800000) throw new Error('This photo is too detailed. Try a smaller image.');
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the product image.'));
    img.src = src;
  });
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 10,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      // Break long URLs / unspaced words too, so exported text stays inside the artboard.
      const pieces: string[] = [];
      let piece = '';
      for (const char of word) {
        if (ctx.measureText(piece + char).width > maxWidth && piece) {
          pieces.push(piece);
          piece = '';
        }
        piece += char;
      }
      if (piece) pieces.push(piece);
      for (const part of pieces) {
        const next = line ? line + ' ' + part : part;
        if (ctx.measureText(next).width > maxWidth && line) {
          lines.push(line);
          line = part;
        } else line = next;
      }
    }
    lines.push(line);
  }
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = last.replace(/[., ]+$/, '') + '…';
  }
  return lines;
}
function block(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  font: string,
  lineHeight: number,
  maxLines: number,
  align: 'left' | 'center' = 'left',
) {
  ctx.font = font;
  const lines = wrapText(ctx, text, width, maxLines);
  const previousAlign = ctx.textAlign;
  ctx.textAlign = align;
  lines.forEach((line, i) =>
    ctx.fillText(line, align === 'center' ? x + width / 2 : x, y + i * lineHeight),
  );
  ctx.textAlign = previousAlign;
  return y + lines.length * lineHeight;
}

function areaText(
  ctx: CanvasRenderingContext2D,
  text: string,
  area: { x: number; y: number; width: number; height: number },
  style: {
    size: number;
    min: number;
    family: string;
    weight?: string;
    lineHeight?: number;
    align: 'left' | 'center';
  },
) {
  let size = style.size;
  const lineHeight = style.lineHeight || 1.18;
  const font = () => `${style.weight || ''} ${size}px ${style.family}`.trim();
  let lines: string[];
  while (true) {
    ctx.font = font();
    lines = wrapText(ctx, text, area.width, 1000);
    if (lines.length * size * lineHeight <= area.height || size <= style.min) break;
    size -= 2;
  }
  const maxLines = Math.max(1, Math.floor(area.height / (size * lineHeight)));
  lines = wrapText(ctx, text, area.width, maxLines);
  ctx.save();
  ctx.textAlign = style.align;
  ctx.textBaseline = 'top';
  lines.forEach((line, i) =>
    ctx.fillText(
      line,
      style.align === 'center' ? area.x + area.width / 2 : area.x,
      area.y + i * size * lineHeight,
    ),
  );
  ctx.restore();
}

export async function drawSlide(canvas: HTMLCanvasElement, project: Project, index: number) {
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d')!;
  const t = project.branding
    ? {
        ...THEMES[project.theme],
        bg: project.branding.background,
        ink: project.branding.ink,
        accent: project.branding.primary,
        light: project.branding.background,
      }
    : THEMES[project.theme];
  const s: Slide = project.kit.slides[index];
  const design = getDesign(project);
  const modern = design.typography === 'sans';
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = t.ink;
  let brandX = 74;
  if (design.showBrand && project.branding?.logo) {
    const logo = await loadImage(project.branding.logo);
    const scale = Math.min(96 / logo.width, 50 / logo.height);
    ctx.drawImage(logo, 74, 49, logo.width * scale, logo.height * scale);
    brandX += logo.width * scale + 18;
  }
  if (design.showBrand)
    block(ctx, project.product.brand, brandX, 85, 850 - brandX, '28px Arial', 32, 1);
  ctx.font = '22px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`0${index + 1} / 05`, 1006, 85);
  ctx.textAlign = 'left';
  const imageSrc = getProjectImage(project);
  let image: HTMLImageElement | null = null;
  if (imageSrc) image = await loadImage(imageSrc);
  const picture = (x: number, y: number, w: number, h: number, radius: number | number[] = 18) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();
    ctx.fillStyle = t.light;
    ctx.fillRect(x, y, w, h);
    if (image) {
      const placement = imagePlacement(image, { x, y, width: w, height: h }, design);
      ctx.drawImage(image, placement.x, placement.y, placement.width, placement.height);
    } else {
      ctx.fillStyle = t.bg;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.ink;
      ctx.textAlign = 'center';
      ctx.font = modern ? '600 110px Arial' : 'italic 110px Georgia';
      if (design.showBrand)
        ctx.fillText(project.product.brand.slice(0, 2).toLowerCase(), x + w / 2, y + h / 2 + 35);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  };
  const headingStyle = {
    size: modern ? 76 : 82,
    min: 46,
    family: modern ? 'Arial' : 'Georgia',
    weight: modern ? '600' : 'italic',
    align: design.textAlign,
  } as const;
  const bodyStyle = {
    size: 28,
    min: 24,
    family: 'Arial',
    lineHeight: 1.3,
    align: design.textAlign,
  } as const;
  const eyebrow = (x: number, y: number, width: number) => {
    ctx.fillStyle = t.accent;
    areaText(
      ctx,
      s.eyebrow,
      { x, y, width, height: 40 },
      { size: 22, min: 18, family: 'Arial', align: design.textAlign },
    );
    ctx.fillStyle = t.ink;
  };

  if (design.layout === 'spotlight') {
    const frames = [
      {
        x: 90,
        y: 155,
        w: 900,
        h: 686,
        r: [450, 450, 20, 20],
        eyebrow: 882,
        headline: 928,
        headlineHeight: 170,
        body: 1140,
        bodyHeight: 140,
      },
      {
        x: 74,
        y: 430,
        w: 932,
        h: 710,
        r: 20,
        eyebrow: 150,
        headline: 197,
        headlineHeight: 180,
        body: 1179,
        bodyHeight: 126,
      },
      {
        x: 210,
        y: 430,
        w: 660,
        h: 580,
        r: [330, 330, 18, 18],
        eyebrow: 150,
        headline: 197,
        headlineHeight: 178,
        body: 1073,
        bodyHeight: 200,
      },
      {
        x: 74,
        y: 155,
        w: 932,
        h: 640,
        r: 20,
        eyebrow: 835,
        headline: 884,
        headlineHeight: 180,
        body: 1120,
        bodyHeight: 165,
      },
      {
        x: 250,
        y: 155,
        w: 580,
        h: 620,
        r: [290, 290, 18, 18],
        eyebrow: 831,
        headline: 880,
        headlineHeight: 190,
        body: 1130,
        bodyHeight: 155,
      },
    ][index];
    picture(frames.x, frames.y, frames.w, frames.h, frames.r);
    eyebrow(74, frames.eyebrow, 932);
    areaText(
      ctx,
      s.headline,
      { x: 74, y: frames.headline, width: 932, height: frames.headlineHeight },
      headingStyle,
    );
    areaText(
      ctx,
      s.body,
      { x: 74, y: frames.body, width: 932, height: frames.bodyHeight },
      bodyStyle,
    );
    return;
  }
  if (design.layout === 'minimal') {
    ctx.strokeStyle = t.ink;
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(74, 124);
    ctx.lineTo(1006, 124);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (index === 2) {
      eyebrow(74, 193, 932);
      areaText(ctx, s.headline, { x: 74, y: 254, width: 932, height: 240 }, headingStyle);
      areaText(ctx, s.body, { x: 74, y: 529, width: 932, height: 125 }, bodyStyle);
      picture(281, 704, 725, 508, 4);
      ctx.fillStyle = t.accent;
      ctx.font = modern ? '500 70px Arial' : 'italic 80px Georgia';
      ctx.fillText('03', 74, 1200);
    } else {
      const flipped = index === 1 || index === 3;
      const copyX = flipped ? 601 : 74;
      picture(flipped ? 74 : 540, 205, 466, 912, 4);
      eyebrow(copyX, 250, 405);
      areaText(
        ctx,
        s.headline,
        { x: copyX, y: 333, width: 405, height: 355 },
        { ...headingStyle, size: modern ? 65 : 70, min: 40 },
      );
      areaText(
        ctx,
        s.body,
        { x: copyX, y: 760, width: 405, height: 330 },
        { ...bodyStyle, size: 26, min: 24 },
      );
    }
    ctx.strokeStyle = t.ink;
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.moveTo(74, 1250);
    ctx.lineTo(1006, 1250);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.ink;
    areaText(
      ctx,
      project.product.category,
      { x: 74, y: 1280, width: 800, height: 30 },
      { size: 20, min: 18, family: 'Arial', align: 'left' },
    );
    return;
  }
  if (index === 0 || index === 4) {
    ctx.fillStyle = t.accent;
    block(ctx, s.eyebrow, 74, 170, 932, '22px Arial', 30, 1, design.textAlign);
    ctx.fillStyle = t.ink;
    block(
      ctx,
      s.headline,
      70,
      268,
      940,
      modern ? '600 82px Arial' : 'italic 88px Georgia',
      94,
      3,
      design.textAlign,
    );
    picture(74, 536, 932, 600);
    ctx.fillStyle = t.ink;
    block(ctx, s.body, 74, 1210, 920, '28px Arial', 37, 2, design.textAlign);
  } else if (index === 1 || index === 3) {
    picture(74, 145, 932, 702);
    ctx.fillStyle = t.accent;
    block(ctx, s.eyebrow, 74, 925, 930, '22px Arial', 30, 1, design.textAlign);
    ctx.fillStyle = t.ink;
    const y = block(
      ctx,
      s.headline,
      70,
      1010,
      932,
      modern ? '600 64px Arial' : 'italic 67px Georgia',
      74,
      2,
      design.textAlign,
    );
    block(ctx, s.body, 74, y + 24, 932, '28px Arial', 38, 3, design.textAlign);
  } else {
    ctx.fillStyle = t.accent;
    block(ctx, s.eyebrow, 74, 185, 932, '22px Arial', 30, 1, design.textAlign);
    ctx.fillStyle = t.ink;
    const y = block(
      ctx,
      s.headline,
      70,
      325,
      925,
      modern ? '600 86px Arial' : 'italic 92px Georgia',
      101,
      4,
      design.textAlign,
    );
    block(
      ctx,
      s.body,
      74,
      y + 35,
      920,
      '32px Arial',
      45,
      Math.min(4, Math.max(1, Math.floor((830 - y - 35) / 45) + 1)),
      design.textAlign,
    );
    picture(548, 875, 458, 386);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(250, 1070, 100, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = t.accent;
    ctx.textAlign = 'center';
    ctx.font = modern ? '500 40px Arial' : 'italic 55px Georgia';
    ctx.fillText('the details', 250, 1085);
    ctx.textAlign = 'left';
  }
  // No simulated product photography or AI image edits are added to seller uploads.
}

async function png(project: Project, index: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  await drawSlide(canvas, project, index);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not export this slide.'))),
      'image/png',
    ),
  );
}
export async function exportSlide(project: Project, index: number) {
  download(await png(project, index), `${safeName(project.product.name)}-story-${index + 1}.png`);
}
export function kitMarkdown(p: Project) {
  const k = p.kit;
  return `# ${p.product.name} — launch kit\n\nBrand: ${p.product.brand}\nEngine: ${p.source}\n\n## Confirmed seller facts\n${p.product.facts}\n\n## Listing title\n${k.title}\n\n## Description\n${k.description}\n\n## Highlights\n${k.bullets.map((x) => '- ' + x).join('\n')}\n\n## Keyword ideas (not validated search data)\n${k.tags.join(', ')}\n\n## Instagram\n${k.instagram}\n\n## WhatsApp\n${k.whatsapp}\n\n## Email\nSubject: ${k.emailSubject}\n\n${k.emailBody}\n\n## Before publishing\n${k.questions.map((x) => '- ' + x).join('\n')}\n\nReview every asset and claim before publishing. This kit does not publish to any platform.\n`;
}
export function csvCell(value: string): string {
  // Protect spreadsheet users from formula injection, including leading whitespace.
  const clean = /^\s*[=+@-]/.test(value) ? "'" + value : value;
  return '"' + clean.replace(/"/g, '""') + '"';
}
export function listingCsv(p: Project) {
  return [
    'title,description,price,currency,keywords',
    [p.kit.title, p.kit.description, p.product.price, p.product.currency, p.kit.tags.join(', ')]
      .map(csvCell)
      .join(','),
  ].join('\r\n');
}
export async function exportKit(project: Project) {
  const zip = new JSZip();
  zip.file('launch-copy.md', kitMarkdown(project));
  zip.file('listing.csv', '\uFEFF' + listingCsv(project));
  zip.file('project.studioshelf.json', JSON.stringify(project, null, 2));
  for (let i = 0; i < 5; i++)
    zip.file(`carousel/0${i + 1}.png`, await (await png(project, i)).arrayBuffer());
  zip.file(
    'READ-ME.txt',
    'StudioShelf launch kit\n\nFive carousel PNGs: 1080 x 1350 pixels.\nThe CSV is a portable content worksheet, not a marketplace-specific bulk import.\nEdit or restore this project using project.studioshelf.json.\nReview product facts, text fit and all claims before publishing.\nTemplate output is based on seller input; Gemini output also requires human review.\nBuilt-in sample products and brands are fictional illustrations, not real product photography.\n',
  );
  download(
    await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
    `${safeName(project.product.name)}-launch-kit.zip`,
  );
}

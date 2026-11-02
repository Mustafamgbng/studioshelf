import { DEFAULT_PRODUCT, type Product, type Kit } from './types';

function allFactLines(product: Product): string[] {
  return product.facts
    .split(/\n/)
    .map((s) => s.trim().replace(/^[-•]\s+/, ''))
    .filter(Boolean);
}

export function factLines(product: Product): string[] {
  return allFactLines(product).slice(0, 12);
}

export function priceLabel(p: Product): string {
  if (!p.price.trim()) return '';
  return `${p.currency} ${p.price}`;
}

export function validateProduct(value: unknown): Product {
  if (!value || typeof value !== 'object') throw new Error('Add your product details first.');
  const p = value as Record<string, unknown>;
  const limits: Record<Exclude<keyof Product, 'url'>, number> = {
    name: 100,
    brand: 80,
    category: 60,
    audience: 200,
    facts: 2000,
    price: 20,
    currency: 8,
    voice: 50,
    cta: 80,
  };
  const result = {} as Product;
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
    if (typeof p[key] !== 'string' || (p[key] as string).length > limits[key])
      throw new Error(`Check the ${key} field (maximum ${limits[key]} characters).`);
    result[key] = (p[key] as string).trim();
  }
  if (!result.name || !result.brand || !result.facts)
    throw new Error('Product name, brand and at least one confirmed fact are required.');
  if (!Intl.supportedValuesOf('currency').includes(result.currency))
    throw new Error('Choose a supported currency.');
  const decimals =
    new Intl.NumberFormat('en', { style: 'currency', currency: result.currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  if (
    result.price &&
    (!/^\d+(\.\d{1,3})?$/.test(result.price) ||
      Number(result.price) > 10000000 ||
      (result.price.split('.')[1] || '').replace(/0+$/, '').length > decimals)
  )
    throw new Error(
      `Enter a valid price for ${result.currency}, with up to ${decimals} decimal places.`,
    );
  if (p.url !== undefined) {
    if (typeof p.url !== 'string' || p.url.length > 2048) throw new Error('Check the product URL.');
    if (p.url) {
      let url: URL;
      try {
        url = new URL(p.url);
      } catch {
        throw new Error('Use an HTTPS product URL.');
      }
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error('Use an HTTPS product URL.');
      if (url.href.length > 2048)
        throw new Error('Use a product URL no longer than 2048 characters after URL encoding.');
      result.url = url.href;
    }
  }
  return result;
}

// No API fallback pretends to be AI. This engine rearranges supplied facts only.
export function createTemplateKit(p: Product): Kit {
  const allFacts = allFactLines(p);
  const facts = allFacts.slice(0, 12);
  const price = priceLabel(p);
  const details = allFacts.join('. ') + '.';
  // Short artwork and highlights have stricter limits than the product brief.
  // Keep complete facts in long copy; show an explicit ellipsis in short fields.
  const compact = (text: string, limit: number) => {
    if (text.length <= limit) return text;
    const prefix = text
      .slice(0, limit - 1)
      .replace(/[\uD800-\uDBFF]$/, '')
      .trimEnd();
    const lastSpace = prefix.lastIndexOf(' ');
    return `${lastSpace >= limit * 0.6 ? prefix.slice(0, lastSpace) : prefix}…`;
  };
  const cta = p.cta || 'Explore the collection';
  const linkedCta = `${cta}.${p.url ? `\n${p.url}` : ''}`;
  const titleFactBudget = Math.max(1, 250 - p.name.length - p.brand.length - 6);
  const title = `${p.name} | ${compact(facts[0] || p.category, titleFactBudget)} | ${p.brand}`;
  const slug = (s: string) =>
    compact(
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .trim(),
      80,
    )
      .replace(/…$/, '')
      .trim();
  const tags = [
    ...new Set([p.name, p.category, ...facts.slice(0, 4)].map(slug).filter(Boolean)),
  ].slice(0, 8);
  if (!tags.length) tags.push(compact(p.name, 80));
  // Many short lines expand when joined with punctuation. Fall back to the full
  // original brief instead of discarding facts or cutting the product link.
  const copyWithFacts = (before: string, after: string) =>
    `${before}${before.length + details.length + after.length <= 5000 ? details : p.facts.trim()}${after}`;
  const isDemo = p.name === DEFAULT_PRODUCT.name && p.facts === DEFAULT_PRODUCT.facts;
  return {
    title,
    description: copyWithFacts(
      `${p.name}, by ${p.brand}.\n\n`,
      `\n\n${price ? `Price: ${price}.\n\n` : ''}${linkedCta}`,
    ),
    bullets: facts.map((fact) => compact(fact, 500)),
    tags,
    instagram: copyWithFacts(
      `${isDemo ? 'A little pause. A favourite ritual.' : `Meet ${p.name}.`}\n\n`,
      `\n\n${price ? `${price}\n` : ''}${linkedCta}\n\n${tags
        .slice(0, 5)
        .map((t) => '#' + t.replace(/\s/g, ''))
        .join(' ')}`,
    ),
    whatsapp: `Meet ${p.name} from ${p.brand}.\n\n${facts.map((f) => '• ' + f).join('\n')}\n\n${price ? `${price}\n` : ''}${linkedCta}`,
    emailSubject: `${p.name} has arrived`,
    emailBody: copyWithFacts(
      `Meet ${p.name}, from ${p.brand}.\n\n`,
      `\n\n${price ? `Price: ${price}.\n\n` : ''}${linkedCta}`,
    ),
    slides: [
      {
        eyebrow: 'MEET YOUR NEW FAVOURITE',
        headline: isDemo ? 'A slower kind\nof Sunday.' : p.name,
        body: isDemo
          ? 'The Sunday Mug. A little moment, just for you.'
          : `${p.name}, by ${p.brand}.`,
      },
      {
        eyebrow: 'THE LITTLE DETAILS',
        headline: facts[0] || p.name,
        body: facts.slice(1, 3).join(' · ') || `Discover ${p.name}.`,
      },
      {
        eyebrow: 'A CLOSER LOOK',
        headline: facts[2] || 'Consider every detail.',
        body: facts.slice(3).join('. ') || facts.join('. '),
      },
      { eyebrow: 'FROM OUR STUDIO', headline: p.brand, body: facts[0] || p.name },
      { eyebrow: 'MAKE IT YOURS', headline: cta, body: `${p.name}${price ? ` · ${price}` : ''}` },
    ].map((slide) => ({
      eyebrow: compact(slide.eyebrow, 80),
      headline: compact(slide.headline, 100),
      body: compact(slide.body, 240),
    })),
    questions: [
      'Confirm delivery regions and processing time.',
      'Add care instructions, materials and dimensions if relevant.',
      'Check returns, stock and any claims before publishing.',
    ],
  };
}

export function validateKit(value: unknown): Kit {
  if (!value || typeof value !== 'object')
    throw new Error('The AI returned an incomplete kit. Please try again.');
  const k = value as Record<string, unknown>;
  const str = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  for (const field of [
    'title',
    'description',
    'instagram',
    'whatsapp',
    'emailSubject',
    'emailBody',
  ]) {
    if (!str(k[field], field === 'title' || field === 'emailSubject' ? 250 : 5000))
      throw new Error('The AI returned invalid copy. Please try again.');
  }
  for (const field of ['bullets', 'tags', 'questions']) {
    if (
      !Array.isArray(k[field]) ||
      k[field].length < 1 ||
      k[field].length > 15 ||
      !k[field].every((v) => str(v, 500))
    )
      throw new Error('The AI returned invalid details. Please try again.');
  }
  if (
    !Array.isArray(k.slides) ||
    k.slides.length !== 5 ||
    !k.slides.every(
      (v) =>
        v &&
        typeof v === 'object' &&
        str(v.eyebrow, 80) &&
        str(v.headline, 100) &&
        str(v.body, 240),
    )
  )
    throw new Error('The AI returned invalid slides. Please try again.');
  return {
    title: k.title as string,
    description: k.description as string,
    bullets: [...(k.bullets as string[])],
    tags: [...(k.tags as string[])],
    instagram: k.instagram as string,
    whatsapp: k.whatsapp as string,
    emailSubject: k.emailSubject as string,
    emailBody: k.emailBody as string,
    slides: k.slides.map((v) => ({ eyebrow: v.eyebrow, headline: v.headline, body: v.body })),
    questions: [...(k.questions as string[])],
  };
}

export const KIT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    instagram: { type: 'string' },
    whatsapp: { type: 'string' },
    emailSubject: { type: 'string' },
    emailBody: { type: 'string' },
    slides: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          eyebrow: { type: 'string' },
          headline: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['eyebrow', 'headline', 'body'],
      },
    },
    questions: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'title',
    'description',
    'bullets',
    'tags',
    'instagram',
    'whatsapp',
    'emailSubject',
    'emailBody',
    'slides',
    'questions',
  ],
};

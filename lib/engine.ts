import { DEFAULT_PRODUCT, type Product, type Kit } from './types';

export function factLines(product: Product): string[] {
  return product.facts
    .split(/\n/)
    .map((s) => s.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean)
    .slice(0, 12);
}

export function priceLabel(p: Product): string {
  if (!p.price.trim()) return '';
  return `${p.currency} ${p.price}`;
}

export function validateProduct(value: unknown): Product {
  if (!value || typeof value !== 'object') throw new Error('Add your product details first.');
  const p = value as Record<string, unknown>;
  const limits: Record<keyof Product, number> = {
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
  for (const key of Object.keys(limits) as (keyof Product)[]) {
    if (typeof p[key] !== 'string' || (p[key] as string).length > limits[key])
      throw new Error(`Check the ${key} field (maximum ${limits[key]} characters).`);
    result[key] = (p[key] as string).trim();
  }
  if (!result.name || !result.brand || !result.facts)
    throw new Error('Product name, brand and at least one confirmed fact are required.');
  if (result.price && (!/^\d+(\.\d{1,2})?$/.test(result.price) || Number(result.price) > 10000000))
    throw new Error('Enter a valid price, with up to two decimal places.');
  if (!['USD', 'INR', 'EUR', 'GBP'].includes(result.currency))
    throw new Error('Choose a supported currency.');
  return result;
}

// No API fallback pretends to be AI. This engine rearranges supplied facts only.
export function createTemplateKit(p: Product): Kit {
  const facts = factLines(p);
  const price = priceLabel(p);
  const details = facts.join('. ') + '.';
  const cta = p.cta || 'Explore the collection';
  const title = `${p.name} | ${facts[0] || p.category} | ${p.brand}`;
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  const tags = [
    ...new Set([p.name, p.category, ...facts.slice(0, 4)].map(slug).filter(Boolean)),
  ].slice(0, 8);
  const isDemo = p.name === DEFAULT_PRODUCT.name && p.facts === DEFAULT_PRODUCT.facts;
  return {
    title,
    description: `${p.name}, by ${p.brand}.\n\n${details}\n\n${price ? `Price: ${price}.\n\n` : ''}${cta}.`,
    bullets: facts,
    tags,
    instagram: `${isDemo ? 'A little pause. A favourite ritual.' : `Meet ${p.name}.`}\n\n${details}\n\n${price ? `${price}\n` : ''}${cta}.\n\n${tags
      .slice(0, 5)
      .map((t) => '#' + t.replace(/\s/g, ''))
      .join(' ')}`,
    whatsapp: `Meet ${p.name} from ${p.brand}.\n\n${facts.map((f) => '• ' + f).join('\n')}\n\n${price ? `${price}\n` : ''}${cta}.`,
    emailSubject: `${p.name} has arrived`,
    emailBody: `Meet ${p.name}, from ${p.brand}.\n\n${details}\n\n${price ? `Price: ${price}.\n\n` : ''}${cta}.`,
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
    ],
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

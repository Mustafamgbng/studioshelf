export type Product = {
  name: string;
  brand: string;
  category: string;
  audience: string;
  facts: string;
  price: string;
  currency: string;
  voice: string;
  cta: string;
  url?: string;
};
export type Branding = {
  logo: string | null;
  primary: string;
  background: string;
  ink: string;
  voice: string;
  cta: string;
};
export type Slide = { eyebrow: string; headline: string; body: string };
export type Kit = {
  title: string;
  description: string;
  bullets: string[];
  tags: string[];
  instagram: string;
  whatsapp: string;
  emailSubject: string;
  emailBody: string;
  slides: Slide[];
  questions: string[];
};
export type Theme = 'clay' | 'lilac' | 'forest' | 'graphite';
export type SampleId = 'headphones' | 'fragrance' | 'tote';
export type CreativeDesign = {
  layout: 'editorial' | 'spotlight' | 'minimal';
  typography: 'serif' | 'sans';
  imageFit: 'contain' | 'cover';
  imageScale: number;
  textAlign: 'left' | 'center';
  showBrand: boolean;
};
export type Project = {
  id: string;
  updatedAt: string;
  product: Product;
  kit: Kit;
  image: string | null;
  sampleId?: SampleId;
  theme: Theme;
  source: 'template' | 'gemini';
  branding?: Branding;
  design?: CreativeDesign;
};

export const DEFAULT_PRODUCT: Product = {
  name: 'The Sunday Mug',
  brand: 'slow mornings',
  category: 'Home & living',
  audience: 'People who make a little time for themselves',
  facts:
    'Hand-thrown ceramic mug\nSoft peach glaze\n350 ml capacity\nMade in small batches\nEach piece has slight variations',
  price: '28',
  currency: 'USD',
  voice: 'Warm & thoughtful',
  cta: 'Discover the collection',
};

export const THEMES = {
  graphite: {
    name: 'Graphite',
    bg: '#17181c',
    ink: '#f0f0f3',
    accent: '#aba8f5',
    light: '#23242a',
  },
  clay: {
    name: 'Peach studio',
    bg: '#f3dacc',
    ink: '#432d2c',
    accent: '#b45b43',
    light: '#fff9f2',
  },
  lilac: { name: 'Lilac hour', bg: '#e6ddf6', ink: '#38274b', accent: '#7751ac', light: '#faf7ff' },
  forest: {
    name: 'Field notes',
    bg: '#dce5d3',
    ink: '#263e32',
    accent: '#557549',
    light: '#f7faef',
  },
} as const;

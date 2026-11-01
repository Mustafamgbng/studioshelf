import type { Metadata, Viewport } from 'next';
import './design.css';

export const metadata: Metadata = {
  title: 'StudioShelf — From product to launch',
  description:
    'Turn product facts and photography into editable listings, social stories and ready-to-share launch kits.',
};

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: '#08090b',
};

const themeScript = `(()=>{let t='dark';try{const s=localStorage.getItem('studioshelf-theme');if(s==='light'||s==='dark')t=s}catch{}const d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t;const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#08090b':'#fafafa')})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

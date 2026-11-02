import type { Metadata, Viewport } from 'next';
// Preserve the shared cascade in development and production builds.
import './editorial.css';
import './studio.css';
import './workspace-overview.css';
import './creative-controls.css';
import './local-brand-kit.css';
import './workspace.css';
import './design.css';
import './info.css';
import './studio-polish.css';
import './product-media.css';
import './kit-review.css';
import './publish-pack.css';
import './demo.css';

export const metadata: Metadata = {
  title: 'StudioShelf — From product to launch',
  description:
    'Turn product facts and photography into editable listings, social stories and ready-to-share launch kits.',
};

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: '#f8f5ee',
};

const themeScript = `(()=>{let t='light';try{const s=localStorage.getItem('studioshelf-theme');if(s==='light'||s==='dark')t=s}catch{}const d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t;const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#101725':'#f8f5ee')})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

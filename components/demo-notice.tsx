import Link from 'next/link';
import { STATIC_DEMO } from '@/lib/deployment';

export default function DemoNotice() {
  if (!STATIC_DEMO) return null;
  return (
    <aside className="demo-notice" aria-label="Interactive demo information">
      <span>INTERACTIVE DEMO</span>
      <p>Explore templates, edit your kit and download real files. Work stays in this browser.</p>
      <Link
        href="/help"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="What works here (opens in a new tab)"
      >
        What works here <span aria-hidden="true">↗</span>
      </Link>
    </aside>
  );
}

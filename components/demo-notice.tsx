import Link from 'next/link';
import { STATIC_DEMO } from '@/lib/deployment';

export default function DemoNotice({ showHelpLink = true }: { showHelpLink?: boolean }) {
  if (!STATIC_DEMO) return null;
  return (
    <aside className="demo-notice" aria-label="Interactive demo information">
      <span>INTERACTIVE DEMO</span>
      <p>
        Final integrations are planned for a future release. Development and testing are in
        progress; Gemini, cloud accounts and Shopify are not connected in this demo. Templates,
        editing and downloads work in your browser.
      </p>
      {showHelpLink && (
        <Link
          href="/help"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="What works here (opens in a new tab)"
        >
          What works here <span aria-hidden="true">↗</span>
        </Link>
      )}
    </aside>
  );
}

import Link from 'next/link';
import BrandLogo from './brand-logo';
import ThemeToggle from './theme-toggle';

export function supportEmail() {
  const email = process.env.STUDIOSHELF_SUPPORT_EMAIL?.trim();
  return email && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)
    ? email
    : null;
}
export function SupportContact() {
  const email = supportEmail();
  return email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <p>
      A support contact has not been published yet. StudioShelf is in development; public merchant
      onboarding is not open.
    </p>
  );
}
export default function PublicInfo({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="info-site">
      <header>
        <Link href="/" className="info-brand">
          <BrandLogo size={32} />
          <span>StudioShelf</span>
        </Link>
        <ThemeToggle />
      </header>
      <main>
        <span className="info-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        {children}
      </main>
      <footer>
        <Link href="/shopify">Shopify workspace</Link>
        <Link href="/help">Help</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/support">Support</Link>
        <Link href="/pricing">Pricing</Link>
      </footer>
    </div>
  );
}

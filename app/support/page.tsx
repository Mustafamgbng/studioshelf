import PublicInfo, { SupportContact } from '@/components/public-info';
export const dynamic = 'force-dynamic';
export default function SupportPage() {
  return (
    <PublicInfo eyebrow="HERE TO HELP" title="A little help for your launch.">
      <p>
        StudioShelf is being prepared for Shopify development-store testing. Public installation is
        not open yet.
      </p>
      <section>
        <h2>Contact</h2>
        <SupportContact />
        <p>
          Include the store’s myshopify.com domain, the action you tried and the error message. Keep
          passwords, Shopify tokens, API keys and customer information out of support messages.
        </p>
      </section>
      <section>
        <h2>Keep your work safe</h2>
        <p>
          Download a launch ZIP before replacing a draft. A failed generation leaves your edited kit
          intact. If another staff member saves a newer version, reload that kit before continuing.
          For a description save with an uncertain outcome, check Shopify before creating a new
          preview.
        </p>
      </section>
    </PublicInfo>
  );
}

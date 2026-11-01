import PublicInfo, { SupportContact } from '@/components/public-info';
export const dynamic = 'force-dynamic';
export default function PrivacyPage() {
  return (
    <PublicInfo eyebrow="YOUR DATA" title="Privacy, made clear.">
      <p>
        Last updated 1 November 2026. This policy describes the StudioShelf development beta. The
        app is not yet approved for public distribution.
      </p>
      <section>
        <h2>What StudioShelf handles</h2>
        <p>
          When connected to Shopify, we read the store ID, domain, name, currency, approved
          permissions and product details you select: title, description, images, variants, price
          and storefront URL. We verify the current Shopify staff session on protected requests. We
          do not request customers, orders, payment details or store passwords.
        </p>
        <p>
          Saved kits, imported product references, store branding and description history are stored
          for your store. Staff with the required Shopify access can use this shared workspace.
          Avoid entering customer information or confidential material into product briefs.
        </p>
      </section>
      <section>
        <h2>Generation and service providers</h2>
        <p>
          Templates run without an AI provider. When you choose Gemini in the Shopify workspace,
          your confirmed product brief is sent through our server to Google to generate text.
          Shopify product photographs are used for previews and exports, and are not sent to Gemini
          by this workspace. The standalone studio can send an explicitly uploaded photo when
          generating with Gemini.
        </p>
        <p>
          Your own Gemini key is kept in the current tab’s memory and is not included in saved kits.
          The app uses Vercel for hosting and Supabase for configured store storage. These providers
          may process operational logs and metadata under their own policies. Google’s free API tier
          may use submitted content to improve its products; review{' '}
          <a
            href="https://ai.google.dev/gemini-api/terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google’s API terms
          </a>{' '}
          before choosing it.
        </p>
      </section>
      <section>
        <h2>Retention and deletion</h2>
        <p>
          You can delete saved kits and download your work. Shopify uninstall notifications remove
          stored kits, description history and branding, and deactivate the connection. Monthly
          usage counters remain until Shopify’s shop-redaction request, which removes store records
          and linked data. Non-identifying webhook delivery IDs and aggregate usage counts may
          remain for duplicate prevention and usage controls. Data in provider backups follows the
          provider’s retention policy.
        </p>
        <p>
          Shopify’s customer data-request and customer-redaction webhooks are verified and
          acknowledged. Because the app does not fetch customer records, no customer records are
          indexed or retained through those APIs. Contact support if personal information was added
          to a brief by mistake.
        </p>
      </section>
      <section>
        <h2>Your choices and requests</h2>
        <p>
          Use templates, supply your own Gemini key, decline optional product-write permission,
          export your work, delete kits or uninstall the app. For access, correction or deletion
          requests concerning this app’s stored data, contact the operator below. Before public
          launch, the operator must publish their identity and working support contact.
        </p>
        <SupportContact />
      </section>
    </PublicInfo>
  );
}

import PublicInfo from '@/components/public-info';
export default function PricingPage() {
  return (
    <PublicInfo eyebrow="SIMPLE BY DESIGN" title="A free development beta.">
      <section>
        <h2>$0 StudioShelf fee</h2>
        <p>
          No paid app plan or subscription is offered in this release. Template generation, editing
          and downloads have no StudioShelf generation fee. Hosting, provider quotas and fair
          platform limits still apply.
        </p>
      </section>
      <section>
        <h2>Bring your own Gemini key</h2>
        <p>
          Google applies your own project’s quotas and pricing. A free API allowance is not
          guaranteed. StudioShelf does not add a charge to your Shopify bill for this option.
        </p>
      </section>
      <section>
        <h2>Optional hosted Gemini</h2>
        <p>
          Hosted AI is off by default. When enabled, your connected workspace shows its monthly
          attempt allowance and remaining attempts. Each request reserves one attempt, including
          failed provider calls. A deployment-wide cap can stop hosted generation for all stores.
          Templates and your own key remain available.
        </p>
        <p>
          Attempt allowances are not a monetary billing limit. The operator must also configure
          provider quotas and monitor usage before enabling hosted AI. StudioShelf does not
          automatically purchase more quota or charge overage fees.
        </p>
      </section>
      <section>
        <h2>Future paid plans</h2>
        <p>
          Any future paid public-app plan must use Shopify-supported app pricing and merchant
          approval. No card details are collected here.
        </p>
      </section>
    </PublicInfo>
  );
}

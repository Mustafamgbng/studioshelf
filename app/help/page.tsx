import Link from 'next/link';
import PublicInfo from '@/components/public-info';
export default function HelpPage() {
  return (
    <PublicInfo eyebrow="THE SHOPIFY WORKFLOW" title="From product to launch kit.">
      <ol>
        <li>
          <h2>Open your store workspace.</h2>
          <p>
            Once the app is registered and installed for testing, open StudioShelf from Shopify
            Admin. Each protected action verifies the current store and staff permissions. Browser
            storage is not required for store kits.
          </p>
        </li>
        <li>
          <h2>Select a product and variant.</h2>
          <p>
            Search the store catalogue, select the variant you are promoting and choose a product
            image. Published products include their real storefront link. Unpublished products have
            no public link to include.
          </p>
        </li>
        <li>
          <h2>Confirm what you know.</h2>
          <p>
            Review imported details and add missing materials, dimensions, care instructions or
            other confirmed facts. Check the confirmation box before generating. Details changed in
            Shopify must be reviewed again.
          </p>
        </li>
        <li>
          <h2>Generate, then make it yours.</h2>
          <p>
            Choose free templates, your own Gemini key or hosted AI when the operator has enabled an
            allowance. Review all claims and edit the copy. Regenerate one asset to preserve the
            rest of your edits.
          </p>
        </li>
        <li>
          <h2>Save and download.</h2>
          <p>
            Save the kit to the connected store so authorized staff can reopen it. Download five
            story PNGs, the listing, captions, email copy and editable project. Downloads do not
            publish to social accounts.
          </p>
        </li>
        <li>
          <h2>Optionally update a description.</h2>
          <p>
            Approve Shopify’s optional product-write permission, create a before-and-after preview,
            then explicitly approve the save. Previous descriptions can be previewed and restored. A
            changed description or expired preview requires a fresh review.
          </p>
        </li>
      </ol>
      <p>
        <Link className="btn primary" href="/shopify">
          Open Shopify workspace
        </Link>
      </p>
      <p>
        The <Link href="/studio">standalone studio</Link> remains available before Shopify is
        configured.
      </p>
    </PublicInfo>
  );
}

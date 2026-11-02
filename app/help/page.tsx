import Link from 'next/link';
import PublicInfo from '@/components/public-info';
export default function HelpPage() {
  return (
    <PublicInfo eyebrow="A LITTLE GUIDANCE" title="From product to launch kit.">
      <h2>Start in the creative studio.</h2>
      <p>
        You can explore without an account or API key. Try the working examples on the homepage,
        then open your creative desk for a guided tour, a new product or your saved kits.
      </p>
      <ol>
        <li>
          <h2>Choose an example or add your product.</h2>
          <p>
            Add a photo and confirmed product facts. Free templates run in your browser. Connect
            your own Gemini key in Connections if you want AI generation instead.
          </p>
        </li>
        <li>
          <h2>Shape the look and the words.</h2>
          <p>
            In Creative studio, use Photos to assign different product photos across slides. Choose
            Design for layouts, typography and photo framing, or Text to edit a slide. Your design
            choices appear in the downloads. Preview zoom only changes your view. Review the
            listing, captions and email in context before sharing. Refresh one asset to keep your
            other edits, or use undo and redo during this session.
          </p>
        </li>
        <li>
          <h2>Keep your brand familiar.</h2>
          <p>
            Brand studio holds your logo, colours, voice and call to action. Save a default for new
            blank kits in this browser. Existing kits keep their own branding. A new voice or call
            to action is used when you regenerate copy; it does not replace your edits.
          </p>
        </li>
        <li>
          <h2>Save, review and take it with you.</h2>
          <p>
            Confirm the seller checklist in Review, then open Publish pack. Its checks point to
            missing facts or links and outdated copy. Preview your shop, Instagram, WhatsApp and
            email files; download one file or the channel pack. Save changes to reopen a kit from
            Saved kits in this browser. Download the complete ZIP for five story PNGs, channel
            HTML/text files, written assets and an editable project backup. Keep a backup for
            another device or browser. Downloads and content previews do not publish posts or send
            emails.
          </p>
        </li>
      </ol>
      <p>
        <Link className="btn primary" href="/studio">
          Open creative desk
        </Link>
      </p>
      <h2>Using StudioShelf inside Shopify.</h2>
      <p>
        Shopify setup and development testing are still required before installation. Once the app
        is configured, use this store-based workflow.
      </p>
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
    </PublicInfo>
  );
}

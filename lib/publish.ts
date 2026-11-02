import { factLines } from './engine';
import { getProjectImage } from './samples';
import { getReviewProgress } from './review';
import type { Project } from './types';

export type PublishTarget = 'brief' | 'link' | 'photos' | 'listing' | 'social' | 'review';
export const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
export function productDestination(value?: string) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
const paragraphs = (text: string, url?: string | null) => {
  const html = text
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  return url
    ? html.replaceAll(escapeHtml(url), `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`)
    : html;
};
export function shopDescriptionHtml(project: Project) {
  const destination = productDestination(project.product.url);
  return `<h2>${escapeHtml(project.kit.title)}</h2>\n${paragraphs(project.kit.description, destination)}\n<ul>\n${project.kit.bullets.map((line) => `  <li>${escapeHtml(line)}</li>`).join('\n')}\n</ul>${destination && !project.kit.description.includes(destination) ? `\n<p><a href="${escapeHtml(destination)}">${escapeHtml(project.product.cta)}</a></p>` : ''}`;
}
export function launchEmailHtml(project: Project) {
  const destination = productDestination(project.product.url);
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(project.kit.emailSubject)}</title></head>\n<body style="font-family:Arial,sans-serif;line-height:1.7;color:#172132;max-width:600px;margin:32px auto;padding:0 20px">\n<p style="font-size:12px;letter-spacing:1px">${escapeHtml(project.product.brand)}</p>\n<h1 style="font-size:28px;line-height:1.2">${escapeHtml(project.kit.emailSubject)}</h1>\n${paragraphs(project.kit.emailBody, destination)}${destination && !project.kit.emailBody.includes(destination) ? `\n<p><a href="${escapeHtml(destination)}">${escapeHtml(project.product.cta)}</a></p>` : ''}\n</body></html>`;
}
export function publishFiles(project: Project) {
  return [
    {
      id: 'shop',
      label: 'Shop listing',
      format: 'HTML',
      filename: 'shop-description.html',
      content: shopDescriptionHtml(project),
      hint: 'Paste into your shop’s HTML description editor. Review its formatting before publishing.',
    },
    {
      id: 'instagram',
      label: 'Instagram',
      format: 'TXT',
      filename: 'instagram-caption.txt',
      content: project.kit.instagram,
      hint: 'Copy the caption and pair it with your five carousel slides.',
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      format: 'TXT',
      filename: 'whatsapp-message.txt',
      content: project.kit.whatsapp,
      hint: 'A plain-text product message for your own WhatsApp conversation or catalogue workflow.',
    },
    {
      id: 'email',
      label: 'Launch email',
      format: 'HTML',
      filename: 'launch-email.html',
      content: launchEmailHtml(project),
      hint: 'Import into an email tool that accepts HTML. Add its required unsubscribe and sender details.',
    },
    {
      id: 'subject',
      label: 'Email subject',
      format: 'TXT',
      filename: 'email-subject.txt',
      content: project.kit.emailSubject,
      hint: 'Use with your launch email.',
    },
  ];
}
export function launchChecks(project: Project) {
  const review = getReviewProgress(project);
  const destination = productDestination(project.product.url);
  const linkedChannels = destination
    ? publishFiles(project).filter(
        (file) =>
          file.id !== 'subject' &&
          (file.format === 'HTML'
            ? file.content.includes(`href="${escapeHtml(destination)}"`)
            : file.content.includes(destination)),
      ).length
    : 0;
  const images = new Set(
    project.kit.slides.map((_, index) => getProjectImage(project, index)).filter(Boolean),
  );
  const signature = (value: Project['product']) =>
    JSON.stringify(
      (
        [
          'name',
          'brand',
          'category',
          'audience',
          'facts',
          'price',
          'currency',
          'voice',
          'cta',
          'url',
        ] as const
      ).map((key) => (value[key] || '').trim()),
    );
  const stale =
    project.generationBrief && signature(project.generationBrief) !== signature(project.product);
  return [
    {
      id: 'facts',
      label: 'Product facts',
      ready: factLines(project.product).length >= 3,
      detail:
        factLines(project.product).length >= 3
          ? `${factLines(project.product).length} supplied facts keep your launch grounded.`
          : 'Add at least three specific details so the draft has something useful to say.',
      target: 'brief' as PublishTarget,
    },
    {
      id: 'destination',
      label: 'Product destination',
      ready: linkedChannels === 4,
      detail: destination
        ? `${linkedChannels} of 4 channel files include your current product URL. ${linkedChannels === 4 ? 'Check every link before sharing.' : 'Add it to missing social copy; check for old links.'}`
        : 'Add your product URL so a customer has somewhere to go after reading.',
      target: (destination ? 'social' : 'link') as PublishTarget,
    },
    {
      id: 'photos',
      label: 'Product imagery',
      ready: images.size > 0,
      detail:
        images.size > 0
          ? `${images.size} distinct ${images.size === 1 ? 'photo is' : 'photos are'} used across your five slides.`
          : 'Add a product photo before sharing your artwork.',
      target: 'photos' as PublishTarget,
    },
    {
      id: 'freshness',
      label: 'Copy matches this brief',
      ready: !!project.generationBrief && !stale,
      detail: !project.generationBrief
        ? 'No generation snapshot is saved. Review your copy or generate a fresh kit.'
        : stale
          ? 'Your product facts changed after generation. Update or regenerate the affected copy.'
          : 'No change from the saved generation brief is detected. Read the copy for accuracy.',
      target: 'listing' as PublishTarget,
    },
    {
      id: 'review',
      label: 'Your final review',
      ready: review.complete,
      detail: `${review.done} of ${review.total} seller checks complete. Confirm facts and inspect your slides.`,
      target: 'review' as PublishTarget,
    },
  ];
}

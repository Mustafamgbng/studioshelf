# StudioShelf identity

The StudioShelf mark is an original geometric monogram built from two opposing editorial cards. Their offset shelves form an abstract **S**. Thick filled shapes keep it legible in a browser tab, navigation bar or small avatar; the rounded square makes it a recognizable standalone app mark.

## Files

- `components/brand-logo.tsx`: accessible, scalable React icon. Default size: 32 pixels.
- `public/brand/studioshelf-mark.svg`: standalone mark with transparent space outside the navy tile.
- `public/brand/studioshelf-mark.png`: 192-pixel raster export of the same mark.
- `public/brand/studioshelf-logo.svg`: mark plus editorial wordmark. It uses system serif fonts rather than an embedded font asset.
- `app/icon.svg`: the same mark as a Next.js file-based favicon.

```tsx
import BrandLogo from '@/components/brand-logo';

<BrandLogo size={32} className="brand-mark" />;
```

The component's fixed SVG geometry has no generated IDs, gradients or external assets. Its default colors work on both interface modes. CSS may override `--brand-logo-bg`, `--brand-logo-ink`, and `--brand-logo-accent` when a different contrast treatment is needed.

## Palette

| Color      | Value     | Role                               |
| ---------- | --------- | ---------------------------------- |
| Navy       | `#14233b` | Main ink and icon tile             |
| Cobalt     | `#3e5edb` | Interface links and primary accent |
| Periwinkle | `#7793ff` | Lower shelf inside the navy mark   |
| Ivory      | `#f8f5ee` | Light page canvas and upper shelf  |
| Sage       | `#e5ece1` | Supporting editorial surfaces      |

Keep clear space of approximately one quarter of the mark's width around a standalone icon. Avoid stretching, rotating, adding a shadow inside the tile, or replacing the filled shapes with outlines. At small sizes, use the mark alone rather than shrinking the whole wordmark. A minimum display size of 20 pixels is recommended for the icon.

This artwork was authored for StudioShelf. No third-party logo or icon asset is incorporated. This design documentation does not establish trademark registration or clearance.

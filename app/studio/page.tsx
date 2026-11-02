import Studio from '@/components/studio';
import { studioOptions } from '@/lib/studio-route';

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const options = studioOptions(params);
  return (
    <Studio
      key={JSON.stringify(options)}
      initialSampleId={options.sample}
      initialTheme={options.theme}
      initialSlide={options.slide}
      initialTab={options.tab}
    />
  );
}

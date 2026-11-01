import Studio from '@/components/studio';

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string | string[] }>;
}) {
  const params = await searchParams;
  const sample = typeof params.sample === 'string' ? params.sample : undefined;
  return <Studio key={sample || 'default'} initialSampleId={sample} />;
}

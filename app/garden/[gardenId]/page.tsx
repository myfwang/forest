import { redirect } from "next/navigation";

export default async function GardenRedirect({
  params,
}: {
  params: Promise<{ gardenId: string }>;
}) {
  const { gardenId } = await params;
  redirect(`/forest/${gardenId}`);
}

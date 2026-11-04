import { redirect } from "next/navigation";

// The shipment used to be a second page. It is all on the shipping page now; old links and bookmarks still land there.
export default async function ShipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; id: string; sid: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { token, id } = await params;
  const { e } = await searchParams;
  redirect(`/m/${token}/orders/${id}/ship${e ? `?e=${encodeURIComponent(e)}` : ""}`);
}

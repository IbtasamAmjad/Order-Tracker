import { redirect } from "next/navigation";

/** Shipping is now one cart for all of a master's customers. */
export default async function ShipHome({ params, searchParams }: { params: Promise<{ token: string; id: string }>; searchParams: Promise<{ sent?: string; e?: string }> }) {
  const { token } = await params;
  const { sent, e } = await searchParams;
  redirect(`/m/${token}/cart${sent ? `?sent=${sent}` : e ? `?e=${e}` : ""}`);
}

import { requireMaster } from "@/lib/master-session";
import { masterOrder } from "@/lib/orders";
import { orderFile } from "@/lib/order-files";
import { get } from "@/lib/storage";

// A master opens a PDF attached to one of his own orders.
export async function GET(_req: Request, ctx: { params: Promise<{ token: string; id: string; fileId: string }> }) {
  const { token, id, fileId } = await ctx.params;
  const master = await requireMaster(token);
  if (!master) return new Response("Not found", { status: 404 });
  const order = masterOrder(master.id, Number(id));
  const row = order ? orderFile(order.id, Number(fileId)) : null;
  const data = row ? await get(row.fileKey) : null;
  if (!row || !data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${row.name}"`,
      "cache-control": "private, no-store",
    },
  });
}

import { requireMaster } from "@/lib/master-session";
import { masterOrder } from "@/lib/orders";
import { renderOrderPdf } from "@/lib/pdf";
import { buildPrintData } from "@/lib/print";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await ctx.params;
  const master = await requireMaster(token);
  if (!master) return new Response("Not found", { status: 404 });
  const order = masterOrder(master.id, Number(id));
  const data = order ? buildPrintData(order.id) : null;
  if (!order || !data) return new Response("Not found", { status: 404 });
  const pdf = await renderOrderPdf(data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="order-${data.orderNumber}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}

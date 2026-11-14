import { requireMaster } from "@/lib/master-session";
import { masterOrder } from "@/lib/orders";
import { renderOrderPdf } from "@/lib/pdf";
import { buildPrintData, hasSlips } from "@/lib/print";

// Master side (his own orders only). `?only=slips` gives just the tailor slips.
export async function GET(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await ctx.params;
  const master = await requireMaster(token);
  if (!master) return new Response("Not found", { status: 404 });
  const order = masterOrder(master.id, Number(id));
  const data = order ? buildPrintData(order.id) : null;
  if (!order || !data) return new Response("Not found", { status: 404 });
  const slips = new URL(req.url).searchParams.get("only") === "slips";
  if (slips && !hasSlips(data)) return new Response("This order has no tailor slips.", { status: 404 });
  const pdf = await renderOrderPdf(data, slips ? { only: "slips" } : {});
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="order-${data.orderNumber}${slips ? "-tailor-slips" : ""}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}

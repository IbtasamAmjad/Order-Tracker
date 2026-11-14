import { isAdmin } from "@/lib/admin-auth";
import { renderOrderPdf } from "@/lib/pdf";
import { buildPrintData, hasSlips } from "@/lib/print";

// Admin side (needs the admin sign-in). `?only=slips` gives just the tailor slips.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Admin login needed." }, { status: 401 });
  const data = buildPrintData(Number((await ctx.params).id));
  if (!data) return new Response("Not found", { status: 404 });
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

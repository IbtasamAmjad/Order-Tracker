import { isAdmin } from "@/lib/admin-auth";
import { renderOrderPdf } from "@/lib/pdf";
import { buildPrintData } from "@/lib/print";

// Admin side (needs the admin sign-in).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Admin login needed." }, { status: 401 });
  const data = buildPrintData(Number((await ctx.params).id));
  if (!data) return new Response("Not found", { status: 404 });
  const pdf = await renderOrderPdf(data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="order-${data.orderNumber}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}

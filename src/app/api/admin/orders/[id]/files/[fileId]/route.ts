import { isAdmin } from "@/lib/admin-auth";
import { orderFile } from "@/lib/order-files";
import { get } from "@/lib/storage";

// Admin opens a PDF attached to an order.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; fileId: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Admin login needed." }, { status: 401 });
  const { id, fileId } = await ctx.params;
  const row = orderFile(Number(id), Number(fileId));
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

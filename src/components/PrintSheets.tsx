import { photoHeightMm, type PrintData, type Sheet } from "@/lib/print";

/** Black-and-white printable pages: one per item type (or shared print group). */
export function PrintSheets({ data, imgUrl }: { data: PrintData; imgUrl: (photoId: number) => string }) {
  const sheets: Sheet[] = data.sheets.length ? data.sheets : [{ key: "empty", title: "Order", items: [] }];
  return (
    <div className="space-y-6 print:space-y-0">
      {sheets.map((sheet, n) => {
        const h = photoHeightMm(sheet);
        return (
          <section
            key={sheet.key}
            className="border-2 border-black bg-white p-4 text-black print:border-0 print:p-0"
            style={n < sheets.length - 1 ? { breakAfter: "page" } : undefined}
          >
            <header className="mb-3 border-b-2 border-black pb-2">
              <p className="text-base">
                Order #{data.orderNumber} - {data.customerName} - Due: {data.karigarDueDate}
              </p>
              <h2 className="text-2xl font-medium">{sheet.title}</h2>
            </header>

            {sheet.items.map((item) => (
              <div key={item.label} className="mb-4" style={{ breakInside: "avoid" }}>
                <h3 className="mb-1 text-xl font-medium">{item.label}</h3>
                {item.details.map((d) =>
                  d.kind === "heading" ? (
                    <p key={d.label} className="mt-2 border-b border-black text-lg font-medium">
                      {d.label}
                    </p>
                  ) : d.kind === "note" ? (
                    <p key={d.label} className="whitespace-pre-wrap">
                      {d.label}
                    </p>
                  ) : (
                    <p key={d.label}>
                      <b>{d.label}:</b> {d.value}
                    </p>
                  ),
                )}
                {item.measures.length > 0 && (
                  <dl className="mt-1 grid grid-cols-3 gap-x-4 gap-y-1 border border-black p-2">
                    {item.measures.map((m) => (
                      <div key={m.label}>
                        {m.label}: <b>{m.value}</b>
                      </div>
                    ))}
                  </dl>
                )}
                {item.photoIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.photoIds.map((id) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={id} src={imgUrl(id)} alt="Reference" style={{ height: `${h}mm`, width: "auto" }} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {data.notes && (
              <div className="mt-3 border-t border-black pt-2">
                <b>Notes</b>
                <p className="whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

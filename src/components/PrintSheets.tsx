import { FIELD_PHOTO_MM, layoutDetails, photoHeightMm, type PrintData, type Sheet } from "@/lib/print";

/** Black-and-white printable pages: one per item type. */
export function PrintSheets({ data, imgUrl }: { data: PrintData; imgUrl: (photoId: number) => string }) {
  const sheets: Sheet[] = data.sheets.length ? data.sheets : [{ key: "empty", title: "Order", items: [] }];
  const pics = (ids: number[], mm: number) => (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {ids.map((id) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={id} src={imgUrl(id)} alt="Picture" style={{ height: `${mm}mm`, width: "auto" }} className="border border-neutral-400" />
      ))}
    </div>
  );
  return (
    <div className="space-y-6 print:space-y-0">
      {sheets.map((sheet, n) => {
        const h = photoHeightMm(sheet);
        return (
          <section
            key={sheet.key}
            className="border-2 border-black bg-white p-5 text-black print:border-0 print:p-0"
            style={n < sheets.length - 1 ? { breakAfter: "page" } : undefined}
          >
            <header className="mb-5 border-2 border-black">
              <div className="flex">
                <div className="min-w-0 flex-1 border-b-2 border-black p-3">
                  <p className="text-xs uppercase tracking-wider">Order #{data.orderNumber}</p>
                  <p className="text-2xl font-medium leading-tight">{data.customerName}</p>
                  {data.designNumber && (
                    <p className="text-base">
                      Design: <b className="font-medium">{data.designNumber}</b>
                    </p>
                  )}
                </div>
                <div className="w-52 shrink-0 border-b-2 border-l-2 border-black p-3 text-right">
                  <p className="text-xs uppercase tracking-wider">Due date</p>
                  <p className="text-xl font-medium leading-tight">{data.dueLabel}</p>
                </div>
              </div>
              <h2 className="px-3 py-2 text-3xl font-medium">{sheet.title}</h2>
            </header>

            {sheet.items.map((item) => (
              <div key={item.label} className="mb-6" style={{ breakInside: "avoid" }}>
                {(sheet.items.length > 1 || item.label !== sheet.title) && <h3 className="mb-1 border-b-2 border-black pb-1 text-xl font-medium">{item.label}</h3>}
                {layoutDetails(item.details, item.measures).map((b, i) =>
                  b.type === "heading" ? (
                    <p key={i} className="mb-1 mt-5 border-b-2 border-black pb-0.5 text-sm font-medium uppercase tracking-wider">
                      {b.label}
                    </p>
                  ) : b.type === "note" ? (
                    <p key={i} className="whitespace-pre-wrap border-b border-neutral-400 py-1 text-sm italic">
                      {b.label}
                    </p>
                  ) : b.type === "grid" ? (
                    <div key={i} className="mt-1 grid grid-cols-3 gap-px border border-black bg-black">
                      {b.cells.map((c) => (
                        <div key={c.label} className="bg-white px-2 py-1.5">
                          <p className="text-xs">{c.label}</p>
                          <p className="text-lg font-medium leading-tight">{c.value}</p>
                        </div>
                      ))}
                      {Array.from({ length: (3 - (b.cells.length % 3)) % 3 }, (_, k) => (
                        <div key={`pad-${k}`} className="bg-white" />
                      ))}
                    </div>
                  ) : (
                    <div key={i} className="border-b border-neutral-400 py-1.5" style={{ breakInside: "avoid" }}>
                      <div className="grid grid-cols-[34%_minmax(0,1fr)] gap-3">
                        <span className="font-medium">{b.label}</span>
                        <span className="whitespace-pre-wrap break-words">{b.value}</span>
                      </div>
                      {b.photoIds.length > 0 && pics(b.photoIds, FIELD_PHOTO_MM)}
                    </div>
                  ),
                )}
                {item.photoIds.length > 0 && (
                  <div className="mt-5">
                    <p className="border-b-2 border-black pb-0.5 text-sm font-medium uppercase tracking-wider">Pictures</p>
                    {pics(item.photoIds, h)}
                  </div>
                )}
                {item.slip && (
                  <div className="mt-6" style={{ breakInside: "avoid" }}>
                    <p className="border-t-2 border-dashed border-black pt-1 text-center text-[10px] uppercase tracking-widest">Cut here - tailor slip</p>
                    <div className="border border-black p-1.5">
                      <p className="text-sm font-medium leading-tight">
                        #{data.orderNumber} {data.customerName} - {item.label}
                      </p>
                      <div className="mt-1 grid grid-cols-4 gap-px border border-black bg-black">
                        {item.slip.cells.map((c, k) => (
                          <div key={`${c.label}-${k}`} className="bg-white px-1.5 py-0.5">
                            <p className="text-[9px] leading-tight">{c.label}</p>
                            <p className="text-sm font-medium leading-tight">{c.value}</p>
                          </div>
                        ))}
                        {Array.from({ length: (4 - (item.slip.cells.length % 4)) % 4 }, (_, k) => (
                          <div key={`slip-pad-${k}`} className="bg-white" />
                        ))}
                      </div>
                      {item.slip.notes.map((t, k) => (
                        <p key={k} className="mt-0.5 whitespace-pre-wrap text-xs leading-snug">
                          {t}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {data.notes && (
              <div className="mt-4 border-t-2 border-black pt-2">
                <p className="text-sm font-medium uppercase tracking-wider">Notes</p>
                <p className="whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

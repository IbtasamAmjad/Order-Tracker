import {
  FIELD_CELL_PHOTO_MM,
  FIELD_PHOTO_MM,
  REF_PHOTO_MM,
  gridRows,
  layoutDetails,
  photoHeightMm,
  slipExtras,
  slipItemTitle,
  type Block,
  type PrintData,
  type Sheet,
  type SheetItem,
} from "@/lib/print";

/** The printed blocks cut into groups: one group per heading with what follows it (the part before the first heading is its own group). */
function groupUnderHeadings(blocks: Block[]) {
  const groups: { headed: boolean; items: { b: Block; i: number }[] }[] = [];
  blocks.forEach((b, i) => {
    if (b.type === "heading" || groups.length === 0) groups.push({ headed: b.type === "heading", items: [] });
    groups[groups.length - 1].items.push({ b, i });
  });
  return groups;
}

/**
 * Black-and-white printable pages: one per item type, then one "Tailor slips" page with every item's tailor slip (by
 * request 14 Nov 2026, so they are all cut from one sheet). The same layout as the PDF (`src/lib/pdf.tsx`).
 */
export function PrintSheets({ data, imgUrl }: { data: PrintData; imgUrl: (photoId: number) => string }) {
  const sheets: Sheet[] = data.sheets.length ? data.sheets : [{ key: "empty", title: "Order", items: [] }];
  const slipItems = sheets.flatMap((sh) => sh.items.filter((i) => i.slip));
  const pages: { sheet: Sheet; slips: boolean }[] = [
    ...sheets.map((sheet) => ({ sheet, slips: false })),
    ...(slipItems.length ? [{ sheet: { key: "tailor-slips", title: "Tailor slips", items: slipItems }, slips: true }] : []),
  ];

  const pics = (ids: number[], mm: number) => (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {ids.map((id) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={id} src={imgUrl(id)} alt="Picture" style={{ height: `${mm}mm`, width: "auto", maxWidth: "100%" }} className="border border-neutral-400" />
      ))}
    </div>
  );

  const header = (title: string) => (
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
      <h2 className="px-3 py-2 text-3xl font-medium">{title}</h2>
    </header>
  );

  // one tailor slip: the tailor's sheet, "Customer Name X   Item Measurements", then rows of names (underlined) with the
  // value under a line and a small note under that
  const tailorSlip = (item: SheetItem, key: string) =>
    item.slip ? (
      <div key={key} className="mb-6" style={{ breakInside: "avoid" }}>
        <p className="border-t-2 border-dashed border-black pt-1 text-center text-[10px] uppercase tracking-widest">Cut here - tailor slip</p>
        <div className="mt-2 flex items-baseline justify-between text-sm">
          <div className="flex flex-wrap gap-x-12">
            <span className="font-bold">Customer Name: {data.customerName}</span>
            <span className="font-bold">{slipItemTitle(item.label, item.slip.head)}</span>
            {slipExtras(item.slip.head).map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <span className="font-bold">Order #{data.orderNumber}</span>
        </div>
        <div className="mt-4 space-y-4">
          {gridRows(item.slip.cells, item.slip.cols).map((row, r) => (
            <div key={r} className="flex">
              {row.map((c, k) => (
                <div key={`${c.label}-${k}`} className="px-1 text-center" style={{ width: `${100 / item.slip!.cols}%` }}>
                  <p className="text-sm underline">{c.label}</p>
                  <p className="mt-0.5 border-b border-black text-base leading-snug">{c.value}</p>
                  {c.note && <p className="text-[11px] uppercase leading-tight">{c.note}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
        {item.slip.notes.map((t, k) => (
          <p key={k} className="mt-2 whitespace-pre-wrap text-xs leading-snug">
            {t}
          </p>
        ))}
      </div>
    ) : null;

  const itemBlock = (sheet: Sheet, item: SheetItem, key: string) => {
    const h = photoHeightMm(sheet);
    return (
      <div key={key} className="mb-6" style={{ breakInside: "avoid" }}>
        {(sheet.items.length > 1 || item.label !== sheet.title) && <h3 className="mb-1 max-w-none border-b-2 border-black pb-1 text-xl font-medium">{item.label}</h3>}
        {/* everything under a heading (the heading, its rows, its measurements table) is kept on one page when it fits */}
        {groupUnderHeadings(layoutDetails(item.details, item.measures)).map((g, n) => (
          <div key={`g${n}`} style={g.headed ? { breakInside: "avoid" } : undefined}>
            {g.items.map(({ b, i }) =>
          b.type === "heading" ? (
            <p key={i} className="mb-1 mt-5 border-b-2 border-black pb-0.5 text-sm font-medium uppercase tracking-wider" style={{ breakAfter: "avoid" }}>
              {b.label}
            </p>
          ) : b.type === "note" ? (
            <p key={i} className="whitespace-pre-wrap border-b border-neutral-400 py-1 text-sm italic">
              {b.label}
            </p>
          ) : b.type === "grid" ? (
            // one row of three boxes at a time, each kept whole, so a page break never cuts a name from its value (like
            // the PDF); real borders on every box, because the old 1px-gap trick printed faint or missing lines
            <div key={i} className="mt-1 border-l border-t border-black" style={{ breakInside: "avoid" }}>
              {Array.from({ length: Math.ceil(b.cells.length / 3) }, (_, r) => (
                <div key={r} className="grid grid-cols-3" style={{ breakInside: "avoid" }}>
                  {Array.from({ length: 3 }, (_, k) => {
                    const c = b.cells[r * 3 + k];
                    return (
                      <div key={k} className="border-b border-r border-black px-2 py-1.5">
                        {c && (
                          <>
                            <p className="text-xs">{c.label}</p>
                            <p className="text-lg font-medium leading-tight">{c.value}</p>
                            {c.note && <p className="text-[10px] uppercase leading-tight">{c.note}</p>}
                            {c.photoIds && c.photoIds.length > 0 && pics(c.photoIds, FIELD_CELL_PHOTO_MM)}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
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
          </div>
        ))}
        {item.photoIds.length > 0 && (
          <div className="mt-5">
            <p className="border-b-2 border-black pb-0.5 text-sm font-medium uppercase tracking-wider">Pictures</p>
            {(item.refPhotoIds?.length ?? 0) > 0 && pics(item.refPhotoIds!, REF_PHOTO_MM)}
            {pics(item.photoIds.filter((id) => !item.refPhotoIds?.includes(id)), h)}
          </div>
        )}
        {/* the tailor slip is not here: all slips are on the "Tailor slips" page at the end */}
        {item.karigar && (
          <div className="mt-6" style={{ breakInside: "avoid" }}>
            <p className="border-t-2 border-dashed border-black pt-1 text-center text-[10px] uppercase tracking-widest">Cut here - karigar paper</p>
            {/* the paper the master writes out by hand for the karigar: the name, then short names (underlined) with the value under each */}
            <p className="mt-2 text-center text-lg font-medium">{item.karigar.title}</p>
            <div className="mt-3 space-y-5">
              {item.karigar.rows.map((row, r) => (
                <div key={r} className="flex">
                  {row.map((c, k) => (
                    <div key={`${c.label}-${k}`} className="px-1 text-center" style={{ width: `${100 / item.karigar!.cols}%` }}>
                      <p className="text-base underline">{c.label}</p>
                      <p className="text-xl leading-snug">{c.value}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 print:space-y-0">
      {pages.map(({ sheet, slips }, n) => (
        <section
          key={sheet.key}
          className="border-2 border-black bg-white p-5 text-black print:border-0 print:p-0"
          style={n < pages.length - 1 ? { breakAfter: "page" } : undefined}
        >
          {/* a table head is repeated by the browser at the top of every printed page (the PDF does the same with `fixed`) */}
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <td className="p-0">{header(sheet.title)}</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-0 align-top">
                  {slips
                    ? sheet.items.map((item, k) => tailorSlip(item, `slip-${k}`))
                    : sheet.items.map((item, k) => itemBlock(sheet, item, `${item.label}-${k}`))}
                  {!slips && data.notes && (
                    <div className="mt-4 border-t-2 border-black pt-2">
                      <p className="text-sm font-medium uppercase tracking-wider">Notes</p>
                      <p className="whitespace-pre-wrap">{data.notes}</p>
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

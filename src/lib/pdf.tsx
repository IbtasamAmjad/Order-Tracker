import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import { FIELD_CELL_PHOTO_MM, FIELD_PHOTO_MM, REF_PHOTO_MM, allPhotoIds, gridRows, layoutDetails, photoHeightMm, slipExtras, slipItemTitle, type PrintData, type SheetItem } from "./print";
import { getPhoto } from "./stages";
import { get } from "./storage";

const MM = 2.835; // points per millimetre
const GREY = "#8a8a8a";
const s = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 11 },
  head: { borderWidth: 1.5, borderColor: "#000", marginBottom: 14 },
  headTop: { flexDirection: "row" },
  headLeft: { flex: 1, padding: 8 },
  headRight: { width: 150, padding: 8, borderLeftWidth: 1.5, borderLeftColor: "#000", alignItems: "flex-end" },
  small: { fontSize: 8, letterSpacing: 1, textTransform: "uppercase" },
  customer: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 1 },
  due: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 1, textAlign: "right" },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold", paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: 1.5, borderTopColor: "#000" },
  item: { marginBottom: 16 },
  itemLabel: { fontSize: 15, fontFamily: "Helvetica-Bold", borderBottomWidth: 1.5, borderBottomColor: "#000", paddingBottom: 3, marginBottom: 2 },
  headingLine: { fontFamily: "Helvetica-Bold", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", marginTop: 12, marginBottom: 2, borderBottomWidth: 1.5, borderBottomColor: "#000", paddingBottom: 2 },
  note: { fontSize: 9, fontStyle: "italic", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: GREY },
  row: { paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: GREY },
  rowLine: { flexDirection: "row" },
  rowLabel: { width: "34%", fontFamily: "Helvetica-Bold", paddingRight: 8 },
  rowValue: { flex: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
  grid: { marginTop: 4, borderTopWidth: 1, borderLeftWidth: 1, borderColor: "#000" },
  gridRow: { flexDirection: "row" },
  cell: { width: "33.33%", flexShrink: 0, paddingVertical: 4, paddingHorizontal: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#000" },
  cellLabel: { fontSize: 8 },
  cellValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  cellNote: { fontSize: 7, textTransform: "uppercase" },
  photos: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, alignSelf: "stretch" },
  cutLine: { marginTop: 14, paddingTop: 2, borderTopWidth: 1.5, borderTopStyle: "dashed", borderTopColor: "#000", textAlign: "center", fontSize: 7, letterSpacing: 1.5, textTransform: "uppercase" },
  slipTitle: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, fontSize: 10 },
  slipTitleLeft: { flexDirection: "row", flexWrap: "wrap", flex: 1 },
  slipGrid: { marginTop: 10 },
  slipRow: { flexDirection: "row", marginBottom: 10 },
  slipCell: { flexShrink: 0, paddingHorizontal: 3, alignItems: "center" },
  slipLabel: { fontSize: 10, textDecoration: "underline", textAlign: "center" },
  slipValue: { fontSize: 12, textAlign: "center", marginTop: 2, borderBottomWidth: 1, borderBottomColor: "#000", alignSelf: "stretch" },
  slipCellNote: { fontSize: 7, textTransform: "uppercase", textAlign: "center" },
  karigarTitle: { fontSize: 14, textAlign: "center", marginTop: 6, fontFamily: "Helvetica-Bold" },
  karigarValue: { fontSize: 14, textAlign: "center", marginTop: 3 },
  slipNote: { fontSize: 9, marginTop: 2 },
  galleryHead: { fontFamily: "Helvetica-Bold", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", marginTop: 12, borderBottomWidth: 1.5, borderBottomColor: "#000", paddingBottom: 2 },
  notes: { marginTop: 10, paddingTop: 6, borderTopWidth: 1.5, borderTopColor: "#000" },
});

/** Small JPEG for a stored photo (react-pdf does not read WebP). */
async function jpeg(photoId: number): Promise<Buffer | null> {
  const p = getPhoto(photoId);
  const data = p ? await get(p.fileKey) : null;
  return data ? sharp(data).resize({ width: 700, height: 700, fit: "inside" }).jpeg({ quality: 70 }).toBuffer() : null;
}

/** The same pages as the on-screen print view, as one PDF file. */
/** The order as a PDF. `only: "slips"` makes just the Tailor slips page(s) (the "Download tailor slips" button). */
export async function renderOrderPdf(data: PrintData, opts: { only?: "slips" } = {}): Promise<Buffer> {
  const images = new Map<number, Buffer>();
  for (const id of allPhotoIds(data)) {
    const b = await jpeg(id);
    if (b) images.set(id, b);
  }
  // inBox: a picture inside a measurement box is never wider than the box (and never taller than twice `mm`)
  const pics = (ids: number[], mm: number, inBox = false) => (
    <View style={s.photos}>
      {ids.map((id) =>
        images.has(id) ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image
            key={id}
            src={{ data: images.get(id)!, format: "jpg" }}
            style={inBox ? { width: "100%", maxHeight: mm * 2 * MM, objectFit: "contain", marginBottom: 4 } : { height: mm * MM, marginRight: 6, marginBottom: 6 }}
          />
        ) : null,
      )}
    </View>
  );

  // `fixed`: repeated at the top of every page, also when an item type runs on to a second page (by request 14 Nov 2026)
  const head = (title: string) => (
    <View style={s.head} fixed>
      <View style={s.headTop}>
        <View style={s.headLeft}>
          <Text style={s.small}>Order #{data.orderNumber}</Text>
          <Text style={s.customer}>{data.customerName}</Text>
          {data.designNumber ? <Text>Design: {data.designNumber}</Text> : null}
        </View>
        <View style={s.headRight}>
          <Text style={s.small}>Due date</Text>
          <Text style={s.due}>{data.dueLabel}</Text>
        </View>
      </View>
      <Text style={s.title}>{title}</Text>
    </View>
  );
  const notes = data.notes ? (
    <View style={s.notes}>
      <Text style={[s.small, s.bold]}>Notes</Text>
      <Text>{data.notes}</Text>
    </View>
  ) : null;

  // one tailor slip: the tailor's own sheet, "Customer Name X   Item Measurements", then names (underlined) with the
  // value under a line and a small note. Kept in one piece.
  const tailorSlip = (item: SheetItem, key: string) =>
    item.slip ? (
      <View key={key} wrap={false}>
        <Text style={s.cutLine}>Cut here - tailor slip</Text>
        <View style={s.slipTitle}>
          <View style={s.slipTitleLeft}>
            <Text style={{ marginRight: 24, fontFamily: "Helvetica-Bold" }}>Customer Name: {data.customerName}</Text>
            <Text style={{ marginRight: 24, fontFamily: "Helvetica-Bold" }}>{slipItemTitle(item.label, item.slip.head)}</Text>
            {slipExtras(item.slip.head).map((t) => (
              <Text key={t} style={{ marginRight: 24 }}>
                {t}
              </Text>
            ))}
          </View>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Order #{data.orderNumber}</Text>
        </View>
        <View style={s.slipGrid}>
          {gridRows(item.slip.cells, item.slip.cols).map((row, r) => (
            <View key={r} style={s.slipRow}>
              {row.map((c, k) => (
                <View key={`${c.label}-${k}`} style={[s.slipCell, { width: `${100 / item.slip!.cols}%` }]}>
                  <Text style={s.slipLabel}>{c.label}</Text>
                  <Text style={s.slipValue}>{c.value}</Text>
                  {c.note ? <Text style={s.slipCellNote}>{c.note}</Text> : null}
                </View>
              ))}
            </View>
          ))}
        </View>
        {item.slip.notes.map((t, k) => (
          <Text key={k} style={s.slipNote}>
            {t}
          </Text>
        ))}
      </View>
    ) : null;
  // every item's tailor slip, collected at the end of the PDF (by request 14 Nov 2026), so they are cut from one sheet
  const slipItems = data.sheets.flatMap((sh) => sh.items.filter((i) => i.slip));
  const slipsPage = slipItems.length ? (
    <Page key="tailor-slips" size="A4" style={s.page}>
      {head("Tailor slips")}
      {slipItems.map((item, k) => tailorSlip(item, `slip-${k}`))}
    </Page>
  ) : null;

  const pages =
    data.sheets.length === 0
      ? [
          <Page key="empty" size="A4" style={s.page}>
            {head("Order")}
            {notes}
          </Page>,
        ]
      : data.sheets.map((sheet) => {
          const h = photoHeightMm(sheet);
          return (
            <Page key={sheet.key} size="A4" style={s.page}>
              {head(sheet.title)}
              {sheet.items.map((item, k) => (
                <View key={`${item.label}-${k}`} style={s.item}>
                  {sheet.items.length > 1 || item.label !== sheet.title ? <Text style={s.itemLabel}>{item.label}</Text> : null}
                  {layoutDetails(item.details, item.measures).map((b, i) =>
                    b.type === "heading" ? (
                      <Text key={i} style={s.headingLine} minPresenceAhead={80}>
                        {b.label}
                      </Text>
                    ) : b.type === "note" ? (
                      <Text key={i} style={s.note}>
                        {b.label}
                      </Text>
                    ) : b.type === "grid" ? (
                      <View key={i} style={s.grid}>
                        {Array.from({ length: Math.ceil(b.cells.length / 3) }, (_, r) => (
                          <View key={r} style={s.gridRow} wrap={false}>
                            {Array.from({ length: 3 }, (_, k) => {
                              const c = b.cells[r * 3 + k];
                              return (
                                <View key={k} style={s.cell}>
                                  {c ? <Text style={s.cellLabel}>{c.label}</Text> : null}
                                  {c ? <Text style={s.cellValue}>{c.value}</Text> : null}
                                  {c?.note ? <Text style={s.cellNote}>{c.note}</Text> : null}
                                  {c?.photoIds && c.photoIds.length > 0 ? pics(c.photoIds, FIELD_CELL_PHOTO_MM, true) : null}
                                </View>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View key={i} style={s.row} wrap={false}>
                        <View style={s.rowLine}>
                          <Text style={s.rowLabel}>{b.label}</Text>
                          <Text style={s.rowValue}>{b.value}</Text>
                        </View>
                        {b.photoIds.length > 0 && pics(b.photoIds, FIELD_PHOTO_MM)}
                      </View>
                    ),
                  )}
                  {item.photoIds.length > 0 && (
                    <View>
                      {/* may continue on the next page; the heading never stays alone at the bottom */}
                      <Text style={s.galleryHead} minPresenceAhead={60}>
                        Pictures
                      </Text>
                      {(item.refPhotoIds?.length ?? 0) > 0 && pics(item.refPhotoIds!, REF_PHOTO_MM)}
                      {pics(item.photoIds.filter((id) => !item.refPhotoIds?.includes(id)), h)}
                    </View>
                  )}
                  {/* the tailor slip is not here: all slips are on their own page(s) at the end */}
                  {item.karigar && (
                    <View wrap={false}>
                      <Text style={s.cutLine}>Cut here - karigar paper</Text>
                      {/* the paper the master writes out by hand for the karigar */}
                      <Text style={s.karigarTitle}>{item.karigar.title}</Text>
                      <View style={s.slipGrid}>
                        {item.karigar.rows.map((row, r) => (
                          <View key={r} style={[s.slipRow, { marginBottom: 14 }]}>
                            {row.map((c, k) => (
                              <View key={`${c.label}-${k}`} style={[s.slipCell, { width: `${100 / item.karigar!.cols}%` }]}>
                                <Text style={[s.slipLabel, { fontSize: 11 }]}>{c.label}</Text>
                                <Text style={s.karigarValue}>{c.value}</Text>
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              ))}
              {notes}
            </Page>
          );
        });

  if (opts.only === "slips") {
    return renderToBuffer(<Document title={`Order ${data.orderNumber} tailor slips`}>{slipsPage}</Document>);
  }
  return renderToBuffer(
    <Document title={`Order ${data.orderNumber}`}>
      {pages}
      {slipsPage}
    </Document>,
  );
}

import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import { FIELD_PHOTO_MM, allPhotoIds, layoutDetails, photoHeightMm, type PrintData } from "./print";
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
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, borderTopWidth: 1, borderLeftWidth: 1, borderColor: "#000" },
  cell: { width: "33.33%", paddingVertical: 4, paddingHorizontal: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#000" },
  cellLabel: { fontSize: 8 },
  cellValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  photos: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  cutLine: { marginTop: 14, paddingTop: 2, borderTopWidth: 1.5, borderTopStyle: "dashed", borderTopColor: "#000", textAlign: "center", fontSize: 7, letterSpacing: 1.5, textTransform: "uppercase" },
  slip: { borderWidth: 1, borderColor: "#000", padding: 4 },
  slipTitle: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  slipGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 3, borderTopWidth: 1, borderLeftWidth: 1, borderColor: "#000" },
  slipCell: { width: "25%", paddingVertical: 2, paddingHorizontal: 4, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#000" },
  slipLabel: { fontSize: 7 },
  slipValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
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
export async function renderOrderPdf(data: PrintData): Promise<Buffer> {
  const images = new Map<number, Buffer>();
  for (const id of allPhotoIds(data)) {
    const b = await jpeg(id);
    if (b) images.set(id, b);
  }
  const pics = (ids: number[], mm: number) => (
    <View style={s.photos}>
      {ids.map((id) =>
        // eslint-disable-next-line jsx-a11y/alt-text
        images.has(id) ? <Image key={id} src={{ data: images.get(id)!, format: "jpg" }} style={{ height: mm * MM, marginRight: 6, marginBottom: 6 }} /> : null,
      )}
    </View>
  );

  const head = (title: string) => (
    <View style={s.head}>
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
              {sheet.items.map((item) => (
                <View key={item.label} style={s.item}>
                  {sheet.items.length > 1 || item.label !== sheet.title ? <Text style={s.itemLabel}>{item.label}</Text> : null}
                  {layoutDetails(item.details, item.measures).map((b, i) =>
                    b.type === "heading" ? (
                      <Text key={i} style={s.headingLine}>
                        {b.label}
                      </Text>
                    ) : b.type === "note" ? (
                      <Text key={i} style={s.note}>
                        {b.label}
                      </Text>
                    ) : b.type === "grid" ? (
                      <View key={i} style={s.grid}>
                        {b.cells.map((c) => (
                          <View key={c.label} style={s.cell}>
                            <Text style={s.cellLabel}>{c.label}</Text>
                            <Text style={s.cellValue}>{c.value}</Text>
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
                    <View wrap={false}>
                      <Text style={s.galleryHead}>Pictures</Text>
                      {pics(item.photoIds, h)}
                    </View>
                  )}
                  {item.slip && (
                    <View wrap={false}>
                      <Text style={s.cutLine}>Cut here - tailor slip</Text>
                      <View style={s.slip}>
                        <Text style={s.slipTitle}>
                          #{data.orderNumber} {data.customerName} - {item.label}
                        </Text>
                        <View style={s.slipGrid}>
                          {item.slip.cells.map((c, k) => (
                            <View key={`${c.label}-${k}`} style={s.slipCell}>
                              <Text style={s.slipLabel}>{c.label}</Text>
                              <Text style={s.slipValue}>{c.value}</Text>
                            </View>
                          ))}
                        </View>
                        {item.slip.notes.map((t, k) => (
                          <Text key={k} style={s.slipNote}>
                            {t}
                          </Text>
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

  return renderToBuffer(<Document title={`Order ${data.orderNumber}`}>{pages}</Document>);
}

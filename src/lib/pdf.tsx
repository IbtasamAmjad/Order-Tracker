import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import { photoHeightMm, type PrintData } from "./print";
import { getPhoto } from "./stages";
import { get } from "./storage";

const MM = 2.835; // points per millimetre
const s = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 11 },
  head: { borderBottomWidth: 2, borderBottomColor: "#000", paddingBottom: 6, marginBottom: 10 },
  headLine: { fontSize: 12 },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 2 },
  item: { marginBottom: 12 },
  itemLabel: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  detail: { marginBottom: 2 },
  headingLine: { fontFamily: "Helvetica-Bold", fontSize: 13, marginTop: 6, marginBottom: 3, borderBottomWidth: 1, borderBottomColor: "#000" },
  bold: { fontFamily: "Helvetica-Bold" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, borderWidth: 1, borderColor: "#000", padding: 4 },
  cell: { width: "33.33%", paddingVertical: 2, paddingRight: 6 },
  photos: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  notes: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#000" },
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
  for (const id of data.sheets.flatMap((sh) => sh.items.flatMap((i) => i.photoIds))) {
    const b = await jpeg(id);
    if (b) images.set(id, b);
  }

  const head = (title: string) => (
    <View style={s.head}>
      <Text style={s.headLine}>
        Order #{data.orderNumber} - {data.customerName}{data.designNumber ? ` - Design: ${data.designNumber}` : ""} - Due: {data.karigarDueDate}
      </Text>
      <Text style={s.title}>{title}</Text>
    </View>
  );
  const notes = data.notes ? (
    <View style={s.notes}>
      <Text style={s.bold}>Notes</Text>
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
          const h = photoHeightMm(sheet) * MM;
          return (
            <Page key={sheet.key} size="A4" style={s.page}>
              {head(sheet.title)}
              {sheet.items.map((item) => (
                <View key={item.label} style={s.item} wrap={false}>
                  <Text style={s.itemLabel}>{item.label}</Text>
                  {item.details.map((d) =>
                    d.kind === "heading" ? (
                      <Text key={d.label} style={s.headingLine}>
                        {d.label}
                      </Text>
                    ) : d.kind === "note" ? (
                      <Text key={d.label} style={s.detail}>
                        {d.label}
                      </Text>
                    ) : (
                      <Text key={d.label} style={s.detail}>
                        <Text style={s.bold}>{d.label}: </Text>
                        {d.value}
                      </Text>
                    ),
                  )}
                  {item.measures.length > 0 && (
                    <View style={s.grid}>
                      {item.measures.map((m) => (
                        <Text key={m.label} style={s.cell}>
                          {m.label}: <Text style={s.bold}>{m.value}</Text>
                        </Text>
                      ))}
                    </View>
                  )}
                  <View style={s.photos}>
                    {item.photoIds.map((id) =>
                      // eslint-disable-next-line jsx-a11y/alt-text
                      images.has(id) ? <Image key={id} src={{ data: images.get(id)!, format: "jpg" }} style={{ height: h, marginRight: 6, marginBottom: 6 }} /> : null,
                    )}
                  </View>
                </View>
              ))}
              {notes}
            </Page>
          );
        });

  return renderToBuffer(<Document title={`Order ${data.orderNumber}`}>{pages}</Document>);
}

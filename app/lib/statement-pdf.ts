import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { pdfSafeText } from "./signed-agreement-pdf";

const ink = rgb(0.078, 0.129, 0.239), muted = rgb(0.357, 0.4, 0.471), brand = rgb(0.086, 0.404, 0.659), line = rgb(0.875, 0.898, 0.925);
const A4: [number, number] = [595.28, 841.89];
const margin = 44;

export type PdfColumn = { label: string; width: number; align?: "left" | "right" };
export type PdfTable = { columns: PdfColumn[]; rows: string[][] };

function fit(text: string, font: PDFFont, size: number, width: number) {
  let value = pdfSafeText(text);
  if (font.widthOfTextAtSize(value, size) <= width) return value;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}…`, size) > width) value = value.slice(0, -1);
  return `${value}…`;
}

/** A branded A4 document: title block, label/value facts, then a paginated table. */
export async function buildTablePdf({ title, subtitle, facts, table, footer }: {
  title: string; subtitle: string; facts: [string, string][]; table?: PdfTable; footer: string;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(pdfSafeText(title));
  pdf.setProducer("Brickwise client portal");
  pdf.setCreator("Brickwise client portal");
  const pages: PDFPage[] = [];
  let page = pdf.addPage(A4); pages.push(page);
  let y = A4[1] - margin;

  page.drawText("BRICKWISE", { x: margin, y: y - 12, size: 15, font: bold, color: ink });
  page.drawText("FRACTIONAL REAL ESTATE", { x: margin, y: y - 23, size: 6, font: bold, color: brand });
  y -= 36;
  page.drawLine({ start: { x: margin, y }, end: { x: A4[0] - margin, y }, thickness: 1.4, color: brand });
  y -= 30;
  page.drawText(pdfSafeText(title), { x: margin, y, size: 17, font: bold, color: ink });
  y -= 15;
  page.drawText(pdfSafeText(subtitle), { x: margin, y, size: 9.5, font: regular, color: muted });
  y -= 22;
  for (const [label, value] of facts) {
    page.drawText(pdfSafeText(label), { x: margin, y, size: 8.6, font: bold, color: muted });
    page.drawText(fit(value, regular, 9.2, A4[0] - margin * 2 - 170), { x: margin + 170, y, size: 9.2, font: regular, color: ink });
    y -= 15;
  }

  if (table) {
    y -= 12;
    const totalWidth = A4[0] - margin * 2;
    const scale = totalWidth / table.columns.reduce((sum, column) => sum + column.width, 0);
    const widths = table.columns.map((column) => column.width * scale);
    const header = () => {
      page.drawRectangle({ x: margin, y: y - 6, width: totalWidth, height: 20, color: rgb(0.973, 0.98, 0.988) });
      let x = margin;
      table.columns.forEach((column, index) => {
        const text = fit(column.label.toUpperCase(), bold, 7, widths[index] - 10);
        const textX = column.align === "right" ? x + widths[index] - 6 - bold.widthOfTextAtSize(text, 7) : x + 6;
        page.drawText(text, { x: textX, y: y + 1, size: 7, font: bold, color: muted });
        x += widths[index];
      });
      y -= 22;
    };
    header();
    for (const row of table.rows) {
      if (y < margin + 40) {
        page = pdf.addPage(A4); pages.push(page);
        y = A4[1] - margin - 10;
        header();
      }
      let x = margin;
      row.forEach((cell, index) => {
        const text = fit(cell, regular, 8.4, widths[index] - 10);
        const textX = table.columns[index].align === "right" ? x + widths[index] - 6 - regular.widthOfTextAtSize(text, 8.4) : x + 6;
        page.drawText(text, { x: textX, y, size: 8.4, font: regular, color: ink });
        x += widths[index];
      });
      page.drawLine({ start: { x: margin, y: y - 6 }, end: { x: margin + totalWidth, y: y - 6 }, thickness: 0.5, color: line });
      y -= 18;
    }
  }

  pages.forEach((current, index) => {
    const label = pdfSafeText(`${footer} · ${index + 1}/${pages.length}`);
    current.drawText(label, { x: margin, y: 24, size: 7, font: regular, color: muted });
  });
  return pdf.save();
}

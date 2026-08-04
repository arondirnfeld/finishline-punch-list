import { jsPDF } from "jspdf";

type ReportItem = { id: number; room: string; title: string; status: string };
type ReportPhoto = { id: number; itemId: number; url: string };

export function buildPunchListPdf(address: string, items: ReportItem[], photos: ReportPhoto[], origin: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const bottom = 52;
  const green: [number, number, number] = [34, 112, 80];
  const ink: [number, number, number] = [38, 52, 46];
  const muted: [number, number, number] = [103, 116, 109];
  const rule: [number, number, number] = [205, 212, 208];
  const completed = items.filter((item) => item.status === "completed").length;
  let pageNumber = 1;
  let y = 0;

  function header() {
    doc.setTextColor(...green); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(address.toUpperCase(), margin, 46);
    doc.setTextColor(...ink); doc.setFont("times", "normal"); doc.setFontSize(30); doc.text("House punch list", margin, 78);
    doc.setTextColor(...muted); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`${items.length - completed} items remaining  |  ${completed} of ${items.length} complete`, margin, 98);
    doc.setDrawColor(...ink); doc.setLineWidth(1.5); doc.line(margin, 114, pageWidth - margin, 114);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...muted);
    doc.text("NO.", margin, 133); doc.text("ITEM", margin + 35, 133); doc.text("ROOM", 395, 133); doc.text("STATUS", 510, 133);
    doc.setDrawColor(...rule); doc.setLineWidth(.6); doc.line(margin, 141, pageWidth - margin, 141);
    y = 157;
  }

  function footer() {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...muted);
    doc.text("Punch House", margin, pageHeight - 25); doc.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - 25, { align: "right" });
  }

  header();
  items.forEach((item, index) => {
    const itemPhotos = photos.filter((photo) => photo.itemId === item.id);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const lines = doc.splitTextToSize(item.title, 295) as string[];
    const rowHeight = Math.max(38, lines.length * 13 + (itemPhotos.length ? 18 : 8));
    if (y + rowHeight > pageHeight - bottom) { footer(); doc.addPage(); pageNumber += 1; header(); }
    doc.setTextColor(...muted); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(String(index + 1).padStart(2, "0"), margin, y + 11);
    doc.setTextColor(...ink); doc.setFont("helvetica", item.status === "completed" ? "normal" : "normal"); doc.setFontSize(10); doc.text(lines, margin + 35, y + 11);
    if (item.status === "completed") { const width = Math.min(295, doc.getTextWidth(lines[0])); doc.setDrawColor(...muted); doc.line(margin + 35, y + 7, margin + 35 + width, y + 7); }
    doc.setTextColor(...green); doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.text(item.room.toUpperCase(), 395, y + 11, { maxWidth: 105 });
    doc.text(item.status === "completed" ? "DONE" : "OPEN", 510, y + 11);
    if (itemPhotos.length) {
      let linkX = margin + 35; const linkY = y + lines.length * 13 + 13;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      itemPhotos.forEach((photo, photoIndex) => {
        const label = `Photo ${photoIndex + 1}`;
        doc.setTextColor(16, 88, 166);
        doc.textWithLink(label, linkX, linkY, { url: new URL(photo.url, origin).href });
        doc.setDrawColor(16, 88, 166); doc.setLineWidth(.4); doc.line(linkX, linkY + 1, linkX + doc.getTextWidth(label), linkY + 1);
        linkX += doc.getTextWidth(label) + 13;
      });
    }
    doc.setDrawColor(...rule); doc.setLineWidth(.45); doc.line(margin, y + rowHeight - 5, pageWidth - margin, y + rowHeight - 5);
    y += rowHeight;
  });
  footer();
  return doc;
}

export function downloadPunchListPdf(address: string, items: ReportItem[], photos: ReportPhoto[]) {
  const doc = buildPunchListPdf(address, items, photos, window.location.origin);
  const safeName = address.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "house";
  doc.save(`${safeName}-punch-list.pdf`);
}

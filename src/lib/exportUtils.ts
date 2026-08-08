/**
 * Export utilities for CSV and PDF generation
 */

// CSV Export
export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(";"), // Use ; for Italian Excel compatibility
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        const str = val === null || val === undefined ? "" : String(val);
        // Escape quotes and wrap in quotes if contains separator or quotes
        if (str.includes(";") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(";")
    ),
  ];

  const csvContent = "\uFEFF" + csvRows.join("\n"); // BOM for Excel UTF-8
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

// Simple PDF Export (table format)
export function exportToPDF(data: Record<string, unknown>[], filename: string, title: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);

  // Build HTML for PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h1 { font-size: 18px; margin-bottom: 5px; }
        .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #f0f0f0; padding: 8px 6px; text-align: left; border: 1px solid #ddd; font-weight: 600; }
        td { padding: 6px; border: 1px solid #ddd; }
        tr:nth-child(even) { background: #fafafa; }
        .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="meta">Esportato il ${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} · ${data.length} record</div>
      <table>
        <thead>
          <tr>${headers.map((h) => `<th>${formatHeader(h)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${data.map((row) => `
            <tr>${headers.map((h) => `<td>${row[h] ?? ""}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
      <div class="footer">Generato da ClerkAI</div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

function formatHeader(key: string): string {
  const map: Record<string, string> = {
    name: "Nome",
    phone_e164: "Telefono",
    email: "Email",
    stage: "Fase",
    source: "Fonte",
    created_at: "Data Creazione",
    last_activity_at: "Ultima Attività",
    direction: "Direzione",
    duration: "Durata",
    outcome: "Esito",
    contact_name: "Contatto",
    status: "Stato",
    template: "Template",
    channel: "Canale",
    start_at: "Data Appuntamento",
    action: "Azione",
  };
  return map[key] || key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

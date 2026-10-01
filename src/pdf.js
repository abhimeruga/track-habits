// Offline PDF writer. Each page is drawn with the browser canvas so activity names
// retain their Unicode characters without fetching fonts or third-party libraries.
const PAGE_W = 816, PAGE_H = 1056;
const ink = '#202238', muted = '#626680', purple = '#6649a0', blue = '#315eae', line = '#dfe2ef';

function pdfFromJpegs(images) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let size = 0;
  const add = bytes => { chunks.push(bytes); size += bytes.length; };
  const word = value => add(encoder.encode(value));
  const object = (number, write) => { offsets[number] = size; word(`${number} 0 obj\n`); write(); word('\nendobj\n'); };
  word('%PDF-1.4\n%Daymark\n');
  object(1, () => word('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2, () => word(`<< /Type /Pages /Kids [${images.map((_, index) => `${3 + index * 3} 0 R`).join(' ')}] /Count ${images.length} >>`));
  images.forEach((bytes, index) => {
    const page = 3 + index * 3, content = page + 1, image = page + 2;
    object(page, () => word(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im ${image} 0 R >> >> /Contents ${content} 0 R >>`));
    const draw = encoder.encode('q\n612 0 0 792 0 0 cm\n/Im Do\nQ\n');
    object(content, () => { word(`<< /Length ${draw.length} >>\nstream\n`); add(draw); word('endstream'); });
    object(image, () => { word(`<< /Type /XObject /Subtype /Image /Width ${PAGE_W} /Height ${PAGE_H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`); add(bytes); word('\nendstream'); });
  });
  const xref = size;
  word(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < offsets.length; i++) word(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  word(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks, { type: 'application/pdf' });
}

export function buildMonthlyPdf(report) {
  const images = [];
  let canvas, ctx, y, pageNo = 0;
  function page() {
    if (canvas) {
      const raw = atob(canvas.toDataURL('image/jpeg', 0.88).split(',')[1]);
      images.push(Uint8Array.from(raw, char => char.charCodeAt(0)));
    }
    canvas = document.createElement('canvas'); canvas.width = PAGE_W; canvas.height = PAGE_H;
    ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('PDF canvas is unavailable in this browser.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.fillStyle = purple; ctx.fillRect(0, 0, PAGE_W, 12);
    ctx.font = '700 16px system-ui, sans-serif'; ctx.fillStyle = purple; ctx.fillText('DAYMARK  /  MONTHLY INSIGHTS', 48, 58);
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = muted; ctx.fillText(report.label, 48, 80);
    ctx.fillStyle = line; ctx.fillRect(48, 96, 720, 1);
    ctx.fillStyle = muted; ctx.font = '11px system-ui, sans-serif'; ctx.fillText(`Generated from this device's planner history  •  Page ${++pageNo}`, 48, 1024);
    y = 125;
  }
  function need(height) { if (y + height > 989) page(); }
  function title(value) { need(50); ctx.fillStyle = ink; ctx.font = '700 22px system-ui, sans-serif'; ctx.fillText(value, 48, y + 23); y += 47; }
  function text(value, x, maxWidth, font = '14px system-ui, sans-serif', color = ink) {
    ctx.font = font; ctx.fillStyle = color;
    let output = String(value ?? '');
    while (ctx.measureText(output).width > maxWidth && output.length > 1) output = `${output.slice(0, -2)}…`;
    ctx.fillText(output, x, y);
  }
  function row(left, right, accent = false) {
    need(27); text(left, 48, 540, accent ? '700 14px system-ui, sans-serif' : '14px system-ui, sans-serif');
    text(right, 625, 140, '700 14px system-ui, sans-serif', accent ? blue : muted);
    ctx.fillStyle = line; ctx.fillRect(48, y + 8, 720, 1); y += 28;
  }
  page();
  title(`${report.label} review`);
  ctx.fillStyle = '#f3f0fa'; ctx.fillRect(48, y, 720, 114);
  ctx.fillStyle = purple; ctx.font = '700 44px system-ui, sans-serif'; ctx.fillText(`${report.rate}%`, 68, y + 62);
  ctx.fillStyle = ink; ctx.font = '700 17px system-ui, sans-serif'; ctx.fillText(`${report.done} of ${report.total} planned items completed`, 222, y + 47);
  ctx.fillStyle = muted; ctx.font = '13px system-ui, sans-serif'; ctx.fillText(`Activities ${report.activityDone}/${report.activityTotal}   •   Todos ${report.todoDone}/${report.todoTotal}`, 222, y + 73);
  y += 145;
  title('Daily completion');
  for (const item of report.days) row(`${item.day}   Activities ${item.activityDone}/${item.activityTotal}   •   Todos ${item.todoDone}/${item.todoTotal}`, item.total ? `${item.rate}%` : 'No plan');
  title('Activity consistency');
  if (!report.habits.length) row('No scheduled activities this month', '');
  for (const item of report.habits) row(`${item.name}   •   ${item.completed}/${item.scheduled} days   •   ${item.missed} missed`, `${item.rate}%`);
  title('Todos due this month');
  if (!report.todos.length) row('No todos with a due date this month', '');
  for (const item of report.todos) row(`${item.dueDate}   ${item.title}`, item.completed ? 'On time' : item.completedOn ? 'Late' : 'Pending');
  page(); // flush the last drawn page
  // page() creates an empty next page after flushing; remove that unused canvas.
  return pdfFromJpegs(images);
}

export function downloadMonthlyPdf(report) {
  const blob = buildMonthlyPdf(report);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `daymark-insights-${report.month}.pdf`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

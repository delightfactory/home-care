// util: export selected data to Excel in browser with dynamic import
// يدعم اللغة العربية تلقائياً لأن XLSX يحفظ UTF-8 داخل ملف xlsx

export async function exportToExcel(data: any[], fileName: string = 'export.xlsx', sheetName = 'Sheet1') {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('لا توجد بيانات للتصدير');
  }

  // lazy-load the heavy xlsx library عند الطلب فقط
  // @ts-ignore – المكتبة لا تملك تعريفات Types كاملة
  const XLSX: any = await import(/* @vite-ignore */ 'xlsx');

  // تحويل البيانات إلى ورقة
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // إنشاء الملف وتنزيله
  XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', type: 'binary' });
}

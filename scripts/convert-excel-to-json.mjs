import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const input = process.argv[2] || path.join(root, 'Data5.xlsm');

const wb = XLSX.readFile(input, { cellDates: false });
const ws = wb.Sheets['Data'];

if (!ws) {
  throw new Error('Cannot find sheet named Data');
}

const rows = XLSX.utils.sheet_to_json(ws, {
  header: 1,
  defval: null,
});

const headers = rows[0] || [];

/**
 * Data sheet 前 7 列预计为：
 * A SAP Code
 * B Description
 * C Group
 * D Location
 * E Source
 * F Standard
 * G Time
 *
 * 从 H 列开始是车型。
 */
const modelHeaders = headers.slice(7).filter(Boolean).map(String);

function clean(v) {
  return typeof v === 'string' ? (v.trim() || null) : v;
}

function id(sap, rowNo) {
  return sap
    ? String(sap).replace(/[^A-Za-z0-9_-]+/g, '_')
    : `NO_SAP_ROW_${String(rowNo).padStart(4, '0')}`;
}

const parts = [];
const bomItems = [];

const models = modelHeaders.map(modelCode => ({
  id: modelCode.replace(/ /g, '_'),
  modelCode,
  family: (modelCode.match(/^[A-Za-z]+/) || [modelCode])[0],
  displayName: modelCode,
}));

rows.slice(1).forEach((raw, i) => {
  const rowNo = i + 2;
  const row = raw.map(clean);

  const [
    sapCode,
    description,
    _excelGroup,
    _excelLocation,
    source,
    _excelStandard,
    _excelTime,
  ] = row;

  const partId = id(sapCode, rowNo);

  /**
   * 注意：
   * 这里故意不输出 group/location/standard/time/finishDate/status/reason/hidden。
   *
   * 原因：
   * 这些字段以后由网站人工维护。
   * import-to-firestore.mjs 使用 { merge: true } 上传。
   * 如果这里继续输出 group/location/standard/time/finishDate/status/reason，
   * 下次 Excel 导入就会覆盖网站上手动修改过的值。
   */
  parts.push({
    id: partId,
    sapCode,
    description,
    source,
    originalRow: rowNo,
  });

  modelHeaders.forEach((model, idx) => {
    const qty = row[7 + idx];

    if (qty === null || qty === '' || Number(qty) === 0) {
      return;
    }

    /**
     * bomItems 也不要再保存 location/group/time/standard/finishDate/status/reason。
     * 页面显示时应该通过 partId 去 parts 里面拿最新人工维护字段。
     */
    bomItems.push({
      partId,
      sapCode,
      model,
      qty: Number(qty),
      source,
      description,
      originalRow: rowNo,
    });
  });
});

const importInfo = [
  {
    id: 'manual_import',
    fileName: path.basename(input),
    importedAt: new Date().toISOString(),
    sheetName: 'Data',
    rowCount: parts.length,
    modelCount: models.length,
    bomItemCount: bomItems.length,
  },
];

for (const [name, data] of Object.entries({
  parts,
  bomItems,
  models,
  imports: importInfo,
})) {
  fs.writeFileSync(
    path.join(root, 'src', 'data', `${name}.json`),
    JSON.stringify(data, null, 2)
  );

  fs.writeFileSync(
    path.join(root, 'firestore', `${name}.json`),
    JSON.stringify(data, null, 2)
  );
}

console.log(
  `Converted ${parts.length} parts, ${models.length} models, ${bomItems.length} bomItems.`
);
console.log(
  'Manual fields are protected: location/group/time/standard/finishDate/status/reason/hidden are not exported from Excel.'
);
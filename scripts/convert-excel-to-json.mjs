import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const input = process.argv[2] || path.join(root, 'Data5.xlsm');
const wb = XLSX.readFile(input, { cellDates: false });
const ws = wb.Sheets['Data'];
if (!ws) throw new Error('Cannot find sheet named Data');
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
const headers = rows[0];
const modelHeaders = headers.slice(7).filter(Boolean).map(String);
function clean(v){ return typeof v === 'string' ? (v.trim() || null) : v; }
function id(sap,rowNo){ return sap ? String(sap).replace(/[^A-Za-z0-9_-]+/g,'_') : `NO_SAP_ROW_${String(rowNo).padStart(4,'0')}`; }
const parts=[]; const bomItems=[]; const models=modelHeaders.map(m=>({id:m.replace(/ /g,'_'), modelCode:m, family:(m.match(/^[A-Za-z]+/)||[m])[0], displayName:m}));
rows.slice(1).forEach((raw, i)=>{
  const rowNo=i+2; const row=raw.map(clean);
  const [sapCode, description, group, location, source, standard, time] = row;
  const partId=id(sapCode,rowNo);
  parts.push({id:partId,sapCode,description,group,location,source,standard,time,originalRow:rowNo});
  modelHeaders.forEach((model, idx)=>{
    const qty=row[7+idx];
    if(qty === null || qty === '' || Number(qty) === 0) return;
    bomItems.push({partId,sapCode,model,qty:Number(qty),source,description,location,group,originalRow:rowNo});
  });
});
const importInfo=[{id:'manual_import',fileName:path.basename(input),importedAt:new Date().toISOString(),sheetName:'Data',rowCount:parts.length,modelCount:models.length,bomItemCount:bomItems.length}];
for (const [name,data] of Object.entries({parts,bomItems,models,imports:importInfo})) {
  fs.writeFileSync(path.join(root,'src','data',`${name}.json`), JSON.stringify(data,null,2));
  fs.writeFileSync(path.join(root,'firestore',`${name}.json`), JSON.stringify(data,null,2));
}
console.log(`Converted ${parts.length} parts, ${models.length} models, ${bomItems.length} bomItems.`);

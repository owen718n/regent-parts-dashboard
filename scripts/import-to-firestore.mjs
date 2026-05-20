import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();

async function importCollection(collectionName, fileName, idField = 'id') {
  const records = JSON.parse(fs.readFileSync(path.join(root, 'firestore', fileName), 'utf8'));
  let batch = db.batch();
  let count = 0;
  for (const record of records) {
    const id = String(record[idField] || db.collection(collectionName).doc().id);
    const ref = db.collection(collectionName).doc(id);
    batch.set(ref, { ...record, importedAtServer: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    count++;
    if (count % 450 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`Imported ${count} records into ${collectionName}`);
}

await importCollection('parts', 'parts.json');
await importCollection('models', 'models.json');
await importCollection('imports', 'imports.json');
// bomItems uses generated doc id because one part can appear in many models.
const bomRecords = JSON.parse(fs.readFileSync(path.join(root, 'firestore', 'bomItems.json'), 'utf8'));
let batch = db.batch();
let count = 0;
for (const record of bomRecords) {
  const safePart = String(record.partId).replace(/[^A-Za-z0-9_-]/g, '_');
  const safeModel = String(record.model).replace(/[^A-Za-z0-9_-]/g, '_');
  const ref = db.collection('bomItems').doc(`${safePart}_${safeModel}`);
  batch.set(ref, { ...record, importedAtServer: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  count++;
  if (count % 450 === 0) { await batch.commit(); batch = db.batch(); }
}
await batch.commit();
console.log(`Imported ${count} records into bomItems`);

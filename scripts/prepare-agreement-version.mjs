import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const version = 'cooperation-2026-10-02-v2';
const consent = {
  en: 'By clicking “Sign automatically”, I confirm that I have read and accept this draft document and sign with the first and last name shown in my profile.',
  de: 'Mit einem Klick auf „Automatisch unterschreiben“ bestätige ich, dass ich dieses Entwurfsdokument gelesen habe und akzeptiere, und unterschreibe mit dem Vor- und Nachnamen aus meinem Profil.',
  fr: 'En cliquant sur « Signer automatiquement », je confirme avoir lu et accepté ce document provisoire et je signe avec le prénom et le nom indiqués dans mon profil.',
  es: 'Al pulsar « Firmar automáticamente », confirmo que he leído y acepto este documento en borrador y firmo con el nombre y los apellidos de mi perfil.',
  it: 'Cliccando su « Firma automaticamente », confermo di aver letto e accettato questo documento in bozza e firmo con il nome e il cognome indicati nel mio profilo.',
};
const folder = `public/documents/agreements/${version}`;
mkdirSync(folder, { recursive: true });
const documents = Object.entries(consent).map(([locale, consentText]) => {
  const source = `public/documents/brickwise-cooperation-agreement-${locale}.pdf`;
  const path = `/documents/agreements/${version}/${locale}.pdf`;
  const bytes = readFileSync(source);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (existsSync(`public${path}`)) {
    if (createHash('sha256').update(readFileSync(`public${path}`)).digest('hex') !== sha256) throw Error('Archived document cannot be replaced. Create a new version.');
  } else copyFileSync(source, `public${path}`);
  return { locale, path, sha256, consentText, isDraft: true };
});
const manifest = JSON.stringify({ version, documents }, null, 2) + '\n';
const target = 'app/lib/agreement-manifest.json';
if (existsSync(target)) {
  const previous = readFileSync(target, 'utf8');
  if (JSON.parse(previous).version === version && previous !== manifest) throw Error('Manifest is immutable. Create a new version.');
}
writeFileSync(target, manifest);
console.log(`Prepared ${documents.length} versioned draft PDFs and their consent manifest.`);

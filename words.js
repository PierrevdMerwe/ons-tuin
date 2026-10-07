/*
 * Every word the garden says, in one place. Change anything here.
 * (The longer texts, like the "how it works" panel, are in index.html.)
 */

// Shown one after another when the password is wrong.
export const NOPE = [
  'hmm, nie heeltemal nie. probeer weer?',
  'die roos bly toe…',
  "amper (dalk). nog 'n keer?",
  'pookie… dis nie reg nie',
  'die doring sê nee, snokkel',
];

const MONTHS = ['Januarie', 'Februarie', 'Maart', 'April', 'Mei', 'Junie', 'Julie', 'Augustus', 'September', 'Oktober', 'November', 'Desember'];
const NUMBERS = ['nul', 'een', 'twee', 'drie', 'vier', 'vyf', 'ses', 'sewe', 'agt', 'nege', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vyftien', 'sestien', 'sewentien', 'agtien', 'negentien', 'twintig'];

export const number = (n) => NUMBERS[n] ?? String(n);
export const formatDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
export const shortDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;

export const days = (n) => (n === 1 ? '1 dag' : `${n} dae`);
export const roses = (n) => (n === 0 ? '1 roosknop' : n === 1 ? '1 roos' : `${n} rose`); // before the first bloom: one bud
export const memories = (n) => (n === 1 ? '1 herinnering' : `${n} herinneringe`);
export const inDays = (n) => (n <= 0 ? 'vandag' : n === 1 ? 'more' : `oor ${n} dae`);

export const together = (n) => `${days(n)} saam`;
export const year = (n) => `jaar ${number(n)}`;
export const begin = 'die begin';

export function nextBloom(firstEver, n) {
  if (n <= 0) return firstEver ? 'vandag blom ons eerste roos' : "vandag blom 'n nuwe roos";
  return firstEver ? `ons eerste roos blom ${inDays(n)}` : `die volgende roos blom ${inDays(n)}`;
}

export const anniversary = (n, name) => `gelukkige ${n === 1 ? 'eerste ' : ''}herdenking${name ? `, ${name}` : ''}`;

export const roseTip = (yearN, bloomed, inN) =>
  bloomed ? `${year(yearN)} se roos` : `${year(yearN)} se roos · blom ${inDays(inN)}`;

export const capsule = (opens) => `gaan oop op ${shortDate(opens)}`;
export const capsuleLabel = (opens) => `'n saadjie wat op ${formatDate(opens)} oopgaan`;
export const capsuleWait = (n) => `hierdie saadjie gaan ${inDays(n)} oop`;
export const fromCapsule = (planted) => `uit 'n saadjie wat op ${shortDate(planted)} geplant is`;
export const plantedBy = (name, d) => [name && `geplant deur ${name}`, d && shortDate(d)].filter(Boolean).join(' · ');

export const plantProgress = ({ step, done, total }) =>
  step === 'upload' && total > 1 ? `besig om te plant… (${done + 1} van ${total})` : 'besig om te plant…';
export const planted = (n) => (n === 1 ? 'geplant. dit groei nou vir altyd hier.' : `${n} dinge geplant. hulle groei nou vir altyd hier.`);
export const keyExpired = (gardener) => `Die tuin se sleutel het verval, so niks kan nou geplant word nie. ${gardener} moet dit hernu (node tuin.mjs setup).`;
export const keyExpiresSoon = (d, n) => `die tuin se sleutel verval op ${shortDate(d)} (${inDays(n)}): hernu dit met node tuin.mjs setup`;
export const keyUntil = (d) => `die tuin se sleutel hou tot ${shortDate(d)}`;
export const plantFailed = (msg) => `Kon nie plant nie: ${msg}`;
export const photoUnreadable = (name) => `Kan nie "${name}" oopmaak nie. Probeer dit as 'n JPG.`;
export const notSetUp = 'Die tuin is nog nie geplant nie. Hardloop eers: node tuin.mjs setup';
export const needsHttps = 'Dit werk net oor https of localhost.';
export const noDate = 'kies asseblief wanneer dit was';
export const tooEarly = 'dit kan nie in die toekoms wees nie';
export const emptyNote = 'skryf eers iets';
export const badSong = "plak 'n skakel na die liedjie (Spotify, YouTube of Apple Music)";

// The decorations you can switch on: [id, name, a few words]. The ids are drawn in garden.js.
export const DECOR = [
  ['fontein', "'n fontein", 'wat saggies borrel'],
  ['bankie', "'n bankie", 'om saam op te sit'],
  ['straatpaal', "'n straatpaal", 'wat na Holbaai wys'],
  ['heining', "'n wit heining", 'agter in die tuin'],
  ['liggies', 'liggies', 'wat saans gloei'],
  ['skoenlappers', 'skoenlappers', 'om die rose'],
  ['voels', 'voëltjies', 'wat soms verbyvlieg'],
  ['berg', 'Tafelberg', 'in die verte'],
];
export const decorSaved = 'gestoor. ons albei sien dit nou.';
export const saveFailed = (msg) => `Kon nie stoor nie: ${msg}`;
export const ideasIntro = (builder) => `Wat moet ons nog in die tuin hê? Skryf dit hier, dan bou ${builder} dit in.`;
export const noIdeas = 'nog geen idees nie. skryf die eerste een!';
export const ideaDone = 'gedoen';

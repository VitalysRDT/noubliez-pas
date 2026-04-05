/**
 * Filter the database to keep ONLY iconic French songs that everyone knows,
 * AND that have synced LRC timestamps. Deletes everything else.
 *
 * Usage: npx tsx scripts/filter-iconic.ts
 */

import path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql, isNull } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlClient, { schema });

// ══════════════════════════════════════════════════════════════════
//  WHITELIST — Chansons cultes que TOUT LE MONDE connaît
//  Critères : tubes incontournables, karaokés, soirées, émissions TV
//  Format : "titre|||artiste" en minuscules pour matching fuzzy
// ══════════════════════════════════════════════════════════════════

const ICONIC_SONGS: [string, string][] = [
  // ── Joe Dassin ──
  ["Les Champs-Élysées", "Joe Dassin"],
  ["Et si tu n'existais pas", "Joe Dassin"],
  ["L'été indien", "Joe Dassin"],
  ["Le petit pain au chocolat", "Joe Dassin"],
  ["Salut les amoureux", "Joe Dassin"],
  ["À toi", "Joe Dassin"],
  ["Siffler sur la colline", "Joe Dassin"],

  // ── Claude François ──
  ["Comme d'habitude", "Claude François"],
  ["Alexandrie Alexandra", "Claude François"],
  ["Le lundi au soleil", "Claude François"],
  ["Magnolias for Ever", "Claude François"],
  ["Cette année-là", "Claude François"],

  // ── Michel Sardou ──
  ["Les lacs du Connemara", "Michel Sardou"],
  ["La maladie d'amour", "Michel Sardou"],
  ["En chantant", "Michel Sardou"],
  ["Je vais t'aimer", "Michel Sardou"],
  ["La java de Broadway", "Michel Sardou"],

  // ── Jean-Jacques Goldman ──
  ["Je te donne", "Jean-Jacques Goldman"],
  ["Envole-moi", "Jean-Jacques Goldman"],
  ["Quand la musique est bonne", "Jean-Jacques Goldman"],
  ["Au bout de mes rêves", "Jean-Jacques Goldman"],
  ["Il suffira d'un signe", "Jean-Jacques Goldman"],
  ["Là-bas", "Jean-Jacques Goldman"],
  ["Je marche seul", "Jean-Jacques Goldman"],
  ["Encore un matin", "Jean-Jacques Goldman"],

  // ── Francis Cabrel ──
  ["Je l'aime à mourir", "Francis Cabrel"],
  ["La Corrida", "Francis Cabrel"],
  ["Petite Marie", "Francis Cabrel"],
  ["L'encre de tes yeux", "Francis Cabrel"],

  // ── Édith Piaf ──
  ["La vie en rose", "Edith Piaf"],
  ["Non, je ne regrette rien", "Edith Piaf"],
  ["L'Hymne à l'amour", "Edith Piaf"],
  ["Milord", "Edith Piaf"],
  ["Padam padam", "Edith Piaf"],

  // ── Jacques Brel ──
  ["Ne me quitte pas", "Jacques Brel"],
  ["Amsterdam", "Jacques Brel"],
  ["Quand on n'a que l'amour", "Jacques Brel"],
  ["La valse à mille temps", "Jacques Brel"],
  ["Les bonbons", "Jacques Brel"],

  // ── Charles Aznavour ──
  ["La Bohème", "Charles Aznavour"],
  ["Emmenez-moi", "Charles Aznavour"],
  ["For me formidable", "Charles Aznavour"],
  ["Hier encore", "Charles Aznavour"],
  ["She", "Charles Aznavour"],

  // ── Georges Brassens ──
  ["Les copains d'abord", "Georges Brassens"],
  ["Chanson pour l'Auvergnat", "Georges Brassens"],
  ["Les passantes", "Georges Brassens"],

  // ── Serge Gainsbourg ──
  ["La javanaise", "Serge Gainsbourg"],
  ["Je t'aime moi non plus", "Serge Gainsbourg"],
  ["Le poinçonneur des Lilas", "Serge Gainsbourg"],
  ["Bonnie and Clyde", "Serge Gainsbourg"],

  // ── Dalida ──
  ["Paroles paroles", "Dalida"],
  ["Il venait d'avoir 18 ans", "Dalida"],
  ["Mourir sur scène", "Dalida"],
  ["Laissez-moi danser", "Dalida"],
  ["Gigi l'amoroso", "Dalida"],

  // ── Johnny Hallyday ──
  ["Que je t'aime", "Johnny Hallyday"],
  ["Allumer le feu", "Johnny Hallyday"],
  ["L'envie", "Johnny Hallyday"],
  ["Je te promets", "Johnny Hallyday"],
  ["Retiens la nuit", "Johnny Hallyday"],
  ["Oh Marie", "Johnny Hallyday"],
  ["Vivre pour le meilleur", "Johnny Hallyday"],

  // ── France Gall ──
  ["Évidemment", "France Gall"],
  ["Ella, elle l'a", "France Gall"],
  ["Résiste", "France Gall"],
  ["Il jouait du piano debout", "France Gall"],
  ["Musique", "France Gall"],
  ["Débranche", "France Gall"],

  // ── Michel Berger ──
  ["Le paradis blanc", "Michel Berger"],
  ["La groupie du pianiste", "Michel Berger"],
  ["Quelques mots d'amour", "Michel Berger"],

  // ── Daniel Balavoine ──
  ["L'Aziza", "Daniel Balavoine"],
  ["Tous les cris les S.O.S.", "Daniel Balavoine"],
  ["Mon fils ma bataille", "Daniel Balavoine"],
  ["Sauver l'amour", "Daniel Balavoine"],

  // ── Téléphone ──
  ["Un autre monde", "Téléphone"],
  ["Ça c'est vraiment toi", "Téléphone"],
  ["New York avec toi", "Téléphone"],
  ["La bombe humaine", "Téléphone"],

  // ── Indochine ──
  ["L'aventurier", "Indochine"],
  ["J'ai demandé à la lune", "Indochine"],
  ["3ème sexe", "Indochine"],
  ["Trois nuits par semaine", "Indochine"],

  // ── Noir Désir ──
  ["Le vent nous portera", "Noir Désir"],
  ["Un jour en France", "Noir Désir"],
  ["Tostaky", "Noir Désir"],

  // ── Louise Attaque ──
  ["J't'emmène au vent", "Louise Attaque"],
  ["Léa", "Louise Attaque"],

  // ── Mylène Farmer ──
  ["Désenchantée", "Mylène Farmer"],
  ["Libertine", "Mylène Farmer"],
  ["Sans contrefaçon", "Mylène Farmer"],
  ["Pourvu qu'elles soient douces", "Mylène Farmer"],

  // ── Vanessa Paradis ──
  ["Joe le taxi", "Vanessa Paradis"],
  ["Be My Baby", "Vanessa Paradis"],

  // ── Renaud ──
  ["Mistral gagnant", "Renaud"],
  ["Morgane de toi", "Renaud"],
  ["Dès que le vent soufflera", "Renaud"],
  ["Laisse béton", "Renaud"],

  // ── Céline Dion ──
  ["Pour que tu m'aimes encore", "Céline Dion"],
  ["S'il suffisait d'aimer", "Céline Dion"],
  ["Destin", "Céline Dion"],

  // ── Années 80/90 pop ──
  ["Voyage voyage", "Desireless"],
  ["Les démons de minuit", "Images"],
  ["Marcia Baïla", "Les Rita Mitsouko"],
  ["Belle-Île-en-Mer", "Laurent Voulzy"],
  ["En rouge et noir", "Jeanne Mas"],
  ["Partenaire particulier", "Partenaire Particulier"],
  ["Le sud", "Nino Ferrer"],
  ["La montagne", "Jean Ferrat"],
  ["L'aigle noir", "Barbara"],
  ["Foule sentimentale", "Alain Souchon"],
  ["Le baiser", "Alain Souchon"],

  // ── Alain Bashung ──
  ["Ma petite entreprise", "Alain Bashung"],
  ["La nuit je mens", "Alain Bashung"],
  ["Osez Joséphine", "Alain Bashung"],

  // ── Laurent Voulzy ──
  ["Le pouvoir des fleurs", "Laurent Voulzy"],
  ["Rockcollection", "Laurent Voulzy"],

  // ── Patrick Bruel ──
  ["Casser la voix", "Patrick Bruel"],
  ["Place des grands hommes", "Patrick Bruel"],
  ["J'te l'dis quand même", "Patrick Bruel"],

  // ── Florent Pagny ──
  ["Savoir aimer", "Florent Pagny"],
  ["Ma liberté de penser", "Florent Pagny"],
  ["Si tu veux m'essayer", "Florent Pagny"],

  // ── Pascal Obispo ──
  ["Lucie", "Pascal Obispo"],
  ["Tombé pour elle", "Pascal Obispo"],

  // ── Calogero ──
  ["En apesanteur", "Calogero"],
  ["Face à la mer", "Calogero"],

  // ── Lara Fabian ──
  ["Je t'aime", "Lara Fabian"],
  ["Tout", "Lara Fabian"],

  // ── Zazie ──
  ["Je suis un homme", "Zazie"],
  ["Larsen", "Zazie"],

  // ── Marc Lavoine ──
  ["Les yeux revolver", "Marc Lavoine"],
  ["Elle a les yeux revolver", "Marc Lavoine"],
  ["Toi mon amour", "Marc Lavoine"],

  // ── Stromae ──
  ["Alors on danse", "Stromae"],
  ["Papaoutai", "Stromae"],
  ["Formidable", "Stromae"],
  ["Tous les mêmes", "Stromae"],
  ["L'enfer", "Stromae"],
  ["Santé", "Stromae"],

  // ── Angèle ──
  ["Tout oublier", "Angèle"],
  ["Balance ton quoi", "Angèle"],
  ["La Thune", "Angèle"],
  ["Démons", "Angèle"],

  // ── Zaz ──
  ["Je veux", "Zaz"],
  ["La pluie", "Zaz"],

  // ── Vianney ──
  ["Je m'en vais", "Vianney"],
  ["Pas là", "Vianney"],
  ["Beau-papa", "Vianney"],

  // ── Louane ──
  ["Avenir", "Louane"],
  ["On était beau", "Louane"],
  ["Si t'étais là", "Louane"],
  ["Jour 1", "Louane"],

  // ── Julien Doré ──
  ["Coco Câline", "Julien Doré"],
  ["Paris-Seychelles", "Julien Doré"],
  ["Le lac", "Julien Doré"],

  // ── Clara Luciani ──
  ["La grenade", "Clara Luciani"],
  ["Nue", "Clara Luciani"],
  ["Le reste", "Clara Luciani"],
  ["Respire encore", "Clara Luciani"],

  // ── Rap FR culte ──
  ["Je danse le Mia", "IAM"],
  ["Petit frère", "IAM"],
  ["Caroline", "MC Solaar"],
  ["Bouge de là", "MC Solaar"],
  ["Ma philosophie", "Amel Bent"],
  ["Dommage", "Bigflo & Oli"],
  ["La lettre", "Renan Luce"],

  // ── Orelsan ──
  ["Tout va bien", "Orelsan"],
  ["La pluie", "Orelsan"],
  ["Basique", "Orelsan"],

  // ── Soprano ──
  ["Mon Everest", "Soprano"],
  ["Cosmo", "Soprano"],
  ["Fresh Prince", "Soprano"],

  // ── Maître Gims ──
  ["Sapés comme jamais", "Maître Gims"],
  ["Est-ce que tu m'aimes", "Maître Gims"],
  ["Bella", "Maître Gims"],

  // ── Aya Nakamura ──
  ["Djadja", "Aya Nakamura"],
  ["Pookie", "Aya Nakamura"],

  // ── Christophe Maé ──
  ["On s'attache", "Christophe Maé"],
  ["Il est où le bonheur", "Christophe Maé"],
  ["Belle demoiselle", "Christophe Maé"],

  // ── Tubes universels / Disney FR ──
  ["On écrit sur les murs", "Kids United"],
  ["Libérée, délivrée", "Anaïs Delva"],
  ["Quelqu'un m'a dit", "Carla Bruni"],
  ["Dernière danse", "Indila"],
  ["La Marseillaise", "Hymne national"],

  // ── Françoise Hardy ──
  ["Tous les garçons et les filles", "Françoise Hardy"],
  ["Le temps de l'amour", "Françoise Hardy"],
  ["Comment te dire adieu", "Françoise Hardy"],

  // ── Christophe ──
  ["Aline", "Christophe"],
  ["Les mots bleus", "Christophe"],

  // ── Michel Delpech ──
  ["Pour un flirt", "Michel Delpech"],
  ["Quand j'étais chanteur", "Michel Delpech"],
  ["Wight Is Wight", "Michel Delpech"],

  // ── Michel Fugain ──
  ["La fête", "Michel Fugain"],
  ["Une belle histoire", "Michel Fugain"],

  // ── Maxime Le Forestier ──
  ["San Francisco", "Maxime Le Forestier"],
  ["Mon frère", "Maxime Le Forestier"],

  // ── Eddy Mitchell ──
  ["La dernière séance", "Eddy Mitchell"],
  ["Sur la route de Memphis", "Eddy Mitchell"],

  // ── Jacques Dutronc ──
  ["Il est cinq heures, Paris s'éveille", "Jacques Dutronc"],
  ["Les playboys", "Jacques Dutronc"],
  ["Et moi et moi et moi", "Jacques Dutronc"],

  // ── Sheila ──
  ["L'école est finie", "Sheila"],
  ["Les rois mages", "Sheila"],
  ["Spacer", "Sheila"],

  // ── Pomme ──
  ["Les oiseaux", "Pomme"],
  ["Ceux qui rêvent", "Pomme"],

  // ── Véronique Sanson ──
  ["Amoureuse", "Véronique Sanson"],

  // ── Patricia Kaas ──
  ["Mademoiselle chante le blues", "Patricia Kaas"],
  ["Mon mec à moi", "Patricia Kaas"],

  // ── Hélène Ségara ──
  ["Il y a trop de gens qui t'aiment", "Hélène Ségara"],

  // ── Grégoire ──
  ["Toi + Moi", "Grégoire"],

  // ── Therapie Taxi ──
  ["Hit Sale", "Therapie Taxi"],
  ["Carie", "Therapie Taxi"],

  // ── Kendji Girac ──
  ["Andalouse", "Kendji Girac"],
  ["Les yeux de la mama", "Kendji Girac"],
  ["Color Gitano", "Kendji Girac"],

  // ── Bénabar ──
  ["Le dîner", "Bénabar"],
  ["Dis-lui oui", "Bénabar"],

  // ── Garou ──
  ["Seul", "Garou"],
  ["Belle", "Garou"],

  // ── Christophe Willem ──
  ["Double je", "Christophe Willem"],

  // ── Shy'm ──
  ["Et alors", "Shy'm"],
  ["Je sais", "Shy'm"],

  // ── Tryo ──
  ["L'hymne de nos campagnes", "Tryo"],
  ["Serre-moi", "Tryo"],

  // ── Matmatah ──
  ["La ouache", "Matmatah"],
  ["Lambé an dro", "Matmatah"],

  // ── Nolwenn Leroy ──
  ["Cassé", "Nolwenn Leroy"],

  // ── Lorie ──
  ["Près de moi", "Lorie"],
  ["Sur un air latino", "Lorie"],

  // ── Amir ──
  ["J'ai cherché", "Amir"],
  ["On dirait", "Amir"],

  // ── Slimane ──
  ["Paname", "Slimane"],

  // ── Grand Corps Malade ──
  ["Saint-Denis", "Grand Corps Malade"],
  ["Midi 20", "Grand Corps Malade"],

  // ── Nekfeu ──
  ["On verra", "Nekfeu"],
  ["Risibles amours", "Nekfeu"],

  // ── PNL ──
  ["Au DD", "PNL"],
  ["Deux frères", "PNL"],

  // ── NTM ──
  ["Seine-Saint-Denis Style", "Suprême NTM"],

  // ── Dadju ──
  ["Reine", "Dadju"],
  ["Jaloux", "Dadju"],

  // ── SCH ──
  ["Autobahn", "SCH"],

  // ── Indila ──
  ["Tourner dans le vide", "Indila"],
  ["Love Story", "Indila"],
  ["S.O.S", "Indila"],

  // ── Jenifer ──
  ["Au soleil", "Jenifer"],
  ["J'attends l'amour", "Jenifer"],

  // ── Patrick Fiori ──
  ["Belle", "Patrick Fiori"],

  // ── Serge Lama ──
  ["Je suis malade", "Serge Lama"],
  ["D'aventures en aventures", "Serge Lama"],

  // ── Léo Ferré ──
  ["Avec le temps", "Léo Ferré"],
  ["C'est extra", "Léo Ferré"],

  // ── Claude Nougaro ──
  ["Toulouse", "Claude Nougaro"],
  ["Armstrong", "Claude Nougaro"],

  // ── Étienne Daho ──
  ["Week-end à Rome", "Etienne Daho"],
  ["Saudade", "Etienne Daho"],

  // ── Divers tubes ──
  ["Diego, libre dans sa tête", "Michel Berger"],
  ["Ma gueule", "Johnny Hallyday"],
  ["Nathalie", "Gilbert Bécaud"],
  ["Mon amant de Saint-Jean", "Lucienne Delyle"],
  ["Sympathique", "Pink Martini"],
  ["La Mer", "Charles Trenet"],
  ["Y'a d'la joie", "Charles Trenet"],
  ["Douce France", "Charles Trenet"],
  ["Que sera sera", "Dalida"],
  ["Les Cornichons", "Nino Ferrer"],
  ["T'en va pas", "Elsa"],
  ["Salade de fruits", "Bourvil"],
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Build a set for fast lookup
const iconicSet = new Set<string>();
for (const [title, artist] of ICONIC_SONGS) {
  iconicSet.add(`${normalize(title)}|||${normalize(artist)}`);
}

function isIconic(title: string, artist: string): boolean {
  const key = `${normalize(title)}|||${normalize(artist)}`;
  if (iconicSet.has(key)) return true;

  // Also try partial match: iconic title contained in DB title or vice versa
  const normTitle = normalize(title);
  const normArtist = normalize(artist);
  for (const [iTitle, iArtist] of ICONIC_SONGS) {
    const nt = normalize(iTitle);
    const na = normalize(iArtist);
    // Artist must match (fuzzy)
    if (!normArtist.includes(na) && !na.includes(normArtist)) continue;
    // Title: close enough
    if (normTitle.includes(nt) || nt.includes(normTitle)) return true;
    // Levenshtein-like: first 10 chars match
    if (normTitle.substring(0, 10) === nt.substring(0, 10) && normTitle.length > 5) return true;
  }
  return false;
}

async function main() {
  console.log("\n🎯 Filtrage — ne garder que les chansons cultes avec timestamps\n");
  console.log(`   Whitelist : ${ICONIC_SONGS.length} chansons cultes\n`);

  const allSongs = await db
    .select({
      id: schema.songs.id,
      title: schema.songs.title,
      artist: schema.songs.artist,
      lrcTimestamps: schema.songs.lrcTimestamps,
    })
    .from(schema.songs);

  console.log(`   En base : ${allSongs.length} chansons\n`);

  const toKeep: typeof allSongs = [];
  const toDelete: typeof allSongs = [];

  for (const song of allSongs) {
    const hasTimestamps =
      song.lrcTimestamps !== null &&
      Array.isArray(song.lrcTimestamps) &&
      (song.lrcTimestamps as unknown[]).length > 0;

    if (isIconic(song.title, song.artist) && hasTimestamps) {
      toKeep.push(song);
    } else {
      toDelete.push(song);
    }
  }

  console.log(`   ✅ À garder : ${toKeep.length} (cultes + timestamps)`);
  console.log(`   🗑  À supprimer : ${toDelete.length}`);
  console.log();

  // Show what we keep
  console.log("── Chansons gardées ──\n");
  for (const s of toKeep.sort((a, b) => a.artist.localeCompare(b.artist))) {
    console.log(`  ✅ ${s.artist} — ${s.title}`);
  }

  console.log(`\n── Suppression de ${toDelete.length} chansons... ──\n`);

  let deleted = 0;
  // Delete in batches of 50
  for (let i = 0; i < toDelete.length; i += 50) {
    const batch = toDelete.slice(i, i + 50);
    for (const s of batch) {
      await db.delete(schema.songs).where(eq(schema.songs.id, s.id));
      deleted++;
    }
    process.stdout.write(`  ${deleted}/${toDelete.length} supprimées\r`);
  }

  console.log(`\n\n📊 Résultat final :`);
  console.log(`   📦 ${toKeep.length} chansons cultes avec timestamps`);
  console.log(`   🗑  ${deleted} chansons supprimées`);
  console.log();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

import { parseLyrics } from "../lyrics-processor";

/**
 * Test songs with original fictional lyrics (no copyright).
 * Real songs should be imported via the /admin interface.
 */
export const testSongs = [
  {
    title: "Chanson de Test 1",
    artist: "Artiste Fictif",
    year: 2024,
    genre: "test",
    difficulty: 1,
    lines: [
      "Le soleil brille sur la colline verte",
      "Les oiseaux chantent dans le matin clair",
      "Je marche doucement vers la rivière",
      "Les fleurs parfument le sentier doré",
      "Le vent murmure entre les grands arbres",
      "Les nuages dansent dans le ciel bleu",
      "Je rêve encore de jours meilleurs",
      "La nuit tombera sur notre village",
    ],
  },
  {
    title: "Chanson de Test 2",
    artist: "Groupe Imaginaire",
    year: 2023,
    genre: "test",
    difficulty: 2,
    lines: [
      "Quand la musique résonne dans la ville",
      "Les lumières scintillent sur les toits",
      "On danse ensemble sans regarder le temps",
      "Les étoiles illuminent notre chemin",
      "Chaque instant devient un souvenir",
      "Les rires éclatent comme des feux",
      "On partage cette nuit magique",
      "Le bonheur flotte dans notre chanson",
      "Demain viendra avec ses promesses",
      "Mais ce soir appartient aux rêveurs",
    ],
  },
  {
    title: "Chanson de Test 3",
    artist: "Chanteuse Inventée",
    year: 2022,
    genre: "test",
    difficulty: 3,
    lines: [
      "Les souvenirs voyagent comme des papillons",
      "Traversant les frontières du temps perdu",
      "Je cherche encore ta voix dans le silence",
      "Les photographies jaunissent doucement",
      "Chaque mot prononcé reste gravé",
      "Dans la mémoire fragile des saisons",
      "Le printemps reviendra colorer les jardins",
      "Les promesses oubliées refleurissent",
      "On retrouve toujours le chemin",
      "Quand le cœur se souvient de chanter",
    ],
  },
];

export function getSeedSongs() {
  return testSongs.map((song) => ({
    title: song.title,
    artist: song.artist,
    year: song.year,
    genre: song.genre,
    difficulty: song.difficulty,
    lyrics: parseLyrics(song.lines),
  }));
}

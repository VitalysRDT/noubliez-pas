export type CatalogEntry = {
  title: string;
  artist: string;
  genre: string;
  year: number;
};

export const FRENCH_SONG_CATALOG: CatalogEntry[] = [
  // === Variété française classique ===
  { title: "Les Champs-Elysées", artist: "Joe Dassin", genre: "variété", year: 1969 },
  { title: "Et si tu n'existais pas", artist: "Joe Dassin", genre: "variété", year: 1975 },
  { title: "L'été indien", artist: "Joe Dassin", genre: "variété", year: 1975 },
  { title: "Comme d'habitude", artist: "Claude François", genre: "variété", year: 1967 },
  { title: "Alexandrie Alexandra", artist: "Claude François", genre: "variété", year: 1978 },
  { title: "Les lacs du Connemara", artist: "Michel Sardou", genre: "variété", year: 1981 },
  { title: "La maladie d'amour", artist: "Michel Sardou", genre: "variété", year: 1973 },
  { title: "Je te donne", artist: "Jean-Jacques Goldman", genre: "variété", year: 1985 },
  { title: "Envole-moi", artist: "Jean-Jacques Goldman", genre: "variété", year: 1984 },
  { title: "Quand la musique est bonne", artist: "Jean-Jacques Goldman", genre: "variété", year: 1982 },
  { title: "Je l'aime à mourir", artist: "Francis Cabrel", genre: "variété", year: 1979 },
  { title: "La Corrida", artist: "Francis Cabrel", genre: "variété", year: 1994 },
  { title: "Pour que tu m'aimes encore", artist: "Céline Dion", genre: "variété", year: 1995 },

  // === Chanson française (patrimoine) ===
  { title: "La vie en rose", artist: "Edith Piaf", genre: "chanson", year: 1947 },
  { title: "Non, je ne regrette rien", artist: "Edith Piaf", genre: "chanson", year: 1960 },
  { title: "Ne me quitte pas", artist: "Jacques Brel", genre: "chanson", year: 1959 },
  { title: "Amsterdam", artist: "Jacques Brel", genre: "chanson", year: 1964 },
  { title: "La Bohème", artist: "Charles Aznavour", genre: "chanson", year: 1965 },
  { title: "Emmenez-moi", artist: "Charles Aznavour", genre: "chanson", year: 1967 },
  { title: "Les copains d'abord", artist: "Georges Brassens", genre: "chanson", year: 1964 },
  { title: "Le Gorille", artist: "Georges Brassens", genre: "chanson", year: 1952 },
  { title: "La montagne", artist: "Jean Ferrat", genre: "chanson", year: 1964 },
  { title: "Le sud", artist: "Nino Ferrer", genre: "chanson", year: 1975 },

  // === Pop/rock français ===
  { title: "Un autre monde", artist: "Téléphone", genre: "rock", year: 1984 },
  { title: "Ça c'est vraiment toi", artist: "Téléphone", genre: "rock", year: 1982 },
  { title: "L'aventurier", artist: "Indochine", genre: "rock", year: 1982 },
  { title: "J'ai demandé à la lune", artist: "Indochine", genre: "rock", year: 2002 },
  { title: "Le vent nous portera", artist: "Noir Désir", genre: "rock", year: 2001 },
  { title: "J't'emmène au vent", artist: "Louise Attaque", genre: "rock", year: 1997 },
  { title: "Quelqu'un m'a dit", artist: "Carla Bruni", genre: "pop", year: 2002 },
  { title: "Joe le taxi", artist: "Vanessa Paradis", genre: "pop", year: 1987 },

  // === Années 80/90 ===
  { title: "Voyage voyage", artist: "Desireless", genre: "pop", year: 1986 },
  { title: "Les démons de minuit", artist: "Images", genre: "pop", year: 1986 },
  { title: "Désenchantée", artist: "Mylène Farmer", genre: "pop", year: 1991 },
  { title: "Libertine", artist: "Mylène Farmer", genre: "pop", year: 1986 },
  { title: "Marcia Baila", artist: "Les Rita Mitsouko", genre: "pop", year: 1984 },
  { title: "Belle-Île-en-Mer", artist: "Laurent Voulzy", genre: "variété", year: 1985 },
  { title: "En rouge et noir", artist: "Jeanne Mas", genre: "pop", year: 1985 },
  { title: "Partenaire particulier", artist: "Partenaire Particulier", genre: "pop", year: 1984 },
  { title: "L'Aziza", artist: "Daniel Balavoine", genre: "variété", year: 1985 },
  { title: "Tous les cris les S.O.S.", artist: "Daniel Balavoine", genre: "variété", year: 1985 },

  // === Chanson française moderne ===
  { title: "Alors on danse", artist: "Stromae", genre: "pop", year: 2009 },
  { title: "Papaoutai", artist: "Stromae", genre: "pop", year: 2013 },
  { title: "Formidable", artist: "Stromae", genre: "pop", year: 2013 },
  { title: "Tout oublier", artist: "Angèle", genre: "pop", year: 2018 },
  { title: "Balance ton quoi", artist: "Angèle", genre: "pop", year: 2019 },
  { title: "Je veux", artist: "Zaz", genre: "chanson", year: 2010 },
  { title: "Je m'en vais", artist: "Vianney", genre: "pop", year: 2016 },
  { title: "Pas là", artist: "Vianney", genre: "pop", year: 2016 },
  { title: "On écrit sur les murs", artist: "Kids United", genre: "variété", year: 2015 },

  // === Rap français ===
  { title: "Je danse le Mia", artist: "IAM", genre: "rap", year: 1993 },
  { title: "Petit frère", artist: "IAM", genre: "rap", year: 1997 },
  { title: "Caroline", artist: "MC Solaar", genre: "rap", year: 1991 },
  { title: "Bouge de là", artist: "MC Solaar", genre: "rap", year: 1991 },
  { title: "Ma philosophie", artist: "Amel Bent", genre: "pop", year: 2004 },
  { title: "Dommage", artist: "Bigflo et Oli", genre: "rap", year: 2018 },

  // === Tubes universels / Disney FR ===
  { title: "Libérée délivrée", artist: "Anaïs Delva", genre: "disney", year: 2013 },
  { title: "Ce rêve bleu", artist: "Daniel Lévi", genre: "disney", year: 1992 },
  { title: "Évidemment", artist: "France Gall", genre: "variété", year: 1987 },
  { title: "Ella, elle l'a", artist: "France Gall", genre: "variété", year: 1987 },
  { title: "La Marseillaise", artist: "Hymne national", genre: "classique", year: 1792 },
];

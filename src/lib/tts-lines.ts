export const PRESENTER_LINES = {
  welcome: [
    "Bienvenue dans N'oubliez pas les paroles ! {player1} contre {player2}, que le duel commence !",
    "Bonsoir à tous ! Ce soir, {player1} affronte {player2}. Prêts à chanter ?",
  ],
  roundStart: [
    "Manche {round} sur {total}. Attention, c'est parti !",
    "On passe à la manche numéro {round}. Ouvrez bien les yeux !",
  ],
  roundEnd: [
    "{winner} remporte cette manche avec {score} mots trouvés ! La chanson était {title} de {artist}.",
    "Bravo {winner} ! {score} bonnes réponses sur cette manche. C'était {title}, {artist}.",
  ],
  tie: [
    "Égalité sur cette manche ! Vous êtes aussi forts l'un que l'autre !",
  ],
  gameEnd: [
    "Et le grand gagnant est... {winner} avec {score} points ! Félicitations !",
    "{winner} l'emporte {score1} à {score2} ! Quelle partie !",
  ],
  perfectRound: [
    "Incroyable ! {player} a trouvé TOUS les mots ! Standing ovation !",
  ],
} as const;

export type PresenterLineType = keyof typeof PRESENTER_LINES;

export function getPresenterLine(
  type: PresenterLineType,
  params: Record<string, string | number>
): string {
  const lines = PRESENTER_LINES[type];
  const template = lines[Math.floor(Math.random() * lines.length)];
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(params[key] ?? key)
  );
}

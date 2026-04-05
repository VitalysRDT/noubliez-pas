import { Redis } from "@upstash/redis";
import type { GameState } from "./types";

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = Redis.fromEnv();
  }
  return _redis;
}

const STATE_TTL = 3600; // 1 hour

export async function getGameState(
  roomCode: string
): Promise<GameState | null> {
  return getRedis().get<GameState>(`room:${roomCode}:state`);
}

export async function setGameState(
  roomCode: string,
  state: GameState
): Promise<void> {
  await getRedis().set(`room:${roomCode}:state`, state, { ex: STATE_TTL });
}

export async function getPlayerAnswers(
  roomCode: string,
  playerId: 1 | 2
): Promise<Record<number, string>> {
  return (
    (await getRedis().get<Record<number, string>>(
      `room:${roomCode}:answers:${playerId}`
    )) ?? {}
  );
}

export async function setPlayerAnswers(
  roomCode: string,
  playerId: 1 | 2,
  answers: Record<number, string>
): Promise<void> {
  await getRedis().set(`room:${roomCode}:answers:${playerId}`, answers, {
    ex: STATE_TTL,
  });
}

export async function clearRoundAnswers(roomCode: string): Promise<void> {
  const r = getRedis();
  await Promise.all([
    r.del(`room:${roomCode}:answers:1`),
    r.del(`room:${roomCode}:answers:2`),
  ]);
}

export async function deleteRoom(roomCode: string): Promise<void> {
  const r = getRedis();
  await Promise.all([
    r.del(`room:${roomCode}:state`),
    r.del(`room:${roomCode}:answers:1`),
    r.del(`room:${roomCode}:answers:2`),
  ]);
}

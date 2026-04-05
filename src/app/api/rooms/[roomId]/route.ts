import { NextResponse } from "next/server";
import { getGameState } from "@/lib/redis";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const state = await getGameState(roomId);
    if (!state) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(state);
  } catch (err) {
    console.error("GET /api/rooms/[roomId] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

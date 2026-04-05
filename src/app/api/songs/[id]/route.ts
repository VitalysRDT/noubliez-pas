import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { songs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminKey = request.headers.get("x-admin-key");
    if (adminKey !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as {
      youtubeId?: string | null;
      timingOffsetMs?: number;
    };

    await db
      .update(songs)
      .set({
        youtubeId: body.youtubeId ?? null,
        timingOffsetMs: body.timingOffsetMs ?? 0,
      })
      .where(eq(songs.id, id));

    return NextResponse.json({ updated: true });
  } catch (err) {
    console.error("PATCH /api/songs/[id] error:", err);
    return NextResponse.json(
      { error: "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    if (key !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await db.delete(songs).where(eq(songs.id, id));
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /api/songs/[id] error:", err);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }
}

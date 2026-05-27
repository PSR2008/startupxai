import { NextRequest, NextResponse } from "next/server";
import { getPaymentsByUser } from "@/lib/supabase";
import { getUserIdFromRequest } from "@/lib/usage-limit";

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const payments = await getPaymentsByUser(userId, 6);
  return NextResponse.json({ success: true, payments });
}

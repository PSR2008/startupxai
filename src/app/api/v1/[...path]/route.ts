import { handleLaunchGateRequest } from "@/server/launchgate/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleLaunchGateRequest;
export const POST = handleLaunchGateRequest;
export const PATCH = handleLaunchGateRequest;
export const DELETE = handleLaunchGateRequest;
export const PUT = handleLaunchGateRequest;

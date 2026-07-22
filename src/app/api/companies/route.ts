import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Company, { normalizeCompanyName } from "@/models/Company";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const companies = await Company.find({ agentId: session.user.id })
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ companies });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = String(body?.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  await connectDB();
  try {
    const company = await Company.create({
      agentId: session.user.id,
      name,
      normalizedName: normalizeCompanyName(name),
    });
    return NextResponse.json(company, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: `Company "${name}" already exists.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
  }
}

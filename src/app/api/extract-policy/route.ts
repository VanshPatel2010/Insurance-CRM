import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { extractPolicyData } from '@/lib/aiExtraction';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 });
    }

    // Convert to Buffer — stays in memory, never persisted to disk
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Run multi-provider extraction with automatic fallback
    const result = await extractPolicyData(pdfBuffer);

    // All providers failed → tell the client to switch to manual entry
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          fallbackToManual: true,
          message: result.message,
        },
        { status: 503 }
      );
    }

    // Rate-limit signal (Gemini 429 is now handled inside aiExtraction.ts,
    // but keeping a 429 path here for any future direct rate-limit surfacing)
    return NextResponse.json({
      success: true,
      data: result.data,
      provider: result.provider,
      fileName: file.name,
    });
  } catch (error) {
    console.error('PDF extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract data from PDF' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  'gemini-2.5-flash-lite:generateContent';

const EXTRACTION_PROMPT = `
You are an expert insurance policy data extractor for Indian insurance policies.

Extract all details from this insurance policy PDF and return ONLY a valid
JSON object. No explanation, no markdown code blocks, no extra text.
Return raw JSON only.

First identify the policy type:
- motor    → vehicle/car/bike/two-wheeler/auto insurance
- medical  → health/mediclaim/family floater insurance
- fire     → property/fire/building/shop insurance
- life     → life/term/endowment/ULIP/money back insurance

Return this exact JSON structure (use null for fields not found):
{
  "type": "motor",
  "confidence": 95,
  "customerName": "",
  "phone": "",
  "email": "",
  "address": "",
  "policyNumber": "",
  "premium": null,
  "sumInsured": null,
  "startDate": null,
  "endDate": null,
  "insurerName": "",
  "details": {
    "vehicleReg": "",
    "make": "",
    "model": "",
    "year": null,
    "fuelType": "",
    "engineCC": null,
    "idvValue": null,
    "ncb": null,
    "addOns": [],
    "dateOfBirth": null,
    "age": null,
    "gender": "",
    "bloodGroup": "",
    "preExistingConditions": "",
    "smoker": null,
    "membersCount": null,
    "memberNames": [],
    "cashlessNetwork": "",
    "propertyType": "",
    "propertyAddress": "",
    "builtUpArea": null,
    "constructionType": "",
    "propertyValue": null,
    "stockValue": null,
    "riskLocation": "",
    "occupation": "",
    "annualIncome": null,
    "nomineeName": "",
    "nomineeRelation": "",
    "policyType": "",
    "premiumFrequency": "",
    "policyTerm": null,
    "maturityDate": null
  }
}

Rules:
- Return numbers only for monetary values (no rupee symbol or commas)
- All dates in YYYY-MM-DD format
- confidence: 90-100 if policy type is clearly stated, 60-89 if reasonably identified, below 60 if uncertain
- Return null for any field not found — never guess or fabricate
- For Indian policies: amounts are in INR, interpret accordingly
- Include ONLY the fields relevant to the identified policy type in details, set others to null
`;

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

    // Convert PDF to base64 (only in memory, never persisted)
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Call Gemini 2.0 Flash API
    const geminiResponse = await fetch(
      `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: 'application/pdf',
                    data: base64,
                  },
                },
                {
                  text: EXTRACTION_PROMPT,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const error = await geminiResponse.json().catch(() => ({}));
      console.error('Gemini API error:', error);

      if (geminiResponse.status === 429) {
        return NextResponse.json(
          { error: 'RATE_LIMIT', message: 'Rate limit reached. Queue will retry.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to process PDF with AI' },
        { status: 500 }
      );
    }

    const geminiData = await geminiResponse.json();

    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawText) {
      return NextResponse.json(
        { error: 'No response from AI — PDF may be scanned or unreadable' },
        { status: 422 }
      );
    }

    // Parse JSON — with markdown code-block stripping fallback
    let extractedData: unknown;
    try {
      extractedData = JSON.parse(rawText);
    } catch {
      const cleaned = rawText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      try {
        extractedData = JSON.parse(cleaned);
      } catch {
        console.error('Could not parse Gemini response:', rawText.slice(0, 200));
        return NextResponse.json(
          { error: 'Could not parse extracted data — please enter manually' },
          { status: 422 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: extractedData,
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

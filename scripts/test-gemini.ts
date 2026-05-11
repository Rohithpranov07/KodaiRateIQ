// ============================================================
// KodaiRateIQ — Gemini API Test Script
// Run: npx tsx scripts/test-gemini.ts
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY || '';

async function testGemini() {
  console.log('\n🧪 KodaiRateIQ — Gemini API Test');
  console.log('═'.repeat(50));

  // 1. Check API key
  if (!API_KEY) {
    console.error('❌ GEMINI_API_KEY is empty in .env');
    process.exit(1);
  }
  console.log(`✅ API Key loaded: ${API_KEY.substring(0, 10)}...${API_KEY.slice(-4)}`);

  // 2. Initialize client
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  });
  console.log('✅ Gemini 2.0 Flash model initialized');

  // 3. Test basic generation
  console.log('\n📡 Sending test pricing prompt...');
  const startTime = Date.now();

  try {
    const result = await model.generateContent(`You are a hotel pricing analyst. Given these Kodaikanal hotel rates:
- The Carlton (5-star): ₹17,600 MAP
- The Tamara Kodai (5-star): ₹22,800 MAP
- Sterling Kodai Lake (4-star): ₹9,200 MAP
- Le Poshe by Sparsa (3-star): ₹8,800 MAP

Recommend a competitive MAP rate for Hotel Kodai International (3-star).
Date: May 11, 2026. Season: Shoulder. Day: Sunday (Weekend).

Respond in JSON:
{
  "recommended_map_rate": <number>,
  "confidence_score": <0-1>,
  "reasoning": "<string>",
  "pricing_strategy": "<aggressive|balanced|conservative|premium>",
  "demand_level": "<high|medium|low>",
  "min_rate": <number>,
  "max_rate": <number>
}`);

    const elapsed = Date.now() - startTime;
    const text = result.response.text();
    const parsed = JSON.parse(text);

    console.log(`✅ Response received in ${elapsed}ms\n`);
    console.log('═'.repeat(50));
    console.log('📊 AI PRICING RECOMMENDATION');
    console.log('═'.repeat(50));
    console.log(`\n💰 Recommended MAP Rate: ₹${parsed.recommended_map_rate?.toLocaleString('en-IN')}`);
    console.log(`📈 Confidence Score:     ${Math.round((parsed.confidence_score || 0) * 100)}%`);
    console.log(`🎯 Strategy:             ${parsed.pricing_strategy}`);
    console.log(`📊 Demand Level:         ${parsed.demand_level}`);
    console.log(`📉 Rate Range:           ₹${parsed.min_rate?.toLocaleString('en-IN')} – ₹${parsed.max_rate?.toLocaleString('en-IN')}`);
    console.log(`\n💬 Reasoning:\n   ${parsed.reasoning}\n`);
    console.log('═'.repeat(50));
    console.log('✅ Gemini API is FULLY OPERATIONAL');
    console.log('═'.repeat(50));

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`\n❌ Gemini API FAILED after ${elapsed}ms`);
    console.error(`   Error: ${error.message}`);
    
    if (error.message?.includes('API_KEY_INVALID')) {
      console.error('   → The API key is invalid. Get a new one at https://aistudio.google.com/apikey');
    } else if (error.message?.includes('QUOTA')) {
      console.error('   → API quota exceeded. Wait or upgrade your plan.');
    } else if (error.message?.includes('model')) {
      console.error('   → Model not available. Try "gemini-1.5-flash" instead.');
    }
    
    process.exit(1);
  }
}

testGemini();

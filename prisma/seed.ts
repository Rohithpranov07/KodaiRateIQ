// ============================================================
// KodaiRateIQ — Database Seed Script
// Seeds initial hotel data and sample rates for development
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HOTELS = [
  {
    name: 'The Carlton',
    slug: 'the-carlton',
    category: 'premium',
    starRating: 5,
    role: 'premium-anchor',
    website: 'https://www.thecarlton.in',
    isTarget: false,
    description: '5-star luxury heritage hotel with panoramic views of Kodai Lake and valley.',
    address: 'Lake Road, Kodaikanal 624101',
    facilities: [
      { name: 'lake-view', category: 'view', quality: 5 },
      { name: 'spa', category: 'recreation', quality: 5 },
      { name: 'pool', category: 'recreation', quality: 4 },
      { name: 'bar', category: 'dining', quality: 5 },
      { name: 'restaurant', category: 'dining', quality: 5 },
      { name: 'wifi', category: 'amenity', quality: 4 },
      { name: 'parking', category: 'amenity', quality: 4 },
      { name: 'gym', category: 'recreation', quality: 4 },
      { name: 'room-service', category: 'service', quality: 5 },
      { name: 'concierge', category: 'service', quality: 5 },
    ],
    rooms: [
      { name: 'Superior Room', type: 'standard', maxOccupancy: 2, hasLakeView: false },
      { name: 'Deluxe Room', type: 'deluxe', maxOccupancy: 2, hasLakeView: true },
      { name: 'Premier Suite', type: 'suite', maxOccupancy: 3, hasLakeView: true },
      { name: 'Carlton Suite', type: 'suite', maxOccupancy: 4, hasLakeView: true },
    ],
  },
  {
    name: 'The Tamara Kodai',
    slug: 'the-tamara-kodai',
    category: 'ultra-premium',
    starRating: 5,
    role: 'ultra-premium-anchor',
    website: 'https://www.thetamara.com/kodaikanal',
    isTarget: false,
    description: 'Ultra-luxury boutique resort set in 7 acres of pristine wilderness.',
    address: 'La Providence, Coakers Walk, Kodaikanal 624101',
    facilities: [
      { name: 'lake-view', category: 'view', quality: 5 },
      { name: 'spa', category: 'recreation', quality: 5 },
      { name: 'pool', category: 'recreation', quality: 5 },
      { name: 'bar', category: 'dining', quality: 5 },
      { name: 'restaurant', category: 'dining', quality: 5 },
      { name: 'wifi', category: 'amenity', quality: 5 },
      { name: 'parking', category: 'amenity', quality: 5 },
      { name: 'gym', category: 'recreation', quality: 5 },
      { name: 'room-service', category: 'service', quality: 5 },
      { name: 'concierge', category: 'service', quality: 5 },
      { name: 'butler', category: 'service', quality: 5 },
    ],
    rooms: [
      { name: 'Cottage Room', type: 'cottage', maxOccupancy: 2, hasLakeView: false },
      { name: 'Valley View Cottage', type: 'cottage', maxOccupancy: 2, hasLakeView: true },
      { name: 'Heritage Suite', type: 'suite', maxOccupancy: 3, hasLakeView: true },
    ],
  },
  {
    name: 'Hotel Kodai International',
    slug: 'hotel-kodai-international',
    category: 'standard',
    starRating: 3,
    role: 'target',
    website: 'https://www.hotelkodaiinternational.com',
    isTarget: true,
    description: 'Well-established 3-star hotel in the heart of Kodaikanal town.',
    address: 'Anna Salai, Kodaikanal 624101',
    facilities: [
      { name: 'restaurant', category: 'dining', quality: 4 },
      { name: 'wifi', category: 'amenity', quality: 3 },
      { name: 'parking', category: 'amenity', quality: 3 },
      { name: 'room-service', category: 'service', quality: 3 },
      { name: 'travel-desk', category: 'service', quality: 3 },
    ],
    rooms: [
      { name: 'Standard Room', type: 'standard', maxOccupancy: 2, hasLakeView: false },
      { name: 'Deluxe Room', type: 'deluxe', maxOccupancy: 2, hasLakeView: false },
      { name: 'Family Suite', type: 'suite', maxOccupancy: 4, hasLakeView: false },
    ],
  },
  {
    name: 'Sterling Kodai Lake',
    slug: 'sterling-kodai-lake',
    category: 'mid-premium',
    starRating: 4,
    role: 'direct-competitor',
    website: 'https://www.sterlingholidays.com/kodaikanal',
    isTarget: false,
    description: '4-star resort with modern amenities near Kodai Lake.',
    address: '44, Gym Khana Road, Kodaikanal 624101',
    facilities: [
      { name: 'lake-view', category: 'view', quality: 4 },
      { name: 'spa', category: 'recreation', quality: 3 },
      { name: 'pool', category: 'recreation', quality: 3 },
      { name: 'restaurant', category: 'dining', quality: 4 },
      { name: 'wifi', category: 'amenity', quality: 3 },
      { name: 'parking', category: 'amenity', quality: 4 },
      { name: 'gym', category: 'recreation', quality: 3 },
      { name: 'room-service', category: 'service', quality: 3 },
      { name: 'kids-play', category: 'recreation', quality: 4 },
    ],
    rooms: [
      { name: 'Classic Room', type: 'standard', maxOccupancy: 2, hasLakeView: false },
      { name: 'Premium Room', type: 'premium', maxOccupancy: 2, hasLakeView: true },
      { name: 'Suite', type: 'suite', maxOccupancy: 3, hasLakeView: true },
    ],
  },
  {
    name: 'Le Poshe by Sparsa',
    slug: 'le-poshe-by-sparsa',
    category: 'standard',
    starRating: 3,
    role: 'direct-competitor',
    website: 'https://www.sparsahotels.com/le-poshe',
    isTarget: false,
    description: 'Contemporary 3-star boutique hotel with modern design sensibility.',
    address: 'PT Road, Kodaikanal 624101',
    facilities: [
      { name: 'restaurant', category: 'dining', quality: 4 },
      { name: 'wifi', category: 'amenity', quality: 4 },
      { name: 'parking', category: 'amenity', quality: 3 },
      { name: 'room-service', category: 'service', quality: 4 },
      { name: 'travel-desk', category: 'service', quality: 3 },
      { name: 'conference', category: 'amenity', quality: 3 },
    ],
    rooms: [
      { name: 'Standard Room', type: 'standard', maxOccupancy: 2, hasLakeView: false },
      { name: 'Deluxe Room', type: 'deluxe', maxOccupancy: 2, hasLakeView: false },
      { name: 'Premium Room', type: 'premium', maxOccupancy: 3, hasLakeView: false },
    ],
  },
];

// Sample rate data for past 30 days
function generateSampleRates() {
  const rates: Array<{
    hotelSlug: string;
    baseMapRate: number;
    baseCpRate: number;
    baseEpRate: number;
    source: string;
  }> = [
    { hotelSlug: 'the-carlton', baseMapRate: 18000, baseCpRate: 15000, baseEpRate: 12000, source: 'booking.com' },
    { hotelSlug: 'the-tamara-kodai', baseMapRate: 22000, baseCpRate: 18000, baseEpRate: 15000, source: 'booking.com' },
    { hotelSlug: 'hotel-kodai-international', baseMapRate: 8500, baseCpRate: 7000, baseEpRate: 5500, source: 'goibibo' },
    { hotelSlug: 'sterling-kodai-lake', baseMapRate: 9000, baseCpRate: 7500, baseEpRate: 6000, source: 'makemytrip' },
    { hotelSlug: 'le-poshe-by-sparsa', baseMapRate: 8500, baseCpRate: 7000, baseEpRate: 5500, source: 'booking.com' },
  ];

  const days = 30;
  const result: Array<{
    hotelSlug: string;
    date: Date;
    mapRate: number;
    cpRate: number;
    epRate: number;
    source: string;
  }> = [];

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    for (const rate of rates) {
      // Add some realistic variance (±5%)
      const variance = 1 + (Math.random() * 0.10 - 0.05);
      // Weekend premium
      const isWeekend = date.getDay() === 0 || date.getDay() === 5 || date.getDay() === 6;
      const weekendMult = isWeekend ? 1.12 : 1.0;

      result.push({
        hotelSlug: rate.hotelSlug,
        date,
        mapRate: Math.round(rate.baseMapRate * variance * weekendMult / 100) * 100,
        cpRate: Math.round(rate.baseCpRate * variance * weekendMult / 100) * 100,
        epRate: Math.round(rate.baseEpRate * variance * weekendMult / 100) * 100,
        source: rate.source,
      });
    }
  }

  return result;
}

async function main() {
  console.log('🏨 Seeding KodaiRateIQ database...\n');

  // Clear existing data
  await prisma.aiInsight.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.rateHistory.deleteMany();
  await prisma.competitorSnapshot.deleteMany();
  await prisma.dailyRate.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.room.deleteMany();
  await prisma.scrapeLog.deleteMany();
  await prisma.hotel.deleteMany();

  console.log('✅ Cleared existing data\n');

  // Create hotels with facilities and rooms
  for (const hotelData of HOTELS) {
    const hotel = await prisma.hotel.create({
      data: {
        name: hotelData.name,
        slug: hotelData.slug,
        category: hotelData.category,
        starRating: hotelData.starRating,
        role: hotelData.role,
        website: hotelData.website,
        isTarget: hotelData.isTarget,
        description: hotelData.description,
        address: hotelData.address,
        city: 'Kodaikanal',
      },
    });

    // Create facilities
    for (const fac of hotelData.facilities) {
      await prisma.facility.create({
        data: {
          hotelId: hotel.id,
          name: fac.name,
          category: fac.category,
          quality: fac.quality,
          available: true,
        },
      });
    }

    // Create rooms
    for (const room of hotelData.rooms) {
      await prisma.room.create({
        data: {
          hotelId: hotel.id,
          name: room.name,
          type: room.type,
          maxOccupancy: room.maxOccupancy,
          hasLakeView: room.hasLakeView,
        },
      });
    }

    console.log(`✅ Created: ${hotel.name} (${hotelData.facilities.length} facilities, ${hotelData.rooms.length} rooms)`);
  }

  // Generate and store sample rates
  const sampleRates = generateSampleRates();
  console.log(`\n📊 Generating ${sampleRates.length} sample rate entries...\n`);

  for (const rate of sampleRates) {
    const hotel = await prisma.hotel.findUnique({ where: { slug: rate.hotelSlug } });
    if (!hotel) continue;

    // Daily rate
    await prisma.dailyRate.create({
      data: {
        hotelId: hotel.id,
        date: rate.date,
        mapRate: rate.mapRate,
        cpRate: rate.cpRate,
        epRate: rate.epRate,
        taxPercent: rate.mapRate > 7500 ? 18 : 12,
        taxInclusive: false,
        totalWithTax: Math.round(rate.mapRate * (rate.mapRate > 7500 ? 1.18 : 1.12)),
        source: rate.source,
        isAvailable: true,
        breakfastIncluded: true,
        dinnerIncluded: true,
        confidence: 0.9,
      },
    });

    // Competitor snapshot
    await prisma.competitorSnapshot.upsert({
      where: { hotelId_date: { hotelId: hotel.id, date: rate.date } },
      update: {
        bestMapRate: rate.mapRate,
        bestCpRate: rate.cpRate,
        bestEpRate: rate.epRate,
        bestSource: rate.source,
        avgMapRate: rate.mapRate,
      },
      create: {
        hotelId: hotel.id,
        date: rate.date,
        bestMapRate: rate.mapRate,
        bestCpRate: rate.cpRate,
        bestEpRate: rate.epRate,
        bestSource: rate.source,
        avgMapRate: rate.mapRate,
      },
    });

    // Rate history
    await prisma.rateHistory.upsert({
      where: {
        hotelId_date_source: {
          hotelId: hotel.id,
          date: rate.date,
          source: rate.source,
        },
      },
      update: { mapRate: rate.mapRate, cpRate: rate.cpRate, epRate: rate.epRate },
      create: {
        hotelId: hotel.id,
        date: rate.date,
        mapRate: rate.mapRate,
        cpRate: rate.cpRate,
        epRate: rate.epRate,
        source: rate.source,
      },
    });
  }

  // Create sample recommendation
  const targetHotel = await prisma.hotel.findFirst({ where: { isTarget: true } });
  if (targetHotel) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.recommendation.create({
      data: {
        hotelId: targetHotel.id,
        date: today,
        recommendedMapRate: 8400,
        recommendedCpRate: 6900,
        recommendedEpRate: 5500,
        minRate: 7800,
        maxRate: 9200,
        optimalRate: 8400,
        strategy: 'balanced',
        confidenceScore: 0.85,
        reasoning: 'Based on current competitor rates: The Carlton at ₹18,000, The Tamara at ₹22,000, Sterling at ₹9,000, and Le Poshe at ₹8,500. The recommended rate of ₹8,400 positions Hotel Kodai International competitively with direct competitors while maintaining significant value gap from premium anchors. Current shoulder season suggests moderate demand.',
        avgCompetitorRate: 8750,
        marketPosition: 'at-market',
        seasonType: 'shoulder',
        demandLevel: 'medium',
        weekendPremium: 12,
      },
    });

    console.log('✅ Created sample recommendation');
  }

  // Create sample insights
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.aiInsight.createMany({
    data: [
      {
        date: today,
        type: 'pricing-pressure',
        title: 'Sterling Kodai Lake Rate Drop',
        summary: 'Sterling Kodai Lake has reduced MAP rates by 8% this week, creating downward pricing pressure. Consider maintaining current rates to preserve margin.',
        severity: 'warning',
        actionable: true,
        confidence: 0.82,
      },
      {
        date: today,
        type: 'premium-opportunity',
        title: 'Weekend Premium Window',
        summary: 'Upcoming long weekend shows high search volume. Recommend 15% weekend premium positioning.',
        severity: 'opportunity',
        actionable: true,
        confidence: 0.78,
      },
      {
        date: today,
        type: 'demand-surge',
        title: 'Summer Season Approaching',
        summary: 'April-June peak season is approaching. Historical data suggests 20-30% rate increases are sustainable.',
        severity: 'opportunity',
        actionable: true,
        confidence: 0.88,
      },
      {
        date: today,
        type: 'competitor-undercut',
        title: 'Le Poshe Flash Sale Detected',
        summary: 'Le Poshe is running a limited-time 20% discount on OTAs. This is likely a short-term promotion — avoid reactive price cuts.',
        severity: 'info',
        actionable: false,
        confidence: 0.75,
      },
    ],
  });

  console.log('✅ Created sample insights\n');
  console.log('🎉 Database seeded successfully!\n');
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

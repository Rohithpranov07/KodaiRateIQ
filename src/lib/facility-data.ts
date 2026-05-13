// ============================================================
// KodaiRateIQ — Verified Facility Intelligence Layer
// SOURCE OF TRUTH: OTA/Official listing cross-verification
// DO NOT modify without re-verification against source data.
// ============================================================

export type FacilityLevel = 'None' | 'Basic' | 'Standard' | 'Premium' | 'Luxury';

export interface FacilityDefinition {
  displayName: string;
  category: string;
  icon: string;
}

export interface HotelFacilityEntry {
  normalizedKey: string;
  level: FacilityLevel;
  quality: number;       // 1–5
  luxuryScore: number;   // 0–10
}

export interface HotelFacilityProfile {
  slug: string;
  luxuryTier: string;
  facilityScore: string;
  overallLuxuryScore: number;
  verificationSource: string;
  confidence: number;
  lastVerified: string;
  facilities: HotelFacilityEntry[];
}

// ============================================================
// CANONICAL FACILITY REGISTRY
// normalizedKey → display metadata
// ============================================================
export const FACILITY_REGISTRY: Record<string, FacilityDefinition> = {
  // Basic Facilities
  wifi:                  { displayName: 'Wi-Fi',                       category: 'Basic Facilities',         icon: 'wifi' },
  housekeeping:          { displayName: 'Housekeeping',                 category: 'Basic Facilities',         icon: 'cleaning_services' },
  room_service:          { displayName: 'Room Service',                 category: 'Basic Facilities',         icon: 'room_service' },
  parking:               { displayName: 'Parking',                      category: 'Basic Facilities',         icon: 'local_parking' },
  power_backup:          { displayName: 'Power Backup',                 category: 'Basic Facilities',         icon: 'bolt' },
  laundry_service:       { displayName: 'Laundry Service',              category: 'Basic Facilities',         icon: 'local_laundry_service' },
  smoke_detector:        { displayName: 'Smoke Detector',               category: 'Basic Facilities',         icon: 'detector_smoke' },
  elevator:              { displayName: 'Elevator/Lift',                category: 'Basic Facilities',         icon: 'elevator' },
  air_conditioning:      { displayName: 'Air Conditioning',             category: 'Basic Facilities',         icon: 'ac_unit' },
  central_heating:       { displayName: 'Central Heating',              category: 'Basic Facilities',         icon: 'thermostat' },
  lan:                   { displayName: 'LAN',                          category: 'Basic Facilities',         icon: 'cable' },
  express_checkin:       { displayName: 'Express Check-in/out',         category: 'Basic Facilities',         icon: 'how_to_reg' },
  smoking_rooms:         { displayName: 'Smoking Rooms',                category: 'Basic Facilities',         icon: 'smoking_rooms' },
  umbrellas:             { displayName: 'Umbrellas',                    category: 'Basic Facilities',         icon: 'beach_access' },
  refrigerator:          { displayName: 'Refrigerator',                 category: 'Basic Facilities',         icon: 'kitchen' },
  ironing_service:       { displayName: 'Ironing Service',              category: 'Basic Facilities',         icon: 'iron' },
  newspaper:             { displayName: 'Newspaper',                    category: 'Basic Facilities',         icon: 'newspaper' },
  laundromat:            { displayName: 'Laundromat',                   category: 'Basic Facilities',         icon: 'local_laundry_service' },
  washing_machine:       { displayName: 'Washing Machine',              category: 'Basic Facilities',         icon: 'local_laundry_service' },
  swimming_pool:         { displayName: 'Swimming Pool',                category: 'Basic Facilities',         icon: 'pool' },
  activity_centre:       { displayName: 'Activity Centre',              category: 'Basic Facilities',         icon: 'sports_handball' },

  // General Services
  concierge:             { displayName: 'Concierge',                    category: 'General Services',         icon: 'support_agent' },
  multilingual_staff:    { displayName: 'Multilingual Staff',           category: 'General Services',         icon: 'translate' },
  luggage_assistance:    { displayName: 'Luggage Assistance',           category: 'General Services',         icon: 'luggage' },
  doctor_on_call:        { displayName: 'Doctor on Call',               category: 'General Services',         icon: 'local_hospital' },
  wheelchair:            { displayName: 'Wheelchair',                   category: 'General Services',         icon: 'accessible' },
  wheelchair_accessible: { displayName: 'Wheelchair Accessible',        category: 'General Services',         icon: 'accessible_forward' },
  ticket_assistance:     { displayName: 'Ticket/Tour Assistance',       category: 'General Services',         icon: 'travel_explore' },
  disabilities_facilities:{ displayName: 'Disability-Friendly Facilities',category: 'General Services',      icon: 'accessible' },
  caretaker:             { displayName: 'Caretaker',                    category: 'General Services',         icon: 'person_pin' },
  butler_services:       { displayName: 'Butler Services',              category: 'General Services',         icon: 'manage_accounts' },
  pool_beach_towels:     { displayName: 'Pool/Beach Towels',            category: 'General Services',         icon: 'dry_cleaning' },
  currency_exchange:     { displayName: 'Currency Exchange',            category: 'General Services',         icon: 'currency_exchange' },

  // Health & Wellness
  gym:                   { displayName: 'Gym / Fitness Centre',         category: 'Health & Wellness',        icon: 'fitness_center' },
  yoga:                  { displayName: 'Yoga',                         category: 'Health & Wellness',        icon: 'self_improvement' },
  first_aid:             { displayName: 'First-aid Services',           category: 'Health & Wellness',        icon: 'medical_services' },
  meditation_room:       { displayName: 'Meditation Room',              category: 'Health & Wellness',        icon: 'spa' },

  // Transfers
  shuttle_service:       { displayName: 'Shuttle Service',              category: 'Transfers',                icon: 'directions_bus' },
  airport_transfers:     { displayName: 'Airport Transfers',            category: 'Transfers',                icon: 'flight_land' },
  railway_transfers:     { displayName: 'Railway Transfers',            category: 'Transfers',                icon: 'train' },
  bus_station_transfers: { displayName: 'Bus Station Transfers',        category: 'Transfers',                icon: 'directions_bus' },
  pickup_drop:           { displayName: 'Pickup/Drop',                  category: 'Transfers',                icon: 'local_taxi' },

  // Room Amenities
  toiletries:            { displayName: 'Toiletries',                   category: 'Room Amenities',           icon: 'soap' },
  mineral_water:         { displayName: 'Mineral Water',                category: 'Room Amenities',           icon: 'water_drop' },
  heater:                { displayName: 'Heater',                       category: 'Room Amenities',           icon: 'thermostat' },
  water_heater:          { displayName: 'Geyser/Water Heater',          category: 'Room Amenities',           icon: 'water_heater' },
  hairdryer:             { displayName: 'Hairdryer',                    category: 'Room Amenities',           icon: 'dry' },
  iron_board:            { displayName: 'Iron/Ironing Board',           category: 'Room Amenities',           icon: 'iron' },
  work_desk:             { displayName: 'Work Desk',                    category: 'Room Amenities',           icon: 'desk' },
  sofa:                  { displayName: 'Sofa',                         category: 'Room Amenities',           icon: 'chair' },
  dental_kit:            { displayName: 'Dental Kit',                   category: 'Room Amenities',           icon: 'medication' },
  minibar:               { displayName: 'Minibar',                      category: 'Room Amenities',           icon: 'liquor' },
  mini_fridge:           { displayName: 'Mini Fridge',                  category: 'Room Amenities',           icon: 'kitchen' },
  bathtub:               { displayName: 'Bathtub',                      category: 'Room Amenities',           icon: 'bathtub' },
  room_jacuzzi:          { displayName: 'In-Room Jacuzzi',              category: 'Room Amenities',           icon: 'hot_tub' },
  coffee_machine:        { displayName: 'Coffee Machine',               category: 'Room Amenities',           icon: 'coffee_maker' },
  living_area:           { displayName: 'Living Area',                  category: 'Room Amenities',           icon: 'weekend' },
  dining_area:           { displayName: 'Dining Area',                  category: 'Room Amenities',           icon: 'dining' },
  room_balcony:          { displayName: 'Balcony',                      category: 'Room Amenities',           icon: 'balcony' },
  interconnected_room:   { displayName: 'Interconnected Rooms',         category: 'Room Amenities',           icon: 'meeting_room' },
  bubble_bath:           { displayName: 'Bubble Bath',                  category: 'Room Amenities',           icon: 'bathtub' },

  // Food & Drinks
  restaurant:            { displayName: 'Restaurant',                   category: 'Food & Drinks',            icon: 'restaurant' },
  bar:                   { displayName: 'Bar',                          category: 'Food & Drinks',            icon: 'local_bar' },
  coffee_shop:           { displayName: 'Coffee Shop',                  category: 'Food & Drinks',            icon: 'local_cafe' },
  kids_meals:            { displayName: "Kids' Meals",                  category: 'Food & Drinks',            icon: 'child_care' },
  breakfast:             { displayName: 'Breakfast Included',           category: 'Food & Drinks',            icon: 'free_breakfast' },
  veg_food:              { displayName: 'Veg Food Available',           category: 'Food & Drinks',            icon: 'eco' },
  barbeque:              { displayName: 'Barbeque',                     category: 'Food & Drinks',            icon: 'outdoor_grill' },
  cooking_class:         { displayName: 'Cooking Class',                category: 'Food & Drinks',            icon: 'menu_book' },

  // Safety & Security
  fire_extinguishers:    { displayName: 'Fire Extinguishers',           category: 'Safety & Security',        icon: 'fire_extinguisher' },
  security_alarms:       { displayName: 'Security Alarms',              category: 'Safety & Security',        icon: 'notification_important' },
  security_guard:        { displayName: 'Security Guard',               category: 'Safety & Security',        icon: 'security' },
  in_room_safe:          { displayName: 'In-Room Safe',                 category: 'Safety & Security',        icon: 'lock' },
  electronic_keycard:    { displayName: 'Electronic Keycard',           category: 'Safety & Security',        icon: 'key' },
  cctv:                  { displayName: 'CCTV Surveillance',            category: 'Safety & Security',        icon: 'videocam' },
  carbon_monoxide_det:   { displayName: 'CO Detector',                  category: 'Safety & Security',        icon: 'detector_smoke' },

  // Entertainment & Media
  entertainment:         { displayName: 'Entertainment',                category: 'Entertainment & Media',    icon: 'theater_comedy' },
  music_system:          { displayName: 'Music System',                 category: 'Entertainment & Media',    icon: 'music_note' },
  karaoke:               { displayName: 'Karaoke',                      category: 'Entertainment & Media',    icon: 'mic' },
  professional_photo:    { displayName: 'Professional Photography',     category: 'Entertainment & Media',    icon: 'camera_alt' },
  tv:                    { displayName: 'TV',                           category: 'Entertainment & Media',    icon: 'tv' },
  computer_station:      { displayName: 'Computer Station',             category: 'Entertainment & Media',    icon: 'computer' },
  electrical_adapters:   { displayName: 'Electrical Adapters',          category: 'Entertainment & Media',    icon: 'electrical_services' },

  // Beauty & Spa
  spa:                   { displayName: 'Spa',                          category: 'Beauty & Spa',             icon: 'spa' },
  massage:               { displayName: 'Massage',                      category: 'Beauty & Spa',             icon: 'self_improvement' },
  steam_sauna:           { displayName: 'Steam & Sauna',                category: 'Beauty & Spa',             icon: 'hot_tub' },
  salon:                 { displayName: 'Salon',                        category: 'Beauty & Spa',             icon: 'content_cut' },
  facial_treatments:     { displayName: 'Facial Treatments',            category: 'Beauty & Spa',             icon: 'face' },
  manicure_pedicure:     { displayName: 'Manicure/Pedicure',            category: 'Beauty & Spa',             icon: 'back_hand' },

  // Outdoor Activities
  bonfire:               { displayName: 'Bonfire',                      category: 'Outdoor Activities',       icon: 'local_fire_department' },
  cycling:               { displayName: 'Cycling',                      category: 'Outdoor Activities',       icon: 'pedal_bike' },
  golf:                  { displayName: 'Golf Course / Mini Golf',       category: 'Outdoor Activities',       icon: 'golf_course' },
  jungle_safari:         { displayName: 'Jungle Safari',                category: 'Outdoor Activities',       icon: 'forest' },
  snorkelling:           { displayName: 'Snorkelling',                  category: 'Outdoor Activities',       icon: 'scuba_diving' },
  vehicle_rentals:       { displayName: 'Vehicle Rentals',              category: 'Outdoor Activities',       icon: 'directions_car' },
  outdoor_sports:        { displayName: 'Outdoor Sports',               category: 'Outdoor Activities',       icon: 'sports' },

  // Indoor Activities
  indoor_games:          { displayName: 'Indoor Games',                 category: 'Indoor Activities',        icon: 'sports_esports' },
  indoor_games_room:     { displayName: 'Indoor Games Room',            category: 'Indoor Activities',        icon: 'gamepad' },
  kids_play_area:        { displayName: "Kids' Play Area",              category: 'Indoor Activities',        icon: 'child_care' },
  table_tennis:          { displayName: 'Table Tennis',                 category: 'Indoor Activities',        icon: 'sports_tennis' },

  // Common Areas
  garden:                { displayName: 'Garden',                       category: 'Common Areas',             icon: 'park' },
  lounge:                { displayName: 'Lounge',                       category: 'Common Areas',             icon: 'weekend' },
  reception:             { displayName: 'Reception',                    category: 'Common Areas',             icon: 'front_desk_bell' },
  balcony_terrace:       { displayName: 'Balcony/Terrace',              category: 'Common Areas',             icon: 'balcony' },
  library:               { displayName: 'Library',                      category: 'Common Areas',             icon: 'local_library' },
  common_jacuzzi:        { displayName: 'Jacuzzi (Common Area)',        category: 'Common Areas',             icon: 'hot_tub' },
  fireplace:             { displayName: 'Fireplace',                    category: 'Common Areas',             icon: 'fireplace' },
  outdoor_furniture:     { displayName: 'Outdoor Furniture',            category: 'Common Areas',             icon: 'chair' },
  living_room:           { displayName: 'Living Room',                  category: 'Common Areas',             icon: 'living' },

  // Family & Kids
  childcare:             { displayName: 'Childcare Services',           category: 'Family & Kids',            icon: 'child_care' },
  baby_safety_gates:     { displayName: 'Baby Safety Gates',            category: 'Family & Kids',            icon: 'baby_changing_station' },
  playground:            { displayName: 'Playground',                   category: 'Family & Kids',            icon: 'toys' },
  kids_club:             { displayName: "Kids' Club",                   category: 'Family & Kids',            icon: 'groups' },

  // Shopping
  souvenir_shop:         { displayName: 'Souvenir Shop',                category: 'Shopping',                 icon: 'storefront' },
  shops:                 { displayName: 'Shops',                        category: 'Shopping',                 icon: 'shopping_bag' },

  // Business & Conferences
  business_centre:       { displayName: 'Business Centre',              category: 'Business & Conferences',   icon: 'business_center' },
  conference_room:       { displayName: 'Conference Room',              category: 'Business & Conferences',   icon: 'meeting_room' },
  banquet:               { displayName: 'Banquet Hall',                 category: 'Business & Conferences',   icon: 'celebration' },
  fax_service:           { displayName: 'Fax Service',                  category: 'Business & Conferences',   icon: 'fax' },
  photocopying:          { displayName: 'Photocopying',                 category: 'Business & Conferences',   icon: 'content_copy' },
  printer:               { displayName: 'Printer',                      category: 'Business & Conferences',   icon: 'print' },

  // Pet Essentials
  pet_bowls:             { displayName: 'Pet Bowls',                    category: 'Pet Essentials',           icon: 'pets' },
  pet_baskets:           { displayName: 'Pet Baskets',                  category: 'Pet Essentials',           icon: 'pets' },

  // Other Facilities
  medical_centre:        { displayName: 'Medical Centre',               category: 'Other Facilities',         icon: 'local_hospital' },
  ev_charging:           { displayName: 'EV Charging Station',          category: 'Other Facilities',         icon: 'ev_station' },
  cloak_room:            { displayName: 'Cloak Room',                   category: 'Other Facilities',         icon: 'checkroom' },
  auditory_guidance:     { displayName: 'Auditory Guidance',            category: 'Other Facilities',         icon: 'hearing' },
  family_rooms:          { displayName: 'Family Rooms',                 category: 'Other Facilities',         icon: 'family_restroom' },
};

// ============================================================
// COMPACT ENTRY HELPERS
// f(key, level, quality, luxuryScore)
// ============================================================
const f = (normalizedKey: string, level: FacilityLevel, quality: number, luxuryScore: number): HotelFacilityEntry =>
  ({ normalizedKey, level, quality, luxuryScore });

// ============================================================
// VERIFIED HOTEL FACILITY PROFILES
// Source: OTA listings + official hotel websites, May 2026
// ============================================================

export const HOTEL_FACILITY_PROFILES: HotelFacilityProfile[] = [

  // ──────────────────────────────────────────────────────────
  // 1. THE CARLTON
  // Tier: Ultra Luxury Premium | 5★ | facilityScore: Luxury
  // ──────────────────────────────────────────────────────────
  {
    slug: 'the-carlton',
    luxuryTier: 'Ultra Luxury Premium',
    facilityScore: 'Luxury',
    overallLuxuryScore: 9.2,
    verificationSource: 'ota-verified',
    confidence: 0.92,
    lastVerified: '2026-05-01',
    facilities: [
      // Basic Facilities
      f('wifi',               'Standard', 3, 7.5),
      f('housekeeping',       'Luxury',   5, 9.0),
      f('room_service',       'Luxury',   5, 9.2),
      f('parking',            'Premium',  4, 8.0),
      f('power_backup',       'Premium',  4, 8.0),
      f('laundry_service',    'Premium',  4, 8.5),
      f('smoke_detector',     'Standard', 3, 7.0),
      f('elevator',           'Premium',  4, 8.0),
      f('air_conditioning',   'Luxury',   5, 9.0),
      f('central_heating',    'Luxury',   5, 9.0),
      f('lan',                'Standard', 3, 7.0),
      f('express_checkin',    'Luxury',   5, 9.0),
      f('smoking_rooms',      'Standard', 3, 7.0),
      f('umbrellas',          'Premium',  4, 8.0),
      f('refrigerator',       'Premium',  4, 8.0),
      f('ironing_service',    'Premium',  4, 8.5),
      f('newspaper',          'Standard', 3, 7.0),
      f('laundromat',         'Premium',  4, 8.0),
      f('washing_machine',    'Premium',  4, 8.0),
      // General Services
      f('concierge',          'Luxury',   5, 9.5),
      f('multilingual_staff', 'Luxury',   5, 9.0),
      f('luggage_assistance', 'Luxury',   5, 9.0),
      f('doctor_on_call',     'Premium',  4, 8.5),
      f('wheelchair',         'Premium',  4, 8.0),
      f('ticket_assistance',  'Luxury',   5, 9.0),
      f('disabilities_facilities', 'Premium', 4, 8.0),
      f('currency_exchange',  'Luxury',   5, 9.0),
      // Health & Wellness
      f('gym',                'Luxury',   5, 9.2),
      f('first_aid',          'Premium',  4, 8.5),
      // Transfers
      f('shuttle_service',    'Premium',  4, 8.5),
      f('airport_transfers',  'Luxury',   5, 9.0),
      // Room Amenities
      f('toiletries',         'Luxury',   5, 9.2),
      f('mineral_water',      'Luxury',   5, 9.0),
      f('heater',             'Luxury',   5, 9.0),
      f('water_heater',       'Luxury',   5, 9.0),
      f('hairdryer',          'Luxury',   5, 9.0),
      f('iron_board',         'Premium',  4, 8.5),
      f('work_desk',          'Luxury',   5, 9.0),
      f('sofa',               'Luxury',   5, 9.2),
      f('dental_kit',         'Luxury',   5, 9.2),
      f('minibar',            'Luxury',   5, 9.5),
      f('bathtub',            'Luxury',   5, 9.5),
      f('bubble_bath',        'Luxury',   5, 9.5),
      f('living_area',        'Luxury',   5, 9.2),
      f('dining_area',        'Luxury',   5, 9.0),
      f('interconnected_room','Premium',  4, 8.5),
      // Food & Drinks
      f('restaurant',         'Luxury',   5, 9.5),
      f('bar',                'Luxury',   5, 9.2),
      f('coffee_shop',        'Luxury',   5, 9.2),
      f('kids_meals',         'Premium',  4, 8.0),
      // Safety & Security
      f('fire_extinguishers', 'Standard', 3, 7.0),
      f('security_alarms',    'Premium',  4, 8.0),
      f('security_guard',     'Luxury',   5, 9.0),
      f('in_room_safe',       'Luxury',   5, 9.5),
      f('electronic_keycard', 'Luxury',   5, 9.5),
      f('cctv',               'Premium',  4, 8.0),
      f('carbon_monoxide_det','Premium',  4, 8.0),
      // Entertainment & Media
      f('entertainment',      'Luxury',   5, 9.0),
      f('tv',                 'Luxury',   5, 9.0),
      f('computer_station',   'Premium',  4, 8.0),
      // Beauty & Spa
      f('spa',                'Luxury',   5, 9.2),
      f('steam_sauna',        'Luxury',   5, 9.2),
      f('massage',            'Luxury',   5, 9.2),
      f('salon',              'Luxury',   5, 9.0),
      f('facial_treatments',  'Luxury',   5, 9.5),
      f('manicure_pedicure',  'Luxury',   5, 9.0),
      // Outdoor Activities
      f('golf',               'Luxury',   5, 9.5),
      f('cycling',            'Luxury',   5, 9.0),
      f('bonfire',            'Luxury',   5, 9.0),
      f('snorkelling',        'Premium',  4, 8.0),
      f('vehicle_rentals',    'Luxury',   5, 9.0),
      // Indoor Activities
      f('indoor_games',       'Premium',  4, 8.0),
      f('kids_play_area',     'Premium',  4, 8.5),
      // Common Areas
      f('garden',             'Luxury',   5, 9.5),
      f('lounge',             'Luxury',   5, 9.5),
      f('reception',          'Luxury',   5, 9.5),
      f('balcony_terrace',    'Luxury',   5, 9.2),
      f('library',            'Luxury',   5, 9.0),
      f('common_jacuzzi',     'Luxury',   5, 9.5),
      f('fireplace',          'Luxury',   5, 9.5),
      f('outdoor_furniture',  'Luxury',   5, 9.0),
      // Family & Kids
      f('childcare',          'Luxury',   5, 9.0),
      f('baby_safety_gates',  'Premium',  4, 8.0),
      f('playground',         'Premium',  4, 8.5),
      // Shopping
      f('souvenir_shop',      'Luxury',   5, 9.0),
      f('shops',              'Luxury',   5, 9.0),
      // Business & Conferences
      f('business_centre',    'Luxury',   5, 9.2),
      f('conference_room',    'Luxury',   5, 9.2),
      f('banquet',            'Luxury',   5, 9.5),
      f('fax_service',        'Premium',  4, 8.0),
      f('photocopying',       'Premium',  4, 8.0),
      f('printer',            'Premium',  4, 8.0),
      // Other
      f('cloak_room',         'Premium',  4, 8.0),
      f('family_rooms',       'Luxury',   5, 9.0),
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 2. THE TAMARA KODAI
  // Tier: Ultra Luxury Premium | 5★ | facilityScore: Luxury
  // ──────────────────────────────────────────────────────────
  {
    slug: 'the-tamara-kodai',
    luxuryTier: 'Ultra Luxury Premium',
    facilityScore: 'Luxury',
    overallLuxuryScore: 9.5,
    verificationSource: 'ota-verified',
    confidence: 0.93,
    lastVerified: '2026-05-01',
    facilities: [
      // Basic Facilities
      f('wifi',               'Standard', 3, 7.5),
      f('housekeeping',       'Luxury',   5, 9.5),
      f('room_service',       'Luxury',   5, 9.5),
      f('parking',            'Premium',  4, 8.0),
      f('power_backup',       'Premium',  4, 8.0),
      f('laundry_service',    'Luxury',   5, 9.0),
      f('smoke_detector',     'Standard', 3, 7.0),
      f('lan',                'Standard', 3, 7.0),
      f('umbrellas',          'Premium',  4, 8.0),
      f('refrigerator',       'Luxury',   5, 9.0),
      f('swimming_pool',      'Luxury',   5, 9.5),
      // General Services
      f('concierge',          'Luxury',   5, 9.8),
      f('multilingual_staff', 'Luxury',   5, 9.2),
      f('luggage_assistance', 'Luxury',   5, 9.2),
      f('doctor_on_call',     'Luxury',   5, 9.0),
      f('wheelchair',         'Luxury',   5, 9.0),
      f('wheelchair_accessible','Luxury', 5, 9.2),
      f('caretaker',          'Luxury',   5, 9.0),
      f('pool_beach_towels',  'Luxury',   5, 9.5),
      // Health & Wellness
      f('gym',                'Luxury',   5, 9.2),
      f('yoga',               'Luxury',   5, 9.8),
      f('first_aid',          'Premium',  4, 8.5),
      f('meditation_room',    'Luxury',   5, 9.8),
      f('activity_centre',    'Luxury',   5, 9.5),
      // Transfers
      f('shuttle_service',    'Luxury',   5, 9.0),
      f('airport_transfers',  'Luxury',   5, 9.5),
      f('railway_transfers',  'Luxury',   5, 9.0),
      f('bus_station_transfers','Luxury', 5, 9.0),
      // Room Amenities
      f('toiletries',         'Luxury',   5, 9.5),
      f('mineral_water',      'Luxury',   5, 9.5),
      f('heater',             'Luxury',   5, 9.5),
      f('water_heater',       'Luxury',   5, 9.5),
      f('hairdryer',          'Luxury',   5, 9.5),
      f('iron_board',         'Luxury',   5, 9.0),
      f('work_desk',          'Luxury',   5, 9.0),
      f('sofa',               'Luxury',   5, 9.5),
      f('dental_kit',         'Luxury',   5, 9.5),
      f('minibar',            'Luxury',   5, 9.8),
      f('mini_fridge',        'Luxury',   5, 9.5),
      f('bathtub',            'Luxury',   5, 9.8),
      f('room_jacuzzi',       'Luxury',   5, 9.8),
      f('coffee_machine',     'Luxury',   5, 9.5),
      f('living_area',        'Luxury',   5, 9.5),
      f('dining_area',        'Luxury',   5, 9.5),
      f('room_balcony',       'Luxury',   5, 9.5),
      f('interconnected_room','Luxury',   5, 9.0),
      // Food & Drinks
      f('restaurant',         'Luxury',   5, 9.8),
      f('bar',                'Luxury',   5, 9.5),
      f('kids_meals',         'Premium',  4, 8.0),
      // Safety & Security
      f('fire_extinguishers', 'Standard', 3, 7.0),
      f('security_alarms',    'Premium',  4, 8.5),
      f('cctv',               'Premium',  4, 8.5),
      // Entertainment & Media
      f('entertainment',      'Luxury',   5, 9.5),
      f('tv',                 'Luxury',   5, 9.5),
      // Beauty & Spa
      f('spa',                'Luxury',   5, 9.8),
      f('steam_sauna',        'Luxury',   5, 9.8),
      f('massage',            'Luxury',   5, 9.8),
      f('salon',              'Luxury',   5, 9.5),
      // Outdoor Activities
      f('bonfire',            'Luxury',   5, 9.5),
      f('cycling',            'Luxury',   5, 9.0),
      // Indoor Activities
      f('indoor_games',       'Premium',  4, 8.5),
      f('indoor_games_room',  'Luxury',   5, 9.0),
      f('kids_play_area',     'Premium',  4, 8.5),
      // Common Areas
      f('garden',             'Luxury',   5, 9.8),
      f('lounge',             'Luxury',   5, 9.8),
      f('reception',          'Luxury',   5, 9.8),
      f('balcony_terrace',    'Luxury',   5, 9.5),
      f('living_room',        'Luxury',   5, 9.5),
      // Business & Conferences
      f('conference_room',    'Luxury',   5, 9.5),
      f('banquet',            'Luxury',   5, 9.5),
      // Other
      f('cloak_room',         'Luxury',   5, 9.0),
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 3. STERLING KODAI LAKE
  // Tier: Premium Resort | 4★ | facilityScore: Premium
  // ──────────────────────────────────────────────────────────
  {
    slug: 'sterling-kodai-lake',
    luxuryTier: 'Premium Resort',
    facilityScore: 'Premium',
    overallLuxuryScore: 7.8,
    verificationSource: 'ota-verified',
    confidence: 0.90,
    lastVerified: '2026-05-01',
    facilities: [
      // Basic Facilities
      f('wifi',               'Standard', 3, 6.5),
      f('housekeeping',       'Premium',  4, 7.5),
      f('room_service',       'Premium',  4, 7.5),
      f('parking',            'Standard', 3, 6.5),
      f('power_backup',       'Standard', 3, 6.5),
      f('laundry_service',    'Standard', 3, 6.5),
      f('smoke_detector',     'Standard', 3, 6.5),
      f('elevator',           'Standard', 3, 6.5),
      f('umbrellas',          'Standard', 3, 6.5),
      f('refrigerator',       'Standard', 3, 6.5),
      f('express_checkin',    'Standard', 3, 6.5),
      // General Services
      f('concierge',          'Premium',  4, 7.8),
      f('multilingual_staff', 'Standard', 3, 6.5),
      f('luggage_assistance', 'Standard', 3, 6.5),
      f('doctor_on_call',     'Standard', 3, 6.5),
      f('wheelchair',         'Standard', 3, 6.5),
      f('wheelchair_accessible','Standard',3, 6.5),
      f('ticket_assistance',  'Standard', 3, 6.5),
      f('butler_services',    'Premium',  4, 8.0),
      // Health & Wellness
      f('gym',                'Premium',  4, 7.8),
      f('first_aid',          'Standard', 3, 6.5),
      f('activity_centre',    'Premium',  4, 7.5),
      // Transfers
      f('shuttle_service',    'Standard', 3, 6.5),
      f('airport_transfers',  'Standard', 3, 6.5),
      // Room Amenities
      f('toiletries',         'Premium',  4, 7.5),
      f('mineral_water',      'Standard', 3, 6.5),
      f('heater',             'Standard', 3, 6.5),
      f('water_heater',       'Standard', 3, 6.5),
      f('hairdryer',          'Standard', 3, 6.5),
      f('iron_board',         'Standard', 3, 6.5),
      f('work_desk',          'Standard', 3, 6.5),
      f('sofa',               'Standard', 3, 6.5),
      f('mini_fridge',        'Standard', 3, 6.5),
      f('air_conditioning',   'Standard', 3, 6.5),
      f('living_area',        'Standard', 3, 6.5),
      f('dining_area',        'Standard', 3, 6.5),
      // Food & Drinks
      f('restaurant',         'Premium',  4, 7.5),
      f('bar',                'Standard', 3, 6.5),
      f('breakfast',          'Premium',  4, 7.5),
      f('kids_meals',         'Standard', 3, 6.5),
      f('veg_food',           'Standard', 3, 6.5),
      f('barbeque',           'Premium',  4, 7.5),
      // Safety & Security
      f('fire_extinguishers', 'Standard', 3, 6.5),
      f('security_alarms',    'Standard', 3, 6.5),
      f('security_guard',     'Standard', 3, 6.5),
      f('cctv',               'Standard', 3, 6.5),
      // Entertainment & Media
      f('entertainment',      'Premium',  4, 7.5),
      f('music_system',       'Premium',  4, 7.5),
      f('karaoke',            'Premium',  4, 7.8),
      f('professional_photo', 'Premium',  4, 8.0),
      f('tv',                 'Standard', 3, 6.5),
      f('electrical_adapters','Standard', 3, 6.5),
      // Beauty & Spa
      f('spa',                'Standard', 3, 6.5),
      f('steam_sauna',        'Standard', 3, 6.5),
      f('massage',            'Standard', 3, 6.5),
      // Outdoor Activities
      f('bonfire',            'Premium',  4, 7.8),
      f('cycling',            'Standard', 3, 6.5),
      f('jungle_safari',      'Premium',  4, 8.0),
      // Indoor Activities
      f('indoor_games',       'Standard', 3, 6.5),
      f('indoor_games_room',  'Premium',  4, 7.5),
      f('kids_play_area',     'Premium',  4, 7.5),
      f('table_tennis',       'Standard', 3, 6.5),
      // Common Areas
      f('garden',             'Premium',  4, 7.8),
      f('reception',          'Standard', 3, 6.5),
      f('balcony_terrace',    'Premium',  4, 7.5),
      f('library',            'Standard', 3, 6.5),
      f('outdoor_furniture',  'Standard', 3, 6.5),
      f('living_room',        'Standard', 3, 6.5),
      // Family & Kids
      f('kids_club',          'Premium',  4, 7.8),
      f('playground',         'Standard', 3, 6.5),
      // Shopping
      f('souvenir_shop',      'Standard', 3, 6.5),
      // Business & Conferences
      f('business_centre',    'Premium',  4, 7.5),
      f('conference_room',    'Premium',  4, 7.5),
      f('banquet',            'Premium',  4, 7.5),
      f('photocopying',       'Standard', 3, 6.0),
      f('printer',            'Standard', 3, 6.0),
      // Pet Essentials
      f('pet_bowls',          'Standard', 3, 6.5),
      f('pet_baskets',        'Standard', 3, 6.5),
      // Other
      f('ev_charging',        'Standard', 3, 6.5),
      f('cloak_room',         'Standard', 3, 6.0),
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 4. HOTEL KODAI INTERNATIONAL (TARGET PROPERTY)
  // Tier: Upper Midscale | 3★ | facilityScore: Premium
  // ──────────────────────────────────────────────────────────
  {
    slug: 'hotel-kodai-international',
    luxuryTier: 'Upper Midscale',
    facilityScore: 'Premium',
    overallLuxuryScore: 6.5,
    verificationSource: 'ota-verified',
    confidence: 0.92,
    lastVerified: '2026-05-01',
    facilities: [
      // Basic Facilities
      f('wifi',               'Basic',    2, 5.0),
      f('housekeeping',       'Standard', 3, 6.0),
      f('room_service',       'Standard', 3, 6.0),
      f('parking',            'Standard', 3, 6.0),
      f('power_backup',       'Standard', 3, 6.0),
      f('laundry_service',    'Standard', 3, 6.0),
      f('smoke_detector',     'Basic',    2, 5.0),
      f('umbrellas',          'Basic',    2, 5.0),
      f('newspaper',          'Standard', 3, 5.5),
      // General Services
      f('concierge',          'Standard', 3, 6.0),
      f('multilingual_staff', 'Standard', 3, 6.0),
      f('luggage_assistance', 'Standard', 3, 6.0),
      f('doctor_on_call',     'Standard', 3, 6.0),
      f('wheelchair',         'Basic',    2, 5.0),
      f('disabilities_facilities','Standard',3, 6.0),
      // Health & Wellness
      f('gym',                'Standard', 3, 6.0),
      f('first_aid',          'Standard', 3, 6.0),
      // Transfers
      f('shuttle_service',    'Standard', 3, 6.0),
      f('airport_transfers',  'Standard', 3, 6.0),
      // Room Amenities
      f('toiletries',         'Standard', 3, 5.5),
      f('mineral_water',      'Standard', 3, 5.5),
      f('heater',             'Standard', 3, 5.5),
      f('water_heater',       'Standard', 3, 5.5),
      f('hairdryer',          'Standard', 3, 5.5),
      f('iron_board',         'Standard', 3, 5.5),
      f('work_desk',          'Standard', 3, 5.5),
      f('sofa',               'Standard', 3, 6.0),
      f('dental_kit',         'Standard', 3, 5.5),
      f('room_balcony',       'Standard', 3, 5.5),
      f('interconnected_room','Standard', 3, 5.5),
      // Food & Drinks
      f('restaurant',         'Standard', 3, 6.0),
      f('bar',                'Standard', 3, 5.5),
      f('kids_meals',         'Standard', 3, 5.5),
      f('dining_area',        'Standard', 3, 5.5),
      // Safety & Security
      f('cctv',               'Basic',    2, 5.0),
      // Entertainment & Media
      f('tv',                 'Standard', 3, 5.5),
      // Beauty & Spa
      f('spa',                'Premium',  4, 6.5),
      f('steam_sauna',        'Standard', 3, 6.0),
      f('massage',            'Standard', 3, 6.0),
      // Outdoor Activities
      f('bonfire',            'Standard', 3, 6.0),
      f('golf',               'Standard', 3, 6.5),
      f('outdoor_sports',     'Standard', 3, 5.5),
      // Indoor Activities
      f('indoor_games',       'Standard', 3, 6.0),
      f('kids_play_area',     'Standard', 3, 5.5),
      // Common Areas
      f('garden',             'Standard', 3, 6.0),
      f('reception',          'Standard', 3, 6.0),
      // Business & Conferences
      f('business_centre',    'Standard', 3, 6.0),
      f('conference_room',    'Standard', 3, 6.0),
      f('banquet',            'Premium',  4, 6.5),
      f('fax_service',        'Standard', 3, 5.5),
      f('photocopying',       'Standard', 3, 5.5),
      f('printer',            'Standard', 3, 5.5),
      // Other
      f('medical_centre',     'Premium',  4, 6.5),
      f('cloak_room',         'Standard', 3, 5.5),
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 5. LE POSHE BY SPARSA
  // Tier: Premium Resort | 3★ | facilityScore: Premium
  // ──────────────────────────────────────────────────────────
  {
    slug: 'le-poshe-by-sparsa',
    luxuryTier: 'Premium Resort',
    facilityScore: 'Premium',
    overallLuxuryScore: 7.2,
    verificationSource: 'ota-verified',
    confidence: 0.90,
    lastVerified: '2026-05-01',
    facilities: [
      // Basic Facilities
      f('wifi',               'Standard', 3, 6.0),
      f('housekeeping',       'Standard', 3, 6.5),
      f('room_service',       'Standard', 3, 6.5),
      f('parking',            'Standard', 3, 6.0),
      f('power_backup',       'Standard', 3, 6.0),
      f('laundry_service',    'Standard', 3, 6.5),
      f('smoke_detector',     'Standard', 3, 6.0),
      f('elevator',           'Standard', 3, 6.0),
      f('smoking_rooms',      'Standard', 3, 6.0),
      f('umbrellas',          'Standard', 3, 6.0),
      f('newspaper',          'Standard', 3, 5.5),
      f('activity_centre',    'Premium',  4, 7.5),
      // General Services
      f('concierge',          'Premium',  4, 7.2),
      f('multilingual_staff', 'Standard', 3, 6.0),
      f('luggage_assistance', 'Standard', 3, 6.0),
      f('doctor_on_call',     'Standard', 3, 6.0),
      f('wheelchair',         'Standard', 3, 6.0),
      f('disabilities_facilities','Standard',3, 6.0),
      f('caretaker',          'Standard', 3, 6.0),
      // Health & Wellness
      f('gym',                'Standard', 3, 6.5),
      f('yoga',               'Standard', 3, 6.5),
      f('first_aid',          'Standard', 3, 6.0),
      // Transfers
      f('shuttle_service',    'Standard', 3, 6.0),
      f('airport_transfers',  'Standard', 3, 6.0),
      f('railway_transfers',  'Standard', 3, 6.0),
      f('bus_station_transfers','Standard',3, 6.0),
      f('pickup_drop',        'Standard', 3, 6.0),
      // Room Amenities
      f('toiletries',         'Standard', 3, 6.5),
      f('mineral_water',      'Standard', 3, 6.0),
      f('heater',             'Standard', 3, 6.0),
      f('water_heater',       'Standard', 3, 6.0),
      f('hairdryer',          'Standard', 3, 6.5),
      f('iron_board',         'Standard', 3, 6.0),
      f('work_desk',          'Standard', 3, 6.0),
      f('sofa',               'Standard', 3, 6.0),
      f('dental_kit',         'Standard', 3, 6.0),
      f('minibar',            'Premium',  4, 7.0),
      f('mini_fridge',        'Standard', 3, 6.0),
      f('coffee_machine',     'Premium',  4, 7.0),
      f('living_area',        'Standard', 3, 6.5),
      f('dining_area',        'Standard', 3, 6.0),
      // Food & Drinks
      f('restaurant',         'Standard', 3, 6.5),
      f('kids_meals',         'Standard', 3, 6.0),
      f('cooking_class',      'Premium',  4, 7.5),
      // Safety & Security
      f('fire_extinguishers', 'Standard', 3, 6.0),
      f('security_alarms',    'Standard', 3, 6.0),
      f('security_guard',     'Standard', 3, 6.0),
      f('cctv',               'Standard', 3, 6.0),
      // Entertainment & Media
      f('entertainment',      'Standard', 3, 6.5),
      f('music_system',       'Standard', 3, 6.5),
      f('tv',                 'Standard', 3, 6.0),
      // Beauty & Spa
      f('spa',                'Premium',  4, 7.5),
      f('steam_sauna',        'Standard', 3, 6.5),
      f('massage',            'Standard', 3, 6.5),
      f('salon',              'Premium',  4, 7.0),
      // Outdoor Activities
      f('bonfire',            'Premium',  4, 7.2),
      f('outdoor_sports',     'Standard', 3, 6.0),
      // Indoor Activities
      f('indoor_games',       'Standard', 3, 6.0),
      f('indoor_games_room',  'Standard', 3, 6.5),
      f('kids_play_area',     'Standard', 3, 6.0),
      // Common Areas
      f('garden',             'Standard', 3, 6.5),
      f('lounge',             'Standard', 3, 6.5),
      f('reception',          'Standard', 3, 6.0),
      f('balcony_terrace',    'Standard', 3, 6.0),
      f('outdoor_furniture',  'Standard', 3, 6.0),
      f('living_room',        'Standard', 3, 6.5),
      // Family & Kids
      f('kids_club',          'Premium',  4, 7.2),
      // Shopping
      f('souvenir_shop',      'Standard', 3, 6.0),
      // Business & Conferences
      f('conference_room',    'Standard', 3, 6.5),
      f('banquet',            'Premium',  4, 7.0),
      f('photocopying',       'Standard', 3, 5.5),
      f('printer',            'Standard', 3, 5.5),
      // Other
      f('medical_centre',     'Premium',  4, 7.0),
      f('ev_charging',        'Standard', 3, 6.5),
      f('cloak_room',         'Standard', 3, 6.0),
      f('auditory_guidance',  'Standard', 3, 6.5),
    ],
  },
];

// ============================================================
// LUXURY LEVEL COLOUR TOKENS (for UI rendering)
// ============================================================
export const LEVEL_STYLES: Record<FacilityLevel, { bg: string; text: string; border: string; label: string }> = {
  Luxury:   { bg: 'rgba(201,169,110,0.14)', text: '#8A6A3B',          border: 'rgba(201,169,110,0.35)', label: 'Luxury'   },
  Premium:  { bg: 'rgba(100,115,140,0.12)', text: '#4A5568',          border: 'rgba(100,115,140,0.30)', label: 'Premium'  },
  Standard: { bg: 'rgba(26,122,85,0.10)',   text: '#1A7A55',          border: 'rgba(26,122,85,0.25)',   label: 'Standard' },
  Basic:    { bg: 'rgba(107,101,96,0.08)',  text: '#6B6560',          border: 'rgba(107,101,96,0.20)',  label: 'Basic'    },
  None:     { bg: 'transparent',            text: 'rgba(17,17,17,0.2)', border: 'transparent',          label: '—'        },
};

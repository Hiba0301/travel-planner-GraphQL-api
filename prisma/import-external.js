const fs = require('fs/promises');
const path = require('path');
const { parse: parseCsv } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = {};

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function getByPath(obj, pathKey) {
  return pathKey.split('.').reduce((acc, part) => {
    if (acc === null || acc === undefined) {
      return undefined;
    }

    return acc[part];
  }, obj);
}

function pick(obj, keys, fallback = undefined) {
  for (const key of keys) {
    const value = getByPath(obj, key);
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return fallback;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toIsoDateString(value, fallback) {
  if (!value) {
    return fallback;
  }

  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeStatus(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function defaultEndDate(startDate, plusDays) {
  const base = new Date(`${startDate}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + plusDays);
  return base.toISOString().slice(0, 10);
}

function normalizeRecord(raw, index) {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = toIsoDateString(
    pick(raw, ['trip.startDate', 'trip_start_date', 'tripStartDate', 'startDate']),
    today,
  );
  const endDate = toIsoDateString(
    pick(raw, ['trip.endDate', 'trip_end_date', 'tripEndDate', 'endDate']),
    defaultEndDate(startDate, 5),
  );

  const userEmail = String(
    pick(raw, ['user.email', 'user_email', 'email', 'userEmail'], ''),
  )
    .trim()
    .toLowerCase();

  const normalized = {
    user: {
      name: String(pick(raw, ['user.name', 'user_name', 'name', 'userName'], 'External User')).trim(),
      email: userEmail,
      password: String(
        pick(raw, ['user.password', 'user_password', 'password'], 'external_import_demo'),
      ).trim(),
      avatar: String(
        pick(raw, ['user.avatar', 'user_avatar', 'avatar', 'avatarUrl'], 'https://i.pravatar.cc/150'),
      ).trim(),
    },
    trip: {
      title: String(pick(raw, ['trip.title', 'trip_title', 'title', 'tripTitle'], 'Trip imported')).trim(),
      description: String(
        pick(raw, ['trip.description', 'trip_description', 'description'], 'Imported from external source'),
      ).trim(),
      budget: toNumber(pick(raw, ['trip.budget', 'trip_budget', 'budget'], 0), 0),
      currency: String(pick(raw, ['trip.currency', 'trip_currency', 'currency'], 'EUR')).trim().toUpperCase(),
      startDate,
      endDate,
      status: normalizeStatus(
        pick(raw, ['trip.status', 'trip_status', 'status'], 'planned'),
        ['planned', 'ongoing', 'completed'],
        'planned',
      ),
    },
    destination: {
      name: String(
        pick(raw, ['destination.name', 'destination_name', 'destination', 'destinationName'], 'Destination'),
      ).trim(),
      country: String(
        pick(raw, ['destination.country', 'destination_country', 'country'], 'Unknown'),
      ).trim(),
      city: String(pick(raw, ['destination.city', 'destination_city', 'city'], 'Unknown')).trim(),
      imageUrl: String(
        pick(raw, ['destination.imageUrl', 'destination_image_url', 'imageUrl', 'image_url'], ''),
      ).trim() || null,
      arrivalDate: toIsoDateString(
        pick(raw, ['destination.arrivalDate', 'destination_arrival_date', 'arrivalDate']),
        startDate,
      ),
      departureDate: toIsoDateString(
        pick(raw, ['destination.departureDate', 'destination_departure_date', 'departureDate']),
        endDate,
      ),
    },
    activity: {
      name: String(
        pick(raw, ['activity.name', 'activity_name', 'activity', 'activityName'], 'Activity imported'),
      ).trim(),
      description: String(
        pick(raw, ['activity.description', 'activity_description'], 'Imported activity'),
      ).trim(),
      price: toNumber(pick(raw, ['activity.price', 'activity_price', 'price'], 0), 0),
      duration: toNumber(pick(raw, ['activity.duration', 'activity_duration', 'duration'], 60), 60),
      category: String(
        pick(raw, ['activity.category', 'activity_category', 'category'], 'culture'),
      ).trim().toLowerCase(),
    },
    booking: {
      status: normalizeStatus(
        pick(raw, ['booking.status', 'booking_status', 'bookingStatus'], 'pending'),
        ['pending', 'confirmed', 'cancelled'],
        'pending',
      ),
      totalPrice: toNumber(
        pick(raw, ['booking.totalPrice', 'booking_total_price', 'totalPrice'], 0),
        0,
      ),
    },
    review: {
      rating: Math.min(
        5,
        Math.max(
          1,
          Math.round(toNumber(pick(raw, ['review.rating', 'review_rating', 'rating'], 5), 5)),
        ),
      ),
      comment: String(
        pick(raw, ['review.comment', 'review_comment', 'comment'], 'Great experience overall.'),
      ).trim(),
    },
  };

  if (!normalized.user.email.includes('@')) {
    throw new Error(`Record ${index + 1}: missing/invalid user email`);
  }

  if (!normalized.trip.title) {
    throw new Error(`Record ${index + 1}: missing trip title`);
  }

  return normalized;
}

function extractRecords(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  throw new Error('JSON source must be an array or contain data/items/results array');
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'travel-planner-api-importer/1.0',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function buildLiveApiRecord({ user, country, index }) {
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() + (index % 21));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 4 + (index % 4));

  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  const countryName = country?.name?.common || 'Unknown';
  const capital = Array.isArray(country?.capital) && country.capital[0] ? country.capital[0] : countryName;
  const currency = country?.currencies ? Object.keys(country.currencies)[0] : 'USD';
  const userFirstName = user?.name?.first || 'Traveler';
  const userLastName = user?.name?.last || 'User';
  const userEmail = String(user?.email || '').toLowerCase();
  const avatar = user?.picture?.large || 'https://i.pravatar.cc/150';

  const activities = [
    { name: `City walk in ${capital}`, category: 'culture', price: 35, duration: 180 },
    { name: `${countryName} food tasting`, category: 'food', price: 55, duration: 120 },
    { name: `Local highlights of ${capital}`, category: 'nature', price: 28, duration: 150 },
  ];
  const selectedActivity = activities[index % activities.length];

  return {
    user: {
      name: `${userFirstName} ${userLastName}`,
      email: userEmail,
      password: 'external_live_api_import',
      avatar,
    },
    trip: {
      title: `${countryName} discovery`,
      description: `Live-imported itinerary based on real data for ${capital}, ${countryName}.`,
      budget: 1000 + (index % 5) * 450,
      currency,
      startDate,
      endDate,
      status: start <= today ? 'ongoing' : 'planned',
    },
    destination: {
      name: capital,
      country: countryName,
      city: capital,
      imageUrl: `https://source.unsplash.com/1200x800/?${encodeURIComponent(capital)},travel`,
      arrivalDate: startDate,
      departureDate: endDate,
    },
    activity: {
      name: selectedActivity.name,
      description: `Popular experience in ${capital}, imported from external live source mode.`,
      price: selectedActivity.price,
      duration: selectedActivity.duration,
      category: selectedActivity.category,
    },
    booking: {
      status: index % 3 === 0 ? 'confirmed' : 'pending',
      totalPrice: selectedActivity.price,
    },
    review: {
      rating: 4 + (index % 2),
      comment: `Great trip to ${capital}. Data imported from live external APIs.`,
    },
  };
}

async function loadLiveApiInput({ limit }) {
  const count = Math.max(1, Number(limit) || 10);
  const [usersPayload, countriesPayload] = await Promise.all([
    fetchJson(`https://randomuser.me/api/?results=${count}&inc=name,email,picture`),
    fetchJson('https://restcountries.com/v3.1/all?fields=name,capital,currencies,population'),
  ]);

  const users = Array.isArray(usersPayload?.results) ? usersPayload.results : [];
  const countries = Array.isArray(countriesPayload)
    ? countriesPayload.filter((country) => Array.isArray(country.capital) && country.capital.length > 0)
    : [];

  if (!users.length) {
    throw new Error('Live API mode failed: no users returned from randomuser.me');
  }
  if (!countries.length) {
    throw new Error('Live API mode failed: no countries returned from restcountries.com');
  }

  const records = [];
  for (let i = 0; i < count; i += 1) {
    const user = users[i % users.length];
    const country = countries[i % countries.length];
    records.push(buildLiveApiRecord({ user, country, index: i }));
  }

  return records;
}

async function loadInput({ url, filePath, format }) {
  let rawText = '';

  if (url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to fetch source: ${response.status} ${response.statusText}`);
    }
    rawText = await response.text();
  } else if (filePath) {
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    rawText = await fs.readFile(absolute, 'utf8');
  } else {
    throw new Error('Provide --url <http(s)://...> or --file <path>');
  }

  const normalizedFormat = String(format || '').toLowerCase();
  const inferredFormat = normalizedFormat || (rawText.trim().startsWith('[') || rawText.trim().startsWith('{') ? 'json' : 'csv');

  if (inferredFormat === 'csv') {
    return parseCsv(rawText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  }

  if (inferredFormat === 'json' || inferredFormat === 'api') {
    const json = JSON.parse(rawText);
    return extractRecords(json);
  }

  throw new Error(`Unsupported format: ${inferredFormat}. Use csv or json.`);
}

async function importRecord(normalized, counters, dryRun) {
  if (dryRun) {
    counters.dryRun += 1;
    return;
  }

  const user = await prisma.user.upsert({
    where: { email: normalized.user.email },
    update: {
      name: normalized.user.name,
      avatar: normalized.user.avatar,
    },
    create: normalized.user,
  });

  let trip = await prisma.trip.findFirst({
    where: {
      userId: user.id,
      title: normalized.trip.title,
      startDate: normalized.trip.startDate,
      endDate: normalized.trip.endDate,
    },
  });

  if (!trip) {
    trip = await prisma.trip.create({
      data: {
        ...normalized.trip,
        userId: user.id,
      },
    });
    counters.createdTrips += 1;
  } else {
    counters.reusedTrips += 1;
  }

  let destination = await prisma.destination.findFirst({
    where: {
      tripId: trip.id,
      name: normalized.destination.name,
      arrivalDate: normalized.destination.arrivalDate,
      departureDate: normalized.destination.departureDate,
    },
  });

  if (!destination) {
    destination = await prisma.destination.create({
      data: {
        ...normalized.destination,
        tripId: trip.id,
      },
    });
    counters.createdDestinations += 1;
  } else {
    counters.reusedDestinations += 1;
  }

  let activity = await prisma.activity.findFirst({
    where: {
      destinationId: destination.id,
      name: normalized.activity.name,
    },
  });

  if (!activity) {
    activity = await prisma.activity.create({
      data: {
        ...normalized.activity,
        destinationId: destination.id,
      },
    });
    counters.createdActivities += 1;
  } else {
    counters.reusedActivities += 1;
  }

  const existingBooking = await prisma.booking.findFirst({
    where: {
      userId: user.id,
      tripId: trip.id,
      activityId: activity.id,
    },
  });

  if (!existingBooking) {
    await prisma.booking.create({
      data: {
        status: normalized.booking.status,
        totalPrice: normalized.booking.totalPrice,
        userId: user.id,
        tripId: trip.id,
        activityId: activity.id,
      },
    });
    counters.createdBookings += 1;
  } else {
    counters.reusedBookings += 1;
  }

  const existingReview = await prisma.review.findFirst({
    where: {
      userId: user.id,
      destinationId: destination.id,
      comment: normalized.review.comment,
    },
  });

  if (!existingReview) {
    await prisma.review.create({
      data: {
        rating: normalized.review.rating,
        comment: normalized.review.comment,
        userId: user.id,
        destinationId: destination.id,
      },
    });
    counters.createdReviews += 1;
  } else {
    counters.reusedReviews += 1;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = String(args.mode || 'append').toLowerCase();
  const source = String(args.source || 'file').toLowerCase();
  const dryRun = Boolean(args['dry-run']);

  if (!['append', 'reset'].includes(mode)) {
    throw new Error("--mode must be 'append' or 'reset'");
  }

  if (!['file', 'live-api'].includes(source)) {
    throw new Error("--source must be 'file' or 'live-api'");
  }

  const records = source === 'live-api'
    ? await loadLiveApiInput({ limit: args.limit })
    : await loadInput({
      url: args.url,
      filePath: args.file,
      format: args.format,
    });

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('No records found in source');
  }

  const normalizedRecords = records.map((record, idx) => normalizeRecord(record, idx));

  if (mode === 'reset' && !dryRun) {
    await prisma.booking.deleteMany();
    await prisma.review.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.destination.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.user.deleteMany();
  }

  const counters = {
    dryRun: 0,
    createdTrips: 0,
    reusedTrips: 0,
    createdDestinations: 0,
    reusedDestinations: 0,
    createdActivities: 0,
    reusedActivities: 0,
    createdBookings: 0,
    reusedBookings: 0,
    createdReviews: 0,
    reusedReviews: 0,
    failed: 0,
  };

  for (const normalized of normalizedRecords) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await importRecord(normalized, counters, dryRun);
    } catch (err) {
      counters.failed += 1;
      console.error(`Failed record for ${normalized.user.email}: ${err.message}`);
    }
  }

  console.log('Import completed.');
  console.log(`Records read: ${normalizedRecords.length}`);
  if (dryRun) {
    console.log(`Dry-run validated records: ${counters.dryRun}`);
  }
  console.log(`Trips created/reused: ${counters.createdTrips}/${counters.reusedTrips}`);
  console.log(
    `Destinations created/reused: ${counters.createdDestinations}/${counters.reusedDestinations}`,
  );
  console.log(`Activities created/reused: ${counters.createdActivities}/${counters.reusedActivities}`);
  console.log(`Bookings created/reused: ${counters.createdBookings}/${counters.reusedBookings}`);
  console.log(`Reviews created/reused: ${counters.createdReviews}/${counters.reusedReviews}`);
  console.log(`Failed records: ${counters.failed}`);
}

main()
  .catch((err) => {
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

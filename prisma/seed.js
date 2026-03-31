const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Idempotent seed: reset in dependency order.
  await prisma.booking.deleteMany();
  await prisma.review.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.destination.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();

  const [pwd1, pwd2, pwd3, pwd4] = await Promise.all([
    bcrypt.hash('demo_password_1', 10),
    bcrypt.hash('demo_password_2', 10),
    bcrypt.hash('demo_password_3', 10),
    bcrypt.hash('demo_password_4', 10),
  ]);

  const users = await prisma.$transaction([
    prisma.user.create({
      data: {
        name: 'Leila Benali',
        email: 'leila.benali@example.com',
        password: pwd1,
        avatar: 'https://i.pravatar.cc/150?img=47',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Thomas Leroy',
        email: 'thomas.leroy@example.com',
        password: pwd2,
        avatar: 'https://i.pravatar.cc/150?img=12',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Sofia Rossi',
        email: 'sofia.rossi@example.com',
        password: pwd3,
        avatar: 'https://i.pravatar.cc/150?img=32',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Omar Haddad',
        email: 'omar.haddad@example.com',
        password: pwd4,
        avatar: 'https://i.pravatar.cc/150?img=68',
      },
    }),
  ]);

  const [leila, thomas, sofia, omar] = users;

  const japanTrip = await prisma.trip.create({
    data: {
      title: 'Printemps au Japon',
      description: 'Tokyo, Kyoto et Osaka pendant la saison des cerisiers.',
      budget: 4200,
      currency: 'EUR',
      startDate: '2025-03-28',
      endDate: '2025-04-11',
      status: 'completed',
      userId: leila.id,
    },
  });

  const tokyo = await prisma.destination.create({
    data: {
      name: 'Tokyo',
      country: 'Japan',
      city: 'Tokyo',
      imageUrl: 'https://source.unsplash.com/1200x800/?tokyo,city',
      arrivalDate: '2025-03-28',
      departureDate: '2025-04-02',
      tripId: japanTrip.id,
    },
  });

  const kyoto = await prisma.destination.create({
    data: {
      name: 'Kyoto',
      country: 'Japan',
      city: 'Kyoto',
      imageUrl: 'https://source.unsplash.com/1200x800/?kyoto,temple',
      arrivalDate: '2025-04-02',
      departureDate: '2025-04-07',
      tripId: japanTrip.id,
    },
  });

  const osaka = await prisma.destination.create({
    data: {
      name: 'Osaka',
      country: 'Japan',
      city: 'Osaka',
      imageUrl: 'https://source.unsplash.com/1200x800/?osaka,night',
      arrivalDate: '2025-04-07',
      departureDate: '2025-04-11',
      tripId: japanTrip.id,
    },
  });

  const sushiClassTokyo = await prisma.activity.create({
    data: {
      name: 'Cours de sushi à Tsukiji',
      description: 'Atelier pratique avec chef local, dégustation incluse.',
      price: 95,
      duration: 150,
      category: 'food',
      destinationId: tokyo.id,
    },
  });

  await prisma.activity.createMany({
    data: [
      {
        name: 'Shibuya et Harajuku à pied',
        description: 'Balade urbaine guidée dans les quartiers iconiques.',
        price: 25,
        duration: 180,
        category: 'culture',
        destinationId: tokyo.id,
      },
      {
        name: 'Fushimi Inari et Gion',
        description: 'Journée temples et ruelles historiques de Kyoto.',
        price: 38,
        duration: 300,
        category: 'culture',
        destinationId: kyoto.id,
      },
      {
        name: 'Cérémonie du thé traditionnelle',
        description: 'Initiation dans une maison de thé historique.',
        price: 42,
        duration: 90,
        category: 'culture',
        destinationId: kyoto.id,
      },
      {
        name: 'Street food à Dotonbori',
        description: 'Parcours gourmand: takoyaki, okonomiyaki et kushikatsu.',
        price: 30,
        duration: 140,
        category: 'food',
        destinationId: osaka.id,
      },
    ],
  });

  const moroccoTrip = await prisma.trip.create({
    data: {
      title: 'Escapade au Maroc Atlantique',
      description: 'Casablanca, Essaouira et immersion locale.',
      budget: 2100,
      currency: 'EUR',
      startDate: '2026-03-20',
      endDate: '2026-03-31',
      status: 'ongoing',
      userId: thomas.id,
    },
  });

  const casablanca = await prisma.destination.create({
    data: {
      name: 'Casablanca',
      country: 'Morocco',
      city: 'Casablanca',
      imageUrl: 'https://source.unsplash.com/1200x800/?casablanca,mosque',
      arrivalDate: '2026-03-20',
      departureDate: '2026-03-24',
      tripId: moroccoTrip.id,
    },
  });

  const essaouira = await prisma.destination.create({
    data: {
      name: 'Essaouira',
      country: 'Morocco',
      city: 'Essaouira',
      imageUrl: 'https://source.unsplash.com/1200x800/?essaouira,coast',
      arrivalDate: '2026-03-24',
      departureDate: '2026-03-31',
      tripId: moroccoTrip.id,
    },
  });

  const medinaTour = await prisma.activity.create({
    data: {
      name: 'Visite guidée de la médina',
      description: 'Artisans, architecture et histoire de la vieille ville.',
      price: 20,
      duration: 120,
      category: 'culture',
      destinationId: casablanca.id,
    },
  });

  await prisma.activity.createMany({
    data: [
      {
        name: 'Hassan II et corniche',
        description: 'Circuit des incontournables de Casablanca.',
        price: 15,
        duration: 120,
        category: 'culture',
        destinationId: casablanca.id,
      },
      {
        name: 'Atelier cuisine marocaine',
        description: 'Préparation de tajine et pastilla avec une cheffe locale.',
        price: 55,
        duration: 180,
        category: 'food',
        destinationId: essaouira.id,
      },
      {
        name: 'Session de surf débutant',
        description: 'Cours collectif sur la plage principale.',
        price: 35,
        duration: 120,
        category: 'sport',
        destinationId: essaouira.id,
      },
    ],
  });

  const portugalTrip = await prisma.trip.create({
    data: {
      title: 'Portugal food & surf',
      description: 'Lisbonne, Porto et côte de Nazaré.',
      budget: 2600,
      currency: 'EUR',
      startDate: '2026-07-05',
      endDate: '2026-07-17',
      status: 'planned',
      userId: sofia.id,
    },
  });

  const lisbon = await prisma.destination.create({
    data: {
      name: 'Lisbon',
      country: 'Portugal',
      city: 'Lisbon',
      imageUrl: 'https://source.unsplash.com/1200x800/?lisbon,tram',
      arrivalDate: '2026-07-05',
      departureDate: '2026-07-10',
      tripId: portugalTrip.id,
    },
  });

  const porto = await prisma.destination.create({
    data: {
      name: 'Porto',
      country: 'Portugal',
      city: 'Porto',
      imageUrl: 'https://source.unsplash.com/1200x800/?porto,river',
      arrivalDate: '2026-07-10',
      departureDate: '2026-07-14',
      tripId: portugalTrip.id,
    },
  });

  const nazare = await prisma.destination.create({
    data: {
      name: 'Nazare',
      country: 'Portugal',
      city: 'Nazare',
      imageUrl: 'https://source.unsplash.com/1200x800/?nazare,ocean',
      arrivalDate: '2026-07-14',
      departureDate: '2026-07-17',
      tripId: portugalTrip.id,
    },
  });

  const lisbonFood = await prisma.activity.create({
    data: {
      name: 'Tour gastronomique de l’Alfama',
      description: 'Pasteis de nata, bacalhau et tavernes historiques.',
      price: 48,
      duration: 160,
      category: 'food',
      destinationId: lisbon.id,
    },
  });

  const nazareSurf = await prisma.activity.create({
    data: {
      name: 'Session surf côte Atlantique',
      description: 'Encadrement pro et location de matériel incluse.',
      price: 62,
      duration: 180,
      category: 'sport',
      destinationId: nazare.id,
    },
  });

  await prisma.activity.createMany({
    data: [
      {
        name: 'Croisière sur le Douro',
        description: 'Découverte des ponts emblématiques et caves de Porto.',
        price: 33,
        duration: 90,
        category: 'nature',
        destinationId: porto.id,
      },
      {
        name: 'Atelier azulejos',
        description: 'Peinture sur carreaux traditionnels portugais.',
        price: 29,
        duration: 110,
        category: 'culture',
        destinationId: porto.id,
      },
    ],
  });

  const turkeyTrip = await prisma.trip.create({
    data: {
      title: 'Istanbul & Cappadoce',
      description: 'Patrimoine ottoman, bazars et paysages volcaniques.',
      budget: 2400,
      currency: 'EUR',
      startDate: '2025-10-01',
      endDate: '2025-10-10',
      status: 'completed',
      userId: omar.id,
    },
  });

  const istanbul = await prisma.destination.create({
    data: {
      name: 'Istanbul',
      country: 'Turkey',
      city: 'Istanbul',
      imageUrl: 'https://source.unsplash.com/1200x800/?istanbul,bosphorus',
      arrivalDate: '2025-10-01',
      departureDate: '2025-10-06',
      tripId: turkeyTrip.id,
    },
  });

  const cappadocia = await prisma.destination.create({
    data: {
      name: 'Cappadocia',
      country: 'Turkey',
      city: 'Goreme',
      imageUrl: 'https://source.unsplash.com/1200x800/?cappadocia,balloons',
      arrivalDate: '2025-10-06',
      departureDate: '2025-10-10',
      tripId: turkeyTrip.id,
    },
  });

  await prisma.activity.createMany({
    data: [
      {
        name: 'Croisière au coucher du soleil sur le Bosphore',
        description: 'Vue panoramique sur les rives européennes et asiatiques.',
        price: 40,
        duration: 100,
        category: 'nature',
        destinationId: istanbul.id,
      },
      {
        name: 'Vol en montgolfière',
        description: 'Survol des vallées de Cappadoce à l’aube.',
        price: 180,
        duration: 75,
        category: 'nature',
        destinationId: cappadocia.id,
      },
    ],
  });

  await prisma.booking.createMany({
    data: [
      {
        status: 'confirmed',
        totalPrice: sushiClassTokyo.price,
        userId: leila.id,
        tripId: japanTrip.id,
        activityId: sushiClassTokyo.id,
      },
      {
        status: 'confirmed',
        totalPrice: medinaTour.price,
        userId: thomas.id,
        tripId: moroccoTrip.id,
        activityId: medinaTour.id,
      },
      {
        status: 'pending',
        totalPrice: lisbonFood.price,
        userId: sofia.id,
        tripId: portugalTrip.id,
        activityId: lisbonFood.id,
      },
      {
        status: 'pending',
        totalPrice: nazareSurf.price,
        userId: sofia.id,
        tripId: portugalTrip.id,
        activityId: nazareSurf.id,
      },
    ],
  });

  await prisma.review.createMany({
    data: [
      {
        rating: 5,
        comment: 'Tokyo est ultra dynamique et incroyablement bien connectée.',
        userId: leila.id,
        destinationId: tokyo.id,
      },
      {
        rating: 5,
        comment: 'Kyoto est un musée à ciel ouvert, parfait pour marcher toute la journée.',
        userId: leila.id,
        destinationId: kyoto.id,
      },
      {
        rating: 4,
        comment: 'Essaouira est super relax, idéale pour ralentir le rythme.',
        userId: thomas.id,
        destinationId: essaouira.id,
      },
      {
        rating: 4,
        comment: 'Lisbonne est très agréable, mais prévoyez de bonnes chaussures.',
        userId: sofia.id,
        destinationId: lisbon.id,
      },
      {
        rating: 5,
        comment: 'Porto est magnifique, surtout au coucher du soleil sur le Douro.',
        userId: sofia.id,
        destinationId: porto.id,
      },
      {
        rating: 5,
        comment: 'Cappadoce au lever du soleil, expérience inoubliable.',
        userId: omar.id,
        destinationId: cappadocia.id,
      },
    ],
  });

  const [userCount, tripCount, destinationCount, activityCount, bookingCount, reviewCount] =
    await prisma.$transaction([
      prisma.user.count(),
      prisma.trip.count(),
      prisma.destination.count(),
      prisma.activity.count(),
      prisma.booking.count(),
      prisma.review.count(),
    ]);

  console.log('✅ Seed terminé avec succès');
  console.log(
    `   Users: ${userCount}, Trips: ${tripCount}, Destinations: ${destinationCount}, Activities: ${activityCount}, Bookings: ${bookingCount}, Reviews: ${reviewCount}`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
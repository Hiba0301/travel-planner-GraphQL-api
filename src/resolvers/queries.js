const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../auth');

const prisma = new PrismaClient();

const tripInclude = {
  user: true,
  destinations: { include: { activities: true, reviews: true } },
  bookings: true
};

// Construit un objet de filtres Prisma reutilisable pour les listes de trips.
function buildTripWhere(args, userId) {
  const where = {};

  if (userId !== undefined) {
    where.userId = Number(userId);
  }

  if (args.status) {
    where.status = args.status;
  }

  if (args.currency) {
    where.currency = String(args.currency).toUpperCase();
  }

  if (args.minBudget !== undefined || args.maxBudget !== undefined) {
    where.budget = {};
    if (args.minBudget !== undefined) {
      where.budget.gte = args.minBudget;
    }
    if (args.maxBudget !== undefined) {
      where.budget.lte = args.maxBudget;
    }
  }

  return where;
}

module.exports = {
  // USERS (lectures protegees)
  users: (_parent, _args, context) => {
    requireAuth(context);
    return prisma.user.findMany({ include: { trips: true, reviews: true, bookings: true } });
  },
  user: (_parent, { id }, context) => {
    const authUser = requireAuth(context);
    if (Number(id) !== authUser.id) {
      throw new Error('Forbidden: you can only access your own user profile.');
    }
    return prisma.user.findUnique({ where: { id: Number(id) }, include: { trips: true, reviews: true, bookings: true } });
  },
  me: (_parent, _args, context) => {
    const authUser = requireAuth(context);
    return prisma.user.findUnique({
      where: { id: authUser.id },
      include: { trips: true, reviews: true, bookings: true },
    });
  },

  // TRIPS
  trips: (_, args) => {
    // Applique filtres, tri et pagination dans une seule requete Prisma.
    const where = buildTripWhere(args);

    const sortFieldMap = {
      CREATED_AT: 'createdAt',
      START_DATE: 'startDate',
      END_DATE: 'endDate',
      BUDGET: 'budget',
      TITLE: 'title',
    };

    const orderBy = {
      [sortFieldMap[args.sortBy || 'CREATED_AT']]: args.sortOrder || 'desc',
    };

    const query = {
      where,
      orderBy,
      include: tripInclude,
    };

    // limit -> take: nombre max de lignes retournees.
    if (Number.isInteger(args.limit) && args.limit > 0) {
      query.take = args.limit;
    }

    // offset -> skip: nombre de lignes ignorees avant retour.
    if (Number.isInteger(args.offset) && args.offset >= 0) {
      query.skip = args.offset;
    }

    return prisma.trip.findMany(query);
  },
  trip: (_, { id }) => prisma.trip.findUnique({ where: { id: Number(id) }, include: tripInclude }),
  tripsByUser: (_parent, { userId }, context) => {
    const authUser = requireAuth(context);
    if (Number(userId) !== authUser.id) {
      throw new Error('Forbidden: you can only access your own trips.');
    }
    return prisma.trip.findMany({ where: { userId: Number(userId) }, include: tripInclude });
  },
  myTrips: (_parent, args, context) => {
    // Meme logique que trips, mais limitee a l'utilisateur authentifie.
    const authUser = requireAuth(context);
    const where = buildTripWhere(args, authUser.id);

    const sortFieldMap = {
      CREATED_AT: 'createdAt',
      START_DATE: 'startDate',
      END_DATE: 'endDate',
      BUDGET: 'budget',
      TITLE: 'title',
    };

    const query = {
      where,
      orderBy: { [sortFieldMap[args.sortBy || 'CREATED_AT']]: args.sortOrder || 'desc' },
      include: tripInclude,
    };

    if (Number.isInteger(args.limit) && args.limit > 0) {
      query.take = args.limit;
    }

    if (Number.isInteger(args.offset) && args.offset >= 0) {
      query.skip = args.offset;
    }

    return prisma.trip.findMany(query);
  },
  tripsByStatus: (_, { status }) => prisma.trip.findMany({ where: { status }, include: tripInclude }),
  tripsByBudget: (_, { max }) => prisma.trip.findMany({ where: { budget: { lte: max } }, include: tripInclude }),
  tripStats: async (_parent, _args, context) => {
    const authUser = requireAuth(context);
    const trips = await prisma.trip.findMany({ where: { userId: authUser.id }, select: { status: true, budget: true } });

    const totalTrips = trips.length;
    const plannedTrips = trips.filter((t) => t.status === 'planned').length;
    const ongoingTrips = trips.filter((t) => t.status === 'ongoing').length;
    const completedTrips = trips.filter((t) => t.status === 'completed').length;
    const totalBudget = trips.reduce((sum, t) => sum + t.budget, 0);

    return {
      totalTrips,
      plannedTrips,
      ongoingTrips,
      completedTrips,
      totalBudget,
      averageBudget: totalTrips ? totalBudget / totalTrips : 0,
    };
  },

  // DESTINATIONS
  destinations: () => prisma.destination.findMany({ include: { activities: true, reviews: true } }),
  destination: (_, { id }) => prisma.destination.findUnique({ where: { id: Number(id) }, include: { activities: true, reviews: true } }),
  destinationsByCountry: (_, { country }) => prisma.destination.findMany({ where: { country }, include: { activities: true, reviews: true } }),
  searchDestinations: (_parent, { keyword, country }) =>
    // Recherche plein texte sur name/city/country + filtre exact optionnel par pays.
    prisma.destination.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: keyword } },
              { city: { contains: keyword } },
              { country: { contains: keyword } },
            ],
          },
          country ? { country: { equals: country } } : {},
        ],
      },
      include: { activities: true, reviews: true },
    }),

  // ACTIVITIES
  activities: () => prisma.activity.findMany({ include: { destination: true } }),
  activitiesByDestination: (_, { destinationId }) => prisma.activity.findMany({ where: { destinationId: Number(destinationId) } }),
  activitiesByCategory: (_, { category }) => prisma.activity.findMany({ where: { category } }),

  // BOOKINGS
  bookings: (_parent, _args, context) => {
    const authUser = requireAuth(context);
    return prisma.booking.findMany({
      where: { userId: authUser.id },
      include: { user: true, trip: true, activity: true },
    });
  },
  bookingsByUser: (_parent, { userId }, context) => {
    const authUser = requireAuth(context);
    if (Number(userId) !== authUser.id) {
      throw new Error('Forbidden: you can only access your own bookings.');
    }
    return prisma.booking.findMany({ where: { userId: Number(userId) }, include: { trip: true, activity: true } });
  },
  myBookings: (_parent, { status }, context) => {
    const authUser = requireAuth(context);
    return prisma.booking.findMany({
      where: {
        userId: authUser.id,
        ...(status ? { status } : {}),
      },
      include: { user: true, trip: true, activity: true },
    });
  },

  // REVIEWS
  reviews: () => prisma.review.findMany({ include: { user: true, destination: true } }),
  reviewsByDestination: (_, { destinationId }) => prisma.review.findMany({ where: { destinationId: Number(destinationId) }, include: { user: true } }),
};
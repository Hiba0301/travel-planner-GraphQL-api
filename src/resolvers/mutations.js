const { PrismaClient } = require('@prisma/client');
const { PubSub } = require('graphql-subscriptions');
const bcrypt = require('bcryptjs');
const { requireAuth, signAccessToken } = require('../auth');

const prisma = new PrismaClient();

const pubsub = new PubSub();

const tripInclude = {
  user: true,
  destinations: { include: { activities: true, reviews: true } },
  bookings: true
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(email, password) {
  if (!emailPattern.test(String(email).trim().toLowerCase())) {
    throw new Error('Invalid email format.');
  }

  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must contain at least 8 characters.');
  }
}

function ensureChronologicalDates(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid dates. Use an ISO date format such as YYYY-MM-DD.');
  }

  if (start > end) {
    throw new Error('startDate must be before or equal to endDate.');
  }
}

async function assertTripOwnership(tripId, authUserId) {
  const trip = await prisma.trip.findUnique({
    where: { id: Number(tripId) },
    select: { id: true, userId: true },
  });

  if (!trip) {
    throw new Error('Trip not found.');
  }

  if (trip.userId !== Number(authUserId)) {
    throw new Error('Forbidden: this trip does not belong to you.');
  }

  return trip;
}

const mutations = {
  // ── USERS ──
  register: async (_parent, args) => {
    validateCredentials(args.email, args.password);

    const hashedPassword = await bcrypt.hash(args.password, 10);

    return prisma.user.create({
      data: {
        name: args.name,
        email: String(args.email).trim().toLowerCase(),
        password: hashedPassword,
        avatar: args.avatar || null,
      },
    });
  },

  createUser: async (_parent, args) => {
    validateCredentials(args.email, args.password);

    const hashedPassword = await bcrypt.hash(args.password, 10);

    return prisma.user.create({
      data: {
        name: args.name,
        email: String(args.email).trim().toLowerCase(),
        password: hashedPassword,
        avatar: args.avatar || null,
      },
    });
  },

  login: async (_parent, { email, password }) => {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new Error('Invalid credentials.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials.');
    }

    const token = signAccessToken(user);
    return { token, user };
  },

  updateMyProfile: (_parent, { name, avatar }, context) => {
    const authUser = requireAuth(context);
    return prisma.user.update({
      where: { id: authUser.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
      },
    });
  },

  // ── TRIPS ──
  createTrip: async (_parent, args, context) => {
    const authUser = requireAuth(context);

    if (args.userId && Number(args.userId) !== authUser.id) {
      throw new Error('Forbidden: userId does not match authenticated user.');
    }

    ensureChronologicalDates(args.startDate, args.endDate);

    const trip = await prisma.trip.create({
      data: {
        title: args.title,
        description: args.description,
        budget: args.budget,
        currency: String(args.currency || 'USD').toUpperCase(),
        startDate: args.startDate,
        endDate: args.endDate,
        userId: authUser.id
      },
      include: tripInclude
    });
    pubsub.publish('TRIP_CREATED', { tripCreated: trip });
    return trip;
  },

  updateTripStatus: async (_parent, { id, status }, context) => {
    const authUser = requireAuth(context);
    await assertTripOwnership(id, authUser.id);
    return prisma.trip.update({ where: { id: Number(id) }, data: { status }, include: tripInclude });
  },

  deleteTrip: async (_parent, { id }, context) => {
    const authUser = requireAuth(context);
    await assertTripOwnership(id, authUser.id);

    const numId = Number(id);
    await prisma.booking.deleteMany({ where: { tripId: numId } });
    const destinations = await prisma.destination.findMany({ where: { tripId: numId } });
    for (const dest of destinations) {
      await prisma.activity.deleteMany({ where: { destinationId: dest.id } });
      await prisma.review.deleteMany({ where: { destinationId: dest.id } });
    }
    await prisma.destination.deleteMany({ where: { tripId: numId } });
    await prisma.trip.delete({ where: { id: numId } });
    return true;
  },

  // ── DESTINATIONS ──
  addDestination: async (_parent, args, context) => {
    const authUser = requireAuth(context);
    await assertTripOwnership(args.tripId, authUser.id);

    ensureChronologicalDates(args.arrivalDate, args.departureDate);

    return prisma.destination.create({
      data: {
        name: args.name,
        country: args.country,
        city: args.city,
        imageUrl: args.imageUrl,
        arrivalDate: args.arrivalDate,
        departureDate: args.departureDate,
        tripId: Number(args.tripId)
      },
      include: { activities: true, reviews: true }
    });
  },

  // ── ACTIVITIES ──
  addActivity: async (_parent, args, context) => {
    const authUser = requireAuth(context);

    const destination = await prisma.destination.findUnique({
      where: { id: Number(args.destinationId) },
      select: { id: true, trip: { select: { userId: true } } },
    });

    if (!destination) {
      throw new Error('Destination not found.');
    }

    if (destination.trip.userId !== authUser.id) {
      throw new Error('Forbidden: destination does not belong to your trip.');
    }

    return prisma.activity.create({
      data: {
        name: args.name,
        description: args.description,
        price: args.price,
        duration: args.duration,
        category: args.category,
        destinationId: Number(args.destinationId)
      },
      include: { destination: true }
    });
  },

  // ── BOOKINGS ──
  createBooking: async (_parent, args, context) => {
    const authUser = requireAuth(context);

    if (args.userId && Number(args.userId) !== authUser.id) {
      throw new Error('Forbidden: userId does not match authenticated user.');
    }

    const activity = await prisma.activity.findUnique({
      where: { id: Number(args.activityId) },
      select: { id: true, destination: { select: { tripId: true } } },
    });

    if (!activity) {
      throw new Error('Activity not found.');
    }

    if (activity.destination.tripId !== Number(args.tripId)) {
      throw new Error('Activity does not belong to this trip.');
    }

    await assertTripOwnership(args.tripId, authUser.id);

    const booking = await prisma.booking.create({
      data: {
        userId: authUser.id,
        tripId: Number(args.tripId),
        activityId: Number(args.activityId),
        totalPrice: args.totalPrice
      },
      include: { user: true, trip: true, activity: true }
    });
    pubsub.publish('BOOKING_CREATED', { bookingCreated: booking });
    return booking;
  },

  updateBookingStatus: async (_parent, { id, status }, context) => {
    const authUser = requireAuth(context);
    const booking = await prisma.booking.findUnique({
      where: { id: Number(id) },
      select: { id: true, userId: true },
    });

    if (!booking) {
      throw new Error('Booking not found.');
    }

    if (booking.userId !== authUser.id) {
      throw new Error('Forbidden: booking does not belong to you.');
    }

    return prisma.booking.update({
      where: { id: Number(id) },
      data: { status },
      include: { user: true, trip: true, activity: true }
    });
  },

  // ── REVIEWS ──
  addReview: async (_parent, args, context) => {
    const authUser = requireAuth(context);

    if (args.userId && Number(args.userId) !== authUser.id) {
      throw new Error('Forbidden: userId does not match authenticated user.');
    }

    const destination = await prisma.destination.findUnique({
      where: { id: Number(args.destinationId) },
      select: { tripId: true },
    });

    if (!destination) {
      throw new Error('Destination not found.');
    }

    const hasBookedTrip = await prisma.booking.findFirst({
      where: {
        userId: authUser.id,
        tripId: destination.tripId,
      },
      select: { id: true },
    });

    if (!hasBookedTrip) {
      throw new Error('You can only review destinations linked to one of your bookings.');
    }

    const review = await prisma.review.create({
      data: {
        rating: args.rating,
        comment: args.comment,
        userId: authUser.id,
        destinationId: Number(args.destinationId)
      },
      include: { user: true, destination: true }
    });
    pubsub.publish('REVIEW_ADDED', { reviewAdded: review });
    return review;
  }
};

module.exports = { mutations, pubsub };
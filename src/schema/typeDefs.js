const typeDefs = `#graphql

  # Entites metier principales du domaine travel planner.

  type User {
    id: ID!
    name: String!
    email: String!
    avatar: String
    createdAt: String!
    trips: [Trip!]!
    reviews: [Review!]!
    bookings: [Booking!]!
  }

  type Trip {
    id: ID!
    title: String!
    description: String
    budget: Float!
    currency: String!
    startDate: String!
    endDate: String!
    status: String!
    createdAt: String!
    user: User!
    destinations: [Destination!]!
    bookings: [Booking!]!
  }

  type Destination {
    id: ID!
    name: String!
    country: String!
    city: String!
    imageUrl: String
    arrivalDate: String!
    departureDate: String!
    activities: [Activity!]!
    reviews: [Review!]!
  }

  type Activity {
    id: ID!
    name: String!
    description: String
    price: Float!
    duration: Int!
    category: String!
    destination: Destination!
  }

  type Booking {
    id: ID!
    status: String!
    bookedAt: String!
    totalPrice: Float!
    user: User!
    trip: Trip!
    activity: Activity!
  }

  type Review {
    id: ID!
    rating: Int!
    comment: String!
    createdAt: String!
    user: User!
    destination: Destination!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type TripStats {
    totalTrips: Int!
    plannedTrips: Int!
    ongoingTrips: Int!
    completedTrips: Int!
    totalBudget: Float!
    averageBudget: Float!
  }

  enum TripSortField {
    CREATED_AT
    START_DATE
    END_DATE
    BUDGET
    TITLE
  }

  enum SortOrder {
    asc
    desc
  }

  # ───── QUERIES ─────
  # Operations de lecture (filtres, tri, pagination sur les listes de trips).
  type Query {
    # Users
    users: [User!]!
    user(id: ID!): User
    me: User

    # Trips
    trips(
      status: String
      currency: String
      minBudget: Float
      maxBudget: Float
      # limit/offset: pagination de type page-based (take/skip cote Prisma).
      limit: Int
      offset: Int
      # Tri parametre par enum pour eviter des champs arbitraires.
      sortBy: TripSortField = CREATED_AT
      sortOrder: SortOrder = desc
    ): [Trip!]!
    trip(id: ID!): Trip
    tripsByUser(userId: ID!): [Trip!]!
    myTrips(
      status: String
      limit: Int
      offset: Int
      sortBy: TripSortField = CREATED_AT
      sortOrder: SortOrder = desc
    ): [Trip!]!
    tripsByStatus(status: String!): [Trip!]!
    tripsByBudget(max: Float!): [Trip!]!
    tripStats: TripStats!

    # Destinations
    destinations: [Destination!]!
    destination(id: ID!): Destination
    destinationsByCountry(country: String!): [Destination!]!
    searchDestinations(keyword: String!, country: String): [Destination!]!

    # Activities
    activities: [Activity!]!
    activitiesByDestination(destinationId: ID!): [Activity!]!
    activitiesByCategory(category: String!): [Activity!]!

    # Bookings
    bookings: [Booking!]!
    bookingsByUser(userId: ID!): [Booking!]!
    myBookings(status: String): [Booking!]!

    # Reviews
    reviews: [Review!]!
    reviewsByDestination(destinationId: ID!): [Review!]!
  }

  # ───── MUTATIONS ─────
  # Operations d'ecriture; les plus sensibles sont protegees dans les resolvers.
  type Mutation {
    # Users
    register(
      name: String!
      email: String!
      password: String!
      avatar: String
    ): User!

    createUser(
      name: String!
      email: String!
      password: String!
      avatar: String
    ): User!

    login(email: String!, password: String!): AuthPayload!
    updateMyProfile(name: String, avatar: String): User!

    # Trips
    createTrip(
      title: String!
      description: String
      budget: Float!
      currency: String
      startDate: String!
      endDate: String!
      userId: ID
    ): Trip!

    updateTripStatus(id: ID!, status: String!): Trip!
    deleteTrip(id: ID!): Boolean!

    # Destinations
    addDestination(
      name: String!
      country: String!
      city: String!
      imageUrl: String
      arrivalDate: String!
      departureDate: String!
      tripId: ID!
    ): Destination!

    # Activities
    addActivity(
      name: String!
      description: String
      price: Float!
      duration: Int!
      category: String!
      destinationId: ID!
    ): Activity!

    # Bookings
    createBooking(
      userId: ID
      tripId: ID!
      activityId: ID!
      totalPrice: Float!
    ): Booking!

    updateBookingStatus(id: ID!, status: String!): Booking!

    # Reviews
    addReview(
      rating: Int!
      comment: String!
      userId: ID
      destinationId: ID!
    ): Review!
  }

  # ───── SUBSCRIPTIONS ─────
  # Evenements temps reel publies depuis certaines mutations.
  type Subscription {
    tripCreated: Trip!
    bookingCreated: Booking!
    reviewAdded: Review!
  }
`;

module.exports = typeDefs;
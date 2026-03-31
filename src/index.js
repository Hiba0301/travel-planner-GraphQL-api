require('dotenv').config();

const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/use/ws');
const express = require('express');
const http = require('http');
const net = require('net');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const typeDefs = require('./schema/typeDefs');
const queries = require('./resolvers/queries');
const { mutations } = require('./resolvers/mutations');
const subscriptions = require('./resolvers/subscriptions');
const { buildContextUser, assertClientCredentials } = require('./auth');

const resolvers = {
  Query: queries,
  Mutation: mutations,
  Subscription: subscriptions,
};

async function startServer() {
  const app = express();
  const preferredPort = Number(process.env.PORT || 4000);
  const httpServer = http.createServer(app);
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        const rawAuth = ctx.connectionParams?.authorization || ctx.connectionParams?.Authorization;
        const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
        const clientId =
          ctx.connectionParams?.clientId ||
          ctx.connectionParams?.['x-client-id'] ||
          ctx.connectionParams?.['X-Client-Id'];
        const clientSecret =
          ctx.connectionParams?.clientSecret ||
          ctx.connectionParams?.['x-client-secret'] ||
          ctx.connectionParams?.['X-Client-Secret'];

        assertClientCredentials(clientId, clientSecret);

        return { user: buildContextUser(authHeader) };
      },
    },
    wsServer,
  );

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  if (!process.env.JWT_SECRET) {
    console.warn('⚠️ JWT_SECRET non defini. Utilisation d\'un secret de dev temporaire.');
  }

  if (!process.env.API_CLIENT_ID || !process.env.API_CLIENT_SECRET) {
    console.warn('⚠️ API_CLIENT_ID/API_CLIENT_SECRET non definis. Utilisation de credentials de dev.');
  }

  const graphqlLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 200),
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(
    '/graphql',
    cors(),
    graphqlLimiter,
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => ({
        ...(() => {
          assertClientCredentials(req.headers['x-client-id'], req.headers['x-client-secret']);
          return {};
        })(),
        user: buildContextUser(req.headers.authorization),
      }),
    }),
  );

  const findAvailablePort = (startPort) =>
    new Promise((resolve, reject) => {
      const tryPort = (port) => {
        const tester = net.createServer();

        tester.once('error', (err) => {
          tester.close();
          if (err.code === 'EADDRINUSE' && !process.env.PORT) {
            tryPort(port + 1);
            return;
          }
          reject(err);
        });

        tester.once('listening', () => {
          tester.close(() => resolve(port));
        });

        tester.listen(port);
      };

      tryPort(startPort);
    });

  const activePort = await findAvailablePort(preferredPort);
  if (activePort !== preferredPort) {
    console.warn(`⚠️ Port ${preferredPort} occupé, démarrage sur ${activePort}.`);
  }

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(activePort, resolve);
  });
  console.log(`🚀 API prête sur http://localhost:${activePort}/graphql`);
  console.log(`📡 Subscriptions sur ws://localhost:${activePort}/graphql`);
}

startServer().catch(console.error);
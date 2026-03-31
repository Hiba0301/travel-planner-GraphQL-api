const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const API_CLIENT_ID = process.env.API_CLIENT_ID || 'travel-client';
const API_CLIENT_SECRET = process.env.API_CLIENT_SECRET || 'travel-secret';

function getTokenFromAuthHeader(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return authHeader.trim();
}

function buildContextUser(authHeader) {
  const token = getTokenFromAuthHeader(authHeader);
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return {
      id: Number(payload.sub),
      email: payload.email,
    };
  } catch (_error) {
    return null;
  }
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function requireAuth(context) {
  if (!context || !context.user || !context.user.id) {
    throw new Error('Authentication required. Provide a valid Bearer token.');
  }

  return context.user;
}

function hasValidClientCredentials(clientId, clientSecret) {
  return clientId === API_CLIENT_ID && clientSecret === API_CLIENT_SECRET;
}

function assertClientCredentials(clientId, clientSecret) {
  if (!hasValidClientCredentials(clientId, clientSecret)) {
    throw new Error('Invalid API client credentials.');
  }
}

module.exports = {
  buildContextUser,
  signAccessToken,
  requireAuth,
  assertClientCredentials,
};

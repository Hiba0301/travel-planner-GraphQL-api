import { useMemo, useState } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/graphql';

const LOGIN_MUTATION = `
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    user {
      id
      name
      email
    }
  }
}
`;

const DASHBOARD_QUERY = `
query Dashboard {
  me {
    id
    name
    email
  }
  tripStats {
    totalTrips
    plannedTrips
    ongoingTrips
    completedTrips
    totalBudget
    averageBudget
  }
  myTrips(limit: 5, sortBy: CREATED_AT, sortOrder: desc) {
    id
    title
    status
    budget
    currency
  }
}
`;

const SEARCH_DESTINATIONS_QUERY = `
query SearchDestinations($keyword: String!, $country: String) {
  searchDestinations(keyword: $keyword, country: $country) {
    id
    name
    city
    country
  }
}
`;

const CREATE_TRIP_MUTATION = `
mutation CreateTrip(
  $title: String!
  $description: String
  $budget: Float!
  $currency: String
  $startDate: String!
  $endDate: String!
) {
  createTrip(
    title: $title
    description: $description
    budget: $budget
    currency: $currency
    startDate: $startDate
    endDate: $endDate
  ) {
    id
    title
    status
    budget
    currency
  }
}
`;

async function gqlRequest({ query, variables, token, clientId, clientSecret }) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  return payload.data;
}

function App() {
  const [clientId, setClientId] = useState('travel-client');
  const [clientSecret, setClientSecret] = useState('travel-secret');

  const [email, setEmail] = useState('leila.benali@example.com');
  const [password, setPassword] = useState('demo_password_1');
  const [token, setToken] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [me, setMe] = useState(null);
  const [stats, setStats] = useState(null);
  const [trips, setTrips] = useState([]);

  const [keyword, setKeyword] = useState('tok');
  const [country, setCountry] = useState('Japan');
  const [destinations, setDestinations] = useState([]);

  const [newTrip, setNewTrip] = useState({
    title: 'Mini trip from client',
    description: 'Created from React interface',
    budget: '1200',
    currency: 'EUR',
    startDate: '2026-05-12',
    endDate: '2026-05-15',
  });

  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await gqlRequest({
        query: LOGIN_MUTATION,
        variables: { email, password },
        clientId,
        clientSecret,
      });
      setToken(data.login.token);
      await refreshDashboard(data.login.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshDashboard(currentToken = token) {
    setLoading(true);
    setError('');

    try {
      const data = await gqlRequest({
        query: DASHBOARD_QUERY,
        token: currentToken,
        clientId,
        clientSecret,
      });
      setMe(data.me);
      setStats(data.tripStats);
      setTrips(data.myTrips);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function searchDestinations(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await gqlRequest({
        query: SEARCH_DESTINATIONS_QUERY,
        variables: {
          keyword,
          country: country || null,
        },
        token,
        clientId,
        clientSecret,
      });
      setDestinations(data.searchDestinations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTrip(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await gqlRequest({
        query: CREATE_TRIP_MUTATION,
        variables: {
          title: newTrip.title,
          description: newTrip.description || null,
          budget: Number(newTrip.budget),
          currency: newTrip.currency || null,
          startDate: newTrip.startDate,
          endDate: newTrip.endDate,
        },
        token,
        clientId,
        clientSecret,
      });
      await refreshDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="kicker">Travel Planner • Phase 2</p>
        <h1>Client React GraphQL</h1>
        <p className="lead">
          Interface cliente minimale pour tester la securite, les queries et les mutations de l'API.
        </p>
      </header>

      <section className="panel credentials">
        <h2>Client credentials (obligatoires)</h2>
        <div className="grid two">
          <label>
            Client ID
            <input value={clientId} onChange={(event) => setClientId(event.target.value)} />
          </label>
          <label>
            Client Secret
            <input value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="panel auth">
        <h2>Authentification utilisateur</h2>
        <form className="grid two" onSubmit={handleLogin}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button disabled={loading} type="submit">
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </section>

      {error ? <p className="error">{error}</p> : null}

      {isAuthenticated ? (
        <>
          <section className="panel">
            <div className="panel-header">
              <h2>Dashboard</h2>
              <button onClick={() => refreshDashboard()} disabled={loading} type="button">
                Rafraichir
              </button>
            </div>

            <p className="token-preview">Token: {token.slice(0, 24)}...</p>

            {me ? (
              <p className="identity">
                Connecte en tant que <strong>{me.name}</strong> ({me.email})
              </p>
            ) : null}

            {stats ? (
              <div className="stats-grid">
                <article>
                  <span>Total trips</span>
                  <strong>{stats.totalTrips}</strong>
                </article>
                <article>
                  <span>Planned</span>
                  <strong>{stats.plannedTrips}</strong>
                </article>
                <article>
                  <span>Ongoing</span>
                  <strong>{stats.ongoingTrips}</strong>
                </article>
                <article>
                  <span>Completed</span>
                  <strong>{stats.completedTrips}</strong>
                </article>
              </div>
            ) : null}

            <h3>Mes derniers trips</h3>
            <ul className="list">
              {trips.map((trip) => (
                <li key={trip.id}>
                  <span>{trip.title}</span>
                  <span>
                    {trip.status} • {trip.budget} {trip.currency}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Recherche destinations</h2>
            <form className="grid three" onSubmit={searchDestinations}>
              <label>
                Mot-cle
                <input value={keyword} onChange={(event) => setKeyword(event.target.value)} />
              </label>
              <label>
                Pays (optionnel)
                <input value={country} onChange={(event) => setCountry(event.target.value)} />
              </label>
              <button disabled={loading} type="submit">
                Rechercher
              </button>
            </form>

            <ul className="list">
              {destinations.map((destination) => (
                <li key={destination.id}>
                  <span>{destination.name}</span>
                  <span>
                    {destination.city}, {destination.country}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Creer un trip</h2>
            <form className="grid two" onSubmit={handleCreateTrip}>
              <label>
                Titre
                <input
                  value={newTrip.title}
                  onChange={(event) => setNewTrip((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label>
                Budget
                <input
                  type="number"
                  min="1"
                  value={newTrip.budget}
                  onChange={(event) => setNewTrip((prev) => ({ ...prev, budget: event.target.value }))}
                />
              </label>
              <label>
                Currency
                <input
                  value={newTrip.currency}
                  onChange={(event) => setNewTrip((prev) => ({ ...prev, currency: event.target.value }))}
                />
              </label>
              <label>
                Start date
                <input
                  type="date"
                  value={newTrip.startDate}
                  onChange={(event) => setNewTrip((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  value={newTrip.endDate}
                  onChange={(event) => setNewTrip((prev) => ({ ...prev, endDate: event.target.value }))}
                />
              </label>
              <label className="full">
                Description
                <textarea
                  rows="3"
                  value={newTrip.description}
                  onChange={(event) => setNewTrip((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>
              <button disabled={loading} type="submit">
                Creer le trip
              </button>
            </form>
          </section>
        </>
      ) : null}
    </main>
  );
}

export default App;

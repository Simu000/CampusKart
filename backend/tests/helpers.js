// tests/helpers.js — Test setup and zero-dependency supertest-compatible helper
const http = require('http');
const bcrypt = require('bcryptjs');
const app = require('../src/index');
const pool = require('../src/db/pool');
const { generateToken } = require('../src/middleware/auth');

let testServer = null;
let serverPort = null;

function ensureServer() {
  if (!testServer) {
    testServer = http.createServer(app);
    testServer.listen(0);
    testServer.unref();
    const addr = testServer.address();
    serverPort = addr.port;
  }
  return { testServer, serverPort };
}

function request(appInstance) {
  const methods = ['get', 'post', 'put', 'delete', 'patch'];
  const runnerObj = {};

  methods.forEach(method => {
    runnerObj[method] = function (path) {
      const headers = {};
      let bodyData = null;
      let queryStr = '';

      const chain = {
        set(keyOrObj, val) {
          if (typeof keyOrObj === 'object') {
            Object.assign(headers, keyOrObj);
          } else {
            headers[keyOrObj.toLowerCase()] = val;
          }
          return chain;
        },
        send(data) {
          bodyData = data;
          if (typeof data === 'object' && !headers['content-type']) {
            headers['content-type'] = 'application/json';
          }
          return chain;
        },
        query(q) {
          const params = new URLSearchParams(q);
          queryStr = '?' + params.toString();
          return chain;
        },
        then(resolve, reject) {
          return execute().then(resolve, reject);
        },
        catch(reject) {
          return execute().catch(reject);
        },
      };

      async function execute() {
        const { serverPort: port } = ensureServer();
        const url = `http://127.0.0.1:${port}${path}${queryStr}`;

        const fetchOptions = {
          method: method.toUpperCase(),
          headers,
        };

        if (bodyData !== null && bodyData !== undefined) {
          fetchOptions.body =
            typeof bodyData === 'object' ? JSON.stringify(bodyData) : String(bodyData);
        }

        const res = await fetch(url, fetchOptions);
        const text = await res.text();

        let json = null;
        try {
          json = JSON.parse(text);
        } catch (_) {}

        const resHeaders = {};
        res.headers.forEach((v, k) => {
          resHeaders[k] = v;
        });

        return {
          status: res.status,
          statusCode: res.status,
          headers: resHeaders,
          body: json !== null ? json : text,
          text,
        };
      }

      return chain;
    };
  });

  return runnerObj;
}

async function createTestUser({
  email = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}@chitkara.edu.in`,
  fullName = 'Test Student',
  password = 'Password123!',
  role = 'USER',
  verified = true,
} = {}) {
  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, verified, status)
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
     RETURNING *`,
    [fullName, email, hash, role, verified]
  );
  const user = result.rows[0];
  const token = generateToken(user.id);
  return { user, token, rawPassword: password };
}

async function cleanupUser(userId) {
  try {
    await pool.query('DELETE FROM item_requests WHERE buyer_id = $1 OR seller_id = $1', [userId]);
    await pool.query('DELETE FROM listings WHERE seller_id = $1', [userId]);
    await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  } catch (_) {}
}

process.on('beforeExit', async () => {
  if (testServer) {
    try {
      testServer.close();
    } catch (_) {}
  }
  try {
    await pool.end();
  } catch (_) {}
});

module.exports = {
  app,
  pool,
  request,
  createTestUser,
  cleanupUser,
};

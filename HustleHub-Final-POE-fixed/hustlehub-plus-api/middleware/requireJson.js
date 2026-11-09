// middleware/requireJson.js
// Write requests must declare Content-Type: application/json. Anything else
// is rejected with 415 rather than being parsed in an unexpected way.

const requireJson = (req, res, next) => {
  const hasBody = Number(req.headers['content-length']) > 0 || req.headers['transfer-encoding'];
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && hasBody && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  next();
};

module.exports = requireJson;

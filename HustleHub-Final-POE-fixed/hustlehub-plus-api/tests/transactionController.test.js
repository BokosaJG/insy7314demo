jest.mock('../models/Transaction', () => ({ find: jest.fn(), aggregate: jest.fn() }));
jest.mock('../models/Booking', () => ({ find: jest.fn() }));

const Transaction = require('../models/Transaction');
const { getTransactions, getMyIncome } = require('../controllers/transactionController');

const ID = '64b7f0f0f0f0f0f0f0f0f0f0';
const call = async (fn, user) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const next = jest.fn();
  await fn({ user }, res, next);
  return { res, next };
};
const sorted = (rows) => ({ sort: jest.fn().mockResolvedValue(rows) });

beforeEach(() => jest.clearAllMocks());

describe('getTransactions - data is scoped by role', () => {
  test.each([
    ['Client', { client: ID }],
    ['Freelancer', { freelancer: ID }],
    ['Admin', {}],
  ])('%s sees filter %j', async (role, filter) => {
    Transaction.find.mockReturnValue(sorted([{ amount: 1 }]));
    const { res } = await call(getTransactions, { id: ID, role });
    expect(Transaction.find).toHaveBeenCalledWith(filter);
    expect(res.body.data).toEqual([{ amount: 1 }]);
  });

  test('errors are forwarded to the error handler', async () => {
    Transaction.find.mockImplementation(() => { throw new Error('x'); });
    expect((await call(getTransactions, { id: ID, role: 'Client' })).next).toHaveBeenCalled();
  });
});

describe('getMyIncome', () => {
  test('returns the aggregate for the freelancer, matching only their id', async () => {
    Transaction.aggregate.mockResolvedValue([{ totalIncome: 750, transactionCount: 3 }]);
    const { res } = await call(getMyIncome, { id: ID, role: 'Freelancer' });
    expect(String(Transaction.aggregate.mock.calls[0][0][0].$match.freelancer)).toBe(ID);
    expect(res.body.data).toEqual({ totalIncome: 750, transactionCount: 3 });
  });

  test('no transactions -> zeros', async () => {
    Transaction.aggregate.mockResolvedValue([]);
    expect((await call(getMyIncome, { id: ID, role: 'Freelancer' })).res.body.data).toEqual({ totalIncome: 0, transactionCount: 0 });
  });
});

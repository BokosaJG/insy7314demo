// routes/gigRoutes.js
// Every route needs a valid JWT; write actions also need the right role.
// Ownership (a freelancer touching only their own gigs) is enforced in the controller.

const express = require('express');
const router = express.Router();

const { createGig, getAllGigs, getMyGigs, getGigById, updateGig, deleteGig } = require('../controllers/gigController');
const { authenticateToken, requireRole } = require('../middleware/authenticateToken');
const { createGigRules, updateGigRules, gigIdRules } = require('../validators/gigValidators');
const validate = require('../middleware/validate');

router.use(authenticateToken);

router.get('/', getAllGigs);
// "/mine" must be declared before "/:id" or it would be read as an id.
router.get('/mine', requireRole('Freelancer'), getMyGigs);
router.get('/:id', gigIdRules, validate, getGigById);

router.post('/', requireRole('Freelancer'), createGigRules, validate, createGig);
router.put('/:id', requireRole('Freelancer'), updateGigRules, validate, updateGig);
router.delete('/:id', requireRole('Freelancer', 'Admin'), gigIdRules, validate, deleteGig);

module.exports = router;

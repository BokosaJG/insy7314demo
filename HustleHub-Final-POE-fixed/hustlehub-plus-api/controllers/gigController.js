// controllers/gigController.js
// Gig management. Freelancers can only update or delete gigs they own;
// the ownership check compares the gig's freelancer id with the id
// inside the verified JWT (req.user.id).

const Gig = require('../models/Gig');
const { audit } = require('../utils/audit');
const { logEvent } = require('../config/logger');

const isOwner = (gig, userId) => gig.freelancer.toString() === userId;

const createGig = async (req, res, next) => {
  try {
    const { title, description, price } = req.body;
    // The owner always comes from the token, never from the request body.
    const gig = await Gig.create({ title, description, price, freelancer: req.user.id });
    await audit(req, 'gig.created', { gigId: gig.id, price: gig.price });
    return res.status(201).json({ message: 'Gig created successfully', data: gig });
  } catch (err) {
    next(err);
  }
};

// Browse all gigs (any authenticated user).
const getAllGigs = async (req, res, next) => {
  try {
    const gigs = await Gig.find().populate('freelancer', 'name').sort({ createdAt: -1 });
    return res.status(200).json({ data: gigs });
  } catch (err) {
    next(err);
  }
};

// A freelancer's own gigs only.
const getMyGigs = async (req, res, next) => {
  try {
    const gigs = await Gig.find({ freelancer: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ data: gigs });
  } catch (err) {
    next(err);
  }
};

const getGigById = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id).populate('freelancer', 'name');
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }
    return res.status(200).json({ data: gig });
  } catch (err) {
    next(err);
  }
};

const updateGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    // Ownership check: 403 Forbidden because the user is authenticated
    // but not allowed to touch this resource.
    if (!isOwner(gig, req.user.id)) {
      logEvent('authz.denied', { requestId: req.id, userId: req.user.id, role: req.user.role, resource: 'gig', resourceId: gig.id, action: 'update', ip: req.ip }, 'warn');
      return res.status(403).json({ error: 'You can only modify your own gigs' });
    }

    gig.title = req.body.title;
    gig.description = req.body.description;
    gig.price = req.body.price;
    await gig.save();
    await audit(req, 'gig.updated', { gigId: gig.id });

    return res.status(200).json({ message: 'Gig updated successfully', data: gig });
  } catch (err) {
    next(err);
  }
};

const deleteGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    // Owner can delete; an Admin may also remove a gig (moderation).
    if (!isOwner(gig, req.user.id) && req.user.role !== 'Admin') {
      logEvent('authz.denied', { requestId: req.id, userId: req.user.id, role: req.user.role, resource: 'gig', resourceId: gig.id, action: 'delete', ip: req.ip }, 'warn');
      return res.status(403).json({ error: 'You can only delete your own gigs' });
    }

    await gig.deleteOne();
    await audit(req, 'gig.deleted', { gigId: req.params.id, byAdmin: !isOwner(gig, req.user.id) });
    return res.status(200).json({ message: 'Gig deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createGig, getAllGigs, getMyGigs, getGigById, updateGig, deleteGig };

const Enquiry = require('../models/Enquiry');

// @desc    Fetch all price enquiries
// @route   GET /api/enquiries
// @access  Private/Admin
const getEnquiries = async (req, res) => {
  try {
    const enquiries = await Enquiry.find({})
      .sort({ createdAt: -1 })
      .select('name phone product createdAt')
      .lean();

    return res.json(enquiries);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch enquiries', error: error.message });
  }
};

module.exports = {
  getEnquiries,
};

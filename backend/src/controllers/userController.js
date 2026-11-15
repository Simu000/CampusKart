const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const userRepository = require('../repositories/userRepository');
const listingRepository = require('../repositories/listingRepository');
const { toUserSummaryDto, toPublicProfileDto } = require('../dtos/userDto');
const { toListingDto } = require('../dtos/listingDto');
const { NotFoundError, BadRequestError } = require('../middleware/errors');

const uploadsDir = path.resolve(process.env.UPLOADS_DIR || 'uploads', 'profiles');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const uploadProfilePhoto = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new BadRequestError('Invalid image format. Allowed: JPG, PNG, WEBP'));
  },
}).single('photo');

async function getMe(req, res, next) {
  try {
    const user = await userRepository.findById(req.userId);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: toUserSummaryDto(user) });
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  // Wrap multer inside controller to handle both JSON and multipart
  uploadProfilePhoto(req, res, async (uploadErr) => {
    if (uploadErr) return next(uploadErr);
    try {
      const { fullName, department, course, studyYear } = req.body;

      let profileImageUrl = null;
      if (req.file) {
        profileImageUrl = `/uploads/profiles/${req.file.filename}`;
      }

      const updated = await userRepository.updateProfile(req.userId, {
        fullName: fullName ? fullName.trim() : null,
        department: department ? department.trim() : null,
        course: course ? course.trim() : null,
        studyYear: studyYear ? studyYear.trim() : null,
        profileImageUrl,
      });

      if (!updated) throw new NotFoundError('User not found');

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: toUserSummaryDto(updated),
      });
    } catch (err) {
      next(err);
    }
  });
}

async function getPublicProfile(req, res, next) {
  try {
    const user = await userRepository.findById(req.params.id);
    if (!user || user.status === 'SUSPENDED') throw new NotFoundError('Student profile not found');

    const listingRows = await listingRepository.findBySeller(user.id);
    const activeRows = listingRows.filter(l => l.status === 'AVAILABLE');
    const activeListings = await Promise.all(activeRows.map(toListingDto));

    res.json({
      success: true,
      data: toPublicProfileDto(user, activeListings),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, updateMe, getPublicProfile };

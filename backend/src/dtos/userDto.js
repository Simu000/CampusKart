// dtos/userDto.js — Safe user DTO mappings (never expose password_hash or private fields)

function toUserSummaryDto(user) {
  if (!user) return null;
  return {
    id: Number(user.id),
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    verified: Boolean(user.verified),
    status: user.status,
    department: user.department || null,
    course: user.course || null,
    studyYear: user.study_year || null,
    profileImageUrl: user.profile_image_url || null,
    createdAt: user.created_at,
  };
}

function toPublicProfileDto(user, activeListings = []) {
  if (!user) return null;
  return {
    id: Number(user.id),
    fullName: user.full_name,
    department: user.department || null,
    course: user.course || null,
    studyYear: user.study_year || null,
    verified: Boolean(user.verified),
    profileImageUrl: user.profile_image_url || null,
    joinedAt: user.created_at,
    activeListingsCount: activeListings.length,
    activeListings,
  };
}

function toAdminUserDto(user) {
  if (!user) return null;
  return {
    id: Number(user.id),
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    verified: Boolean(user.verified),
    status: user.status,
    department: user.department || null,
    course: user.course || null,
    studyYear: user.study_year || null,
    profileImageUrl: user.profile_image_url || null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

module.exports = { toUserSummaryDto, toPublicProfileDto, toAdminUserDto };

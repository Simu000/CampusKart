// dtos/listingDto.js — Listing DTO mapping helper
const listingRepository = require('../repositories/listingRepository');

async function toListingDto(listing) {
  if (!listing) return null;
  const images = await listingRepository.findImages(listing.id);
  const imageUrls = images.map(i => i.image_url);
  const primaryRow = images.find(i => i.is_primary);
  const primaryImageUrl = primaryRow
    ? primaryRow.image_url
    : imageUrls.length > 0
      ? imageUrls[0]
      : (listing.image_url || null);

  const pendingCount = await listingRepository.countPendingRequests(listing.id);

  return {
    id: Number(listing.id),
    sellerId: Number(listing.seller_id),
    sellerName: listing.seller_name || 'Unknown Student',
    categoryId: Number(listing.category_id),
    categoryName: listing.category_name || '',
    title: listing.title,
    description: listing.description,
    itemCondition: listing.item_condition,
    transactionType: listing.transaction_type,
    qtyTotal: listing.qty_total,
    qtyAvailable: listing.qty_available,
    qtyReserved: listing.qty_reserved,
    price: parseFloat(listing.price),
    priceBasis: listing.price_basis,
    imageUrl: primaryImageUrl,
    images: imageUrls.length > 0 ? imageUrls : (listing.image_url ? [listing.image_url] : []),
    status: listing.status,
    pendingRequestCount: pendingCount,
    createdAt: listing.created_at,
    updatedAt: listing.updated_at,
  };
}

function toReportDto(report) {
  if (!report) return null;
  return {
    id: Number(report.id),
    reporterId: Number(report.reporter_id),
    reporterName: report.reporter_name || null,
    reportedUserId: report.reported_user_id ? Number(report.reported_user_id) : null,
    reportedUserName: report.reported_user_name || null,
    listingId: report.listing_id ? Number(report.listing_id) : null,
    listingTitle: report.listing_title || null,
    reason: report.reason,
    description: report.description || null,
    status: report.status,
    adminNotes: report.admin_notes || null,
    reviewedBy: report.reviewed_by ? Number(report.reviewed_by) : null,
    reviewedByName: report.reviewed_by_name || null,
    reviewedAt: report.reviewed_at || null,
    createdAt: report.created_at,
  };
}

module.exports = { toListingDto, toReportDto };

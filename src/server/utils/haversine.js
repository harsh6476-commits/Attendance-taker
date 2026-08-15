/**
 * Haversine formula and location confidence evaluation
 */

function toRad(x) {
  return (x * Math.PI) / 180;
}

/**
 * Calculates distance between two points in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes average center point and sample spread from 5 GPS samples
 * @param {Array<{latitude: number, longitude: number, accuracy: number}>} samples 
 */
function computeLocationCenter(samples) {
  if (!samples || samples.length === 0) return null;

  let sumLat = 0;
  let sumLon = 0;
  let sumAccuracy = 0;

  samples.forEach(s => {
    sumLat += s.latitude;
    sumLon += s.longitude;
    sumAccuracy += s.accuracy || 10;
  });

  const avgLat = sumLat / samples.length;
  const avgLon = sumLon / samples.length;
  const avgAccuracy = sumAccuracy / samples.length;

  let maxDistance = 0;
  samples.forEach(s => {
    const d = calculateDistance(avgLat, avgLon, s.latitude, s.longitude);
    if (d > maxDistance) maxDistance = d;
  });

  return {
    latitude: avgLat,
    longitude: avgLon,
    accuracy: avgAccuracy,
    sampleSpreadMeters: maxDistance
  };
}

/**
 * Evaluates location confidence for attendance submission
 * @param {number} studentLat 
 * @param {number} studentLon 
 * @param {number} accuracy 
 * @param {object} classroomGeofence { latitude, longitude, radiusMeters, sampleSpreadMeters }
 */
function evaluateLocationConfidence(studentLat, studentLon, accuracy, classroomGeofence) {
  if (!classroomGeofence || typeof classroomGeofence.latitude !== 'number') {
    return { confidence: 'none', score: 0, distanceMeters: null, reason: 'Geofence not configured for classroom' };
  }

  const distance = calculateDistance(
    studentLat,
    studentLon,
    classroomGeofence.latitude,
    classroomGeofence.longitude
  );

  const allowedRadius = (classroomGeofence.radiusMeters || 30) + (accuracy || 15) + (classroomGeofence.sampleSpreadMeters || 5);

  if (distance <= allowedRadius) {
    return {
      confidence: 'high',
      score: 100,
      distanceMeters: Math.round(distance),
      reason: `Location within verified classroom radius (${Math.round(distance)}m <= ${Math.round(allowedRadius)}m)`
    };
  } else if (distance <= allowedRadius * 2) {
    return {
      confidence: 'medium',
      score: 60,
      distanceMeters: Math.round(distance),
      reason: `Location near classroom boundary (${Math.round(distance)}m > ${Math.round(allowedRadius)}m)`
    };
  } else {
    return {
      confidence: 'low',
      score: 20,
      distanceMeters: Math.round(distance),
      reason: `Location outside expected classroom zone (${Math.round(distance)}m > ${Math.round(allowedRadius)}m)`
    };
  }
}

module.exports = {
  calculateDistance,
  computeLocationCenter,
  evaluateLocationConfidence
};

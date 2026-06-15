export function publicSchoolTitle(school = {}) {
  const place = school.spot || school.city;
  return place ? `Stage de kitesurf à ${place}` : 'Stage de kitesurf Spotykite';
}

export function publicSchoolLocation(school = {}) {
  return [school.city, school.region].filter(Boolean).join(' · ');
}

export function publicSchoolMapLabel(school = {}) {
  const place = school.spot || school.city || 'Spot Spotykite';
  const location = publicSchoolLocation(school);
  return location ? `${place} · ${location}` : place;
}

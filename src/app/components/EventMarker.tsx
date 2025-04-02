import L from 'leaflet';

export const createEventMarkerIcon = (year: number, isSelected = false) => {
	const color = isSelected ? '#B45309' : '#D97706';

	const svgString = `
<svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
	<path d="M20 0C8.954 0 0 8.954 0 20c0 11.046 20 28 20 28s20-16.954 20-28c0-11.046-8.954-20-20-20z" fill="${color}"/>
	<text x="50%" y="45%" font-size="10" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="serif">${year}</text>
</svg>`;

	return L.divIcon({
		html: svgString,
		className: 'custom-marker',
		iconSize: [40, 48],
		iconAnchor: [20, 48],
		popupAnchor: [0, -48],
	});
};

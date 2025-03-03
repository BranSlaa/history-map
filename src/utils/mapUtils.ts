import { Event } from '@/types/event';
import L from 'leaflet';

export interface MapIcons {
    defaultIcon: L.Icon;
    selectedIcon: L.Icon;
    interactedIcon: L.Icon;
}

export const createMapIcons = (): MapIcons => {
    const defaultIcon = new L.Icon({
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        shadowSize: [41, 41],
    });

    const selectedIcon = new L.Icon({
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconSize: [35, 57],
        iconAnchor: [17, 57],
        popupAnchor: [1, -34],
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        shadowSize: [41, 41],
        className: 'selected-marker',
    });

    const interactedIcon = new L.Icon({
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        shadowSize: [41, 41],
        className: 'interacted-marker',
    });

    return { defaultIcon, selectedIcon, interactedIcon };
};

export const addMapMarkerStyles = (): void => {
    const style = document.createElement('style');
    style.innerHTML = `
        .interacted-marker {
            filter: hue-rotate(100deg) brightness(1.1);
        }
        .selected-marker {
            filter: brightness(1.3);
            z-index: 1000 !important;
        }
    `;
    document.head.appendChild(style);
};

export const getEventMarkerIcon = (
    event: Event,
    selectedEventId: string | null,
    interactedEventIds: Set<string>,
    icons: MapIcons
): L.Icon => {
    if (selectedEventId === event.id) {
        return icons.selectedIcon;
    }
    if (interactedEventIds.has(event.id)) {
        return icons.interactedIcon;
    }
    return icons.defaultIcon;
}; 
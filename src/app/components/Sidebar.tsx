import React, { useState, useEffect } from 'react';
import EventPanel from './EventPanel';
import InformationPanel from './InformationPanel';
import { Event } from '@/types/event';
interface SidebarProps {
	className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [headerHeight, setHeaderHeight] = useState<number>(0);
	useEffect(() => {
		setHeaderHeight(document.querySelector('header')?.clientHeight || 0);
	}, []);
	return (
		<div
			className={`relative overflow-hidden m-h-[calc(50vh-${headerHeight}px)] ${className}`}
		>
			<div className="flex-1 overflow-auto p-4 h-full">
				<EventPanel onSelectEvent={event => setSelectedEvent(event)} />
				<InformationPanel event={selectedEvent} />
			</div>
		</div>
	);
};

export default Sidebar;

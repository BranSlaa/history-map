import React, { useState, useEffect } from 'react';
import EventPanel from './EventPanel';
import InformationPanel from './InformationPanel';
import { Event } from '@/types/event';

interface SidebarProps {
	className?: string;
	selectedEvent?: Event | null;
	onEventSelect?: (event: Event) => void;
	onSearch?: (query: string) => Promise<Event[]>;
}

const Sidebar: React.FC<SidebarProps> = ({
	className = '',
	selectedEvent = null,
	onEventSelect = () => {},
	onSearch = async () => [],
}) => {
	return (
		<div
			className={`grid grid-rows-[1fr,1fr] h-full overflow-hidden ${className}`}
		>
			<EventPanel onSelectEvent={onEventSelect} onSearch={onSearch} />
			<InformationPanel event={selectedEvent} />
		</div>
	);
};

export default Sidebar;

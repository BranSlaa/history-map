import React from 'react';
import { Event } from '@/types/event';

interface InformationPanelProps {
	event: Event | null;
}

const InformationPanel: React.FC<InformationPanelProps> = ({ event }) => {
	if (!event) {
		return <div className="information-panel">No event selected</div>;
	}

	return (
		<div className="information-panel">
			<h2 className="title">{event.title}</h2>
			<div className="tag-line">
				<span className="year">
					<strong>Year:</strong> {event.year}
				</span>
				<span className="subject">
					<strong>Subject:</strong> {event.subject}
				</span>
			</div>
			<p className="description">
				<strong>Description:</strong> {event.info}
			</p>
		</div>
	);
};

export default InformationPanel;

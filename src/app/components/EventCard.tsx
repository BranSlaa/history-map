'use client';

import React, { useState } from 'react';
import {
	useThemeStyles,
	mergeStyles,
	getComponentStyle,
} from '@/utils/styleUtils';

interface EventCardProps {
	title: string;
	year: number;
	description: string;
	tags: string[];
	onClick?: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({
	title,
	year,
	description,
	tags,
	onClick,
}) => {
	const [isHovered, setIsHovered] = useState(false);
	const { theme, componentStyles } = useThemeStyles(false); // Default to light theme

	// Get component styles
	const containerStyle = getComponentStyle(
		componentStyles,
		'eventPanel',
		'eventListItem',
	);
	const titleStyle = getComponentStyle(
		componentStyles,
		'informationPanel',
		'title',
	);
	const yearStyle = getComponentStyle(
		componentStyles,
		'informationPanel',
		'year',
	);
	const descriptionStyle = getComponentStyle(
		componentStyles,
		'informationPanel',
		'description',
	);
	const tagLineStyle = getComponentStyle(
		componentStyles,
		'informationPanel',
		'tagLine',
	);
	const tagStyle = getComponentStyle(
		componentStyles,
		'informationPanel',
		'tag',
	);

	// Apply hover state style
	const hoverStyle = isHovered
		? getComponentStyle(componentStyles, 'eventPanel', 'eventListItemHover')
		: {};

	// Custom card style
	const cardStyle: React.CSSProperties = {
		border: `1px solid ${theme.colors.gray[300]}`,
		borderRadius: theme.borderRadius.md,
		padding: theme.spacing.md,
		backgroundColor: theme.colors.background,
		boxShadow: isHovered ? theme.shadows.md : theme.shadows.sm,
		transition: 'box-shadow 0.2s ease, transform 0.2s ease',
		cursor: onClick ? 'pointer' : 'default',
		transform: isHovered ? 'translateY(-2px)' : 'none',
		overflow: 'hidden',
		maxWidth: '100%',
	};

	// Truncate long description
	const truncatedDescription =
		description.length > 120
			? `${description.substring(0, 120)}...`
			: description;

	return (
		<div
			style={mergeStyles(containerStyle, cardStyle, hoverStyle)}
			onClick={onClick}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			role={onClick ? 'button' : 'article'}
			tabIndex={onClick ? 0 : undefined}
		>
			<h3 style={titleStyle}>{title}</h3>
			<p style={yearStyle}>{year}</p>
			<p style={descriptionStyle}>{truncatedDescription}</p>

			{tags.length > 0 && (
				<div style={tagLineStyle}>
					{tags.map((tag, index) => (
						<span key={index} style={tagStyle}>
							{tag}
						</span>
					))}
				</div>
			)}
		</div>
	);
};

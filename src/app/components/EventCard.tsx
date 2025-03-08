'use client';

import React, { useState } from 'react';
import { classNames } from '@/utils/styleUtils';

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

	// Truncate long description
	const truncatedDescription =
		description.length > 120
			? `${description.substring(0, 120)}...`
			: description;

	return (
		<div
			className={classNames(
				'border border-stone-300 dark:border-stone-700 rounded-lg p-4 bg-white dark:bg-stone-800 transition-all duration-200 overflow-hidden max-w-full',
				isHovered ? 'shadow-md -translate-y-0.5' : 'shadow-sm',
				onClick ? 'cursor-pointer' : 'cursor-default',
			)}
			onClick={onClick}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			role={onClick ? 'button' : 'article'}
			tabIndex={onClick ? 0 : undefined}
		>
			<h3 className="text-lg font-semibold text-stone-800 dark:text-amber-100 mb-1">
				{title}
			</h3>
			<p className="text-sm bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 px-2 py-0.5 rounded-full inline-block mb-2">
				{year}
			</p>
			<p className="text-stone-600 dark:text-stone-300 text-sm mb-3">
				{truncatedDescription}
			</p>

			{tags.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{tags.map((tag, index) => (
						<span
							key={index}
							className="text-xs bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-full"
						>
							{tag}
						</span>
					))}
				</div>
			)}
		</div>
	);
};

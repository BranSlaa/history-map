import React, { useState, useEffect, useCallback } from 'react';
import { Event } from '@/types/event';

const SubjectFilterBar: React.FC<{
	events: Event[];
	onFilterChange: (selectedSubject: string | null) => void;
}> = ({ events, onFilterChange }) => {
	const [showDropdown, setShowDropdown] = useState(false);
	const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

	// Extract unique subjects from events
	const uniqueSubjects = Array.from(
		new Set(events.map(event => event.subject)),
	)
		.filter(Boolean)
		.sort();

	const handleSelectChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			const value = e.target.value;
			setSelectedSubject(value === 'all' ? null : value);
		},
		[],
	);

	useEffect(() => {
		onFilterChange(selectedSubject);
	}, [selectedSubject, onFilterChange]);

	return (
		<div
			className={`bg-amber-50 dark:bg-stone-900 border-2 border-amber-700 dark:border-amber-800 rounded-lg shadow-md flex gap-3 p-3 justify-between items-center z-10 transition-transform duration-300 ease-in-out ${
				!showDropdown ? 'translate-x-[calc(100%-5rem)]' : ''
			} md:transform-none md:justify-center md:w-auto md:mx-auto`}
		>
			<button
				className="md:hidden h-10 w-10 rounded-full bg-amber-700 dark:bg-amber-800 text-white flex items-center justify-center"
				onClick={() => setShowDropdown(!showDropdown)}
			>
				<span>{showDropdown ? '×' : '⋯'}</span>
			</button>
			<div className="flex gap-3">
				<label className="flex gap-2 items-center whitespace-nowrap text-sm text-stone-800 dark:text-amber-100">
					Filter by Subject:
				</label>
				<select
					value={selectedSubject || 'all'}
					onChange={handleSelectChange}
					className="bg-amber-50 dark:bg-stone-800 border border-amber-700 dark:border-amber-600 text-stone-800 dark:text-amber-100 rounded p-1"
				>
					<option value="all">All Subjects</option>
					{uniqueSubjects.map(subject => (
						<option key={subject} value={subject}>
							{subject}
						</option>
					))}
				</select>
			</div>
		</div>
	);
};

export default SubjectFilterBar;

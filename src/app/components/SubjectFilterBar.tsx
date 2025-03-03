import React, { useState, useEffect, useCallback } from 'react';
import { Event } from '@/types/event';

const SubjectFilterBar: React.FC<{
	events: Event[];
	onFilterChange: (selectedSubject: string | null) => void;
}> = ({ events, onFilterChange }) => {
	const [showDropdown, setShowDropdown] = useState(true); // Always show on mobile initially
	const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

	// Debug
	useEffect(() => {
		console.log('SubjectFilterBar received events:', events?.length || 0);
		console.log(
			'Events with subjects:',
			events?.filter(e => e?.subject)?.length || 0,
		);
	}, [events]);

	// Extract unique subjects from events - handle null/undefined events gracefully
	const uniqueSubjects = Array.from(
		new Set(
			(events || [])
				.filter(event => event && event.subject)
				.map(event => event.subject),
		),
	)
		.filter(Boolean)
		.sort();

	// Debug
	useEffect(() => {
		console.log('Unique subjects found:', uniqueSubjects);
	}, [uniqueSubjects]);

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

	// Don't render if there are no valid subjects
	if (!events?.length || uniqueSubjects.length === 0) {
		return null;
	}

	return (
		<div className="bg-amber-50 dark:bg-stone-900 border-2 border-amber-700 dark:border-amber-800 rounded-lg shadow-md p-3 z-10 w-auto flex items-end">
			<button
				className="h-8 w-8 rounded-full bg-amber-700 dark:bg-amber-800 text-white flex items-center justify-center"
				onClick={() => setShowDropdown(!showDropdown)}
			>
				<span>{showDropdown ? 'x' : '+'}</span>
			</button>
			{showDropdown && (
				<div className="flex flex-col gap-2 ml-2">
					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium text-stone-800 dark:text-amber-100">
							Filter by Subject
						</label>
						<select
							value={selectedSubject || 'all'}
							onChange={handleSelectChange}
							className="w-full bg-amber-50 dark:bg-stone-800 border border-amber-700 dark:border-amber-600 text-stone-800 dark:text-amber-100 rounded p-2"
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
			)}
		</div>
	);
};

export default SubjectFilterBar;

import React, { useState, useEffect, useCallback } from 'react';

const SubjectFilterBar: React.FC<{
	subjects: string[];
	onFilterChange: (selectedSubject: string | null) => void;
}> = ({ subjects, onFilterChange }) => {
	const [showDropdown, setShowDropdown] = useState(true); // Always show on mobile initially
	const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

	// Debug - only log in development, not in production
	useEffect(() => {
		console.log(
			'SubjectFilterBar received subjects:',
			subjects?.length || 0,
		);
	}, [subjects]);

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
	if (subjects.length === 0) {
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
							{subjects.map(subject => (
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

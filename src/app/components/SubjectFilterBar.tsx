import React, { useState, useEffect } from 'react';

const SubjectFilterBar: React.FC<{
	onFilterChange: (selectedSubjects: string[]) => void;
}> = ({ onFilterChange }) => {
	const [showSubjects, setShowSubjects] = useState(false);
	const [selectedSubjects, setSelectedSubjects] = useState<string[]>([
		'significant-events',
		'great-people',
		'important-places',
		'scientific-discoveries',
		'works-of-art',
		'military-conflicts',
	]);

	const handleCheckboxChange = (subject: string) => {
		setSelectedSubjects(prev =>
			prev.includes(subject)
				? prev.filter(s => s !== subject)
				: [...prev, subject]
		);
	};

	useEffect(() => {
		onFilterChange(selectedSubjects);
	}, [selectedSubjects, onFilterChange]);

	return (
		<div
			className={`subject-filter-bar ${
				showSubjects ? 'visible' : 'hidden'
			}`}
		>
			<button
				className="toggle-button"
				onClick={() => setShowSubjects(!showSubjects)}
			>
				<span className="toggle-button-text">
					{showSubjects ? 'Hide' : 'Show'}
				</span>
			</button>
			<div className="subject-filter-bar-content">
				<label>
					<input
						type="checkbox"
						name="significant-events"
						checked={selectedSubjects.includes(
							'significant-events'
						)}
						onChange={() =>
							handleCheckboxChange('significant-events')
						}
					/>
					Events
				</label>
				<label>
					<input
						type="checkbox"
						name="great-people"
						checked={selectedSubjects.includes('great-people')}
						onChange={() => handleCheckboxChange('great-people')}
					/>
					People
				</label>
				<label>
					<input
						type="checkbox"
						name="important-places"
						checked={selectedSubjects.includes('important-places')}
						onChange={() =>
							handleCheckboxChange('important-places')
						}
					/>
					Places
				</label>
				<label>
					<input
						type="checkbox"
						name="scientific-discoveries"
						checked={selectedSubjects.includes(
							'scientific-discoveries'
						)}
						onChange={() =>
							handleCheckboxChange('scientific-discoveries')
						}
					/>
					Scientific Discoveries
				</label>
				<label>
					<input
						type="checkbox"
						name="works-of-art"
						checked={selectedSubjects.includes('works-of-art')}
						onChange={() => handleCheckboxChange('works-of-art')}
					/>
					Works of Art
				</label>
				<label>
					<input
						type="checkbox"
						name="military-conflicts"
						checked={selectedSubjects.includes(
							'military-conflicts'
						)}
						onChange={() =>
							handleCheckboxChange('military-conflicts')
						}
					/>
					Military Conflicts
				</label>
			</div>
		</div>
	);
};

export default SubjectFilterBar;

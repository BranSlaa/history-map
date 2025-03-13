import React, { useState } from 'react';

interface EventSearchProps {
	onSearch: (query: string) => Promise<void>;
	isSearching: boolean;
}

const EventSearch: React.FC<EventSearchProps> = ({ onSearch, isSearching }) => {
	const [searchTerm, setSearchTerm] = useState<string>('');

	const handleSearchSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!searchTerm.trim()) return;
		await onSearch(searchTerm);
	};

	return (
		<form
			onSubmit={handleSearchSubmit}
			className="p-4 border-b border-amber-700/30"
		>
			<div className="relative">
				<input
					type="text"
					value={searchTerm}
					onChange={e => setSearchTerm(e.target.value)}
					placeholder="Search for a topic to discover historical events"
					className="w-full p-2 pl-8 border border-amber-700/30 focus:border-amber-600 bg-transparent rounded-lg text-stone-800 dark:text-amber-100 placeholder-stone-400 dark:placeholder-amber-300/50"
					disabled={isSearching}
				/>
			</div>
		</form>
	);
};

export default EventSearch;

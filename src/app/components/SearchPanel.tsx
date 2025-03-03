'use client';

import React, { useState, useEffect } from 'react';
import {
	useThemeStyles,
	mergeStyles,
	getComponentStyle,
} from '@/utils/styleUtils';
import { StyledButton } from './StyledButton';

interface SearchPanelProps {
	onSearch: (query: string) => void;
	isVisible: boolean;
	onClose: () => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
	onSearch,
	isVisible,
	onClose,
}) => {
	const [query, setQuery] = useState('');
	const [isSmallScreen, setIsSmallScreen] = useState(false);
	const [popularTerms, setPopularTerms] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const { theme, componentStyles, mediaQueryStyles } = useThemeStyles(false);

	// Get component styles
	const containerBaseStyle = getComponentStyle(
		componentStyles,
		'searchContainer',
		'container',
	);
	const hiddenStyle = !isVisible
		? getComponentStyle(componentStyles, 'searchContainer', 'hidden')
		: {};
	const labelStyle = getComponentStyle(
		componentStyles,
		'searchContainer',
		'label',
	);

	// Fetch popular search terms
	useEffect(() => {
		if (isVisible) {
			fetchPopularSearchTerms();
		}
	}, [isVisible]);

	const fetchPopularSearchTerms = async () => {
		try {
			setIsLoading(true);
			const API_URL =
				process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
			const response = await fetch(
				`${API_URL}/popular_search_terms?limit=5`,
			);

			if (!response.ok) {
				throw new Error(
					`Failed to fetch popular terms: ${response.status}`,
				);
			}

			const data = await response.json();
			setPopularTerms(data.map((item: any) => item.term));
		} catch (error) {
			console.error('Error fetching popular search terms:', error);
		} finally {
			setIsLoading(false);
		}
	};

	// Responsive styles
	useEffect(() => {
		const checkScreenSize = () => {
			setIsSmallScreen(
				window.innerWidth < parseInt(theme.breakpoints.md),
			);
		};

		// Initial check
		checkScreenSize();

		// Add listener for resize
		window.addEventListener('resize', checkScreenSize);

		// Cleanup
		return () => window.removeEventListener('resize', checkScreenSize);
	}, [theme.breakpoints.md]);

	// Apply responsive styles
	const containerStyle = mergeStyles(
		containerBaseStyle,
		hiddenStyle,
		isSmallScreen ? { width: '90vw' } : {},
	);

	// Close panel when Escape key is pressed
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isVisible) {
				onClose();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isVisible, onClose]);

	// Handle form submission
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (query.trim()) {
			onSearch(query.trim());
			onClose();
		}
	};

	const handlePopularTermClick = (term: string) => {
		setQuery(term);
		onSearch(term);
		onClose();
	};

	if (!isVisible) return null;

	return (
		<div style={containerStyle}>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					marginBottom: theme.spacing.md,
				}}
			>
				<h2
					style={{
						fontSize: '1.25rem',
						fontWeight: 'bold',
						color: theme.colors.accent,
					}}
				>
					Search Historical Events
				</h2>
				<button
					onClick={onClose}
					style={{
						background: 'transparent',
						border: 'none',
						fontSize: '1.5rem',
						cursor: 'pointer',
						padding: theme.spacing.xs,
						color: theme.colors.foreground,
					}}
					aria-label="Close search panel"
				>
					×
				</button>
			</div>

			<form onSubmit={handleSubmit}>
				<label style={labelStyle}>
					<span>Search term:</span>
					<input
						type="text"
						value={query}
						onChange={e => setQuery(e.target.value)}
						placeholder="e.g. World War II, Ancient Egypt"
						style={mergeStyles(
							{ padding: theme.spacing.md },
							getComponentStyle({}, 'input', ''),
						)}
						autoFocus
					/>
				</label>

				{/* Popular search terms section */}
				{popularTerms.length > 0 && (
					<div style={{ marginTop: theme.spacing.md }}>
						<h3
							style={{
								fontSize: '0.9rem',
								marginBottom: theme.spacing.sm,
								color: theme.colors.mutedText,
							}}
						>
							Popular searches:
						</h3>
						<div
							style={{
								display: 'flex',
								flexWrap: 'wrap',
								gap: theme.spacing.sm,
							}}
						>
							{popularTerms.map((term, index) => (
								<button
									key={index}
									type="button"
									onClick={() => handlePopularTermClick(term)}
									style={{
										backgroundColor:
											theme.colors.background,
										border: `1px solid ${theme.colors.border}`,
										borderRadius: theme.borderRadius.sm,
										padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
										fontSize: '0.9rem',
										cursor: 'pointer',
										color: theme.colors.accent,
										transition: 'all 0.2s ease',
										':hover': {
											backgroundColor:
												theme.colors.accentBackground,
										},
									}}
								>
									{term}
								</button>
							))}
						</div>
					</div>
				)}

				<div
					style={{
						display: 'flex',
						gap: theme.spacing.sm,
						marginTop: theme.spacing.lg,
						justifyContent: 'flex-end',
					}}
				>
					<StyledButton
						type="button"
						variant="outlined"
						onClick={onClose}
					>
						Cancel
					</StyledButton>
					<StyledButton type="submit" disabled={!query.trim()}>
						Search
					</StyledButton>
				</div>
			</form>
		</div>
	);
};

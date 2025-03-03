'use client';

import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	useMemo,
	ReactNode,
} from 'react';
import { Theme } from '@/app/styles';
import { useThemeStyles } from '@/utils/styleUtils';

// Context type definition
interface ThemeContextType {
	isDarkMode: boolean;
	toggleDarkMode: () => void;
	theme: Theme;
}

// Create the context with a default value
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider component
interface ThemeProviderProps {
	children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
	// Initialize dark mode based on system preference
	const [isDarkMode, setIsDarkMode] = useState(false);

	// Get theme styles based on current mode
	const { theme } = useThemeStyles(isDarkMode);

	// Toggle between dark and light mode
	const toggleDarkMode = () => {
		setIsDarkMode(prev => !prev);
		localStorage.setItem('darkMode', (!isDarkMode).toString());
	};

	// Apply theme based on system preference or stored preference
	useEffect(() => {
		// Check for stored preference
		const storedDarkMode = localStorage.getItem('darkMode');

		if (storedDarkMode !== null) {
			setIsDarkMode(storedDarkMode === 'true');
		} else {
			// Check system preference
			const prefersDarkMode = window.matchMedia(
				'(prefers-color-scheme: dark)',
			).matches;
			setIsDarkMode(prefersDarkMode);
		}

		// Listen for system preference changes
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = (e: MediaQueryListEvent) => {
			// Only apply if user hasn't set a preference
			if (localStorage.getItem('darkMode') === null) {
				setIsDarkMode(e.matches);
			}
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, []);

	// Apply dark mode class to html element
	useEffect(() => {
		if (isDarkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}, [isDarkMode]);

	// Memoize context value to prevent unnecessary re-renders
	const contextValue = useMemo(
		() => ({
			isDarkMode,
			toggleDarkMode,
			theme,
		}),
		[isDarkMode, theme],
	);

	return (
		<ThemeContext.Provider value={contextValue}>
			{children}
		</ThemeContext.Provider>
	);
};

// Custom hook to use the theme context
export const useTheme = () => {
	const context = useContext(ThemeContext);

	if (context === undefined) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}

	return context;
};
